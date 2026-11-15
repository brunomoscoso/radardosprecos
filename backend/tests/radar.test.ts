// Testa as regras e operações do sistema usando bancos SQLite temporários.
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { connectDB, withDB } from '../src/config/database';
import { initDatabase } from '../src/config/initDatabase';
import { productsToSearch, basketReplacements } from '../src/scrapers/config/products';
import { findAllProducts } from '../src/services/productService';
import { findAllMarkets } from '../src/services/marketService';
import { getBasket, saveBasket } from '../src/services/basketService';
import { compareBasket } from '../src/services/compareService';
import { findAllPrices } from '../src/services/priceService';
import { finishCollection, saveScrapedData, startCollection } from '../src/services/scraperPersistenceService';
import { CollectionBusyError, getCollections, recoverInterruptedRuns, runCollection, ScheduleAlreadyRunError } from '../src/services/collectionService';
import { scheduleConfig, scheduledKey } from '../src/services/schedulerService';
import { Scraper, chooseOffer } from '../src/scrapers/markets/shared';
import { scrapeMercadoB } from '../src/scrapers/markets/mercadoB.scraper';
import { matchesProduct, packageQuantity, parsePrice } from '../src/scrapers/helpers/normalizeProductData';
import { app } from '../src/app';

let directory: string;
beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'radar-test-'));
    process.env.DATABASE_PATH = path.join(directory, 'test.sqlite');
    delete process.env.SCRAPE_TIMES;
    delete process.env.SCRAPE_TIMEZONE;
    delete process.env.PRICE_MAX_AGE_HOURS;
    delete process.env.PINGO_DOCE_POSTAL_CODE;
    await initDatabase();
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
const fake: Scraper = async (products, save) => {
    for (const product of products) await save({ productId: product.id, productName: product.name, productUrl: 'https://example.test/product', price: 1.1, quantity: '1000g' });
};
const fail: Scraper = async () => { throw new Error('Falha simulada do site'); };
const adapters = { continente: fake, 'pingo-doce': fake };
async function select(count = 2) { const p = (await findAllProducts()).slice(0, count); await saveBasket(p.map(x => x.id)); return p; }

test('farinha sem fermento substitui seleção ambígua sem apagar registros antigos', async () => {
    const oldId = await withDB(async db => {
        const result = await db.run("INSERT INTO produtos(nome,cesta_basica) VALUES('Farinha Branca de Trigo 1kg',1)");
        await db.run('INSERT INTO cesta(produto_id) VALUES(?)', result.lastID);
        return result.lastID;
    });
    await initDatabase(); await initDatabase();
    assert.deepEqual((await getBasket()).map(p => p.name), ['Farinha de Trigo T55 sem Fermento 1kg']);
    assert.equal((await withDB(db => db.get('SELECT cesta_basica FROM produtos WHERE id=?', oldId))).cesta_basica, 0);
});

test('catálogo específico migra a seleção sem atribuir preços antigos aos novos produtos', async () => {
    await withDB(async db => {
        for (const name of Object.keys(basketReplacements)) {
            const result = await db.run('INSERT INTO produtos(nome,cesta_basica) VALUES(?,1)', name);
            await db.run('INSERT INTO cesta(produto_id) VALUES(?)', result.lastID);
        }
    });
    await initDatabase(); await initDatabase();
    assert.deepEqual((await getBasket()).map(p => p.name).sort(), [...new Set(Object.values(basketReplacements))].sort());
    assert.equal((await findAllProducts()).filter(p => p.basketOption).length, productsToSearch.length);
    await saveBasket([]); await initDatabase();
    assert.deepEqual(await getBasket(), []);
});

test('views mostram cesta sem preços e resultados sem duplicar histórico', async () => {
    await select(2);
    const before = await withDB(db => db.all('SELECT * FROM cesta_precos'));
    assert.equal(before.length, 4);
    assert.ok(before.every(r => r.preco === null));
    await runCollection('teste', undefined, adapters);
    assert.equal((await withDB(db => db.all('SELECT * FROM cesta_precos WHERE preco IS NOT NULL'))).length, 4);
    assert.equal((await withDB(db => db.all('SELECT * FROM ultimas_consultas'))).length, 4);
    await runCollection('teste', undefined, adapters);
    await initDatabase();
    assert.equal((await withDB(db => db.get('SELECT COUNT(*) n FROM precos'))).n, 8);
    assert.equal((await withDB(db => db.get('SELECT COUNT(*) n FROM ultimos_precos'))).n, 4);
    assert.equal((await withDB(db => db.get('SELECT COUNT(*) n FROM ultimas_consultas'))).n, 4);
});

test('remove colunas obsoletas vazias e preserva valores de bancos antigos', async () => {
    await withDB(async db => {
        await db.exec('ALTER TABLE mercados ADD COLUMN cidade TEXT; ALTER TABLE precos ADD COLUMN preco_original REAL;');
    });
    await initDatabase();
    assert.equal((await withDB(db => db.all('PRAGMA table_info(mercados)'))).some(c => c.name === 'cidade'), false);
    assert.equal((await withDB(db => db.all('PRAGMA table_info(precos)'))).some(c => c.name === 'preco_original'), false);
    await withDB(async db => {
        await db.exec('ALTER TABLE mercados ADD COLUMN cidade TEXT;');
        await db.run("UPDATE mercados SET cidade='Lisboa'");
    });
    await initDatabase();
    assert.equal((await withDB(db => db.get('SELECT cidade FROM mercados LIMIT 1'))).cidade, 'Lisboa');
});

test('migração idempotente e catálogo reutilizado', async () => {
    await initDatabase();
    assert.equal((await findAllMarkets()).length, 2);
    assert.deepEqual((await findAllProducts()).map(p => p.name).sort(), [...productsToSearch].sort());
    assert.equal((await findAllProducts()).every(p => p.basketOption === 1), true);
    assert.deepEqual(await getBasket(), []);
});

test('migração preserva registros legados e não associa mercado órfão ao seed', async () => {
    process.env.DATABASE_PATH = path.join(directory, 'legacy.sqlite');
    const db = await connectDB();
    await db.exec(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE mercados(id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,site TEXT,cidade TEXT);
        CREATE TABLE produtos(id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,categoria TEXT,descricao TEXT);
        CREATE TABLE coletas(id INTEGER PRIMARY KEY AUTOINCREMENT,data_coleta DATETIME DEFAULT CURRENT_TIMESTAMP,origem TEXT,status TEXT);
        CREATE TABLE precos(id INTEGER PRIMARY KEY AUTOINCREMENT,produto_id INTEGER NOT NULL,mercado_id INTEGER NOT NULL,coleta_id INTEGER NOT NULL,preco REAL NOT NULL,preco_original REAL,link_produto TEXT,disponivel INTEGER DEFAULT 1,data_registro DATETIME DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO produtos(id,nome) VALUES(42,'Produto legado');
        INSERT INTO coletas(id,origem,status) VALUES(17,'antigo','sucesso');
        INSERT INTO precos(produto_id,mercado_id,coleta_id,preco) VALUES(42,10,17,2.5);
    `);
    await db.close();
    await initDatabase(); await initDatabase();
    assert.equal((await withDB(d => d.get('SELECT COUNT(*) n FROM precos'))).n, 1);
    assert.equal((await withDB(d => d.get('SELECT preco FROM precos'))).preco, 2.5);
    assert.equal((await withDB(d => d.get('SELECT COUNT(*) n FROM coletas'))).n, 1);
    assert.ok((await findAllMarkets()).every(m => m.id > 10));
    assert.deepEqual(await findAllPrices(), []);
});

test('cesta persiste após reabrir banco e aceita limpar sem reativar no reinício', async () => {
    const products = await select();
    await initDatabase();
    assert.deepEqual((await getBasket()).map(p => p.id), products.map(p => p.id).sort((a,b) => a-b));
    await saveBasket([]); await initDatabase();
    assert.deepEqual(await getBasket(), []);
});

test('preço legado é exibido pela origem e busca originais, mesmo após falha, sem alterar o histórico', async () => {
    const rice = (await findAllProducts()).find(p => p.name === 'Arroz Agulha 1kg')!;
    await saveBasket([rice.id]);
    await withDB(async db => {
        await db.exec('PRAGMA foreign_keys=OFF');
        await db.run("INSERT INTO produtos(id,nome,descricao) VALUES(900,'Arroz Agulha Marca antiga',?)", rice.name);
        await db.run("INSERT INTO coletas(id,data_coleta,origem,status) VALUES(800,'2001-01-01T12:00:00Z','scraper_mercado_a','sucesso')");
        await db.run("INSERT INTO precos(produto_id,mercado_id,coleta_id,preco,data_registro) VALUES(900,777,800,1.38,'2001-01-01 12:00:01')");
    });
    const before = await withDB(db => db.all('SELECT * FROM precos'));
    let comparison = await compareBasket();
    let market = comparison.markets.find(m => m.scraperKey === 'continente')!;
    assert.equal(market.items[0].price?.price, 1.38);
    assert.equal(market.items[0].price?.matchedName, 'Arroz Agulha Marca antiga');
    assert.equal(market.items[0].price?.productId, rice.id);
    assert.equal(market.items[0].price?.sourceProductId, 900);
    assert.equal(market.items[0].price?.sourceMarketId, 777);
    assert.equal(market.items[0].price?.productUrl, null);
    assert.equal(market.items[0].price?.collectedAt, '2001-01-01T12:00:01.000Z');
    assert.equal(market.items[0].price?.legacy, 1);
    assert.equal(market.total, null);
    assert.equal(market.savedSubtotal, 1.38);
    assert.match(market.items[0].priceWarning!, /histórico/);
    assert.deepEqual(comparison.cheapestMarketIds, []);
    assert.equal(comparison.markets.find(m => m.scraperKey === 'pingo-doce')!.items[0].price, null);

    await runCollection('teste', undefined, { continente: fail, 'pingo-doce': fail });
    comparison = await compareBasket();
    market = comparison.markets.find(m => m.scraperKey === 'continente')!;
    assert.equal(market.items[0].price?.price, 1.38);
    assert.match(market.items[0].lastCollectionError!, /Falha simulada/);
    assert.equal(market.items[0].usable, false);
    assert.deepEqual(await withDB(db => db.all('SELECT * FROM precos')), before);

    await runCollection('teste', undefined, adapters);
    market = (await compareBasket()).markets.find(m => m.scraperKey === 'continente')!;
    assert.equal(market.items[0].price?.price, 1.1);
    assert.equal(market.items[0].price?.legacy, 0);
    assert.equal(market.items[0].usable, true);
});

test('busca antiga diferente não é associada por semelhança à cesta', async () => {
    const rice = (await findAllProducts()).find(p => p.name === 'Arroz Agulha 1kg')!;
    await saveBasket([rice.id]);
    await withDB(async db => {
        await db.exec('PRAGMA foreign_keys=OFF');
        await db.run("INSERT INTO produtos(id,nome,descricao) VALUES(900,'Arroz Agulha Marca antiga','Arroz Agulha 5kg')");
        await db.run("INSERT INTO coletas(id,origem,status) VALUES(800,'scraper_mercado_a','sucesso')");
        await db.run('INSERT INTO precos(produto_id,mercado_id,coleta_id,preco) VALUES(900,777,800,1.38)');
    });
    const comparison = await compareBasket();
    assert.equal(comparison.markets.find(m => m.scraperKey === 'continente')!.items[0].price, null);
    assert.deepEqual(comparison.cheapestMarketIds, []);
});

test('IDs inválidos não alteram a cesta salva', async () => {
    const products = await select(1);
    for (const ids of [null, {}, ['1'], [0], [-1], [1.5], [99999], [products[0].id, products[0].id], [products[0].id, 99999]]) {
        await assert.rejects(saveBasket(ids));
        assert.equal((await getBasket()).length, 1);
    }
});

test('histórico acumula, consultas retornam o último preço e somas usam centavos', async () => {
    await select();
    await runCollection('teste', undefined, adapters);
    await runCollection('teste', undefined, { ...adapters, continente: async (products, save) => {
        for (let i=0; i<products.length; i++) await save({ productId: products[i].id, productName: products[i].name, productUrl: 'https://example.test/offer', price: i ? .2 : .1, quantity: '1000g' });
    } });
    assert.equal((await withDB(db => db.get('SELECT COUNT(*) n FROM precos'))).n, 8);
    assert.equal((await findAllPrices()).length, 4);
    const comparison = await compareBasket();
    assert.equal(comparison.comparable, true);
    const continente = comparison.markets.find(m => m.scraperKey === 'continente')!;
    assert.equal(continente.total, .3);
    assert.deepEqual(comparison.cheapestMarketIds, [continente.id]);
});

test('empate retorna os dois mercados; cesta vazia não tem vencedor', async () => {
    await select(); await runCollection('teste', undefined, adapters);
    assert.equal((await compareBasket()).cheapestMarketIds.length, 2);
    await saveBasket([]);
    const result = await compareBasket();
    assert.equal(result.comparable, false); assert.deepEqual(result.cheapestMarketIds, []);
    await assert.rejects(runCollection('teste', undefined, adapters), /Selecione/);
});

test('falha recente mantém histórico mas exclui preço anterior e mostra erro', async () => {
    await select(); await runCollection('teste', undefined, adapters);
    const result = await runCollection('teste', undefined, { ...adapters, 'pingo-doce': fail });
    assert.equal(result.status, 'parcial');
    const comparison = await compareBasket();
    const market = comparison.markets.find(m => m.scraperKey === 'pingo-doce')!;
    assert.equal(market.total, null); assert.equal(market.missingProducts.length, 2);
    assert.ok(market.items.every(i => i.price && !i.usable && i.error?.includes('Falha simulada')));
    assert.deepEqual(comparison.cheapestMarketIds, []);
    assert.equal((await withDB(db => db.get('SELECT COUNT(*) n FROM precos'))).n, 6);
});

test('ausência parcial, nenhum preço e preços vencidos nunca vencem', async () => {
    await select();
    const partial: Scraper = async (products, save, reject) => { await fake([products[0]], save, reject); await reject(products[1].id, 'Sem oferta'); };
    await runCollection('teste', undefined, { continente: partial, 'pingo-doce': fail });
    let result = await compareBasket();
    assert.equal(result.markets[0].total, null); assert.deepEqual(result.cheapestMarketIds, []);
    await runCollection('teste', undefined, adapters);
    result = await compareBasket(Date.now() + 37 * 3600000);
    assert.ok(result.markets.every(m => m.total === null));
    assert.deepEqual(result.cheapestMarketIds, []);
});

test('embalagens incompatíveis impedem vencedor', async () => {
    await select();
    await runCollection('teste', undefined, { ...adapters, 'pingo-doce': async (products, save) => {
        for (const p of products) await save({ productId: p.id, productName: p.name, productUrl: 'https://example.test/p', price: .5, quantity: '500g' });
    } });
    const result = await compareBasket();
    assert.equal(result.incompatibleProducts.length, 2); assert.equal(result.comparable, false);
    assert.deepEqual(result.cheapestMarketIds, []);
});

test('coleta sem resultados não reporta sucesso falso', async () => {
    await select();
    const empty: Scraper = async () => {};
    assert.equal((await runCollection('teste', undefined, { continente: empty, 'pingo-doce': empty })).status, 'erro');
    const data = await getCollections();
    assert.ok(data.results.every(r => r.status === 'erro'));
});

test('lock persistente impede sobreposição e schedule_key impede repetição', async () => {
    await select(1);
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const slow: Scraper = async (products, save, reject) => { entered(); await gate; await fake(products, save, reject); };
    const first = runCollection('teste', 'slot-test', { ...adapters, continente: slow });
    await started;
    try { await assert.rejects(runCollection('manual', undefined, adapters), CollectionBusyError); }
    finally { release(); }
    assert.equal((await first).status, 'sucesso');
    await assert.rejects(runCollection('agendamento', 'slot-test', adapters), ScheduleAlreadyRunError);
    assert.equal((await getCollections()).runs.length, 1);
});

test('recupera execução de processo morto sem apagar histórico', async () => {
    const products = await select(1);
    await withDB(db => db.run("INSERT INTO execucoes(id,inicio,status,origem,pid,host) VALUES(1,?,'em_andamento','teste',2147483647,?)", new Date().toISOString(), os.hostname()));
    const collection = await startCollection(1, (await findAllMarkets())[0].id, [products[0].id]);
    await recoverInterruptedRuns();
    const result = await withDB(db => db.get('SELECT status,erro FROM coletas WHERE id=?', collection));
    assert.equal(result.status, 'erro'); assert.match(result.erro, /interrompida/);
});

test('persistência é atômica e rejeita preço inválido, produto alheio e duplicata', async () => {
    const products = await select(1);
    await withDB(db => db.run("INSERT INTO execucoes(id,inicio,status,origem,pid,host) VALUES(1,?,'em_andamento','teste',?,?)", new Date().toISOString(), process.pid, os.hostname()));
    const collection = await startCollection(1, (await findAllMarkets())[0].id, [products[0].id]);
    const offer = { productId: products[0].id, productName: 'Teste', productUrl: 'https://example.test/p', price: 1, quantity: '1000g' };
    await assert.rejects(saveScrapedData(collection, { ...offer, price: NaN }));
    await assert.rejects(saveScrapedData(collection, { ...offer, productId: 9999 }));
    assert.equal((await withDB(db => db.get('SELECT COUNT(*) n FROM precos'))).n, 0);
    await saveScrapedData(collection, offer);
    await assert.rejects(saveScrapedData(collection, offer));
    assert.equal(await finishCollection(collection), 'sucesso');
    assert.equal((await withDB(db => db.get('SELECT COUNT(*) n FROM precos'))).n, 1);
});

test('horários configuráveis respeitam Lisboa, verão/inverno e horário repetido', () => {
    const config = scheduleConfig();
    assert.deepEqual(config.times, ['08:00', '20:00']);
    assert.match(scheduledKey(new Date('2026-07-01T07:00:00Z'), config)!, /08:00$/);
    assert.match(scheduledKey(new Date('2026-01-01T08:00:00Z'), config)!, /08:00$/);
    assert.equal(scheduledKey(new Date('2026-01-01T07:59:00Z'), config), null);
    process.env.SCRAPE_TIMES='01:30,20:00';
    const dst = scheduleConfig();
    assert.equal(scheduledKey(new Date('2026-10-25T00:30:00Z'), dst), scheduledKey(new Date('2026-10-25T01:30:00Z'), dst));
    process.env.SCRAPE_TIMES='25:00,08:00'; assert.throws(scheduleConfig);
    process.env.SCRAPE_TIMES='08:00,08:00'; assert.throws(scheduleConfig);
    process.env.SCRAPE_TIMES='08:00,20:00'; process.env.SCRAPE_TIMEZONE='invalid'; assert.throws(scheduleConfig);
});

test('Pingo Doce sem configuração falha antes de enviar pedidos HTTP', async () => {
    await assert.rejects(scrapeMercadoB([], async () => {}, async () => {}), /PINGO_DOCE_POSTAL_CODE/);
    process.env.PINGO_DOCE_POSTAL_CODE='invalid';
    await assert.rejects(scrapeMercadoB([], async () => {}, async () => {}), /PINGO_DOCE_POSTAL_CODE/);
});

test('normalização não transforma ausência em zero e exige nome e embalagem', () => {
    assert.equal(parsePrice('1,23 €'), 1.23);
    assert.equal(parsePrice('1.234,56 €'), 1234.56);
    for (const value of [null, '', 'Grátis', '0,00 €', '1,23 €/kg', '1,20 € 2,30 €']) assert.throws(() => parsePrice(value));
    assert.equal(packageQuantity('emb. 1 kg'), '1000g');
    assert.equal(packageQuantity('1 L | 1,20 €/L'), '1000ml');
    assert.equal(packageQuantity('6 x 1 L'), null);
    assert.ok(matchesProduct('Arroz Agulha 1kg', 'Arroz Agulha Marca', '1 kg'));
    assert.equal(matchesProduct('Arroz Agulha 1kg', 'Arroz Basmati', '1 kg'), false);
    assert.equal(matchesProduct('Arroz Agulha 1kg', 'Arroz Agulha', '500 g'), false);
    assert.throws(() => chooseOffer({ id: 1, name: 'Arroz Agulha 1kg' }, [{ name: 'Arroz Agulha', price: '', quantity: '1 kg', url: 'https://example.test/p' }]));
});

test('API integra catálogo, cesta, preços, comparação, validação e conflito de coleta', async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const port = (server.address() as { port: number }).port;
    const request = (route: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${route}`, init);
    try {
        const catalog = await (await request('/products')).json() as any;
        assert.equal(catalog.success, true);
        let response = await request('/basket', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productIds: [catalog.data[0].id] }) });
        assert.equal(response.status, 200);
        response = await request('/basket', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"productIds":["bad"]}' });
        assert.equal(response.status, 400);
        assert.equal((await (await request('/basket')).json() as any).data.length, 1);
        response = await request('/basket', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
        assert.equal(response.status, 400);
        await runCollection('teste', undefined, adapters);
        assert.equal((await (await request('/prices')).json() as any).data.length, 2);
        assert.equal((await (await request('/compare/basket')).json() as any).data.comparable, true);
        await withDB(db => db.run("INSERT INTO execucoes(inicio,status,origem,pid,host) VALUES(?,'em_andamento','teste',?,?)", new Date().toISOString(), process.pid, os.hostname()));
        response = await request('/collections', { method: 'POST' });
        assert.equal(response.status, 409);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

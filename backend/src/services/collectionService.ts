import os from 'node:os';
import { withDB } from '../config/database';
import { getBasket, InputError } from './basketService';
import { findAllMarkets } from './marketService';
import { startCollection, saveScrapedData, failProduct, finishCollection } from './scraperPersistenceService';
import { scrapeMercadoA } from '../scrapers/markets/mercadoA.scraper';
import { scrapeMercadoB } from '../scrapers/markets/mercadoB.scraper';
import { Scraper } from '../scrapers/markets/shared';

// Orquestra coletas, impede execuções simultâneas e recupera execuções interrompidas.
export class CollectionBusyError extends Error { status = 409; }
export class ScheduleAlreadyRunError extends Error {}
const scrapers: Record<string, Scraper> = { continente: scrapeMercadoA, 'pingo-doce': scrapeMercadoB };
function isAlive(pid: number) {
    try { process.kill(pid, 0); return true; }
    catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
export async function recoverInterruptedRuns() {
    await withDB(async db => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            const running = await db.all<{ id: number; pid: number; host: string }[]>("SELECT id,pid,host FROM execucoes WHERE status='em_andamento'");
            for (const run of running) {
                if (run.host !== os.hostname() || isAlive(run.pid)) continue;
                const message = 'Execução interrompida: processo anterior terminou.';
                await db.run("UPDATE coleta_resultados SET status='erro',erro=? WHERE status='em_andamento' AND coleta_id IN (SELECT id FROM coletas WHERE execucao_id=?)", message, run.id);
                await db.run("UPDATE coletas SET status='erro',erro=?,finalizada_em=? WHERE execucao_id=? AND status='em_andamento'", message, new Date().toISOString(), run.id);
                await db.run("UPDATE execucoes SET status='erro',erro=?,fim=? WHERE id=?", message, new Date().toISOString(), run.id);
            }
            await db.exec('COMMIT');
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
    });
}
export async function runCollection(origin = 'manual', scheduleKey?: string, adapters = scrapers) {
    await recoverInterruptedRuns();
    const products = await getBasket();
    if (!products.length) throw new InputError('Selecione e salve pelo menos um produto antes de coletar.');
    const runId = await withDB(async db => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            if (await db.get("SELECT id FROM execucoes WHERE status='em_andamento'")) throw new CollectionBusyError('Já existe uma coleta em andamento.');
            if (scheduleKey && await db.get('SELECT id FROM execucoes WHERE schedule_key=?', scheduleKey)) throw new ScheduleAlreadyRunError('Horário já executado.');
            const result = await db.run("INSERT INTO execucoes(inicio,status,origem,schedule_key,pid,host) VALUES(?,'em_andamento',?,?,?,?)",
                new Date().toISOString(), origin, scheduleKey || null, process.pid, os.hostname());
            await db.exec('COMMIT');
            return result.lastID!;
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
    });
    const collections: { id: number; key: string }[] = [];
    let status = 'erro', fatalError: string | null = null;
    try {
        const markets = (await findAllMarkets()).filter(m => m.scraperKey);
        for (const market of markets) collections.push({ id: await startCollection(runId, market.id, products.map(p => p.id)), key: market.scraperKey! });
        const statuses: string[] = [];
        for (const collection of collections) {
            let error: string | undefined;
            try {
                const scrape = adapters[collection.key];
                if (!scrape) throw new Error('Scraper não disponível para este mercado.');
                await scrape(products, data => saveScrapedData(collection.id, data), (id, message) => failProduct(collection.id, id, message));
            } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
            statuses.push(await finishCollection(collection.id, error));
        }
        status = statuses.length && statuses.every(s => s === 'sucesso') ? 'sucesso' : statuses.some(s => s === 'sucesso' || s === 'parcial') ? 'parcial' : 'erro';
    } catch (error) {
        fatalError = error instanceof Error ? error.message : String(error);
        for (const collection of collections) await finishCollection(collection.id, fatalError).catch(() => {});
    } finally {
        await withDB(db => db.run('UPDATE execucoes SET status=?,erro=?,fim=? WHERE id=?', status, fatalError, new Date().toISOString(), runId));
    }
    return { id: runId, status, error: fatalError };
}
export async function getCollections() {
    return withDB(async db => ({
        runs: await db.all('SELECT id,inicio startedAt,fim finishedAt,status,origem origin,erro error FROM execucoes ORDER BY id DESC LIMIT 20'),
        results: await db.all(`SELECT c.id collectionId,c.execucao_id runId,c.mercado_id marketId,m.nome marketName,c.status collectionStatus,
            c.data_coleta collectedAt,c.erro collectionError,r.produto_id productId,p.nome productName,r.status,r.erro error
            FROM coletas c JOIN mercados m ON m.id=c.mercado_id
            LEFT JOIN coleta_resultados r ON r.coleta_id=c.id LEFT JOIN produtos p ON p.id=r.produto_id
            WHERE c.execucao_id=(SELECT MAX(id) FROM execucoes) ORDER BY c.id,r.produto_id`),
    }));
}

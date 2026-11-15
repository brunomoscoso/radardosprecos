import { DatabaseConnection } from './database';
import { productsToSearch, basketReplacements } from '../scrapers/config/products';

// Refresh the catalogue and transfer selections without deleting price history.
export async function seedDatabase(db: DatabaseConnection) {
    // Do not accidentally attach orphan legacy prices to a newly seeded market.
    const max = await db.get<{ id: number }>('SELECT COALESCE(MAX(mercado_id),0) id FROM precos');
    await db.run("INSERT INTO sqlite_sequence(name,seq) SELECT 'mercados', ? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='mercados')", max!.id);
    await db.run("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name='mercados'", max!.id);
    for (const [key, name, website] of [
        ['continente', 'Continente', 'https://www.continente.pt/'],
        ['pingo-doce', 'Pingo Doce', 'https://www.pingodoce.pt/'],
    ]) {
        const existing = await db.get('SELECT id FROM mercados WHERE scraper_key = ? OR (lower(nome) = lower(?) AND scraper_key IS NULL) ORDER BY id LIMIT 1', key, name);
        if (existing) await db.run('UPDATE mercados SET scraper_key = ? WHERE id = ?', key, existing.id);
        else await db.run('INSERT INTO mercados(nome,site,scraper_key) VALUES(?,?,?)', name, website, key);
    }
    for (const name of productsToSearch) {
        const existing = await db.get('SELECT id FROM produtos WHERE nome = ? ORDER BY id LIMIT 1', name);
        if (existing) await db.run('UPDATE produtos SET cesta_basica = 1 WHERE id = ?', existing.id);
        else await db.run("INSERT INTO produtos(nome,categoria,cesta_basica) VALUES(?,'Cesta básica',1)", name);
    }
    for (const [previous, next] of Object.entries(basketReplacements)) {
        const target = await db.get('SELECT id FROM produtos WHERE nome=? ORDER BY id LIMIT 1', next);
        await db.run('INSERT OR IGNORE INTO cesta(produto_id) SELECT ? WHERE EXISTS (SELECT 1 FROM cesta b JOIN produtos p ON p.id=b.produto_id WHERE p.nome=?)', target.id, previous);
        await db.run('DELETE FROM cesta WHERE produto_id IN (SELECT id FROM produtos WHERE nome=?)', previous);
        await db.run('UPDATE produtos SET cesta_basica=0 WHERE nome=?', previous);
    }
}

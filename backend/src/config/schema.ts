import { DatabaseConnection } from './database';

// Schema upgrades retain existing tables, identifiers and historical records.
export async function migrateSchema(db: DatabaseConnection) {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS mercados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        site TEXT
        );
    `);

    await db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        categoria TEXT,
        descricao TEXT
        );
    `);

    await db.exec(`
    CREATE TABLE IF NOT EXISTS coletas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_coleta DATETIME DEFAULT CURRENT_TIMESTAMP,
        origem TEXT,
        status TEXT
        );
    `);

    await db.exec(`
    CREATE TABLE IF NOT EXISTS precos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_id INTEGER NOT NULL,
        mercado_id INTEGER NOT NULL,
        coleta_id INTEGER NOT NULL,
        preco REAL NOT NULL,
        link_produto TEXT,
        disponivel INTEGER DEFAULT 1,
        data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produto_id) REFERENCES produtos(id),
        FOREIGN KEY (mercado_id) REFERENCES mercados(id),
        FOREIGN KEY (coleta_id) REFERENCES coletas(id)
        );
    `);

    // Remove unused fields only when no existing information would be lost.
    for (const [table, column] of [['mercados', 'cidade'], ['precos', 'preco_original']]) {
        const columns = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
        if (columns.some(c => c.name === column)) {
            const populated = await db.get<{ total: number }>(`SELECT COUNT(*) total FROM ${table} WHERE ${column} IS NOT NULL`);
            if (populated?.total === 0) await db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        }
    }
    // Existing prices and collections remain untouched.
    const addColumn = async (table: string, name: string, definition: string) => {
        const columns = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
        if (!columns.some(column => column.name === name)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    };
    await addColumn('mercados', 'scraper_key', 'TEXT');
    await addColumn('produtos', 'cesta_basica', 'INTEGER NOT NULL DEFAULT 0');
    await addColumn('coletas', 'mercado_id', 'INTEGER REFERENCES mercados(id)');
    await addColumn('coletas', 'execucao_id', 'INTEGER REFERENCES execucoes(id)');
    await addColumn('coletas', 'erro', 'TEXT');
    await addColumn('coletas', 'finalizada_em', 'TEXT');
    await addColumn('precos', 'nome_encontrado', 'TEXT');
    await addColumn('precos', 'quantidade', 'TEXT');
    await db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS mercados_scraper_key ON mercados(scraper_key);
        CREATE TABLE IF NOT EXISTS cesta (produto_id INTEGER PRIMARY KEY REFERENCES produtos(id));
        CREATE TABLE IF NOT EXISTS execucoes (
            id INTEGER PRIMARY KEY, inicio TEXT NOT NULL, fim TEXT, status TEXT NOT NULL,
            origem TEXT NOT NULL, schedule_key TEXT UNIQUE, pid INTEGER NOT NULL, host TEXT NOT NULL, erro TEXT
        );
        CREATE TABLE IF NOT EXISTS coleta_resultados (
            coleta_id INTEGER NOT NULL REFERENCES coletas(id), produto_id INTEGER NOT NULL REFERENCES produtos(id),
            status TEXT NOT NULL, erro TEXT, PRIMARY KEY(coleta_id, produto_id)
        );
        CREATE INDEX IF NOT EXISTS precos_produto_mercado ON precos(produto_id, mercado_id, data_registro DESC, id DESC);
    `);

    await db.exec(`CREATE VIEW IF NOT EXISTS ultimos_precos AS WITH resolved AS (
        SELECT p.id, COALESCE(target.id, pr.id) productId, p.coleta_id collectionId,
            COALESCE(target.nome, pr.nome) productName,
            COALESCE(m.id, legacy_market.id) marketId, COALESCE(m.nome, legacy_market.nome) marketName,
            p.preco price, p.link_produto productUrl,
            strftime('%Y-%m-%dT%H:%M:%fZ', p.data_registro) collectedAt,
            COALESCE(p.nome_encontrado, pr.nome) matchedName, p.quantidade quantity,
            CASE WHEN c.origem='scraper_mercado_a' AND c.execucao_id IS NULL THEN 1 ELSE 0 END legacy,
            p.produto_id sourceProductId, p.mercado_id sourceMarketId
        FROM precos p JOIN produtos pr ON pr.id=p.produto_id
        LEFT JOIN coletas c ON c.id=p.coleta_id
        LEFT JOIN mercados m ON m.id=p.mercado_id
        LEFT JOIN mercados legacy_market ON m.id IS NULL AND c.mercado_id IS NULL
            AND c.origem='scraper_mercado_a' AND c.execucao_id IS NULL
            AND legacy_market.scraper_key='continente'
        LEFT JOIN produtos target ON c.origem='scraper_mercado_a' AND c.execucao_id IS NULL
            AND (m.scraper_key='continente' OR legacy_market.id IS NOT NULL)
            AND pr.cesta_basica=0 AND target.cesta_basica=1 AND target.nome=pr.descricao
        WHERE p.disponivel=1 AND p.preco>0 AND COALESCE(m.id, legacy_market.id) IS NOT NULL
    ), ranked AS (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY productId,marketId ORDER BY julianday(collectedAt) DESC,id DESC) rn
        FROM resolved
    ) SELECT id, productId, collectionId, productName, marketId, marketName, price, productUrl,
        collectedAt, matchedName, quantity, legacy, sourceProductId, sourceMarketId
        FROM ranked WHERE rn=1 ORDER BY productId,marketId`);
    await db.exec(`DROP VIEW IF EXISTS cesta_precos`);
    await db.exec(`CREATE VIEW cesta_precos AS
        SELECT p.id produto_id, p.nome produto, m.id mercado_id, m.nome mercado,
            u.price preco, u.quantity embalagem, u.matchedName oferta, u.collectedAt data_preco,
            u.productUrl link_produto, u.legacy historico_legado
        FROM produtos p
        CROSS JOIN mercados m
        LEFT JOIN ultimos_precos u ON u.productId=p.id AND u.marketId=m.id
        WHERE p.cesta_basica=1 AND m.scraper_key IN ('continente','pingo-doce')`);
    await db.exec(`CREATE VIEW IF NOT EXISTS ultimas_consultas AS
        SELECT * FROM (
            SELECT p.nome produto, m.nome mercado, c.data_coleta consultado_em,
                r.status, r.erro, ROW_NUMBER() OVER (
                    PARTITION BY r.produto_id,c.mercado_id ORDER BY julianday(c.data_coleta) DESC,c.id DESC
                ) ordem
            FROM coleta_resultados r JOIN coletas c ON c.id=r.coleta_id
            JOIN produtos p ON p.id=r.produto_id JOIN mercados m ON m.id=c.mercado_id
        ) WHERE ordem=1`);
}

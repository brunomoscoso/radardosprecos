import { connectDB } from "./database";

export async function initDatabase() {
    const db = await connectDB();

    await db.exec(`
    CREATE TABLE IF NOT EXISTS mercados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        site TEXT,
        cidade TEXT
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
        preco_original REAL,
        link_produto TEXT,
        disponivel INTEGER DEFAULT 1,
        data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produto_id) REFERENCES produtos(id),
        FOREIGN KEY (mercado_id) REFERENCES mercados(id),
        FOREIGN KEY (coleta_id) REFERENCES coletas(id)
        );
    `);

    console.log("Banco de dados inicializado com sucesso.");
}
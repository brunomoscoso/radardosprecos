// Abre conexões com o SQLite e garante seu fechamento após cada operação.
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

export async function connectDB() {
    const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, "../../database/database.sqlite");
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });
    await db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    return db;
}

export type DatabaseConnection = Awaited<ReturnType<typeof connectDB>>;

export async function withDB<T>(work: (db: DatabaseConnection) => Promise<T>): Promise<T> {
    const db = await connectDB();
    try { return await work(db); } finally { await db.close(); }
}

import { connectDB } from "../config/database";
import { Market } from "../types/Market";

export async function findAllMarkets(): Promise<Market[]> {
    const db = await connectDB();

    const markets = await db.all<Market[]>(`
        SELECT * FROM mercados
    `);

    return markets;
}

export async function findMarketById(id: number): Promise<Market | undefined> {
    const db = await connectDB();

    const market = await db.get<Market>(
        `SELECT * FROM mercados WHERE id = ?`,
        [id]
    );

    return market;
}

export async function createMarket(data: Omit<Market, "id">): Promise<Market> {
    const db = await connectDB();

    const result = await db.run(
        `INSERT INTO mercados (nome, site, cidade) VALUES (?, ?, ?)`,
        [data.name, data.website ?? null, data.city ?? null]
    );

    const newMarket = await db.get<Market>(
        `SELECT * FROM mercados WHERE id = ?`,
        [result.lastID]
    );

    return newMarket as Market;
}
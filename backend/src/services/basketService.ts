import { withDB, DatabaseConnection } from '../config/database';
import { Product } from '../types/Product';

// Lê e atualiza no SQLite a seleção persistente de produtos da cesta.
export class InputError extends Error { status = 400; }
export async function getBasket(connection?: DatabaseConnection): Promise<Product[]> {
    const query = (db: DatabaseConnection) => db.all<Product[]>(`SELECT p.id, p.nome name, p.categoria category, p.descricao description
        FROM cesta c JOIN produtos p ON p.id=c.produto_id ORDER BY p.id`);
    return connection ? query(connection) : withDB(query);
}
export async function saveBasket(productIds: unknown): Promise<Product[]> {
    if (!Array.isArray(productIds) || productIds.length > 100 || productIds.some(id => !Number.isSafeInteger(id) || id <= 0)
        || new Set(productIds).size !== productIds.length) throw new InputError('productIds deve ser uma lista de até 100 IDs inteiros positivos, sem duplicados.');
    await withDB(async db => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            for (const id of productIds) {
                if (!await db.get('SELECT id FROM produtos WHERE id=?', id)) throw new InputError(`Produto desconhecido: ${id}`);
            }
            await db.run('DELETE FROM cesta');
            for (const id of productIds) await db.run('INSERT INTO cesta(produto_id) VALUES(?)', id);
            await db.exec('COMMIT');
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
    });
    return getBasket();
}

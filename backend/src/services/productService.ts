import { withDB } from "../config/database";
import { Product } from "../types/Product";

// Consulta e mantém o catálogo de produtos armazenado no SQLite.
export async function findAllProducts(): Promise<Product[]> {
    return withDB(async db => {

        const products = await db.all<Product[]>(`
            SELECT
                id,
                nome AS name,
                categoria AS category,
                descricao AS description, cesta_basica AS basketOption
            FROM produtos
            ORDER BY nome ASC
        `);

        return products;
    });
}


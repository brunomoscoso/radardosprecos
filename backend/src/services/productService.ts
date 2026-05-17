import { connectDB } from "../config/database";
import { Product } from "../types/Product";

export async function findAllProducts(): Promise<Product[]> {
    const db = await connectDB();

    const products = await db.all<Product[]>(`
        SELECT
            id,
            nome AS name,
            categoria AS category,
            descricao AS description
        FROM produtos
        ORDER BY nome ASC
    `);

    return products;
}

export async function findProductById(id: number): Promise<Product | undefined> {
    const db = await connectDB();

    const product = await db.get<Product>(
        `
        SELECT
            id,
            nome AS name,
            categoria AS category,
            descricao AS description
        FROM produtos
        WHERE id = ?
        `,
        [id]
    );

    return product;
}

export async function findProductByName(name: string): Promise<Product | undefined> {
    const db = await connectDB();

    const product = await db.get<Product>(
        `
        SELECT
            id,
            nome AS name,
            categoria AS category,
            descricao AS description
        FROM produtos
        WHERE LOWER(nome) = LOWER(?)
        `,
        [name]
    );

    return product;
}

export async function createNewProduct(data: {
    name: string;
    category?: string | null;
    description?: string | null;
}): Promise<Product> {
    const db = await connectDB();

    const result = await db.run(
        `
        INSERT INTO produtos (nome, categoria, descricao)
        VALUES (?, ?, ?)
        `,
        [data.name, data.category ?? null, data.description ?? null]
    );

    const newProduct = await db.get<Product>(
        `
        SELECT
            id,
            nome AS name,
            categoria AS category,
            descricao AS description
        FROM produtos
        WHERE id = ?
        `,
        [result.lastID]
    );

    return newProduct as Product;
}

export async function updateExistingProduct(
    id: number,
    data: {
        name: string;
        category?: string | null;
        description?: string | null;
    }
): Promise<Product | undefined> {
    const db = await connectDB();

    const existingProduct = await db.get(
        `SELECT id FROM produtos WHERE id = ?`,
        [id]
    );

    if (!existingProduct) {
        return undefined;
    }

    await db.run(
        `
        UPDATE produtos
        SET nome = ?, categoria = ?, descricao = ?
        WHERE id = ?
        `,
        [data.name, data.category ?? null, data.description ?? null, id]
    );

    const updatedProduct = await db.get<Product>(
        `
        SELECT
            id,
            nome AS name,
            categoria AS category,
            descricao AS description
        FROM produtos
        WHERE id = ?
        `,
        [id]
    );

    return updatedProduct;
}

export async function deleteExistingProduct(id: number): Promise<Product | undefined> {
    const db = await connectDB();

    const product = await db.get<Product>(
        `
        SELECT
            id,
            nome AS name,
            categoria AS category,
            descricao AS description
        FROM produtos
        WHERE id = ?
        `,
        [id]
    );

    if (!product) {
        return undefined;
    }

    await db.run(`DELETE FROM produtos WHERE id = ?`, [id]);

    return product;
}
import { connectDB } from "../config/database";

interface ScrapedProductData {
    searchedProduct: string;
    productName: string;
    price: number;
    marketId: number;
    collectedAt: string;
}

export async function saveScrapedData(data: ScrapedProductData): Promise<void> {
    const db = await connectDB();

    let product = await db.get<{ id: number }>(
        `
        SELECT id
        FROM produtos
        WHERE LOWER(nome) = LOWER(?)
        `,
        [data.productName]
    );

    if (!product) {
        const productResult = await db.run(
            `
            INSERT INTO produtos (nome, categoria, descricao)
            VALUES (?, ?, ?)
            `,
            [data.productName, "Não categorizado", data.searchedProduct]
        );

        console.log("Produto inserido. ID:", productResult.lastID);
        product = { id: productResult.lastID as number };
    } else {
        console.log("Produto já existia. ID:", product.id);
    }

    const coletaResult = await db.run(
        `
        INSERT INTO coletas (data_coleta, origem, status)
        VALUES (?, ?, ?)
        `,
        [data.collectedAt, "scraper_mercado_a", "sucesso"]
    );

    console.log("Coleta inserida. ID:", coletaResult.lastID);

    const precoResult = await db.run(
        `
        INSERT INTO precos (
            produto_id,
            mercado_id,
            coleta_id,
            preco,
            preco_original,
            link_produto,
            disponivel
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [product.id, data.marketId, coletaResult.lastID, data.price, null, null, 1]
    );

    console.log("Preço inserido. ID:", precoResult.lastID);

    const counts = await db.get<{
        totalProdutos: number;
        totalColetas: number;
        totalPrecos: number;
    }>(`
        SELECT
            (SELECT COUNT(*) FROM produtos) as totalProdutos,
            (SELECT COUNT(*) FROM coletas) as totalColetas,
            (SELECT COUNT(*) FROM precos) as totalPrecos
    `);

    console.log("Totais no banco:", counts);
}

export async function clearPreviousScraperData(): Promise<void> {
    const db = await connectDB();

    await db.run("DELETE FROM precos");
    await db.run("DELETE FROM coletas");

    console.log("Dados antigos de preços e coletas removidos.");
}
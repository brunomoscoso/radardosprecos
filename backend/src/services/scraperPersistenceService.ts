import { withDB } from '../config/database';

// Registra execuções, resultados por produto e preços coletados no SQLite.
export interface ScrapedProductData {
    productId: number; productName: string; price: number; productUrl: string; quantity: string;
}
export async function startCollection(runId: number, marketId: number, productIds: number[]) {
    return withDB(async db => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            const result = await db.run(`INSERT INTO coletas(data_coleta,origem,status,mercado_id,execucao_id)
                VALUES(?,'scraper','em_andamento',?,?)`, new Date().toISOString(), marketId, runId);
            for (const id of productIds) await db.run('INSERT INTO coleta_resultados(coleta_id,produto_id,status) VALUES(?,?,?)', result.lastID, id, 'em_andamento');
            await db.exec('COMMIT');
            return result.lastID!;
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
    });
}
export async function saveScrapedData(collectionId: number, data: ScrapedProductData) {
    if (!Number.isFinite(data.price) || data.price <= 0 || !data.productName || !data.quantity || !/^https:\/\//.test(data.productUrl)) {
        throw new Error('Oferta inválida: preço, nome, embalagem e URL são obrigatórios.');
    }
    await withDB(async db => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            const collection = await db.get("SELECT mercado_id FROM coletas WHERE id=? AND status='em_andamento'", collectionId);
            const pending = await db.get("SELECT 1 FROM coleta_resultados WHERE coleta_id=? AND produto_id=? AND status='em_andamento'", collectionId, data.productId);
            if (!collection || !pending) throw new Error('Coleta/produto não está em andamento.');
            await db.run(`INSERT INTO precos(produto_id,mercado_id,coleta_id,preco,link_produto,data_registro,nome_encontrado,quantidade)
                VALUES(?,?,?,?,?,?,?,?)`, data.productId, collection.mercado_id, collectionId, data.price, data.productUrl, new Date().toISOString(), data.productName, data.quantity);
            await db.run("UPDATE coleta_resultados SET status='sucesso',erro=NULL WHERE coleta_id=? AND produto_id=?", collectionId, data.productId);
            await db.exec('COMMIT');
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
    });
}
export async function failProduct(collectionId: number, productId: number, error: string) {
    await withDB(db => db.run("UPDATE coleta_resultados SET status='erro',erro=? WHERE coleta_id=? AND produto_id=? AND status='em_andamento'", error, collectionId, productId));
}
export async function finishCollection(collectionId: number, fatalError?: string) {
    return withDB(async db => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            await db.run("UPDATE coleta_resultados SET status='erro',erro=? WHERE coleta_id=? AND status='em_andamento'", fatalError || 'Coleta terminou sem resultado.', collectionId);
            const counts = await db.get<{ total: number; ok: number }>("SELECT COUNT(*) total, COALESCE(SUM(status='sucesso'),0) ok FROM coleta_resultados WHERE coleta_id=?", collectionId);
            const status = counts!.ok === counts!.total && !fatalError ? 'sucesso' : counts!.ok ? 'parcial' : 'erro';
            await db.run('UPDATE coletas SET status=?,erro=?,finalizada_em=? WHERE id=?', status, fatalError || null, new Date().toISOString(), collectionId);
            await db.exec('COMMIT');
            return status;
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
    });
}

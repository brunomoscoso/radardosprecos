import { withDB } from '../config/database';
import { getBasket } from './basketService';
import { findAllMarkets } from './marketService';
import { findAllPrices } from './priceService';

// Calcula totais comparáveis usando os preços recentes e estados de coleta.
export async function compareBasket(now = Date.now()) {
    // One read transaction prevents mixing prices and statuses from different commits.
    return withDB(async db => {
        await db.exec('BEGIN');
        try {
            const [products, allMarkets, prices, results] = await Promise.all([
                getBasket(db), findAllMarkets(db), findAllPrices(db),
                db.all<{ productId: number; marketId: number; collectionId: number; status: string; error: string | null; date: string }[]>(`
                    SELECT productId,marketId,collectionId,status,error,date FROM (
                        SELECT r.produto_id productId,c.mercado_id marketId,c.id collectionId,r.status,r.erro error,c.data_coleta date,
                        ROW_NUMBER() OVER(PARTITION BY r.produto_id,c.mercado_id ORDER BY julianday(c.data_coleta) DESC,c.id DESC) rn
                        FROM coleta_resultados r JOIN coletas c ON c.id=r.coleta_id) WHERE rn=1`),
            ]);
            const maxAgeHours = Number(process.env.PRICE_MAX_AGE_HOURS || 36);
            if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error('PRICE_MAX_AGE_HOURS deve ser positivo.');
            const markets = allMarkets.filter(m => m.scraperKey).map(market => {
                const items = products.map(product => {
                    const price = prices.find(p => p.productId === product.id && p.marketId === market.id) || null;
                    const latest = results.find(r => r.productId === product.id && r.marketId === market.id);
                    const outdated = price ? now - Date.parse(price.collectedAt) > maxAgeHours * 3600000 : false;
                    const usable = !!price && !price.legacy && !!price.quantity && !outdated && latest?.status === 'sucesso' && price.collectionId === latest.collectionId;
                    const priceWarning = price?.legacy
                        ? 'Registro histórico: a embalagem e a correspondência com o item pedido não foram verificadas. Fora do total comparável.'
                        : outdated ? 'Preço desatualizado. Fora do total comparável.'
                        : price && !price.quantity ? 'Embalagem não verificada. Fora do total comparável.'
                        : price && !usable ? 'Último preço salvo, fora do total até uma atualização bem-sucedida.' : null;
                    return { product, price, usable, status: latest?.status || 'sem_coleta', collectedAt: latest?.date || null,
                        priceWarning, lastCollectionError: latest?.error || null,
                        error: latest?.error || priceWarning || (!price ? 'Sem preço disponível.' : null) };
                });
                const complete = products.length > 0 && items.every(i => i.usable);
                const subtotal = items.filter(i => i.usable).reduce((sum, i) => sum + Math.round(i.price!.price * 100), 0) / 100;
                const savedItems = items.filter(i => i.price);
                const savedSubtotal = savedItems.reduce((sum, i) => sum + Math.round(i.price!.price * 100), 0) / 100;
                return { ...market, items, missingProducts: items.filter(i => !i.usable).map(i => i.product), complete,
                    subtotal, savedSubtotal, savedItemCount: savedItems.length, total: complete ? subtotal : null };
            });
            const incompatibleProducts = products.filter(product => {
                const quantities = markets.map(m => m.items.find(i => i.product.id === product.id)).filter(i => i?.usable).map(i => i!.price!.quantity);
                return new Set(quantities).size > 1;
            });
            const comparable = markets.length >= 2 && markets.every(m => m.complete) && incompatibleProducts.length === 0;
            const min = comparable ? Math.min(...markets.map(m => m.total!)) : null;
            return { products, markets, comparable, incompatibleProducts, maxAgeHours,
                cheapestMarketIds: comparable ? markets.filter(m => m.total === min).map(m => m.id) : [] };
        } finally { await db.exec('ROLLBACK'); }
    });
}

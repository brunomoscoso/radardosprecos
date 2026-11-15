import { ProductComparison } from './compareService';

export function carryForwardPrices(current: ProductComparison, previous: ProductComparison | null, now = Date.now()) {
    if (!previous) return current;

    for (const market of current.markets) {
        const previousMarket = previous.markets.find(candidate => candidate.scraperKey === market.scraperKey);
        for (const item of market.items) {
            if (item.price) continue;
            const previousPrice = previousMarket?.items.find(candidate => candidate.product.id === item.product.id)?.price;
            if (!previousPrice) continue;

            const age = now - Date.parse(previousPrice.collectedAt);
            item.price = previousPrice;
            item.usable = false;
            item.priceWarning = previousPrice.legacy
                ? 'Preço histórico sem embalagem verificada; fora do total comparável.'
                : !Number.isFinite(age) || age > current.maxAgeHours * 3600000
                    ? 'Último preço publicado desatualizado; fora do total comparável.'
                    : 'Último preço publicado não confirmado nesta coleta; fora do total comparável.';
            item.error = item.lastCollectionError || item.priceWarning;
        }

        const savedItems = market.items.filter(item => item.price);
        market.savedItemCount = savedItems.length;
        market.savedSubtotal = savedItems.reduce((sum, item) => sum + Math.round((item.price?.price ?? 0) * 100), 0) / 100;
    }

    return current;
}

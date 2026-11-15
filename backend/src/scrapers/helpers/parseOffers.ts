import { load } from 'cheerio';
import { Candidate } from '../markets/shared';

export function parseOffers(html: string, market: 'continente' | 'pingodoce', postalCode?: string): Candidate[] {
    const $ = load(html);
    const continente = market === 'continente';
    const base = continente ? 'https://www.continente.pt' : 'https://www.pingodoce.pt';
    if (!continente && (!postalCode || $('#postalModal').attr('data-savedcode') !== postalCode)) {
        throw new Error('Pingo Doce: localização não confirmada na sessão; preços descartados.');
    }
    const tiles = $(continente ? '.product-tile' : '.product-tile-pd');
    if (!tiles.length) throw new Error('Sem resultados verificáveis: produto ausente, acesso bloqueado ou formato do site alterado.');
    return tiles.toArray().flatMap(element => {
        const tile = $(element);
        const href = tile.find(continente ? '.ct-pdp-link a' : '.product-name-link a').first().attr('href');
        if (!href) return [];
        let url: URL;
        try { url = new URL(href, base); } catch { return []; }
        if (url.origin !== base) return [];
        return [{
            name: tile.find(continente ? '.pwc-tile--description' : '.product-name-link').first().text(),
            price: tile.find(continente ? '.pwc-tile--price-primary' : '.product-price .sales').first().text(),
            quantity: tile.find(continente ? '.pwc-tile--quantity' : '.product-unit').first().text(),
            url: url.href,
        }];
    });
}

import { Product } from '../../types/Product';
import { ScrapedProductData } from '../../services/scraperPersistenceService';
import { cleanText, matchesProduct, packageQuantity, parsePrice } from '../helpers/normalizeProductData';

// Valida ofertas e partilha o contrato de recolha entre mercados.
export interface Candidate { name: string; price: string; quantity: string; url: string }
export type Scraper = (products: Product[], save: (data: ScrapedProductData) => Promise<void>, fail: (productId: number, error: string) => Promise<void>) => Promise<void>;
export function chooseOffer(product: Product, candidates: Candidate[]): ScrapedProductData {
    const offers = candidates.filter(c => matchesProduct(product.name, c.name, c.quantity)).flatMap(c => {
        try {
            const url = new URL(c.url);
            if (url.protocol !== 'https:') return [];
            return [{ productId: product.id, productName: cleanText(c.name), price: parsePrice(c.price), productUrl: url.href, quantity: packageQuantity(c.quantity)! }];
        } catch { return []; }
    });
    if (!offers.length) throw new Error('Nenhuma oferta com nome, embalagem e preço verificáveis na página de resultados. A busca pode não ter correspondências ou o site pode ter mudado.');
    return offers.sort((a, b) => a.price - b.price)[0];
}

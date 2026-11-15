import { Scraper, chooseOffer } from './shared';
import { HttpSession } from '../helpers/httpSession';
import { parseOffers } from '../helpers/parseOffers';

export const scrapeMercadoA: Scraper = async (products, save, fail) => {
    const session = new HttpSession('https://www.continente.pt');
    for (const product of products) {
        try {
            const params = new URLSearchParams({ q: product.name, cgid: 'col-produtos', start: '0', sz: '24', pmin: '0.01' });
            const response = await session.get('/on/demandware.store/Sites-continente-Site/default/Search-ShowAjax?' + params);
            await save(chooseOffer(product, parseOffers(await response.text(), 'continente')));
        } catch (error) { await fail(product.id, error instanceof Error ? error.message : String(error)); }
    }
};

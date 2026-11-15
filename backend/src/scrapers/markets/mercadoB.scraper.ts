import { load } from 'cheerio';
import { Scraper, chooseOffer } from './shared';
import { HttpSession } from '../helpers/httpSession';
import { parseOffers } from '../helpers/parseOffers';

export async function preparePingoDoce(session: HttpSession, postalCode: string) {
    const $ = load(await (await session.get('/')).text());
    const getPath = $('#postalModal').attr('data-url-get');
    const setPath = $('#postalModal').attr('data-url-set');
    if (!getPath || !setPath) throw new Error('Pingo Doce: fluxo de código postal mudou.');
    const url = new URL(getPath, 'https://www.pingodoce.pt');
    url.searchParams.set('postalCode', postalCode);
    const info = await (await session.get(url.href)).json() as { success?: boolean; postalCodeInfo?: { deliveryType?: string } };
    if (!info.success || info.postalCodeInfo?.deliveryType !== 'home') throw new Error('Pingo Doce: código postal sem entrega em casa confirmada. Escolha de loja não suportada.');
    const result = await (await session.get(setPath, {
        method: 'POST', body: new URLSearchParams({ postalCode, home: 'true', chosenDelivery: '', isConfirmed: '', isAddExternal: 'false' }),
    })).json() as { success?: boolean };
    if (!result.success) throw new Error('Pingo Doce: não foi possível aplicar o código postal.');
}

export const scrapeMercadoB: Scraper = async (products, save, fail) => {
    const postalCode = process.env.PINGO_DOCE_POSTAL_CODE?.trim();
    if (!postalCode || !/^\d{4}-\d{3}$/.test(postalCode)) throw new Error('Configure PINGO_DOCE_POSTAL_CODE no formato 0000-000. Pingo Doce não coletado.');
    const session = new HttpSession('https://www.pingodoce.pt');
    await preparePingoDoce(session, postalCode);
    for (const product of products) {
        try {
            const params = new URLSearchParams({ q: product.name });
            const response = await session.get('/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show?' + params);
            await save(chooseOffer(product, parseOffers(await response.text(), 'pingodoce', postalCode)));
        } catch (error) { await fail(product.id, error instanceof Error ? error.message : String(error)); }
    }
};

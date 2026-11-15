import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpSession } from '../src/scrapers/helpers/httpSession';
import { parseOffers } from '../src/scrapers/helpers/parseOffers';
import { chooseOffer } from '../src/scrapers/markets/shared';
import { preparePingoDoce } from '../src/scrapers/markets/mercadoB.scraper';
import { packageQuantity, matchesProduct } from '../src/scrapers/helpers/normalizeProductData';

test('embalagens lt/gr e variantes alimentares preservam a comparação', () => {
    assert.equal(packageQuantity('emb. 1 lt'), '1000ml');
    assert.equal(packageQuantity('emb. 500 gr'), '500g');
    assert.equal(packageQuantity('emb. 6 x 1 lt'), null);
    assert.equal(matchesProduct('Leite UHT Meio Gordo', 'Leite UHT Meio Gordo', '1 lt'), true);
    assert.equal(matchesProduct('Leite UHT Meio Gordo', 'Leite UHT Meio Gordo sem Lactose', '0.2 L'), false);
    assert.equal(matchesProduct('Leite UHT Meio Gordo sem Lactose', 'Leite UHT Meio Gordo sem Lactose', '1 L'), true);
    assert.equal(matchesProduct('Farinha de Trigo sem Fermento 1kg', 'Farinha de Trigo com Fermento', '1 Kg'), false);
    assert.equal(matchesProduct('Farinha de Trigo sem Fermento 1kg', 'Farinha de Trigo Integral sem Fermento', '1 Kg'), false);
});

const postal = '1000-001';
test('cesta compara quantidades e tipos equivalentes', () => {
    assert.ok(matchesProduct('Farinha de Trigo T55 sem Fermento 1kg', 'Farinha de Trigo Tipo 55 sem Fermento', '1 Kg'));
    assert.equal(matchesProduct('Farinha de Trigo T55 sem Fermento 1kg', 'Farinha de Trigo T65 sem Fermento', '1 kg'), false);
    assert.equal(matchesProduct('Feijão Manteiga 500g', 'Feijão Manteiga Cozido', '500 g'), false);
    assert.equal(matchesProduct('Massa Esparguete 500g', 'Massa Esparguete Integral', '500 g'), false);
    assert.equal(matchesProduct('Massa Esparguete 500g', 'Massa Esparguete', '1 kg'), false);
    assert.equal(matchesProduct('Manteiga com Sal 250g', 'Manteiga Magra com Sal', '250 g'), false);
    assert.equal(matchesProduct('Sal Fino 250g', 'Sal Rosa Fino', '250 g'), false);
    assert.equal(packageQuantity('500 gr + 10% GRÁTIS'), null);
});
const pd = `<div id="postalModal" data-savedcode="${postal}"></div>
<div class="product-tile-pd"><div class="product-name-link"><a href="/arroz.html">Arroz Agulha</a></div>
<div class="product-unit">1 Kg | 1,89 €/Kg</div><div class="product-price"><span class="sales">1,89 &euro;</span></div></div>`;

test('HTTP: extrai preço da embalagem e valida localização do Pingo Doce', () => {
    const offer = chooseOffer({ id: 1, name: 'Arroz Agulha 1kg' }, parseOffers(pd, 'pingodoce', postal));
    assert.equal(offer.price, 1.89);
    assert.equal(offer.quantity, '1000g');
    assert.equal(offer.productUrl, 'https://www.pingodoce.pt/arroz.html');
    assert.throws(() => parseOffers(pd, 'pingodoce', '2000-001'), /localização/);
    assert.throws(() => parseOffers(pd, 'pingodoce'), /localização/);
    assert.throws(() => parseOffers('<html>Access denied</html>', 'continente'), /Sem resultados/);
});

test('HTTP: Continente lê preço com elementos aninhados e recusa links externos', () => {
    const html = `<div class="product-tile"><div class="ct-pdp-link"><a href="/arroz.html">Arroz</a></div>
    <h2 class="pwc-tile--description">Arroz Agulha</h2><p class="pwc-tile--quantity">emb. 1 kg</p>
    <span class="pwc-tile--price-primary">1<span>,64&euro;</span></span></div>`;
    assert.equal(chooseOffer({ id: 1, name: 'Arroz Agulha 1kg' }, parseOffers(html, 'continente')).price, 1.64);
    assert.deepEqual(parseOffers(html.replace('/arroz.html', 'https://other.test/'), 'continente'), []);
});

test('HTTP: mantém cookies em redirecionamentos e bloqueia outras origens e HTTP 247', async () => {
    let calls = 0;
    const request: typeof fetch = async (_url, init) => {
        calls++;
        if (calls === 1) return new Response(null, { status: 302, headers: { location: '/next', 'set-cookie': 'session=ok; Path=/; Secure' } });
        assert.equal(new Headers(init?.headers).get('cookie'), 'session=ok');
        return new Response('ok');
    };
    assert.equal(await (await new HttpSession('https://www.pingodoce.pt', request).get('/')).text(), 'ok');
    assert.equal(calls, 2);
    const external: typeof fetch = async () => new Response(null, { status: 302, headers: { location: 'https://other.test/' } });
    await assert.rejects(new HttpSession('https://www.pingodoce.pt', external).get('/'), /origem/);
    const blocked: typeof fetch = async () => new Response('challenge', { status: 247 });
    await assert.rejects(new HttpSession('https://www.continente.pt', blocked).get('/'), /HTTP 247/);
});

test('HTTP: fluxo postal valida entrega, envia formulário e conserva sessão', async () => {
    let calls = 0;
    const request: typeof fetch = async (url, init) => {
        calls++;
        if (calls === 1) return new Response('<div id="postalModal" data-url-get="/validate" data-url-set="/apply"></div>', { headers: { 'set-cookie': 'session=postal; Path=/; Secure' } });
        assert.equal(new Headers(init?.headers).get('cookie'), 'session=postal');
        if (calls === 2) {
            assert.equal(new URL(String(url)).searchParams.get('postalCode'), postal);
            return Response.json({ success: true, postalCodeInfo: { deliveryType: 'home' } });
        }
        assert.equal(init?.method, 'POST');
        assert.equal((init?.body as URLSearchParams).get('postalCode'), postal);
        return Response.json({ success: true });
    };
    await preparePingoDoce(new HttpSession('https://www.pingodoce.pt', request), postal);
    assert.equal(calls, 3);
    const unsupported: typeof fetch = async url => String(url).endsWith('/')
        ? new Response('<div id="postalModal" data-url-get="/validate" data-url-set="/apply"></div>')
        : Response.json({ success: true, postalCodeInfo: { deliveryType: 'store' } });
    await assert.rejects(preparePingoDoce(new HttpSession('https://www.pingodoce.pt', unsupported), postal), /Escolha de loja/);
});

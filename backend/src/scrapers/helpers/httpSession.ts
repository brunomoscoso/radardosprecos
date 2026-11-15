import { CookieJar } from 'tough-cookie';

// Separate session per market/run; preserve delivery cookies without a browser.
export class HttpSession {
    private jar = new CookieJar();
    constructor(private origin: string, private request: typeof fetch = fetch) {}
    async get(path: string, init: RequestInit = {}): Promise<Response> {
        let url = new URL(path, this.origin);
        for (let redirects = 0; redirects <= 5; redirects++) {
            if (url.origin !== this.origin) throw new Error('Mercado redirecionou para uma origem inesperada.');
            const headers = new Headers(init.headers);
            headers.set('Accept-Language', 'pt-PT,pt;q=0.9');
            headers.set('Cookie', await this.jar.getCookieString(url.href));
            let response: Response;
            try {
                response = await this.request(url, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
            } catch { throw new Error('Falha de ligação ao mercado ou tempo de espera excedido.'); }
            for (const cookie of response.headers.getSetCookie()) await this.jar.setCookie(cookie, url.href);
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location');
                await response.body?.cancel();
                if (!location) throw new Error('Redirecionamento sem destino.');
                url = new URL(location, url);
                if (response.status === 303 || ([301, 302].includes(response.status) && init.method === 'POST')) init = {};
                continue;
            }
            if (response.status !== 200) {
                await response.body?.cancel();
                throw new Error(`Mercado: HTTP ${response.status}. Nenhum preço recolhido.`);
            }
            return response;
        }
        throw new Error('Demasiados redirecionamentos do mercado.');
    }
}

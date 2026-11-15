// Configura a aplicação Express, seus middlewares e o tratamento central de erros.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes';
import { publicApiRateLimit } from './middleware/rateLimit';
export const app = express();
const proxyHops = process.env.TRUST_PROXY_HOPS;
if (proxyHops) {
    const hops = Number(proxyHops);
    if (!Number.isSafeInteger(hops) || hops < 1) throw new Error('TRUST_PROXY_HOPS deve ser um inteiro positivo.');
    app.set('trust proxy', hops);
}
app.use(cors({ origin: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(publicApiRateLimit());
app.use(express.json({ limit: '64kb' }));
app.use(routes);
app.use((err: Error & { status?: number; code?: string }, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) { next(err); return; }
    if (err instanceof SyntaxError && 'body' in err) { res.status(400).json({ success: false, message: 'JSON inválido.' }); return; }
    const status = err.status || (err.code?.startsWith('SQLITE_CONSTRAINT') ? 409 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ success: false, message: status === 500 ? 'Erro interno do servidor.' : err.message });
});

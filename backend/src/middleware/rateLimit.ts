import { RequestHandler } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const MAX_CLIENTS = 10_000;

export function publicApiRateLimit(): RequestHandler {
    const clients = new Map<string, { count: number; resetAt: number }>();
    return (req, res, next) => {
        const now = Date.now();
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        let client = clients.get(ip);
        if (!client || client.resetAt <= now) {
            client = { count: 1, resetAt: now + WINDOW_MS };
            clients.set(ip, client);
        } else if (client.count >= MAX_REQUESTS) {
            res.setHeader('Retry-After', String(Math.ceil((client.resetAt - now) / 1000)));
            res.status(429).json({ success: false, message: 'Muitas solicitações. Aguarde antes de tentar novamente.' });
            return;
        } else {
            client.count++;
        }

        if (clients.size > MAX_CLIENTS) {
            for (const [key, entry] of clients) if (entry.resetAt <= now) clients.delete(key);
            while (clients.size > MAX_CLIENTS) clients.delete(clients.keys().next().value!);
        }
        next();
    };
}

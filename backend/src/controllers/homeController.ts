import { Request, Response } from 'express';

export function home(req: Request, res: Response): void {
    res.json({ mensagem: 'API funcionando corretamente!' });
}
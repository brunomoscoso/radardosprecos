// Expõe os endpoints para consultar e salvar os produtos selecionados na cesta.
import { Request, Response } from 'express';
import { getBasket, saveBasket } from '../services/basketService';
export async function getSelectedBasket(req: Request, res: Response) {
    res.json({ success: true, data: await getBasket() });
}
export async function putSelectedBasket(req: Request, res: Response) {
    res.json({ success: true, data: await saveBasket(req.body?.productIds) });
}

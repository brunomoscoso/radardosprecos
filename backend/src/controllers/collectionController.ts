// Expõe o estado das coletas e permite iniciar uma coleta manual.
import { Request, Response } from 'express';
import { getCollections, runCollection } from '../services/collectionService';
import { scheduleConfig } from '../services/schedulerService';
export async function getCollectionStatus(req: Request, res: Response) {
    res.json({ success: true, data: { ...await getCollections(), schedule: scheduleConfig() } });
}
export async function postCollection(req: Request, res: Response) {
    const data = await runCollection();
    res.json({ success: data.status === 'sucesso', message: data.status === 'sucesso' ? 'Coleta concluída.' : 'Coleta concluída com falhas. Consulte os resultados por produto.', data });
}

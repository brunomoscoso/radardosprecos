// Responde ao endpoint usado para verificar se a API está disponível.
import { Request, Response } from "express";

export function health(req: Request, res: Response): void {
    res.status(200).json({ status: "ok", message: "API is healthy!" });
}
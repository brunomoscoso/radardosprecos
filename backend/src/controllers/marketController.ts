import { Request, Response } from "express";
import {
    findAllMarkets,
    findMarketById,
    createMarket,
} from "../services/marketService";

export function getMarkets(req: Request, res: Response): void {
    const markets = findAllMarkets();

    res.status(200).json({
        success: true,
        data: markets,
    });
}

export function getMarketById(req: Request, res: Response): void {
    const id = Number(req.params.id);

    const market = findMarketById(id);

    if (!market) {
    res.status(404).json({
        success: false,
        message: "Market not found",
    });
    return;
    }

    res.status(200).json({
        success: true,
        data: market,
    });
}

export function postMarket(req: Request, res: Response): void {
    const { name, city, website } = req.body;

    const newMarket = createMarket({
        name,
        city,
        website,
    });

    res.status(201).json({
        success: true,
        message: "Market created successfully",
        data: newMarket,
    });
}
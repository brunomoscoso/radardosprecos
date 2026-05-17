import { Request, Response } from "express";
import {
    findAllMarkets,
    findMarketById,
    createMarket,
} from "../services/marketService";

export async function getMarkets(req: Request, res: Response): Promise<void> {
    try {
        const markets = await findAllMarkets();

    res.status(200).json({
        success: true,
        data: markets,
    });
    } catch (error) {
        console.error("Error fetching markets:", error);
        res.status(500).json({
        success: false,
        message: "Internal server error",
    });
    }
}

export async function getMarketById(req: Request, res: Response): Promise<void> {
    try {
        const id = Number(req.params.id);

    if (isNaN(id)) {
        res.status(400).json({
            success: false,
            message: "Invalid market id",
    });
        return;
    }

    const market = await findMarketById(id);

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
    } catch (error) {
        console.error("Error fetching market:", error);
        res.status(500).json({
        success: false,
        message: "Internal server error",
    });
    }
}

export async function postMarket(req: Request, res: Response): Promise<void> {
    try {
        const { name, city, website } = req.body;

    if (!name || !city || !website) {
        res.status(400).json({
        success: false,
        message: "name, city and website are required",
        });
        return;
    }

    const newMarket = await createMarket({
        name,
        city,
        website,
    });

    res.status(201).json({
        success: true,
        message: "Market created successfully",
        data: newMarket,
    });
    } catch (error) {
    console.error("Error creating market:", error);
    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
    }
}
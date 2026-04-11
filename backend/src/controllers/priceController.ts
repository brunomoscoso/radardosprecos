import { Request, Response } from "express";
import {
    findAllPrices,
    createPrice,
    findPricesByProductName,
} from "../services/priceService";

export function getPrices(req: Request, res: Response): void {
    const prices = findAllPrices();

    res.status(200).json({
        success: true,
        data: prices,
    });
}

export function getPricesByProductName(req: Request, res: Response): void {
    const productName = String(req.params.productName);

    const prices = findPricesByProductName(productName);

    res.status(200).json({
        success: true,
        data: prices,
    });
}

export function postPrice(req: Request, res: Response): void {
    const { productName, marketId, price, productUrl, collectedAt } = req.body;

    const newPrice = createPrice({
        productName,
        marketId,
        price,
        productUrl,
        collectedAt,
    });

    res.status(201).json({
        success: true,
        message: "Price created successfully",
        data: newPrice,
    });
}
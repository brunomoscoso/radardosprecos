import { Request, Response } from "express";
import { findPricesByProductName } from "../services/priceService";
import { findMarketById } from "../services/marketService";

export function comparePricesByProductName(req: Request, res: Response): void {
    const productName = String(req.params.productName);

    const prices = findPricesByProductName(productName);

    if (prices.length === 0) {
        res.status(404).json({
        success: false,
        message: "No prices found for this product",
        });
    return;
    }

    const comparedPrices = prices
        .map((priceItem) => {
        const market = findMarketById(priceItem.marketId);

    return {
        marketId: priceItem.marketId,
        marketName: market ? market.name : "Unknown market",
        productName: priceItem.productName,
        price: priceItem.price,
        productUrl: priceItem.productUrl,
        collectedAt: priceItem.collectedAt,
    };
    })
    .sort((a, b) => a.price - b.price);

    const cheapest = comparedPrices[0];

    res.status(200).json({
        success: true,
        productName,
        cheapest,
        results: comparedPrices,
    });
}
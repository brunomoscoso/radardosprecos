import { Market } from "../types/Market";

const markets: Market[] = [];

export function findAllMarkets(): Market[] {
    return markets;
}

export function findMarketById(id: number): Market | undefined {
    return markets.find((market) => market.id === id);
}

export function createMarket(data: Omit<Market, "id">): Market {
    const newMarket: Market = {
        id: markets.length + 1,
        ...data,
    };

    markets.push(newMarket);
    return newMarket;
}
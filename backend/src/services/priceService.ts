import { Price } from "../types/Price";

const prices: Price[] = [];

export function findAllPrices(): Price[] {
    return prices;
}

export function createPrice(data: Omit<Price, "id">): Price {
    const newPrice: Price = {
        id: prices.length + 1,
        ...data,
    };

    prices.push(newPrice);
    return newPrice;
}

export function findPricesByProductName(productName: string): Price[] {
    return prices.filter(
        (price) => price.productName.toLowerCase() === productName.toLowerCase()
    );
}
// Define os campos básicos de um preço exibido ou registrado pela aplicação.
export interface Price {
    id: number;
    productName: string;
    marketId: number;
    price: number;
    productUrl: string | null;
    collectedAt: string;
}

// Define os dados de produto do catálogo e da cesta.
export interface Product {
    id: number;
    name: string;
    basketOption?: number;
    category?: string | null;
    description?: string | null;
}

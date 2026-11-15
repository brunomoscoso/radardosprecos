// Define os dados de mercado usados pelos serviços e pela API.
export interface Market {
    id: number;
    name: string;
    website: string;
    scraperKey?: string | null;
}

import { withDB, DatabaseConnection } from '../config/database';
import { Price } from '../types/Price';


// Latest prices, including the established legacy compatibility rules.
export interface LatestPrice extends Price {
    productId: number; collectionId: number; marketName: string; matchedName: string | null; quantity: string | null;
    legacy: number; sourceProductId: number; sourceMarketId: number;
}
export async function findAllPrices(connection?: DatabaseConnection): Promise<LatestPrice[]> {
    const query = (db: DatabaseConnection) => db.all<LatestPrice[]>('SELECT * FROM ultimos_precos ORDER BY productId,marketId');
    return connection ? query(connection) : withDB(query);
}

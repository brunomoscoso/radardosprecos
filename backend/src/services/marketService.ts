import { withDB, DatabaseConnection } from '../config/database';
import { Market } from '../types/Market';
// Consulta os mercados usados na comparação.
const columns = 'id, nome name, site website, scraper_key scraperKey';
export async function findAllMarkets(connection?: DatabaseConnection): Promise<Market[]> {
    const query = (db: DatabaseConnection) => db.all<Market[]>(`SELECT ${columns} FROM mercados ORDER BY id`);
    return connection ? query(connection) : withDB(query);
}

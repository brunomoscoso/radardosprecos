import { withDB } from './database';
import { migrateSchema } from './schema';
import { seedDatabase } from './seedDatabase';

export async function initDatabase() {
    await withDB(async db => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            await migrateSchema(db);
            await seedDatabase(db);
            await db.exec('COMMIT');
        } catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }
    });
}

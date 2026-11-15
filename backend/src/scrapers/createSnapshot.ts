import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { initDatabase } from '../config/initDatabase';
import { compareSelectedProducts, ProductComparison } from '../services/compareService';
import { runCollection } from '../services/collectionService';
import { findAllProducts } from '../services/productService';
import { carryForwardPrices } from '../services/staticSnapshotService';

function isComparison(value: unknown): value is ProductComparison {
    return typeof value === 'object' && value !== null
        && 'products' in value && Array.isArray(value.products)
        && 'markets' in value && Array.isArray(value.markets)
        && value.markets.every(market => typeof market === 'object' && market !== null && 'items' in market && Array.isArray(market.items));
}

async function loadPreviousComparison(): Promise<ProductComparison | null> {
    const snapshotUrl = process.env.PREVIOUS_SNAPSHOT_URL;
    if (!snapshotUrl) return null;
    const url = new URL(snapshotUrl);
    url.searchParams.set('updated', String(Date.now()));
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Não foi possível ler o snapshot anterior: HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || !('comparison' in payload) || !isComparison(payload.comparison)) {
        throw new Error('O snapshot anterior tem um formato inválido.');
    }
    return payload.comparison;
}

async function createSnapshot() {
    const postalCode = process.env.PINGO_DOCE_POSTAL_CODE?.trim();
    if (!postalCode || !/^\d{4}-\d{3}$/.test(postalCode)) {
        throw new Error('Configure o secret PINGO_DOCE_POSTAL_CODE no formato 0000-000.');
    }

    const previous = await loadPreviousComparison();
    await initDatabase();
    const collection = await runCollection('github-actions');
    if (collection.error) throw new Error(`Coleta interrompida: ${collection.error}`);

    const productIds = (await findAllProducts()).filter(product => product.basketOption).map(product => product.id);
    const current = await compareSelectedProducts(productIds);
    const comparison = carryForwardPrices(current, previous);
    const outputPath = resolve(__dirname, '../../../frontend/public/data/prices.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        collectionStatus: collection.status,
        comparison,
    }, null, 2));
    console.log(`Snapshot publicado para ${productIds.length} produtos (${collection.status}).`);
}

createSnapshot().catch(error => {
    console.error('Falha ao criar snapshot:', error);
    process.exitCode = 1;
});

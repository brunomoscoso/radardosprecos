import { Router } from 'express';
import { findAllProducts } from '../services/productService';
import { findAllMarkets } from '../services/marketService';
import { findAllPrices } from '../services/priceService';
import { compareSelectedProducts } from '../services/compareService';
import { health } from '../controllers/healthController';

const router = Router();
router.get('/health', health);
router.get('/products', async (_req, res) => { res.json({ success: true, data: await findAllProducts() }); });
router.get('/markets', async (_req, res) => { res.json({ success: true, data: await findAllMarkets() }); });
router.get('/prices', async (_req, res) => { res.json({ success: true, data: await findAllPrices() }); });
router.get('/compare/basket', async (req, res) => { res.json({ success: true, data: await compareSelectedProducts(req.query.productIds) }); });
export default router;

import { Router } from 'express';
import { home } from '../controllers/homeController';
import { health } from '../controllers/healthController';
import productRoutes from './productRoutes';
import marketRoutes from "./marketRoutes";
import priceRoutes from "./priceRoutes";
import compareRoutes from "./compareRoutes";

const router = Router();

router.get('/', home);
router.get('/health', health);
router.use('/products', productRoutes);
router.use("/markets", marketRoutes);
router.use("/prices", priceRoutes);
router.use("/compare", compareRoutes);

export default router;
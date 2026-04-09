import { Router } from 'express';
import { home } from '../controllers/homeController';
import { health } from '../controllers/healthController';
import productRoutes from './productRoutes';

const router = Router();

router.get('/', home);
router.get('/health', health);
router.use('/products', productRoutes);


export default router;
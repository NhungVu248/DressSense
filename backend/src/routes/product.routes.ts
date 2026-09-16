import { Router } from 'express';
import { listProducts, getProduct, createProduct } from '../controllers/product.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();
router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', authenticate, authorize('SELLER', 'ADMIN'), createProduct);

export default router;

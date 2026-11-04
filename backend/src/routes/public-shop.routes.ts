import { Router } from 'express';
import { getPublicShop } from '../controllers/public-shop.controller';

const router = Router();

// Trang gian hàng công khai (khách xem) - kiểu Shopee
router.get('/:sellerId', getPublicShop);

export default router;

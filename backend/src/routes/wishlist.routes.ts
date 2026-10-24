import { Router } from 'express';
import {
  getWishlist, getWishlistIds, addWishlist, removeWishlist, wishlistToCart,
} from '../controllers/wishlist.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC8.2 - 3E: wishlist gắn với tài khoản -> yêu cầu đăng nhập
router.use(authenticate);

router.get('/', getWishlist);
router.get('/ids', getWishlistIds);
router.post('/', addWishlist);
router.post('/:productId/to-cart', wishlistToCart);
router.delete('/:productId', removeWishlist);

export default router;

import { Router } from 'express';
import {
  getCart, addToCart, updateCartItem, removeCartItem, checkoutPreview, getCartCount,
} from '../controllers/cart.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC8.1 - chỉ Khách hàng đã đăng nhập mới có giỏ hàng gắn với tài khoản
router.use(authenticate);

router.get('/', getCart);
router.get('/count', getCartCount);     // badge navbar
router.post('/', addToCart);
router.post('/checkout', checkoutPreview); // bước 8-9 -> chuyển UC9
router.patch('/:id', updateCartItem);
router.delete('/:id', removeCartItem);

export default router;

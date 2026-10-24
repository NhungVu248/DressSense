import { Router } from 'express';
import { getCheckoutInfo, placeOrder, listOrders, getOrder } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC9.1 - đặt hàng yêu cầu đăng nhập
router.use(authenticate);

router.get('/checkout', getCheckoutInfo); // dữ liệu trang checkout (đặt trước '/:id')
router.get('/', listOrders);
router.post('/', placeOrder);
router.get('/:id', getOrder);

export default router;

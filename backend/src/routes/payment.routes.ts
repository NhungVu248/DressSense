import { Router } from 'express';
import {
  vnpayReturn, vnpayIpn, retryPayment, listTransactions, getTransaction,
} from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC9.2 - callback CÔNG KHAI từ VNPAY (không qua authenticate)
router.get('/vnpay/return', vnpayReturn);
router.get('/vnpay/ipn', vnpayIpn);

// UC9.2/9.3 - cần đăng nhập
router.post('/orders/:orderId/retry', authenticate, retryPayment); // thanh toán lại
router.get('/', authenticate, listTransactions);                   // lịch sử giao dịch
router.get('/:id', authenticate, getTransaction);                  // chi tiết giao dịch

export default router;

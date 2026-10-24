import { Router } from 'express';
import { applyVoucher, listVouchers } from '../controllers/voucher.controller';

const router = Router();

// UC8.3 - xem mã khả dụng + xem trước mức giảm (chưa đánh dấu đã dùng)
router.get('/', listVouchers);
router.post('/apply', applyVoucher);

export default router;

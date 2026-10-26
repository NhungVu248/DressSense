import { Router } from 'express';
import {
  listSellerOrders, updateOrderStatus, updateShippingInfo, approveCancel, rejectCancel,
} from '../controllers/order-seller.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC10.4 - chỉ Người bán / Quản trị viên
router.use(authenticate, authorize('SELLER', 'ADMIN'));

router.get('/orders', listSellerOrders);
router.patch('/orders/:id/status', updateOrderStatus);          // cập nhật trạng thái theo thứ tự
router.patch('/orders/:id/shipping', updateShippingInfo);       // cập nhật thông tin vận chuyển
router.patch('/orders/:id/cancel/approve', approveCancel);      // UC10.5 - duyệt yêu cầu hủy
router.patch('/orders/:id/cancel/reject', rejectCancel);        // UC10.5 - từ chối yêu cầu hủy

export default router;

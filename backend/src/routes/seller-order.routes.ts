import { Router } from 'express';
import {
  listSellerOrders, updateOrderStatus, updateShippingInfo, approveCancel, rejectCancel,
} from '../controllers/order-seller.controller';
import { listSellerReturns, approveReturn, rejectReturn } from '../controllers/return.controller';
import { listSellerComplaints, sellerRespondComplaint } from '../controllers/complaint.controller';
import { createIncident, resolveIncident, listSellerIncidents } from '../controllers/incident.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC10.4 / UC11 - chỉ Người bán / Quản trị viên
router.use(authenticate, authorize('SELLER', 'ADMIN'));

router.get('/orders', listSellerOrders);
router.patch('/orders/:id/status', updateOrderStatus);          // cập nhật trạng thái theo thứ tự
router.patch('/orders/:id/shipping', updateShippingInfo);       // cập nhật thông tin vận chuyển
router.patch('/orders/:id/cancel/approve', approveCancel);      // UC10.5 - duyệt yêu cầu hủy
router.patch('/orders/:id/cancel/reject', rejectCancel);        // UC10.5 - từ chối yêu cầu hủy

// UC11.1 - đổi/trả
router.get('/returns', listSellerReturns);
router.patch('/returns/:id/approve', approveReturn);
router.patch('/returns/:id/reject', rejectReturn);

// UC11.2 - khiếu nại (người bán phản hồi)
router.get('/complaints', listSellerComplaints);
router.patch('/complaints/:id/respond', sellerRespondComplaint);

// UC11.3 - sự cố giao hàng
router.get('/incidents', listSellerIncidents);
router.post('/orders/:orderId/incident', createIncident);
router.patch('/incidents/:id/resolve', resolveIncident);

export default router;

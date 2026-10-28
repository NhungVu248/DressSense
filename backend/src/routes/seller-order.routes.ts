import { Router } from 'express';
import {
  listSellerOrders, updateOrderStatus, updateShippingInfo, approveCancel, rejectCancel,
} from '../controllers/order-seller.controller';
import { listSellerReturns, approveReturn, rejectReturn } from '../controllers/return.controller';
import { listSellerComplaints, sellerRespondComplaint } from '../controllers/complaint.controller';
import { createIncident, resolveIncident, listSellerIncidents } from '../controllers/incident.controller';
import { listSellerReviews, replyReview } from '../controllers/review.controller';
import { listSellerQuestions, answerQuestion } from '../controllers/question.controller';
import { getMyShop, updateMyShop, submitMyShop } from '../controllers/shop.controller';
import { getSellerReport } from '../controllers/seller-report.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC10.4 / UC11 / UC14 - chỉ Người bán / Quản trị viên
router.use(authenticate, authorize('SELLER', 'ADMIN'));

// UC14.1 - quản lý hồ sơ gian hàng
router.get('/shop', getMyShop);
router.put('/shop', updateMyShop);
router.post('/shop/submit', submitMyShop);

// UC14.4 - báo cáo doanh thu gian hàng
router.get('/report', getSellerReport);

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

// UC12.2 - phản hồi đánh giá
router.get('/reviews', listSellerReviews);
router.patch('/reviews/:id/reply', replyReview);

// UC12.3 - trả lời hỏi đáp
router.get('/questions', listSellerQuestions);
router.patch('/questions/:id/answer', answerQuestion);

export default router;

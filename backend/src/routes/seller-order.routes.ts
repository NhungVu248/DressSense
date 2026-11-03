import { Router } from 'express';
import {
  listSellerOrders, updateOrderStatus, updateShippingInfo, approveCancel, rejectCancel,
} from '../controllers/order-seller.controller';
import { listSellerReturns, approveReturn, rejectReturn, replyReturn } from '../controllers/return.controller';
import { listSellerComplaints, sellerRespondComplaint } from '../controllers/complaint.controller';
import { createIncident, resolveIncident, listSellerIncidents } from '../controllers/incident.controller';
import { listSellerReviews, replyReview } from '../controllers/review.controller';
import { listSellerQuestions, answerQuestion } from '../controllers/question.controller';
import { getMyShop, updateMyShop, submitMyShop } from '../controllers/shop.controller';
import { getSellerReport } from '../controllers/seller-report.controller';
import { getSellerFinance, listSellerCommissions, listSellerSettlements, updateSellerBankInfo } from '../controllers/commission-seller.controller';
import {
  createBannerOrder, listMyBannerOrders, payBannerOrder, markPaidSandbox, cancelBannerOrder,
} from '../controllers/banner-order.controller';
import {
  createVoucherOrder, listMyVoucherOrders, payVoucherOrder, markVoucherPaidSandbox, cancelVoucherOrder,
} from '../controllers/voucher-order.controller';
import { listInventory, adjustStock, listStockMovements } from '../controllers/inventory.controller';
import {
  listShippingMethods, createShippingMethod, updateShippingMethod, deleteShippingMethod, toggleSystemMethod,
} from '../controllers/shipping-method.controller';
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

// Mục 3 - Tài chính & doanh thu (hoa hồng, số dư, lịch sử thanh toán, thông tin nhận tiền)
router.get('/finance', getSellerFinance);
router.get('/finance/commissions', listSellerCommissions);
router.get('/finance/settlements', listSellerSettlements);
router.put('/finance/bank', updateSellerBankInfo);

router.get('/orders', listSellerOrders);
router.patch('/orders/:id/status', updateOrderStatus);          // cập nhật trạng thái theo thứ tự
router.patch('/orders/:id/shipping', updateShippingInfo);       // cập nhật thông tin vận chuyển
router.patch('/orders/:id/cancel/approve', approveCancel);      // UC10.5 - duyệt yêu cầu hủy
router.patch('/orders/:id/cancel/reject', rejectCancel);        // UC10.5 - từ chối yêu cầu hủy

// UC11.1 - đổi/trả
router.get('/returns', listSellerReturns);
router.patch('/returns/:id/approve', approveReturn);
router.patch('/returns/:id/reject', rejectReturn);
router.patch('/returns/:id/reply', replyReturn); // Backlog B.24 - phản hồi trực tiếp với khách

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

// Backlog B.26 - đơn đăng ký chạy banner quảng cáo (gian hàng)
router.get('/ad-orders', listMyBannerOrders);
router.post('/ad-orders', createBannerOrder);
router.post('/ad-orders/:id/pay', payBannerOrder);
router.post('/ad-orders/:id/mark-paid', markPaidSandbox);
router.delete('/ad-orders/:id', cancelBannerOrder);

// Backlog B.27 - đơn mua gói voucher (gian hàng)
router.get('/voucher-orders', listMyVoucherOrders);
router.post('/voucher-orders', createVoucherOrder);
router.post('/voucher-orders/:id/pay', payVoucherOrder);
router.post('/voucher-orders/:id/mark-paid', markVoucherPaidSandbox);
router.delete('/voucher-orders/:id', cancelVoucherOrder);

// ERD 3.8/3.9 (Seller #4) - Quản lý tồn kho + lịch sử biến động
router.get('/inventory', listInventory);
router.get('/inventory/movements', listStockMovements);
router.patch('/inventory/:variantId', adjustStock);

// ERD 3.3 (Seller #6) - Quản lý phương thức vận chuyển của gian hàng
router.get('/shipping-methods', listShippingMethods);
router.post('/shipping-methods/system', toggleSystemMethod); // bật/tắt phương thức hệ thống
router.post('/shipping-methods', createShippingMethod);
router.put('/shipping-methods/:id', updateShippingMethod);
router.delete('/shipping-methods/:id', deleteShippingMethod);

export default router;

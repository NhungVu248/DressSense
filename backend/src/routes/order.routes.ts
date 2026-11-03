import { Router } from 'express';
import { getCheckoutInfo, placeOrder, listOrders, getOrder, confirmReceipt, cancelOrder } from '../controllers/order.controller';
import { issueInvoice, getInvoice, emailInvoice } from '../controllers/invoice.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC9.1 - đặt hàng yêu cầu đăng nhập
router.use(authenticate);

router.get('/checkout', getCheckoutInfo); // dữ liệu trang checkout (đặt trước '/:id')
router.get('/', listOrders);               // UC10.1 - danh sách (lọc theo trạng thái)
router.post('/', placeOrder);
router.get('/:id', getOrder);
router.patch('/:id/confirm-receipt', confirmReceipt); // UC10.3 - xác nhận nhận hàng
router.post('/:id/cancel', cancelOrder);              // UC10.5 - hủy đơn
router.get('/:id/invoice', getInvoice);               // Backlog - lấy hóa đơn VAT
router.post('/:id/invoice', issueInvoice);            // Backlog - xuất/ xuất lại hóa đơn VAT
router.post('/:id/invoice/email', emailInvoice);      // Gửi hóa đơn về email người mua

export default router;

import { Router } from 'express';
import {
  listVouchersManage, createVoucher, updateVoucher, activateVoucher, stopVoucher, deleteVoucher,
  listFlashSales, createFlashSale, updateFlashSale, activateFlashSale, stopFlashSale, deleteFlashSale,
  listActiveFlashSales,
} from '../controllers/promotion.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC13.1 - CÔNG KHAI: Flash Sale đang diễn ra (trang chủ)
router.get('/flash-sales/active', listActiveFlashSales);

// UC13.1 - quản lý khuyến mãi: chỉ Người bán / Quản trị viên
router.use(authenticate, authorize('SELLER', 'ADMIN'));

// Voucher
router.get('/vouchers', listVouchersManage);
router.post('/vouchers', createVoucher);
router.patch('/vouchers/:id', updateVoucher);
router.post('/vouchers/:id/activate', activateVoucher);
router.post('/vouchers/:id/stop', stopVoucher);
router.delete('/vouchers/:id', deleteVoucher);

// Flash Sale
router.get('/flash-sales', listFlashSales);
router.post('/flash-sales', createFlashSale);
router.patch('/flash-sales/:id', updateFlashSale);
router.post('/flash-sales/:id/activate', activateFlashSale);
router.post('/flash-sales/:id/stop', stopFlashSale);
router.delete('/flash-sales/:id', deleteFlashSale);

export default router;

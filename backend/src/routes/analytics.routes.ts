import { Router } from 'express';
import {
  getRevenueAnalytics, getCustomerAnalytics, getBehaviorAnalytics,
  getBodyShapeAnalytics, getInventoryAnalytics,
} from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC15 - Phân tích dữ liệu kinh doanh: Người bán (phạm vi gian hàng) & Quản trị viên
router.use(authenticate, authorize('SELLER', 'ADMIN'));

router.get('/customers', getCustomerAnalytics); // UC15.1
router.get('/behavior', getBehaviorAnalytics); // UC15.2
router.get('/body-shapes', getBodyShapeAnalytics); // UC15.3
router.get('/revenue', getRevenueAnalytics); // UC15.4
router.get('/inventory', getInventoryAnalytics); // UC15.5

export default router;

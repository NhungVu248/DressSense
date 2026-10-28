import { Router } from 'express';
import {
  listUsers,
  getUserDetail,
  updateUserRole,
  listAuditLogs,
} from '../controllers/admin.controller';
import { listAdminComplaints, adminResolveComplaint } from '../controllers/complaint.controller';
import { listAdminReviews, moderateReview } from '../controllers/review.controller';
import { listShopsAdmin, approveShop, rejectShop, setShopSuspension } from '../controllers/shop.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC1.7 - Phân quyền người dùng: chỉ Quản trị viên (ADMIN) đã đăng nhập
router.use(authenticate, authorize('ADMIN'));

router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id', updateUserRole);
router.get('/audit-logs', listAuditLogs);

// UC11.2 - phân xử khiếu nại
router.get('/complaints', listAdminComplaints);
router.patch('/complaints/:id/resolve', adminResolveComplaint);

// UC12.1 - kiểm duyệt đánh giá
router.get('/reviews', listAdminReviews);
router.patch('/reviews/:id/moderate', moderateReview);

// UC14.1 / UC16.3 - kiểm duyệt gian hàng
router.get('/shops', listShopsAdmin);
router.patch('/shops/:id/approve', approveShop);
router.patch('/shops/:id/reject', rejectShop);
router.patch('/shops/:id/suspension', setShopSuspension);

export default router;

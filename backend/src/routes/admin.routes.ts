import { Router } from 'express';
import {
  listUsers,
  getUserDetail,
  updateUserRole,
  listAuditLogs,
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC1.7 - Phân quyền người dùng: chỉ Quản trị viên (ADMIN) đã đăng nhập
router.use(authenticate, authorize('ADMIN'));

router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id', updateUserRole);
router.get('/audit-logs', listAuditLogs);

export default router;

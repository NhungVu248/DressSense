import { Router } from 'express';
import { createReport } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth';

// ERD 3.19 - mọi người dùng đã đăng nhập (Buyer/Seller) đều có thể gửi báo cáo vi phạm.
const router = Router();
router.use(authenticate);
router.post('/', createReport);

export default router;

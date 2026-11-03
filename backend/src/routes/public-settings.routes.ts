import { Router } from 'express';
import { getPublicSettings } from '../controllers/settings.controller';

const router = Router();

// Cấu hình công khai (thuế VAT, tên hệ thống…) - không cần đăng nhập
router.get('/public', getPublicSettings);

export default router;

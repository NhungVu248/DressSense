import { Router } from 'express';
import { listPublicBanners } from '../controllers/banner.controller';

const router = Router();

// UC13.2 - CÔNG KHAI: banner đang hiển thị theo vị trí (trang chủ/khuyến mãi)
router.get('/', listPublicBanners);

export default router;

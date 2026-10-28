import { Router } from 'express';
import {
  listBanners, createBanner, updateBanner, activateBanner, hideBanner, deleteBanner,
} from '../controllers/banner.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC13.2 - quản lý banner: chỉ Quản trị viên
router.use(authenticate, authorize('ADMIN'));

router.get('/', listBanners);
router.post('/', createBanner);
router.patch('/:id', updateBanner);
router.post('/:id/activate', activateBanner);
router.post('/:id/hide', hideBanner);
router.delete('/:id', deleteBanner);

export default router;

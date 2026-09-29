import { Router } from 'express';
import {
  getCatalog,
  getProfile,
  updateProfile,
  listSizes,
  upsertSize,
  deleteSize,
  bodySyncStatus,
  bodySync,
  bodyAutoSync,
} from '../controllers/personalization.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC2.1/UC2.2 - chỉ Khách hàng đã đăng nhập mới thao tác trên hồ sơ của chính mình
router.use(authenticate);

router.get('/catalog', getCatalog);

// UC2.1 - Thiết lập hồ sơ cá nhân hóa
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// UC2.2 - Quản lý thông tin size
router.get('/sizes', listSizes);
router.put('/sizes/:categoryId', upsertSize);
router.delete('/sizes/:categoryId', deleteSize);

// UC2.3 - Đồng bộ Body Profile
router.get('/body-sync', bodySyncStatus);
router.post('/body-sync', bodySync);
router.put('/body-sync/auto', bodyAutoSync);

export default router;

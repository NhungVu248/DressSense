import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  updateAvatar,
  requestChangeContact,
  verifyChangeContact,
} from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth';
import { uploadAvatar } from '../middlewares/upload';

const router = Router();
router.use(authenticate); // UC1.4/1.5: tất cả route hồ sơ yêu cầu đăng nhập

// UC1.4 - Xem hồ sơ
router.get('/me', getMyProfile);

// UC1.5 - Cập nhật hồ sơ
router.patch('/me', updateMyProfile);
router.post('/me/avatar', (req, res, next) => {
  uploadAvatar(req, res, (err: any) => {
    if (err) {
      const message = err.message === 'INVALID_IMAGE_TYPE'
        ? 'Ảnh phải ở định dạng JPG, PNG hoặc WEBP'
        : err.code === 'LIMIT_FILE_SIZE'
          ? 'Ảnh vượt quá dung lượng tối đa 3MB'
          : 'Không tải được ảnh, vui lòng thử lại';
      return res.status(400).json({ message });
    }
    next();
  });
}, updateAvatar);
router.post('/me/contact/request', requestChangeContact);
router.post('/me/contact/verify', verifyChangeContact);

export default router;

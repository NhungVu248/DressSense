import { Router } from 'express';
import {
  getConsent,
  giveConsent,
  analyzeBody,
  getLatestProfile,
  getHistory,
  deleteBodyData,
} from '../controllers/body.controller';
import { authenticate } from '../middlewares/auth';
import { uploadBodyPhoto } from '../middlewares/upload';

const router = Router();

// UC3 - chỉ Khách hàng đã đăng nhập mới được phân tích/xem/xóa dữ liệu cơ thể của chính mình
router.use(authenticate);

// UC3.1 bước 2 - đồng ý điều khoản xử lý dữ liệu cơ thể (informed consent)
router.get('/consent', getConsent);
router.post('/consent', giveConsent);

// UC3.1 (bao gồm UC3.2 xử lý + UC3.3 sinh Body Profile) - ảnh là tùy chọn (multipart 'photo')
router.post('/analyze', (req, res, next) => {
  uploadBodyPhoto(req, res, (err: any) => {
    if (err) {
      const message = err.message === 'INVALID_IMAGE_TYPE'
        ? 'Ảnh phải ở định dạng JPG, PNG hoặc WEBP' // 5E
        : err.code === 'LIMIT_FILE_SIZE'
          ? 'Ảnh vượt quá dung lượng tối đa 5MB'
          : 'Không tải được ảnh, vui lòng thử lại';
      return res.status(400).json({ message });
    }
    next();
  });
}, analyzeBody);

router.get('/profile', getLatestProfile);
router.get('/history', getHistory);

// UC3.4 - Xóa dữ liệu cơ thể
router.delete('/data', deleteBodyData);

export default router;

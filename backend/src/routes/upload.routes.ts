import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { uploadMedia } from '../middlewares/upload';

const router = Router();

// POST /api/upload - tải lên ảnh (Ảnh bìa shop, Banner quảng cáo, v.v.)
router.post('/', authenticate, (req, res) => {
  uploadMedia(req, res, (err: any) => {
    if (err) {
      const msg = err.message === 'INVALID_IMAGE_TYPE'
        ? 'Định dạng ảnh không hợp lệ (chỉ chấp nhận JPG, PNG, WEBP).'
        : 'Tệp tải lên không hợp lệ hoặc vượt quá dung lượng 10MB.';
      return res.status(400).json({ message: msg });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn tệp ảnh để tải lên.' });
    }
    const url = `/uploads/media/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  });
});

export default router;


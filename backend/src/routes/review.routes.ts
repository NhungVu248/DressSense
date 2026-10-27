import { Router } from 'express';
import { createReview, getProductReviews, uploadReviewImagesHandler } from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth';
import { uploadReviewImages } from '../middlewares/upload';

const router = Router();

// UC12.1 - công khai: xem đánh giá của sản phẩm
router.get('/product/:id', getProductReviews);

// cần đăng nhập: tạo đánh giá + tải ảnh
router.use(authenticate);
router.post('/', createReview);
router.post('/upload', (req, res, next) => {
  uploadReviewImages(req, res, (err: any) => {
    if (err) {
      const msg = err.message === 'INVALID_IMAGE_TYPE' ? 'Ảnh phải ở định dạng JPG, PNG hoặc WEBP' // 6E
        : err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh tối đa 5MB'
          : 'Không tải được ảnh, vui lòng thử lại';
      return res.status(400).json({ message: msg });
    }
    next();
  });
}, uploadReviewImagesHandler);

export default router;

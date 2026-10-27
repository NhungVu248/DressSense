import { Router } from 'express';
import { createReview, getProductReviews } from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC12.1 - công khai: xem đánh giá của sản phẩm
router.get('/product/:id', getProductReviews);

// cần đăng nhập: tạo đánh giá
router.use(authenticate);
router.post('/', createReview);

export default router;

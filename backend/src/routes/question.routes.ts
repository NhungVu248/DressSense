import { Router } from 'express';
import { createQuestion, getProductQuestions } from '../controllers/question.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC12.3 - công khai: xem hỏi đáp của sản phẩm
router.get('/product/:id', getProductQuestions);

// cần đăng nhập: đặt câu hỏi
router.use(authenticate);
router.post('/', createQuestion);

export default router;

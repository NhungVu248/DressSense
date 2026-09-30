import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { recommendForUser } from '../services/recommendation.service';

const router = Router();

// UC5 - Gợi ý sản phẩm cá nhân hóa (yêu cầu đăng nhập)
router.use(authenticate);

// GET /api/recommendations?limit=&categoryId=
router.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const result = await recommendForUser(req.user!.userId, { limit, categoryId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

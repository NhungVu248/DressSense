import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { recommendForUser, relatedProducts } from '../services/recommendation.service';
import { composeOutfits } from '../services/outfit.service';

const router = Router();

// UC5 - Gợi ý sản phẩm cá nhân hóa (yêu cầu đăng nhập)
router.use(authenticate);

// GET /api/recommendations/outfits?occasion=&limit= - UC4 bước B: ghép BỘ ĐỒ từ kho
router.get('/outfits', async (req, res, next) => {
  try {
    const occasion = req.query.occasion ? String(req.query.occasion) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await composeOutfits(req.user!.userId, { occasion, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/recommendations?limit=&categoryId=
router.get('/', async (req, res, next) => {
  try {
    const num = (v: unknown) => (v != null && v !== '' ? Number(v) : undefined);
    const result = await recommendForUser(req.user!.userId, {
      limit: num(req.query.limit),
      categoryId: num(req.query.categoryId),
      occasion: req.query.occasion ? String(req.query.occasion) : undefined, // 3a - dịp tạm
      minPrice: num(req.query.minPrice), // 3a - khoảng giá tạm (lọc mềm)
      maxPrice: num(req.query.maxPrice),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/recommendations/related?productId=&limit= - UC5.1 (1a) SP liên quan khi đang xem SP
router.get('/related', async (req, res, next) => {
  try {
    const productId = Number(req.query.productId);
    if (!productId) return res.status(400).json({ message: 'Thiếu productId' });
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await relatedProducts(req.user!.userId, productId, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

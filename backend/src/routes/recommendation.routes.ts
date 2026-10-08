import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { recommendForUser, relatedProducts } from '../services/recommendation.service';
import { composeOutfits, outfitAlternatives, OUTFIT_SLOTS } from '../services/outfit.service';

const router = Router();

// UC5 - Gợi ý sản phẩm cá nhân hóa (yêu cầu đăng nhập)
router.use(authenticate);

// GET /api/recommendations/outfits?occasion=&limit=&anchorProductId=&budget= - UC5.2: ghép BỘ ĐỒ
router.get('/outfits', async (req, res, next) => {
  try {
    const num = (v: unknown) => (v != null && v !== '' ? Number(v) : undefined);
    const result = await composeOutfits(req.user!.userId, {
      occasion: req.query.occasion ? String(req.query.occasion) : undefined,
      limit: num(req.query.limit),
      anchorProductId: num(req.query.anchorProductId), // 1a - phối quanh SP neo
      budget: num(req.query.budget), // ngân sách tổng (lọc mềm)
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/recommendations/outfits/alternatives?slot=&keep=1,2&occasion= - UC5.2 (6a) thay 1 món
router.get('/outfits/alternatives', async (req, res, next) => {
  try {
    const slot = String(req.query.slot || '').toUpperCase();
    if (!(OUTFIT_SLOTS as readonly string[]).includes(slot)) {
      return res.status(400).json({ message: `slot không hợp lệ (cần 1 trong: ${OUTFIT_SLOTS.join(', ')})` });
    }
    const keepIds = String(req.query.keep || '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    const result = await outfitAlternatives(req.user!.userId, {
      slot: slot as any,
      keepIds,
      occasion: req.query.occasion ? String(req.query.occasion) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
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

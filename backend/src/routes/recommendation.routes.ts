import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { recommendForUser, relatedProducts, searchByImageMatch } from '../services/recommendation.service';
import { composeOutfits, outfitAlternatives, OUTFIT_SLOTS } from '../services/outfit.service';
import { uploadSearchImage } from '../middlewares/upload';
import { aiEnabled, aiColorFromBuffer } from '../services/ai-client';

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

// POST /api/recommendations/search-by-image - UC5.3 tìm SP tương tự theo ẢNH (màu + loại).
// Ảnh chỉ nằm trong RAM, KHÔNG lưu đĩa (tối thiểu hóa dữ liệu).
router.post('/search-by-image',
  (req, res, next) => {
    uploadSearchImage(req, res, (err: any) => {
      if (err) return res.status(400).json({ message: err.message === 'INVALID_IMAGE_TYPE' ? 'Ảnh phải ở định dạng JPG, PNG hoặc WEBP' : 'Không tải được ảnh, vui lòng thử lại' }); // 4E
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Vui lòng cung cấp ảnh cần tìm.' }); // 4E
      if (!aiEnabled()) return res.status(503).json({ message: 'Dịch vụ AI trích đặc trưng ảnh chưa sẵn sàng.' }); // 5F
      const color = await aiColorFromBuffer(req.file.buffer, req.file.originalname || 'search.jpg');
      if (!color) return res.status(422).json({ message: 'Không nhận diện được đặc trưng món đồ trong ảnh. Hãy thử ảnh rõ hơn.' }); // 4E
      const garment = (req.body?.garment ?? req.query.garment) ? String(req.body?.garment ?? req.query.garment) : undefined; // 4a - chọn loại món chính
      const limit = req.body?.limit ?? req.query.limit;
      const result = await searchByImageMatch(req.user!.userId, { color: color.code, garment, limit: limit ? Number(limit) : undefined });
      res.json({ ...result, confidence: color.conf });
    } catch (err) {
      next(err);
    }
  });

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth';
import { recordBehavior } from '../services/behavior.service';

const router = Router();
router.use(authenticate);

const schema = z.object({
  productId: z.number().int(),
  action: z.enum(['VIEW', 'WISHLIST', 'ADD_TO_CART', 'PURCHASE', 'HIDE']),
});

// POST /api/behaviors - ghi nhận 1 sự kiện tương tác (UC5/GĐ6)
router.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu hành vi không hợp lệ' });
    await recordBehavior(req.user!.userId, parsed.data.productId, parsed.data.action);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

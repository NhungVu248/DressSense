import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/categories - danh mục sản phẩm dùng chung (lọc sản phẩm, ngân sách UC2.1, size UC2.2)
router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

export default router;

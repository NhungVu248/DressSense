import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// GET /api/products  (hỗ trợ phân trang + lọc theo danh mục)
export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 12);
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where: categoryId ? { categoryId } : undefined,
        include: { images: true, category: true, bodyFits: true }, // UC4 - điểm tương thích dáng
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where: categoryId ? { categoryId } : undefined }),
    ]);

    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:id
export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true, variants: true, category: true, reviews: true,
        bodyFits: { orderBy: { score: 'desc' } }, // UC4 - điểm tương thích dáng (cao->thấp)
      },
    });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(),
  categoryId: z.number().int(),
  color: z.string().optional(),
  pattern: z.string().optional(),
  material: z.string().optional(),
  fit: z.string().optional(),
  length: z.string().optional(),
  neckline: z.string().optional(),
  sleeve: z.string().optional(),
  style: z.string().optional(),
  season: z.string().optional(),
  // Trường bổ sung theo lược đồ DeepFashion2
  garmentType: z.string().optional(),
  targetGender: z.string().optional(),
  brand: z.string().optional(),
  occasion: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// POST /api/products  (chỉ SELLER/ADMIN)
export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createSchema.parse(req.body);
    const product = await prisma.product.create({
      data: { ...data, sellerId: req.user!.userId },
    });
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

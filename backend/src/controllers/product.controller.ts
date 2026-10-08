import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { analyzeProduct, analyzeMany } from '../services/product-analysis.service';

// UC4.1 - chỉ Người bán (SP của mình) hoặc Quản trị viên mới được phân tích/xác nhận nhãn
async function assertCanEdit(req: Request, productId: number): Promise<{ ok: true } | { ok: false; code: number; message: string }> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { sellerId: true } });
  if (!p) return { ok: false, code: 404, message: 'Không tìm thấy sản phẩm' };
  if (req.user?.role !== 'ADMIN' && p.sellerId !== req.user?.userId) return { ok: false, code: 403, message: 'Không có quyền với sản phẩm này' };
  return { ok: true };
}

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
        analysis: true, // UC4.1 - nhãn thuộc tính đề xuất/đã xác nhận
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
    // UC4.1 - tự động phân tích khi thêm mới (sự kiện kích hoạt). Lỗi không làm hỏng việc tạo SP.
    let analysis = null;
    try { analysis = await analyzeProduct(product.id); } catch { /* 8E - để phân tích lại sau */ }
    res.status(201).json({ product, analysis });
  } catch (err) {
    next(err);
  }
}

// POST /api/products/:id/analyze - "Phân tích lại sản phẩm" (UC4.1 sự kiện kích hoạt thủ công)
export async function analyzeProductEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const analysis = await analyzeProduct(id);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

const confirmSchema = z.object({
  attributes: z.record(z.string(), z.string()).optional(), // điều chỉnh/bổ sung nhãn thủ công (8b)
});

// POST /api/products/:id/analysis/confirm - Người bán/Admin xác nhận hoặc điều chỉnh nhãn (luồng 8)
export async function confirmAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const body = confirmSchema.parse(req.body);
    const current = await prisma.productAnalysis.findUnique({ where: { productId: id } });
    if (!current) return res.status(404).json({ message: 'Sản phẩm chưa được phân tích. Hãy chạy phân tích trước.' });
    const attributes = { ...(current.attributes as Record<string, string> | null ?? {}), ...(body.attributes ?? {}) };
    const analysis = await prisma.productAnalysis.update({
      where: { productId: id },
      data: {
        status: 'CONFIRMED', attributes, occasion: attributes.occasion ?? current.occasion,
        confirmedAt: new Date(), confirmedBy: req.user!.userId,
      },
    });
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

// POST /api/products/analyze-batch - phân tích hàng loạt (UC4.1 luồng 1a). ADMIN: toàn sàn; SELLER: SP của mình.
export async function analyzeBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = req.user?.role === 'ADMIN' ? undefined : req.user?.userId;
    const result = await analyzeMany(sellerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

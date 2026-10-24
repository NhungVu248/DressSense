import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC8.2 - Quản lý Wishlist (danh sách yêu thích)
//  Gắn với tài khoản; 1 sản phẩm chỉ xuất hiện 1 lần; tồn tại giữa các phiên.
// ============================================================

const availableOf = (v: { stock: number; reserved: number }) => Math.max(0, v.stock - v.reserved);

// GET /api/wishlist - danh sách yêu thích kèm giá & trạng thái hiện tại
export async function getWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.wishlist.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            category: { select: { id: true, name: true } },
            variants: { select: { id: true, size: true, stock: true, reserved: true } },
            reviews: { select: { rating: true } },
          },
        },
      },
    });
    const items = rows.map((w) => {
      const p = w.product;
      const sellable = p.status === 'ACTIVE' && !p.deletedAt;
      const inStock = p.variants.some((v) => availableOf(v) > 0);
      const ratingCount = p.reviews.length;
      const ratingAvg = ratingCount ? p.reviews.reduce((a, r) => a + r.rating, 0) / ratingCount : 0;
      return {
        productId: p.id,
        name: p.name,
        price: p.price,
        color: p.color,
        image: p.images[0]?.url ?? null,
        category: p.category,
        sizes: p.variants.map((v) => ({ id: v.id, size: v.size, available: availableOf(v) })),
        sellable,   // 7a - còn được bán không
        inStock,    // sản phẩm hết hàng vẫn giữ trong wishlist (quy tắc nghiệp vụ)
        ratingAvg: Math.round(ratingAvg * 10) / 10,
        ratingCount,
        createdAt: w.createdAt,
      };
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// GET /api/wishlist/ids - danh sách productId đã lưu (để tô tim trên thẻ sản phẩm)
export async function getWishlistIds(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.wishlist.findMany({ where: { userId: req.user!.userId }, select: { productId: true } });
    res.json({ ids: rows.map((r) => r.productId) });
  } catch (err) {
    next(err);
  }
}

const addSchema = z.object({ productId: z.coerce.number().int() });

// POST /api/wishlist - thêm sản phẩm vào wishlist (2a: đã có thì không tạo trùng)
export async function addWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const body = addSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const { productId } = body.data;

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, deletedAt: true } });
    if (!product || product.deletedAt) return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });

    // @@unique([userId, productId]) -> upsert tránh bản ghi trùng (2a)
    await prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    res.status(201).json({ added: true, productId });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/wishlist/:productId - 5a xóa khỏi wishlist
export async function removeWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const productId = Number(req.params.productId);
    await prisma.wishlist.deleteMany({ where: { userId, productId } });
    res.json({ removed: true, productId });
  } catch (err) {
    next(err);
  }
}

const toCartSchema = z.object({
  variantId: z.coerce.number().int().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
});
const PURCHASE_LIMIT = 10;

// POST /api/wishlist/:productId/to-cart - chuyển sang giỏ (kiểm tra lại biến thể/tồn kho; 6a/7a/14E)
export async function wishlistToCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const productId = Number(req.params.productId);
    const body = toCartSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const { variantId, quantity } = body.data;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { select: { id: true, stock: true, reserved: true } } },
    });
    if (!product || product.deletedAt || product.status !== 'ACTIVE') {
      return res.status(409).json({ message: 'Sản phẩm không còn được bán.', code: 'UNAVAILABLE' }); // 7a
    }
    // 6a - có biến thể thì phải chọn size
    let variant = null as (typeof product.variants)[number] | null;
    if (product.variants.length > 0) {
      if (!variantId) return res.status(400).json({ message: 'Vui lòng chọn size trước khi thêm vào giỏ.', code: 'VARIANT_REQUIRED' });
      variant = product.variants.find((v) => v.id === variantId) ?? null;
      if (!variant) return res.status(400).json({ message: 'Biến thể không hợp lệ.' });
      if (availableOf(variant) <= 0) return res.status(409).json({ message: 'Biến thể đã hết hàng.', code: 'OUT_OF_STOCK' }); // 14E
    }
    const cap = Math.min(PURCHASE_LIMIT, variant ? availableOf(variant) : PURCHASE_LIMIT);

    const existing = await prisma.cartItem.findFirst({ where: { userId, productId, variantId: variantId ?? null } });
    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(existing.quantity + quantity, cap), selected: true } });
    } else {
      await prisma.cartItem.create({ data: { userId, productId, variantId: variantId ?? null, quantity: Math.min(quantity, cap) } });
    }
    // Quy tắc: thêm vào giỏ KHÔNG bắt buộc xóa khỏi wishlist -> giữ nguyên
    res.json({ addedToCart: true });
  } catch (err) {
    next(err);
  }
}

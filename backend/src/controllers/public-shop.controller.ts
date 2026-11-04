import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { flashPriceMapByProduct } from '../services/promotion.service';

// ============================================================
//  Trang gian hàng công khai (khách xem) - kiểu Shopee
//  GET /api/shops/:sellerId
//  Chỉ hiển thị gian hàng đang hoạt động (Shop.status = ACTIVE) + sản phẩm ACTIVE.
// ============================================================

// Dựng thẻ sản phẩm giống listProducts (product.controller.ts) để FE tái dùng ProductCard.
function toCard(p: any, salePrice: number | null) {
  const ratingCount = p.reviews.length;
  const ratingAvg = ratingCount ? p.reviews.reduce((a: number, r: any) => a + r.rating, 0) / ratingCount : 0;
  const inStock = p.variants.some((v: any) => v.stock > 0);
  const { reviews, _count, variants, ...rest } = p;
  return {
    ...rest,
    featured: p.featured,
    sizes: [...new Set(p.variants.map((v: any) => v.size))],
    ratingAvg: Math.round(ratingAvg * 10) / 10,
    ratingCount,
    soldCount: p._count.orderItems,
    inStock,
    salePrice: salePrice != null && salePrice < p.price ? salePrice : null,
    onSale: salePrice != null && salePrice < p.price,
  };
}

export async function getPublicShop(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = Number(req.params.sellerId);
    if (!Number.isInteger(sellerId)) return res.status(400).json({ message: 'Gian hàng không hợp lệ.' });

    // Hồ sơ gian hàng: chỉ lộ khi đang hoạt động (đã được Admin duyệt)
    const shop = await prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop || shop.status !== 'ACTIVE') return res.status(404).json({ message: 'Gian hàng không tồn tại hoặc chưa hoạt động.' });

    // Sản phẩm đang bán của gian hàng
    const rows = await prisma.product.findMany({
      where: { sellerId, status: 'ACTIVE', deletedAt: null },
      include: {
        images: true, category: { select: { id: true, name: true } },
        variants: { select: { size: true, stock: true } },
        reviews: { select: { rating: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });

    const flashMap = await flashPriceMapByProduct(rows.map((p) => p.id));
    const products = rows.map((p) => toCard(p, flashMap.get(p.id) ?? null));

    // Danh mục của gian hàng (distinct) + số lượng
    const catCount = new Map<number, { id: number; name: string; count: number }>();
    for (const p of products) {
      const c = p.category;
      if (!catCount.has(c.id)) catCount.set(c.id, { id: c.id, name: c.name, count: 0 });
      catCount.get(c.id)!.count++;
    }
    const categories = [...catCount.values()].sort((a, b) => b.count - a.count);

    // Sản phẩm nổi bật: ưu tiên SP người bán tự tích; nếu chưa tích thì fallback bán chạy
    const picked = products.filter((p) => p.featured);
    const featured = (picked.length ? picked : [...products].sort((a, b) => b.soldCount - a.soldCount)).slice(0, 8);

    // Thống kê hiển thị
    const ratingCountTotal = products.reduce((a, p) => a + p.ratingCount, 0);
    const ratingAvgAll = ratingCountTotal
      ? Math.round((products.reduce((a, p) => a + p.ratingAvg * p.ratingCount, 0) / ratingCountTotal) * 10) / 10
      : 0;

    res.json({
      shop: {
        sellerId,
        name: shop.name,
        logoUrl: shop.logoUrl,
        coverUrl: shop.coverUrl,
        description: shop.description,
        contactEmail: shop.contactEmail,
        contactPhone: shop.contactPhone,
        createdAt: shop.createdAt,
      },
      stats: {
        productCount: products.length,
        soldTotal: products.reduce((a, p) => a + p.soldCount, 0),
        ratingAvg: ratingAvgAll,
        ratingCount: ratingCountTotal,
      },
      categories,
      featured,
      products,
    });
  } catch (err) {
    next(err);
  }
}

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';

// ============================================================
//  UC16.4 - Kiểm duyệt nội dung: SẢN PHẨM.
//  (Phần đánh giá dùng lại review.controller: listAdminReviews / moderateReview.)
// ============================================================

// GET /api/admin/moderation/products?status=PENDING
export async function listModerationProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING';
    const products = await prisma.product.findMany({
      where: { status: status as any, deletedAt: null },
      include: {
        seller: { select: { id: true, fullName: true } },
        category: { select: { name: true } },
        images: { take: 1, select: { url: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    const counts = await prisma.product.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
    res.json({ products, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) });
  } catch (err) { next(err); }
}

// PATCH /api/admin/moderation/products/:id  { action: 'approve'|'hide'|'reject', reason? }
export async function moderateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const action = req.body?.action;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' }); // 4E

    let status: 'ACTIVE' | 'HIDDEN';
    let msg: string;
    if (action === 'approve') { status = 'ACTIVE'; msg = `Sản phẩm "${product.name}" đã được duyệt và hiển thị bán.`; }
    else if (action === 'hide' || action === 'reject') {
      if (!reason) return res.status(400).json({ message: 'Vui lòng nhập lý do ẩn/từ chối.' }); // 6
      status = 'HIDDEN';
      msg = `Sản phẩm "${product.name}" bị ${action === 'hide' ? 'ẩn' : 'từ chối'}. Lý do: ${reason}`;
    } else {
      return res.status(400).json({ message: 'Hành động không hợp lệ.' });
    }

    const updated = await prisma.product.update({ where: { id }, data: { status } });
    await notify(product.sellerId, 'SHOP', 'Kết quả kiểm duyệt sản phẩm', msg, '/seller/products');
    res.json({ product: updated });
  } catch (err) { next(err); }
}

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { recordStockMovement } from '../services/stock.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  ERD 3.8/3.9 - Quản lý tồn kho (Seller #4)
//  Tồn kho lưu ngay trên ProductVariant (stock/reserved); module này cho Người bán
//  xem, điều chỉnh và xem LỊCH SỬ biến động kho (StockMovement).
// ============================================================

// Điều kiện lọc biến thể thuộc Người bán đang đăng nhập (ADMIN xem tất cả)
function variantScope(user: JwtPayload) {
  return user.role === 'ADMIN' ? {} : { product: { sellerId: user.userId } };
}

// GET /api/seller/inventory?q=&lowStock=1 - danh sách tồn kho theo biến thể
export async function listInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const lowOnly = req.query.lowStock === '1' || req.query.lowStock === 'true';

    const where: any = { ...variantScope(user) };
    if (q) where.product = { ...(where.product || {}), name: { contains: q } };

    const variants = await prisma.productVariant.findMany({
      where,
      orderBy: [{ productId: 'asc' }, { size: 'asc' }],
      include: {
        product: { select: { id: true, name: true, sellerId: true, status: true } },
      },
    });

    const items = variants
      .map((v) => ({
        variantId: v.id,
        productId: v.productId,
        productName: v.product.name,
        productStatus: v.product.status,
        size: v.size,
        stock: v.stock,
        reserved: v.reserved,
        available: v.stock - v.reserved,
        lowStockThreshold: v.lowStockThreshold,
        isLow: v.lowStockThreshold != null && v.stock - v.reserved <= v.lowStockThreshold,
      }))
      .filter((it) => (lowOnly ? it.isLow : true));

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

const adjustSchema = z.object({
  type: z.enum(['IMPORT', 'EXPORT', 'ADJUSTMENT']),
  quantity: z.number().int(), // IMPORT/EXPORT: số dương; ADJUSTMENT: giá trị tồn mới (tuyệt đối)
  note: z.string().trim().max(500).optional(),
  lowStockThreshold: z.number().int().min(0).nullable().optional(),
});

// PATCH /api/seller/inventory/:variantId - nhập/xuất/điều chỉnh tồn kho
export async function adjustStock(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const variantId = Number(req.params.variantId);
    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const { type, quantity, note } = parsed.data;

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, ...variantScope(user) },
    });
    if (!variant) return res.status(404).json({ message: 'Không tìm thấy biến thể trong gian hàng của bạn.' });

    // Tính tồn kho mới + delta ghi lịch sử theo từng loại biến động
    let newStock = variant.stock;
    let delta = 0;
    if (type === 'IMPORT') {
      if (quantity <= 0) return res.status(400).json({ message: 'Số lượng nhập phải lớn hơn 0.' });
      delta = quantity;
      newStock = variant.stock + quantity;
    } else if (type === 'EXPORT') {
      if (quantity <= 0) return res.status(400).json({ message: 'Số lượng xuất phải lớn hơn 0.' });
      delta = -quantity;
      newStock = variant.stock - quantity;
    } else {
      // ADJUSTMENT: quantity là tồn kho MỚI (tuyệt đối)
      if (quantity < 0) return res.status(400).json({ message: 'Tồn kho không thể âm.' });
      delta = quantity - variant.stock;
      newStock = quantity;
    }

    if (newStock < 0) return res.status(400).json({ message: 'Tồn kho sau thao tác không thể âm.' });
    if (newStock < variant.reserved)
      return res.status(400).json({ message: `Không thể giảm dưới số đang giữ chỗ (${variant.reserved}).` });

    const data: any = { stock: newStock };
    if (parsed.data.lowStockThreshold !== undefined) data.lowStockThreshold = parsed.data.lowStockThreshold;

    const updated = await prisma.productVariant.update({ where: { id: variantId }, data });
    if (delta !== 0) {
      await recordStockMovement({
        variantId, type, quantity: delta, referenceType: 'MANUAL', note, actorId: user.userId,
      });
    }
    res.json({
      variantId: updated.id, stock: updated.stock, reserved: updated.reserved,
      available: updated.stock - updated.reserved, lowStockThreshold: updated.lowStockThreshold,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/seller/inventory/movements?variantId= - lịch sử biến động kho
export async function listStockMovements(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const variantId = req.query.variantId ? Number(req.query.variantId) : undefined;

    // Lấy các variantId thuộc phạm vi để lọc (đa hình, không có FK cứng)
    const scoped = await prisma.productVariant.findMany({
      where: { ...variantScope(user), ...(variantId ? { id: variantId } : {}) },
      select: { id: true },
    });
    const ids = scoped.map((v) => v.id);
    if (ids.length === 0) return res.json({ movements: [] });

    const movements = await prisma.stockMovement.findMany({
      where: { variantId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Gắn tên sản phẩm + size để hiển thị
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: ids } },
      include: { product: { select: { name: true } } },
    });
    const vmap = new Map(variants.map((v) => [v.id, { name: v.product.name, size: v.size }]));
    res.json({
      movements: movements.map((m) => ({
        ...m,
        productName: vmap.get(m.variantId)?.name ?? '',
        size: vmap.get(m.variantId)?.size ?? '',
      })),
    });
  } catch (err) {
    next(err);
  }
}

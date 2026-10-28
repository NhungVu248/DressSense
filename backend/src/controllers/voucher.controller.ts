import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC8.3 / UC13.1 - Áp dụng mã giảm giá.
//  Hỗ trợ: %/cố định, trần giảm, đơn tối thiểu, hiệu lực thời gian, tổng lượt dùng,
//  phạm vi (toàn bộ / sản phẩm / danh mục), voucher theo gian hàng, giới hạn mỗi khách.
// ============================================================

// Một dòng hàng trong giỏ để xét phạm vi/gian hàng áp dụng của voucher.
export interface VoucherCtxItem {
  productId: number;
  categoryId: number;
  sellerId: number;
  lineTotal: number;
}
export interface VoucherCtx {
  userId?: number;
  items?: VoucherCtxItem[];
}

export interface VoucherResult {
  valid: boolean;
  message: string;
  discount: number;
  voucher: null | {
    code: string; description: string | null; type: 'PERCENT' | 'FIXED';
    value: number; minOrder: number; maxDiscount: number | null;
    sellerId: number | null; scope: 'ALL' | 'PRODUCT' | 'CATEGORY'; scopeIds: number[];
  };
}

// Phần tổng tiền (lineTotal) đủ điều kiện áp voucher: lọc theo gian hàng rồi theo phạm vi.
export function voucherEligibleAmount(
  v: { sellerId: number | null; scope: 'ALL' | 'PRODUCT' | 'CATEGORY'; scopeIds: number[] },
  items: VoucherCtxItem[],
): number {
  return items
    .filter((it) => (v.sellerId == null || it.sellerId === v.sellerId))
    .filter((it) =>
      v.scope === 'ALL' ? true :
      v.scope === 'PRODUCT' ? v.scopeIds.includes(it.productId) :
      v.scopeIds.includes(it.categoryId),
    )
    .reduce((a, it) => a + it.lineTotal, 0);
}

// Kiểm tra voucher theo tổng tạm tính (subtotal) + ngữ cảnh giỏ, tính số tiền giảm.
export async function computeVoucher(rawCode: string, subtotal: number, ctx: VoucherCtx = {}): Promise<VoucherResult> {
  const code = rawCode.trim().toUpperCase();
  const fail = (message: string): VoucherResult => ({ valid: false, message, discount: 0, voucher: null });

  const v = await prisma.voucher.findUnique({ where: { code } });
  if (!v || v.status !== 'RUNNING' || !v.active) return fail('Mã giảm giá không hợp lệ hoặc chưa được kích hoạt.'); // 11a
  const now = new Date();
  if (v.startsAt && now < v.startsAt) return fail('Mã giảm giá chưa đến thời gian áp dụng.');
  if (v.endsAt && now > v.endsAt) return fail('Mã giảm giá đã hết hạn.');
  if (v.usageLimit != null && v.usedCount >= v.usageLimit) return fail('Mã giảm giá đã hết lượt sử dụng.');
  if (subtotal < v.minOrder) {
    return fail(`Cần mua thêm ${(v.minOrder - subtotal).toLocaleString('vi-VN')}₫ để dùng mã này (đơn tối thiểu ${v.minOrder.toLocaleString('vi-VN')}₫).`);
  }

  const scope = v.scope as 'ALL' | 'PRODUCT' | 'CATEGORY';
  const scopeIds = Array.isArray(v.scopeIds) ? (v.scopeIds as number[]) : [];

  // Giới hạn mỗi khách (perUserLimit) - 11a
  if (v.perUserLimit != null && ctx.userId != null) {
    const usage = await prisma.voucherUsage.findUnique({ where: { voucherId_userId: { voucherId: v.id, userId: ctx.userId } } });
    if (usage && usage.count >= v.perUserLimit) return fail('Bạn đã dùng hết số lần cho phép của mã này.');
  }

  // Phạm vi áp dụng: cần ngữ cảnh giỏ để xác định phần đủ điều kiện.
  let eligible = subtotal;
  if (scope !== 'ALL' || v.sellerId != null) {
    if (!ctx.items) {
      return fail('Mã chỉ áp dụng cho một số sản phẩm/gian hàng; vui lòng kiểm tra trong giỏ hàng.');
    }
    eligible = voucherEligibleAmount({ sellerId: v.sellerId, scope, scopeIds }, ctx.items);
    if (eligible <= 0) return fail('Mã không áp dụng cho sản phẩm đang chọn.'); // 11a
  }

  // Tính giảm trên phần đủ điều kiện: PERCENT (có trần) hoặc FIXED; không vượt phần đủ điều kiện.
  let discount = v.type === 'PERCENT' ? Math.floor((eligible * v.value) / 100) : v.value;
  if (v.type === 'PERCENT' && v.maxDiscount != null) discount = Math.min(discount, v.maxDiscount);
  discount = Math.min(discount, eligible);

  return {
    valid: true,
    message: 'Đã áp dụng mã giảm giá.',
    discount,
    voucher: {
      code: v.code, description: v.description, type: v.type, value: v.value,
      minOrder: v.minOrder, maxDiscount: v.maxDiscount,
      sellerId: v.sellerId, scope, scopeIds,
    },
  };
}

const applySchema = z.object({ code: z.string().min(1), subtotal: z.coerce.number().int().min(0) });

// POST /api/vouchers/apply - xem trước mức giảm cho giỏ (chưa đánh dấu đã dùng)
export async function applyVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const body = applySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const result = await computeVoucher(body.data.code, body.data.subtotal, { userId: req.user?.userId });
    if (!result.valid) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/vouchers - danh sách mã đang khả dụng (để khách chọn nhanh)
export async function listVouchers(_req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const vouchers = await prisma.voucher.findMany({
      where: {
        status: 'RUNNING',
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { minOrder: 'asc' },
      select: { code: true, description: true, type: true, value: true, minOrder: true, maxDiscount: true, endsAt: true, scope: true },
    });
    res.json({ vouchers });
  } catch (err) {
    next(err);
  }
}

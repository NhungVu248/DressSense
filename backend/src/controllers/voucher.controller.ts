import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC8.3 - Áp dụng mã giảm giá (bản gọn; UC13 quản lý đầy đủ)
//  Phạm vi hỗ trợ: toàn hệ thống, đơn tối thiểu, %/cố định, trần giảm,
//  hiệu lực thời gian, giới hạn lượt dùng.
// ============================================================

export interface VoucherResult {
  valid: boolean;
  message: string;
  discount: number;
  voucher: null | {
    code: string; description: string | null; type: 'PERCENT' | 'FIXED';
    value: number; minOrder: number; maxDiscount: number | null;
  };
}

// Kiểm tra voucher theo tổng tạm tính (subtotal) và tính số tiền giảm.
export async function computeVoucher(rawCode: string, subtotal: number): Promise<VoucherResult> {
  const code = rawCode.trim().toUpperCase();
  const fail = (message: string): VoucherResult => ({ valid: false, message, discount: 0, voucher: null });

  const v = await prisma.voucher.findUnique({ where: { code } });
  if (!v || !v.active) return fail('Mã giảm giá không hợp lệ.'); // 7E
  const now = new Date();
  if (v.startsAt && now < v.startsAt) return fail('Mã giảm giá chưa đến thời gian áp dụng.'); // 3b
  if (v.endsAt && now > v.endsAt) return fail('Mã giảm giá đã hết hạn.'); // 3b
  if (v.usageLimit != null && v.usedCount >= v.usageLimit) return fail('Mã giảm giá đã hết lượt sử dụng.'); // 3b
  if (subtotal < v.minOrder) {
    return fail(`Cần mua thêm ${(v.minOrder - subtotal).toLocaleString('vi-VN')}₫ để dùng mã này (đơn tối thiểu ${v.minOrder.toLocaleString('vi-VN')}₫).`); // 3a
  }

  // Tính giảm: PERCENT (có trần maxDiscount) hoặc FIXED; không vượt quá tổng tiền
  let discount = v.type === 'PERCENT' ? Math.floor((subtotal * v.value) / 100) : v.value;
  if (v.type === 'PERCENT' && v.maxDiscount != null) discount = Math.min(discount, v.maxDiscount);
  discount = Math.min(discount, subtotal);

  return {
    valid: true,
    message: 'Đã áp dụng mã giảm giá.',
    discount,
    voucher: { code: v.code, description: v.description, type: v.type, value: v.value, minOrder: v.minOrder, maxDiscount: v.maxDiscount },
  };
}

const applySchema = z.object({ code: z.string().min(1), subtotal: z.coerce.number().int().min(0) });

// POST /api/vouchers/apply - xem trước mức giảm cho giỏ (chưa đánh dấu đã dùng)
export async function applyVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const body = applySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const result = await computeVoucher(body.data.code, body.data.subtotal);
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
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { minOrder: 'asc' },
      select: { code: true, description: true, type: true, value: true, minOrder: true, maxDiscount: true, endsAt: true },
    });
    res.json({ vouchers });
  } catch (err) {
    next(err);
  }
}

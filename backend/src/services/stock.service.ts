import { prisma } from '../lib/prisma';
import type { StockMovementType } from '@prisma/client';

// ERD 3.9 - ghi một biến động kho. Chỉ GHI LỊCH SỬ, không tự sửa tồn kho ở đây
// (việc cộng/trừ ProductVariant.stock do controller/service nghiệp vụ đảm nhiệm).
export async function recordStockMovement(opts: {
  variantId: number;
  type: StockMovementType;
  quantity: number;
  referenceType?: string | null;
  referenceId?: number | null;
  note?: string | null;
  actorId?: number | null;
}) {
  try {
    await prisma.stockMovement.create({
      data: {
        variantId: opts.variantId,
        type: opts.type,
        quantity: opts.quantity,
        referenceType: opts.referenceType ?? null,
        referenceId: opts.referenceId ?? null,
        note: opts.note ?? null,
        actorId: opts.actorId ?? null,
      },
    });
  } catch {
    /* bỏ qua lỗi ghi lịch sử kho */
  }
}

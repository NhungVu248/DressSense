import type { Prisma } from '@prisma/client';

// UC10 - tiện ích tồn kho theo vòng đời đơn.
// Mô hình: đặt đơn -> reserved += qty (giữ chỗ). Hoàn tất -> trừ stock thật + nhả reserved.
// Hủy -> chỉ nhả reserved (trả lại hàng bán được), stock không đổi.

type TxItem = { variantId: number | null; quantity: number };

// Hủy đơn: hoàn trả hàng đã giữ chỗ (UC10.5 hậu điều kiện)
export async function releaseReserved(db: Prisma.TransactionClient, items: TxItem[]) {
  for (const it of items) {
    if (it.variantId) await db.productVariant.update({ where: { id: it.variantId }, data: { reserved: { decrement: it.quantity } } });
  }
}

// Hoàn tất đơn: chốt bán - trừ tồn kho thật và nhả giữ chỗ (UC10.3)
export async function finalizeStock(db: Prisma.TransactionClient, items: TxItem[]) {
  for (const it of items) {
    if (it.variantId) await db.productVariant.update({ where: { id: it.variantId }, data: { stock: { decrement: it.quantity }, reserved: { decrement: it.quantity } } });
  }
}

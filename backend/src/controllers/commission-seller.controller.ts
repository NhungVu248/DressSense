import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  Mục 3 - Seller: Tài chính & doanh thu (chỉ dữ liệu gian hàng mình).
//  Seller KHÔNG được sửa tỷ lệ hoa hồng hay trạng thái thanh toán.
// ============================================================

function sellerId(req: Request): number {
  return (req.user as JwtPayload).userId;
}

// GET /api/seller/finance - tổng quan tài chính
export async function getSellerFinance(req: Request, res: Response, next: NextFunction) {
  try {
    const sid = sellerId(req);
    const commissions = await prisma.orderCommission.findMany({ where: { sellerId: sid }, select: { baseAmount: true, commissionAmount: true, method: true, status: true, settlementId: true } });

    let totalGoods = 0, totalCommission = 0; // trên các khoản CONFIRMED (đã xác nhận)
    let pendingPayable = 0; // online chưa đối soát: sàn còn phải trả
    let pendingCodOwed = 0; // COD chưa đối soát: mình còn phải trả sàn (hoa hồng)
    for (const c of commissions) {
      if (c.status !== 'CONFIRMED') continue;
      totalGoods += c.baseAmount;
      totalCommission += c.commissionAmount;
      if (!c.settlementId) {
        if (c.method === 'COD') pendingCodOwed += c.commissionAmount;
        else pendingPayable += c.baseAmount - c.commissionAmount;
      }
    }
    const netGoods = totalGoods - totalCommission; // phần hàng sau khi trừ hoa hồng

    const paidToMeAgg = await prisma.sellerSettlement.aggregate({ _sum: { netAmount: true }, where: { sellerId: sid, status: 'PAID', direction: 'PAYABLE' } });
    const paidToPlatformAgg = await prisma.sellerSettlement.aggregate({ _sum: { netAmount: true }, where: { sellerId: sid, status: 'PAID', direction: 'RECEIVABLE' } });

    const shop = await prisma.shop.findUnique({ where: { ownerId: sid }, select: { bankName: true, bankAccountNo: true, bankAccountName: true } });

    res.json({
      metrics: {
        totalGoods, totalCommission, netGoods,
        pendingPayable, pendingCodOwed,
        paidToMe: paidToMeAgg._sum.netAmount ?? 0,
        paidToPlatform: paidToPlatformAgg._sum.netAmount ?? 0,
      },
      bank: shop ?? { bankName: null, bankAccountNo: null, bankAccountName: null },
    });
  } catch (err) { next(err); }
}

// GET /api/seller/finance/commissions - chi tiết hoa hồng theo đơn
export async function listSellerCommissions(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.orderCommission.findMany({
      where: { sellerId: sellerId(req) }, orderBy: { createdAt: 'desc' }, take: 300,
      include: { order: { select: { code: true } } },
    });
    res.json({
      commissions: rows.map((r) => ({
        id: r.id, orderId: r.orderId, orderCode: r.order?.code ?? `#${r.orderId}`,
        baseAmount: r.baseAmount, commissionRate: r.commissionRate, commissionAmount: r.commissionAmount,
        method: r.method, status: r.status, settlementId: r.settlementId, createdAt: r.createdAt,
      })),
    });
  } catch (err) { next(err); }
}

// GET /api/seller/finance/settlements - lịch sử đối soát/thanh toán của gian hàng
export async function listSellerSettlements(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.sellerSettlement.findMany({ where: { sellerId: sellerId(req) }, orderBy: { createdAt: 'desc' }, include: { items: true }, take: 100 });
    res.json({ settlements: rows });
  } catch (err) { next(err); }
}

const bankSchema = z.object({
  bankName: z.string().trim().max(120).optional().nullable(),
  bankAccountNo: z.string().trim().max(60).optional().nullable(),
  bankAccountName: z.string().trim().max(120).optional().nullable(),
});

// PUT /api/seller/finance/bank - cập nhật thông tin nhận tiền
export async function updateSellerBankInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bankSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const shop = await prisma.shop.findUnique({ where: { ownerId: sellerId(req) } });
    if (!shop) return res.status(404).json({ message: 'Chưa có hồ sơ gian hàng.' });
    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: { bankName: body.data.bankName ?? null, bankAccountNo: body.data.bankAccountNo ?? null, bankAccountName: body.data.bankAccountName ?? null },
      select: { bankName: true, bankAccountNo: true, bankAccountName: true },
    });
    res.json({ bank: updated });
  } catch (err) { next(err); }
}

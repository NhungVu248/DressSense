import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  Mục 2 - Admin quản lý & cấu hình hoa hồng:
//   2.1/2.2 chính sách, 2.3 giao dịch hoa hồng, 2.4 đối soát & thanh toán, 2.5 báo cáo.
// ============================================================

function actor(req: Request): number {
  return (req.user as JwtPayload).userId;
}

// Chuẩn hóa object (có Date) thành JSON thuần để lưu cột Json (tránh lỗi kiểu Date).
function toJson(obj: unknown): any {
  return JSON.parse(JSON.stringify(obj));
}

// ---------- 2.1 / 2.2 - Chính sách hoa hồng ----------

const policySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên chính sách.'),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  commissionRate: z.coerce.number().min(0, 'Tỷ lệ không âm.').max(100, 'Tỷ lệ tối đa 100%.'),
  effectiveFrom: z.string().min(1, 'Vui lòng chọn ngày bắt đầu.'),
  effectiveTo: z.string().optional().nullable(),
  note: z.string().trim().optional(),
});

// Kiểm tra chồng lấn thời gian với chính sách ACTIVE cùng phạm vi (categoryId).
async function hasOverlap(categoryId: number | null, from: Date, to: Date | null, excludeId?: number): Promise<boolean> {
  const rows = await prisma.commissionPolicy.findMany({
    where: { status: 'ACTIVE', categoryId: categoryId ?? null, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  for (const r of rows) {
    const aFrom = from.getTime();
    const aTo = to ? to.getTime() : Infinity;
    const bFrom = r.effectiveFrom.getTime();
    const bTo = r.effectiveTo ? r.effectiveTo.getTime() : Infinity;
    if (aFrom <= bTo && bFrom <= aTo) return true; // giao nhau
  }
  return false;
}

// GET /api/admin/commission/policies?categoryId=&status=
export async function listCommissionPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE') where.status = req.query.status;
    if (req.query.categoryId === 'default') where.categoryId = null;
    else if (req.query.categoryId) where.categoryId = Number(req.query.categoryId);
    const policies = await prisma.commissionPolicy.findMany({ where, orderBy: [{ categoryId: 'asc' }, { effectiveFrom: 'desc' }] });
    const catIds = [...new Set(policies.map((p) => p.categoryId).filter((x): x is number => x != null))];
    const cats = catIds.length ? await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } }) : [];
    const catName = new Map(cats.map((c) => [c.id, c.name] as const));
    res.json({ policies: policies.map((p) => ({ ...p, categoryName: p.categoryId ? (catName.get(p.categoryId) ?? `#${p.categoryId}`) : 'Mặc định toàn sàn' })) });
  } catch (err) { next(err); }
}

// POST /api/admin/commission/policies
export async function createCommissionPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const body = policySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const categoryId = body.data.categoryId ?? null;
    const from = new Date(body.data.effectiveFrom);
    const to = body.data.effectiveTo ? new Date(body.data.effectiveTo) : null;
    if (isNaN(from.getTime()) || (to && isNaN(to.getTime()))) return res.status(400).json({ message: 'Ngày hiệu lực không hợp lệ.' });
    if (to && to < from) return res.status(400).json({ message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!cat) return res.status(400).json({ message: 'Danh mục không tồn tại.' });
    }
    if (await hasOverlap(categoryId, from, to)) {
      return res.status(409).json({ message: 'Đã có chính sách cùng phạm vi hiệu lực chồng lấn thời gian.', code: 'OVERLAP' });
    }
    const created = await prisma.commissionPolicy.create({
      data: { name: body.data.name, categoryId, commissionRate: body.data.commissionRate, effectiveFrom: from, effectiveTo: to, note: body.data.note ?? null, createdById: actor(req) },
    });
    await prisma.commissionPolicyLog.create({ data: { policyId: created.id, action: 'CREATE', after: toJson(created), actorId: actor(req) } });
    res.status(201).json({ policy: created });
  } catch (err) { next(err); }
}

// PUT /api/admin/commission/policies/:id
export async function updateCommissionPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const cur = await prisma.commissionPolicy.findUnique({ where: { id } });
    if (!cur) return res.status(404).json({ message: 'Không tìm thấy chính sách.' });
    const body = policySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const categoryId = body.data.categoryId ?? null;
    const from = new Date(body.data.effectiveFrom);
    const to = body.data.effectiveTo ? new Date(body.data.effectiveTo) : null;
    if (isNaN(from.getTime()) || (to && isNaN(to.getTime()))) return res.status(400).json({ message: 'Ngày hiệu lực không hợp lệ.' });
    if (to && to < from) return res.status(400).json({ message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
    if (cur.status === 'ACTIVE' && (await hasOverlap(categoryId, from, to, id))) {
      return res.status(409).json({ message: 'Đã có chính sách cùng phạm vi hiệu lực chồng lấn thời gian.', code: 'OVERLAP' });
    }
    const updated = await prisma.commissionPolicy.update({
      where: { id },
      data: { name: body.data.name, categoryId, commissionRate: body.data.commissionRate, effectiveFrom: from, effectiveTo: to, note: body.data.note ?? null },
    });
    await prisma.commissionPolicyLog.create({ data: { policyId: id, action: 'UPDATE', before: toJson(cur), after: toJson(updated), actorId: actor(req) } });
    res.json({ policy: updated });
  } catch (err) { next(err); }
}

// PATCH /api/admin/commission/policies/:id/status  { status: ACTIVE | INACTIVE }
export async function setCommissionPolicyStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (status !== 'ACTIVE' && status !== 'INACTIVE') return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    const cur = await prisma.commissionPolicy.findUnique({ where: { id } });
    if (!cur) return res.status(404).json({ message: 'Không tìm thấy chính sách.' });
    if (cur.status === status) return res.json({ policy: cur });
    // kích hoạt lại: kiểm tra chồng lấn
    if (status === 'ACTIVE' && (await hasOverlap(cur.categoryId, cur.effectiveFrom, cur.effectiveTo, id))) {
      return res.status(409).json({ message: 'Không thể kích hoạt: trùng thời gian với chính sách khác cùng phạm vi.', code: 'OVERLAP' });
    }
    const updated = await prisma.commissionPolicy.update({ where: { id }, data: { status } });
    await prisma.commissionPolicyLog.create({ data: { policyId: id, action: status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE', before: toJson(cur), after: toJson(updated), actorId: actor(req) } });
    res.json({ policy: updated });
  } catch (err) { next(err); }
}

// GET /api/admin/commission/policies/history?policyId=
export async function getCommissionPolicyHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (req.query.policyId) where.policyId = Number(req.query.policyId);
    const logs = await prisma.commissionPolicyLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ logs });
  } catch (err) { next(err); }
}

// ---------- 2.3 - Giao dịch hoa hồng ----------

// GET /api/admin/commission/transactions?sellerId=&status=&from=&to=
export async function listOrderCommissions(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (req.query.sellerId) where.sellerId = Number(req.query.sellerId);
    if (['PENDING', 'CONFIRMED', 'REFUNDED', 'CANCELLED'].includes(String(req.query.status))) where.status = req.query.status;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
      if (req.query.to) where.createdAt.lte = new Date(String(req.query.to));
    }
    const rows = await prisma.orderCommission.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 300,
      include: { order: { select: { code: true } } },
    });
    const sellerIds = [...new Set(rows.map((r) => r.sellerId))];
    const shops = sellerIds.length ? await prisma.shop.findMany({ where: { ownerId: { in: sellerIds } }, select: { ownerId: true, name: true } }) : [];
    const shopName = new Map(shops.map((s) => [s.ownerId, s.name] as const));
    res.json({
      transactions: rows.map((r) => ({
        id: r.id, orderId: r.orderId, orderCode: r.order?.code ?? `#${r.orderId}`,
        sellerId: r.sellerId, shopName: shopName.get(r.sellerId) ?? `Gian hàng #${r.sellerId}`,
        baseAmount: r.baseAmount, commissionRate: r.commissionRate, commissionAmount: r.commissionAmount,
        method: r.method, status: r.status, settlementId: r.settlementId, createdAt: r.createdAt, note: r.note,
      })),
    });
  } catch (err) { next(err); }
}

// ---------- 2.4 - Đối soát & thanh toán Seller ----------

// Gom các khoản hoa hồng CONFIRMED chưa đối soát theo đơn, kèm chiều tiền.
// online -> sàn trả seller (goods - commission); COD -> seller trả sàn (commission).
async function buildEligibleByOrder(sellerId?: number) {
  const where: any = { status: 'CONFIRMED', settlementId: null };
  if (sellerId) where.sellerId = sellerId;
  const rows = await prisma.orderCommission.findMany({ where, include: { order: { select: { code: true } } } });
  // gom theo đơn
  const byOrder = new Map<number, { orderId: number; orderCode: string; sellerId: number; method: string; goods: number; commission: number }>();
  for (const r of rows) {
    const cur = byOrder.get(r.orderId) ?? { orderId: r.orderId, orderCode: r.order?.code ?? `#${r.orderId}`, sellerId: r.sellerId, method: r.method, goods: 0, commission: 0 };
    cur.goods += r.baseAmount;
    cur.commission += r.commissionAmount;
    byOrder.set(r.orderId, cur);
  }
  return [...byOrder.values()].map((o) => {
    const isCod = o.method === 'COD';
    // net đóng góp vào số dư: online dương (sàn trả), COD âm (seller trả sàn hoa hồng)
    const net = isCod ? -o.commission : o.goods - o.commission;
    return { ...o, net };
  });
}

// GET /api/admin/commission/settlements/balances - số dư phải trả/phải thu theo seller
export async function getSettlementBalances(_req: Request, res: Response, next: NextFunction) {
  try {
    const eligible = await buildEligibleByOrder();
    const bySeller = new Map<number, { sellerId: number; orderCount: number; goods: number; commission: number; net: number }>();
    for (const o of eligible) {
      const cur = bySeller.get(o.sellerId) ?? { sellerId: o.sellerId, orderCount: 0, goods: 0, commission: 0, net: 0 };
      cur.orderCount += 1; cur.goods += o.goods; cur.commission += o.commission; cur.net += o.net;
      bySeller.set(o.sellerId, cur);
    }
    const sellerIds = [...bySeller.keys()];
    const shops = sellerIds.length ? await prisma.shop.findMany({ where: { ownerId: { in: sellerIds } }, select: { ownerId: true, name: true, bankName: true, bankAccountNo: true, bankAccountName: true } }) : [];
    const shopMap = new Map(shops.map((s) => [s.ownerId, s] as const));
    res.json({
      balances: [...bySeller.values()].map((b) => ({
        ...b,
        shopName: shopMap.get(b.sellerId)?.name ?? `Gian hàng #${b.sellerId}`,
        bank: shopMap.get(b.sellerId) ? { bankName: shopMap.get(b.sellerId)!.bankName, bankAccountNo: shopMap.get(b.sellerId)!.bankAccountNo, bankAccountName: shopMap.get(b.sellerId)!.bankAccountName } : null,
        direction: b.net >= 0 ? 'PAYABLE' : 'RECEIVABLE',
        amount: Math.abs(b.net),
      })).sort((a, b) => b.amount - a.amount),
    });
  } catch (err) { next(err); }
}

// GET /api/admin/commission/settlements/eligible?sellerId= - danh sách đơn đủ điều kiện
export async function listEligibleOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = req.query.sellerId ? Number(req.query.sellerId) : undefined;
    const eligible = await buildEligibleByOrder(sellerId);
    res.json({ orders: eligible });
  } catch (err) { next(err); }
}

function settlementCode(): string {
  return 'STL' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
}

const createSettlementSchema = z.object({
  sellerId: z.coerce.number().int().positive(),
  orderIds: z.array(z.coerce.number().int().positive()).optional(), // bỏ trống = tất cả đơn đủ điều kiện của seller
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  note: z.string().trim().optional(),
});

// POST /api/admin/commission/settlements - tạo đợt đối soát
export async function createSettlement(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSettlementSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const { sellerId, orderIds, periodFrom, periodTo, note } = body.data;
    let eligible = await buildEligibleByOrder(sellerId);
    if (orderIds && orderIds.length) eligible = eligible.filter((o) => orderIds.includes(o.orderId));
    if (!eligible.length) return res.status(400).json({ message: 'Không có đơn đủ điều kiện để tạo đợt đối soát.' });

    const grossAmount = eligible.reduce((s, o) => s + o.goods, 0);
    const commissionAmount = eligible.reduce((s, o) => s + o.commission, 0);
    const signedNet = eligible.reduce((s, o) => s + o.net, 0);
    const direction = signedNet >= 0 ? 'PAYABLE' : 'RECEIVABLE';

    const settlement = await prisma.$transaction(async (db) => {
      const st = await db.sellerSettlement.create({
        data: {
          code: settlementCode(), sellerId,
          periodFrom: periodFrom ? new Date(periodFrom) : null,
          periodTo: periodTo ? new Date(periodTo) : null,
          grossAmount, commissionAmount, adjustmentAmount: 0,
          netAmount: Math.abs(signedNet), direction, status: 'PENDING',
          note: note ?? null, createdById: actor(req),
          items: {
            create: eligible.map((o) => ({ orderId: o.orderId, orderCode: o.orderCode, orderAmount: o.goods, commissionAmount: o.commission, netAmount: o.net })),
          },
        },
      });
      // đánh dấu các khoản hoa hồng đã vào đợt (một đơn không vào hai đợt)
      await db.orderCommission.updateMany({ where: { orderId: { in: eligible.map((o) => o.orderId) }, status: 'CONFIRMED', settlementId: null }, data: { settlementId: st.id } });
      return st;
    });
    res.status(201).json({ settlement });
  } catch (err) { next(err); }
}

const paySchema = z.object({
  paymentMethod: z.string().trim().min(1, 'Vui lòng nhập hình thức thanh toán.'),
  transactionReference: z.string().trim().min(1, 'Vui lòng nhập mã giao dịch / chứng từ.'),
  note: z.string().trim().optional(),
});

// POST /api/admin/commission/settlements/:id/pay - xác nhận đã thanh toán
export async function confirmSettlementPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const st = await prisma.sellerSettlement.findUnique({ where: { id } });
    if (!st) return res.status(404).json({ message: 'Không tìm thấy đợt đối soát.' });
    if (st.status === 'PAID') return res.status(400).json({ message: 'Đợt đối soát đã được thanh toán.' });
    const body = paySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const updated = await prisma.sellerSettlement.update({
      where: { id },
      data: { status: 'PAID', paymentMethod: body.data.paymentMethod, transactionReference: body.data.transactionReference, note: body.data.note ?? st.note, paidAt: new Date() },
    });
    res.json({ settlement: updated });
  } catch (err) { next(err); }
}

// POST /api/admin/commission/settlements/:id/cancel - hủy đợt (trả các khoản về chưa đối soát)
export async function cancelSettlement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const st = await prisma.sellerSettlement.findUnique({ where: { id } });
    if (!st) return res.status(404).json({ message: 'Không tìm thấy đợt đối soát.' });
    if (st.status === 'PAID') return res.status(400).json({ message: 'Đợt đã thanh toán, không thể hủy.' });
    await prisma.$transaction(async (db) => {
      await db.orderCommission.updateMany({ where: { settlementId: id }, data: { settlementId: null } });
      await db.sellerSettlementItem.deleteMany({ where: { settlementId: id } });
      await db.sellerSettlement.update({ where: { id }, data: { status: 'FAILED' } });
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// GET /api/admin/commission/settlements?sellerId=&status=
export async function listSettlements(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (req.query.sellerId) where.sellerId = Number(req.query.sellerId);
    if (['PENDING', 'PROCESSING', 'PAID', 'FAILED'].includes(String(req.query.status))) where.status = req.query.status;
    const rows = await prisma.sellerSettlement.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    const sellerIds = [...new Set(rows.map((r) => r.sellerId))];
    const shops = sellerIds.length ? await prisma.shop.findMany({ where: { ownerId: { in: sellerIds } }, select: { ownerId: true, name: true } }) : [];
    const shopName = new Map(shops.map((s) => [s.ownerId, s.name] as const));
    res.json({ settlements: rows.map((r) => ({ ...r, shopName: shopName.get(r.sellerId) ?? `Gian hàng #${r.sellerId}` })) });
  } catch (err) { next(err); }
}

// GET /api/admin/commission/settlements/:id - chi tiết đợt (kèm các đơn)
export async function getSettlement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const st = await prisma.sellerSettlement.findUnique({ where: { id }, include: { items: true } });
    if (!st) return res.status(404).json({ message: 'Không tìm thấy đợt đối soát.' });
    const shop = await prisma.shop.findUnique({ where: { ownerId: st.sellerId }, select: { name: true, bankName: true, bankAccountNo: true, bankAccountName: true } });
    res.json({ settlement: { ...st, shopName: shop?.name ?? `Gian hàng #${st.sellerId}`, bank: shop ? { bankName: shop.bankName, bankAccountNo: shop.bankAccountNo, bankAccountName: shop.bankAccountName } : null } });
  } catch (err) { next(err); }
}

// ---------- 2.5 - Báo cáo doanh thu hoa hồng (thay trang C.42) ----------

function resolveRange(q: any): { from: Date; to: Date; preset: string } {
  const now = new Date();
  const preset = typeof q.preset === 'string' ? q.preset : q.from ? 'custom' : '30d';
  const to = q.to ? new Date(String(q.to)) : now;
  let from: Date;
  if (q.from) from = new Date(String(q.from));
  else {
    from = new Date(now);
    if (preset === 'today') from.setHours(0, 0, 0, 0);
    else if (preset === '7d') { from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0); }
    else if (preset === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else { from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0); }
  }
  return { from, to, preset };
}

// GET /api/admin/commission/report?preset=30d | from=&to=
export async function getCommissionReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(+from) || isNaN(+to) || from > to) return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ.' });

    // GMV trong kỳ (đơn hợp lệ, khách trả)
    const orders = await prisma.order.findMany({
      where: { status: { notIn: ['CANCELLED', 'AWAITING_PAYMENT'] }, createdAt: { gte: from, lte: to } },
      select: { total: true },
    });
    const gmv = orders.reduce((s, o) => s + o.total, 0);

    // Hoa hồng phát sinh trong kỳ (theo thời điểm ghi nhận = khi hoàn tất)
    const commissions = await prisma.orderCommission.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { commissionAmount: true, baseAmount: true, status: true, method: true, sellerId: true, createdAt: true },
    });
    let commissionTotal = 0, confirmedCommission = 0, refundedCommission = 0;
    const byDay = new Map<string, number>();
    const byShop = new Map<number, { base: number; commission: number }>();
    for (const c of commissions) {
      commissionTotal += c.commissionAmount;
      if (c.status === 'CONFIRMED') confirmedCommission += c.commissionAmount;
      if (c.status === 'REFUNDED') refundedCommission += c.commissionAmount;
      const k = c.createdAt.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + c.commissionAmount);
      const s = byShop.get(c.sellerId) ?? { base: 0, commission: 0 };
      s.base += c.baseAmount; s.commission += c.commissionAmount; byShop.set(c.sellerId, s);
    }

    // Số dư phải trả / đã thanh toán (toàn hệ thống, không giới hạn kỳ - trạng thái hiện tại)
    const unsettled = await prisma.orderCommission.findMany({ where: { status: 'CONFIRMED', settlementId: null }, select: { baseAmount: true, commissionAmount: true, method: true } });
    let payableToSellers = 0, receivableFromSellers = 0;
    for (const u of unsettled) {
      if (u.method === 'COD') receivableFromSellers += u.commissionAmount;
      else payableToSellers += u.baseAmount - u.commissionAmount;
    }
    const paidAgg = await prisma.sellerSettlement.aggregate({ _sum: { netAmount: true }, where: { status: 'PAID', direction: 'PAYABLE' } });
    const paidToSellers = paidAgg._sum.netAmount ?? 0;

    // Doanh thu khác của sàn (gộp C.42): phí banner + phí voucher đã thanh toán trong kỳ
    const bannerRevenue = await sumPaidFee('bannerOrder', 'amount', from, to);
    const voucherRevenue = await sumPaidFee('voucherOrder', 'fee', from, to);
    const platformIncome = commissionTotal + bannerRevenue + voucherRevenue;

    const sellerIds = [...byShop.keys()];
    const shops = sellerIds.length ? await prisma.shop.findMany({ where: { ownerId: { in: sellerIds } }, select: { ownerId: true, name: true } }) : [];
    const shopName = new Map(shops.map((s) => [s.ownerId, s.name] as const));

    res.json({
      range: { from, to, preset },
      metrics: {
        gmv, commissionTotal, confirmedCommission, refundedCommission,
        payableToSellers, receivableFromSellers, paidToSellers,
        bannerRevenue, voucherRevenue, platformIncome, orderCount: orders.length,
      },
      commissionSeries: [...byDay.entries()].sort().map(([date, commission]) => ({ date, commission })),
      byShop: [...byShop.entries()].map(([sellerId, v]) => ({ sellerId, shopName: shopName.get(sellerId) ?? `Gian hàng #${sellerId}`, base: v.base, commission: v.commission })).sort((a, b) => b.commission - a.commission).slice(0, 20),
    });
  } catch (err) { next(err); }
}

// Tổng phí đã thanh toán của bannerOrder/voucherOrder trong kỳ (an toàn nếu model chưa có).
async function sumPaidFee(model: 'bannerOrder' | 'voucherOrder', field: 'amount' | 'fee', from: Date, to: Date): Promise<number> {
  try {
    const anyPrisma = prisma as any;
    if (!anyPrisma[model]) return 0;
    const agg = await anyPrisma[model].aggregate({ _sum: { [field]: true }, where: { paymentStatus: 'PAID', paidAt: { gte: from, lte: to } } });
    return agg._sum[field] ?? 0;
  } catch { return 0; }
}

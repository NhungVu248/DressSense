import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC15 - Phân tích dữ liệu kinh doanh (BI).
//  Scope theo vai trò: Người bán -> chỉ gian hàng mình (sellerId);
//  Quản trị viên -> toàn hệ thống (có thể lọc ?sellerId=).
// ============================================================

const MIN_SAMPLE = 5; // ngưỡng mẫu tối thiểu để hiện một nhóm thống kê (UC15.3)
const VALID_ORDER = { notIn: ['CANCELLED', 'AWAITING_PAYMENT'] } as any;

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

// Kỳ liền trước cùng độ dài (để so sánh tăng/giảm)
function prevRange(from: Date, to: Date): { from: Date; to: Date } {
  const len = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - len), to: new Date(from.getTime()) };
}

// sellerId áp dụng: người bán -> của mình; admin -> toàn hệ thống (hoặc ?sellerId)
function scopeSeller(req: Request): number | undefined {
  const user = req.user as JwtPayload;
  if (user.role !== 'ADMIN') return user.userId;
  const s = req.query.sellerId;
  return s ? Number(s) : undefined;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}
function delta(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// ---------- UC15.4 Thống kê doanh thu ----------
async function revenueFor(sellerId: number | undefined, from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: { ...(sellerId ? { sellerId } : {}), status: VALID_ORDER, createdAt: { gte: from, lte: to } },
    include: { items: { include: { product: { select: { categoryId: true, category: { select: { name: true } } } } } } },
    orderBy: { createdAt: 'asc' },
  });
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const soldQuantity = orders.reduce((s, o) => s + o.items.reduce((a, it) => a + it.quantity, 0), 0);
  const customers = new Set(orders.map((o) => o.userId)).size;
  const refundAgg = await prisma.paymentTransaction.aggregate({
    _sum: { amount: true },
    where: { kind: 'REFUND', status: { in: ['PAID', 'REFUNDED'] }, createdAt: { gte: from, lte: to }, ...(sellerId ? { order: { sellerId } } : {}) },
  });
  const refundAmount = refundAgg._sum.amount ?? 0;
  return { orders, revenue, soldQuantity, customers, refundAmount, netRevenue: revenue - refundAmount };
}

export async function getRevenueAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(+from) || isNaN(+to) || from > to) return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ.' });
    const sellerId = scopeSeller(req);
    const cur = await revenueFor(sellerId, from, to);
    const pv = prevRange(from, to);
    const prev = await revenueFor(sellerId, pv.from, pv.to);

    // biểu đồ theo ngày
    const byDay = new Map<string, number>();
    for (const o of cur.orders) { const k = o.createdAt.toISOString().slice(0, 10); byDay.set(k, (byDay.get(k) ?? 0) + o.total); }
    const timeSeries = [...byDay.entries()].sort().map(([date, revenue]) => ({ date, revenue }));

    // SP bán chạy + tỷ trọng theo danh mục
    const prod = new Map<number, { productId: number; name: string; quantity: number; revenue: number }>();
    const cat = new Map<string, number>();
    for (const o of cur.orders) for (const it of o.items) {
      const p = prod.get(it.productId) ?? { productId: it.productId, name: it.name ?? `SP #${it.productId}`, quantity: 0, revenue: 0 };
      p.quantity += it.quantity; p.revenue += it.price * it.quantity; prod.set(it.productId, p);
      const cname = it.product?.category?.name ?? 'Khác';
      cat.set(cname, (cat.get(cname) ?? 0) + it.price * it.quantity);
    }
    const bestSellers = [...prod.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    const categoryShare = [...cat.entries()].map(([name, revenue]) => ({ name, revenue, pct: pct(revenue, cur.revenue) })).sort((a, b) => b.revenue - a.revenue);

    const orderCount = cur.orders.length;
    res.json({
      range: { from, to, preset },
      metrics: {
        revenue: cur.revenue, orderCount, soldQuantity: cur.soldQuantity, customers: cur.customers,
        avgOrderValue: orderCount ? Math.round(cur.revenue / orderCount) : 0,
        refundAmount: cur.refundAmount, netRevenue: cur.netRevenue,
      },
      compare: {
        revenue: delta(cur.revenue, prev.revenue), orderCount: delta(orderCount, prev.orders.length),
        customers: delta(cur.customers, prev.customers), netRevenue: delta(cur.netRevenue, prev.netRevenue),
      },
      timeSeries, bestSellers, categoryShare,
    });
  } catch (err) { next(err); }
}

// ---------- UC15.1 Phân tích khách hàng ----------
export async function getCustomerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(+from) || isNaN(+to) || from > to) return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ.' });
    const sellerId = scopeSeller(req);
    const base = sellerId ? { sellerId } : {};

    const orders = await prisma.order.findMany({
      where: { ...base, status: VALID_ORDER, createdAt: { gte: from, lte: to } },
      include: { items: { include: { product: { select: { style: true, color: true, price: true, category: { select: { name: true } } } } } } },
    });
    const buyers = [...new Set(orders.map((o) => o.userId))];
    // new vs returning: có đơn hợp lệ TRƯỚC 'from' hay không
    let returning = 0;
    if (buyers.length) {
      const prior = await prisma.order.findMany({
        where: { ...base, status: VALID_ORDER, createdAt: { lt: from }, userId: { in: buyers } },
        select: { userId: true }, distinct: ['userId'],
      });
      returning = prior.length;
    }
    const newCustomers = buyers.length - returning;
    const revenue = orders.reduce((s, o) => s + o.total, 0);

    // xu hướng
    const styles = new Map<string, number>(), colors = new Map<string, number>(), cats = new Map<string, number>();
    const priceBuckets = new Map<string, number>();
    const bucketOf = (p: number) => p < 200000 ? '<200k' : p < 500000 ? '200k–500k' : p < 1000000 ? '500k–1tr' : '≥1tr';
    for (const o of orders) for (const it of o.items) {
      const pr = it.product;
      if (pr?.style) styles.set(pr.style, (styles.get(pr.style) ?? 0) + it.quantity);
      if (pr?.color) colors.set(pr.color, (colors.get(pr.color) ?? 0) + it.quantity);
      if (pr?.category?.name) cats.set(pr.category.name, (cats.get(pr.category.name) ?? 0) + it.quantity);
      if (pr?.price != null) { const b = bucketOf(pr.price); priceBuckets.set(b, (priceBuckets.get(b) ?? 0) + it.quantity); }
    }
    const top = (m: Map<string, number>, n = 6) => [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, n);

    // SP được xem / thêm giỏ nhiều (behaviors, scope theo sản phẩm gian hàng)
    const behWhere = (action: string) => ({ action: action as any, createdAt: { gte: from, lte: to }, ...(sellerId ? { product: { sellerId } } : {}) });
    const [viewGrp, cartGrp] = await Promise.all([
      prisma.userBehavior.groupBy({ by: ['productId'], where: behWhere('VIEW'), _count: { _all: true }, orderBy: { _count: { productId: 'desc' } }, take: 6 }),
      prisma.userBehavior.groupBy({ by: ['productId'], where: behWhere('ADD_TO_CART'), _count: { _all: true }, orderBy: { _count: { productId: 'desc' } }, take: 6 }),
    ]);
    const nameOf = async (grp: { productId: number; _count: { _all: number } }[]) => {
      const ids = grp.map((g) => g.productId);
      const ps = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
      const map = new Map(ps.map((p) => [p.id, p.name]));
      return grp.map((g) => ({ name: map.get(g.productId) ?? `SP #${g.productId}`, value: g._count._all }));
    };
    const [mostViewed, mostAddedToCart] = await Promise.all([nameOf(viewGrp), nameOf(cartGrp)]);

    res.json({
      range: { from, to, preset },
      metrics: {
        totalCustomers: buyers.length, newCustomers, returningCustomers: returning,
        returnRate: pct(returning, buyers.length),
        avgPurchaseValue: buyers.length ? Math.round(revenue / orders.length || 0) : 0,
        purchaseFrequency: buyers.length ? Math.round((orders.length / buyers.length) * 100) / 100 : 0,
      },
      trends: { styles: top(styles), colors: top(colors), categories: top(cats), priceRanges: top(priceBuckets, 4), mostViewed, mostAddedToCart },
    });
  } catch (err) { next(err); }
}

// ---------- UC15.2 Phân tích hành vi (phễu) ----------
export async function getBehaviorAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(+from) || isNaN(+to) || from > to) return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ.' });
    const sellerId = scopeSeller(req);
    const behWhere = (action: string) => ({ action: action as any, createdAt: { gte: from, lte: to }, ...(sellerId ? { product: { sellerId } } : {}) });

    const [views, wishlist, addToCart] = await Promise.all([
      prisma.userBehavior.count({ where: behWhere('VIEW') }),
      prisma.userBehavior.count({ where: behWhere('WISHLIST') }),
      prisma.userBehavior.count({ where: behWhere('ADD_TO_CART') }),
    ]);
    // đặt hàng / hoàn tất: đếm dòng sản phẩm trong đơn (scope gian hàng)
    const itemWhere = (statusFilter: any) => ({
      order: { ...(sellerId ? { sellerId } : {}), status: statusFilter, createdAt: { gte: from, lte: to } },
    });
    const [ordered, completed] = await Promise.all([
      prisma.orderItem.count({ where: itemWhere(VALID_ORDER) as any }),
      prisma.orderItem.count({ where: itemWhere('COMPLETED') as any }),
    ]);

    const steps = [
      { key: 'view', label: 'Xem sản phẩm', count: views },
      { key: 'wishlist', label: 'Thêm Wishlist', count: wishlist },
      { key: 'cart', label: 'Thêm giỏ hàng', count: addToCart },
      { key: 'order', label: 'Đặt hàng', count: ordered },
      { key: 'complete', label: 'Hoàn tất', count: completed },
    ];
    // tỷ lệ chuyển đổi so với bước đầu tiên có dữ liệu
    const first = steps[0].count || 0;
    const funnel = steps.map((s, i) => ({
      ...s,
      ofTop: pct(s.count, first),
      stepRate: i === 0 ? 100 : pct(s.count, steps[i - 1].count || 0),
    }));
    // bước rời bỏ cao nhất (tỷ lệ giảm lớn nhất giữa 2 bước liên tiếp)
    let worst: { from: string; to: string; dropPct: number } | null = null;
    for (let i = 1; i < steps.length; i++) {
      const drop = 100 - pct(steps[i].count, steps[i - 1].count || 0);
      if (steps[i - 1].count > 0 && (!worst || drop > worst.dropPct)) {
        worst = { from: steps[i - 1].label, to: steps[i].label, dropPct: Math.round(drop * 10) / 10 };
      }
    }
    res.json({ range: { from, to, preset }, funnel, biggestDropOff: worst });
  } catch (err) { next(err); }
}

// ---------- UC15.3 Phân tích dáng người (ẩn danh, tổng hợp) ----------
export async function getBodyShapeAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(+from) || isNaN(+to) || from > to) return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ.' });
    // Lấy Body Profile bản mới nhất mỗi khách (không lộ cá nhân/ảnh) trong phạm vi thời gian
    const profiles = await prisma.bodyProfile.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { userId: true, bodyShape: true, bust: true, waist: true, hip: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const latest = new Map<number, (typeof profiles)[number]>();
    for (const p of profiles) if (!latest.has(p.userId)) latest.set(p.userId, p);
    const sample = [...latest.values()];

    if (sample.length < MIN_SAMPLE) {
      return res.json({ range: { from, to, preset }, enough: false, minSample: MIN_SAMPLE, total: sample.length, shapes: [], sizes: [] });
    }

    const SHAPES = ['HOURGLASS', 'RECTANGLE', 'PEAR', 'APPLE', 'INVERTED_TRIANGLE'];
    const SHAPE_VI: Record<string, string> = { HOURGLASS: 'Đồng hồ cát', RECTANGLE: 'Chữ nhật', PEAR: 'Quả lê', APPLE: 'Quả táo', INVERTED_TRIANGLE: 'Tam giác ngược' };
    const shapeCount = new Map<string, number>();
    for (const p of sample) shapeCount.set(p.bodyShape, (shapeCount.get(p.bodyShape) ?? 0) + 1);
    const shapes = SHAPES.map((s) => ({ key: s, label: SHAPE_VI[s], count: shapeCount.get(s) ?? 0, pct: pct(shapeCount.get(s) ?? 0, sample.length) }));

    // phân bố size ước lượng từ vòng eo (ẩn danh) - chỉ khi đủ dữ liệu số đo
    const sizeOf = (waist: number) => waist < 64 ? 'S' : waist < 72 ? 'M' : waist < 80 ? 'L' : 'XL';
    const withWaist = sample.filter((p) => p.waist && p.waist > 0);
    let sizes: { name: string; count: number; pct: number }[] = [];
    if (withWaist.length >= MIN_SAMPLE) {
      const sc = new Map<string, number>();
      for (const p of withWaist) { const s = sizeOf(p.waist!); sc.set(s, (sc.get(s) ?? 0) + 1); }
      sizes = ['S', 'M', 'L', 'XL'].map((s) => ({ name: s, count: sc.get(s) ?? 0, pct: pct(sc.get(s) ?? 0, withWaist.length) }));
    }
    const popularSize = sizes.length ? [...sizes].sort((a, b) => b.count - a.count)[0].name : null;
    res.json({ range: { from, to, preset }, enough: true, total: sample.length, shapes, sizes, popularSize });
  } catch (err) { next(err); }
}

// ---------- UC15.5 Phân tích tồn kho ----------
export async function getInventoryAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = scopeSeller(req);
    const horizon = [7, 14, 30, 60].includes(Number(req.query.horizon)) ? Number(req.query.horizon) : 30;
    const LOOKBACK = 30; // số ngày lịch sử để tính tốc độ bán
    const since = new Date(); since.setDate(since.getDate() - LOOKBACK);

    const variants = await prisma.productVariant.findMany({
      where: { product: { ...(sellerId ? { sellerId } : {}), deletedAt: null } },
      select: { id: true, size: true, stock: true, reserved: true, lowStockThreshold: true,
        product: { select: { id: true, name: true, category: { select: { name: true } } } } },
    });

    // số đã bán theo biến thể trong LOOKBACK (đơn hợp lệ)
    const sold = await prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { variantId: { not: null }, order: { createdAt: { gte: since }, status: VALID_ORDER, ...(sellerId ? { sellerId } : {}) } },
      _sum: { quantity: true },
    });
    const soldMap = new Map<number, number>(sold.map((s) => [s.variantId as number, s._sum?.quantity ?? 0]));

    const items = variants.map((v) => {
      const available = Math.max(0, v.stock - v.reserved);
      const soldQty = soldMap.get(v.id) ?? 0;
      const rate = soldQty / LOOKBACK; // tốc độ bán/ngày
      const forecast = Math.round(rate * horizon);
      const daysOfCover = rate > 0 ? Math.round(available / rate) : null;
      const suggestedReorder = Math.max(0, forecast - available);
      const lowTh = v.lowStockThreshold ?? 5;
      let status: 'LOW' | 'NORMAL' | 'OVERSTOCK';
      if (available <= lowTh || (daysOfCover != null && daysOfCover < horizon)) status = 'LOW';
      else if (rate > 0 && daysOfCover != null && daysOfCover > horizon * 3) status = 'OVERSTOCK';
      else if (rate === 0 && available > lowTh * 4) status = 'OVERSTOCK';
      else status = 'NORMAL';
      return {
        variantId: v.id, productId: v.product.id, product: v.product.name, category: v.product.category?.name ?? 'Khác',
        size: v.size, stock: v.stock, reserved: v.reserved, available, sold: soldQty,
        sellRate: Math.round(rate * 100) / 100, forecast, daysOfCover, suggestedReorder, status,
        enoughData: soldQty > 0,
      };
    });
    const summary = {
      low: items.filter((i) => i.status === 'LOW').length,
      overstock: items.filter((i) => i.status === 'OVERSTOCK').length,
      normal: items.filter((i) => i.status === 'NORMAL').length,
      totalVariants: items.length,
    };
    // ưu tiên hiện biến thể cảnh báo trước
    items.sort((a, b) => (a.status === 'LOW' ? -1 : 1) - (b.status === 'LOW' ? -1 : 1) || b.sold - a.sold);
    res.json({ horizon, lookbackDays: LOOKBACK, summary, items });
  } catch (err) { next(err); }
}

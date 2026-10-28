import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { SHIPPING_METHODS, shippingFeeFor } from '../constants/shipping';
import { computeVoucher, voucherEligibleAmount } from './voucher.controller';
import { priceOrderRows, getRunningFlashSales, pickFlashSale, effectivePrice } from '../services/promotion.service';
import { startOnlinePayment } from '../services/payment.service';
import { vnpayEnabled } from '../config/env';
import { releaseReserved, finalizeStock } from '../services/order.service';
import { CANCELLABLE_DIRECT, CANCELLABLE_REQUEST, type OrderStatusValue } from '../constants/order-status';

// ============================================================
//  UC9.1 - Đặt hàng. Tính tiền ở phía hệ thống, kiểm tra lại giá/tồn kho/voucher
//  trước khi tạo đơn; snapshot thông tin tại thời điểm đặt.
// ============================================================

const availableOf = (v: { stock: number; reserved: number } | null) => (v ? Math.max(0, v.stock - v.reserved) : 0);

async function genOrderCode(): Promise<string> {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (let i = 0; i < 10; i++) {
    const code = `DS${ymd}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    if (!(await prisma.order.findUnique({ where: { code } }))) return code;
  }
  return `DS${Date.now().toString(36).toUpperCase()}`;
}

// Lấy các mục giỏ ĐANG CHỌN kèm dữ liệu kiểm tra
async function selectedCartItems(userId: number) {
  return prisma.cartItem.findMany({
    where: { userId, selected: true },
    include: {
      product: { select: { id: true, name: true, price: true, categoryId: true, status: true, deletedAt: true, seller: { select: { id: true, shopName: true, fullName: true } } } },
      variant: { select: { id: true, size: true, stock: true, reserved: true } },
    },
  });
}

// GET /api/orders/checkout - dữ liệu trang checkout: địa chỉ + phương thức ship + mục đang chọn
export async function getCheckoutInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const [addresses, rows] = await Promise.all([
      prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
      selectedCartItems(userId),
    ]);
    // UC13.1 - giá hiệu lực theo Flash Sale (nếu còn suất)
    const sales = await getRunningFlashSales(rows.map((r) => r.product.id));
    const items = rows.map((it) => {
      const valid = it.product.status === 'ACTIVE' && !it.product.deletedAt && (!it.variant || availableOf(it.variant) >= it.quantity);
      const fs = pickFlashSale(sales, it.product.id, it.variantId ?? null);
      const price = effectivePrice(it.product.price, fs);
      return {
        cartItemId: it.id, productId: it.product.id, name: it.product.name, price,
        originalPrice: it.product.price, flashSale: price < it.product.price,
        size: it.variant?.size ?? null, quantity: it.quantity, lineTotal: price * it.quantity,
        sellerId: it.product.seller.id, seller: it.product.seller.shopName || it.product.seller.fullName, valid,
      };
    });
    const subtotal = items.filter((i) => i.valid).reduce((a, i) => a + i.lineTotal, 0);
    res.json({ addresses, shippingMethods: SHIPPING_METHODS, items, subtotal, vnpayEnabled: vnpayEnabled() });
  } catch (err) {
    next(err);
  }
}

const placeSchema = z.object({
  addressId: z.coerce.number().int(),
  shippingMethod: z.string().default('STANDARD'),
  paymentMethod: z.enum(['COD', 'VNPAY', 'VISA']),
  voucherCode: z.string().trim().optional(),
  note: z.string().max(500).optional(),
});

function genCheckoutCode(): string {
  return 'CK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// POST /api/orders - đặt hàng (UC9.1). MULTI-SHOP: tách theo gian hàng -> MỘT đơn/mỗi shop,
// gộp cùng một checkoutCode (thanh toán gộp cho đơn online).
export async function placeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const body = placeSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu đặt hàng không hợp lệ.' });
    const { addressId, shippingMethod, paymentMethod, voucherCode, note } = body.data;

    const online = paymentMethod !== 'COD';
    if (online && !vnpayEnabled()) {
      return res.status(503).json({ message: 'Thanh toán online (VNPAY) chưa được cấu hình. Vui lòng chọn COD hoặc cấu hình VNPAY sandbox.', code: 'VNPAY_DISABLED' });
    }

    // 4E - địa chỉ phải thuộc khách và hợp lệ
    const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) return res.status(400).json({ message: 'Địa chỉ giao hàng không hợp lệ.', code: 'INVALID_ADDRESS' });

    const rows = await selectedCartItems(userId);
    if (rows.length === 0) return res.status(400).json({ message: 'Chưa chọn sản phẩm nào để đặt.', code: 'EMPTY_SELECTION' });

    // 2E/10b - kiểm tra lại trạng thái + tồn kho
    const invalid = rows.filter((it) => it.product.status !== 'ACTIVE' || it.product.deletedAt || (it.variant && availableOf(it.variant) < it.quantity));
    if (invalid.length > 0) {
      return res.status(409).json({
        message: 'Một số sản phẩm đã hết hàng/ngừng bán hoặc không đủ tồn kho. Vui lòng cập nhật giỏ hàng.',
        code: 'INVALID_ITEMS',
        items: invalid.map((it) => ({ name: it.product.name, size: it.variant?.size ?? null, available: availableOf(it.variant) })),
      });
    }

    // UC13.1 - giá hiệu lực: áp giá Flash Sale (nếu còn suất) rồi mới tính tiền.
    const { priced, consume } = await priceOrderRows(
      rows.map((it) => ({ productId: it.product.id, variantId: it.variantId ?? null, quantity: it.quantity, basePrice: it.product.price })),
      userId,
    );
    const priceByCart = new Map(rows.map((it, i) => [it.id, priced[i].price] as const)); // giá sau Flash theo cartItemId
    const effPrice = (it: (typeof rows)[number]) => priceByCart.get(it.id) ?? it.product.price;

    // Tính tiền ở phía hệ thống (không tin số từ frontend)
    const totalSubtotal = rows.reduce((a, it) => a + effPrice(it) * it.quantity, 0);
    const ctxItems = rows.map((it) => ({ productId: it.product.id, categoryId: it.product.categoryId, sellerId: it.product.seller.id, lineTotal: effPrice(it) * it.quantity }));
    let discount = 0;
    let voucherInfo: Awaited<ReturnType<typeof computeVoucher>>['voucher'] = null;
    if (voucherCode) {
      const v = await computeVoucher(voucherCode, totalSubtotal, { userId, items: ctxItems }); // kiểm lại khi checkout
      if (!v.valid) return res.status(400).json({ message: v.message, code: 'VOUCHER_INVALID' }); // 10c
      discount = v.discount;
      voucherInfo = v.voucher;
    }

    // Nhóm các mục theo gian hàng (sellerId)
    const groups = new Map<number, typeof rows>();
    for (const it of rows) {
      const sid = it.product.seller.id;
      if (!groups.has(sid)) groups.set(sid, []);
      groups.get(sid)!.push(it);
    }
    // Voucher PHÂN BỔ theo phần ĐỦ ĐIỀU KIỆN của từng gian hàng (voucher theo shop/phạm vi chỉ giảm đúng đơn liên quan)
    const entries = [...groups.entries()];
    const groupEligible = entries.map(([, items]) =>
      voucherInfo ? voucherEligibleAmount(voucherInfo, items.map((it) => ({ productId: it.product.id, categoryId: it.product.categoryId, sellerId: it.product.seller.id, lineTotal: effPrice(it) * it.quantity }))) : 0,
    );
    const totalEligible = groupEligible.reduce((a, b) => a + b, 0);
    let allocated = 0;
    const prepared = entries.map(([sid, items], idx) => {
      const subtotal = items.reduce((a, it) => a + effPrice(it) * it.quantity, 0);
      // đơn cuối (trong các đơn đủ điều kiện) nhận phần dư để tổng giảm khớp tuyệt đối
      const lastEligibleIdx = groupEligible.reduce((last, amt, i) => (amt > 0 ? i : last), -1);
      const d = totalEligible <= 0 ? 0 : idx === lastEligibleIdx ? discount - allocated : Math.floor((discount * groupEligible[idx]) / totalEligible);
      allocated += d;
      const shippingFee = shippingFeeFor(shippingMethod, subtotal); // phí ship tính theo từng gian hàng
      return { sid, items, subtotal, discount: d, shippingFee, total: Math.max(0, subtotal - d + shippingFee) };
    });
    const checkoutCode = genCheckoutCode();

    // Nguyên tử: tạo N đơn + giữ chỗ tồn kho + xóa mục khỏi giỏ + trừ suất Flash + ghi lượt voucher
    const orders = await prisma.$transaction(async (db) => {
      const created = [];
      for (const g of prepared) {
        const code = await genOrderCode();
        const o = await db.order.create({
          data: {
            code, userId, sellerId: g.sid, checkoutCode,
            status: online ? 'AWAITING_PAYMENT' : 'PENDING',
            paymentMethod, paymentStatus: online ? 'PENDING' : 'UNPAID',
            recipientName: address.recipientName, phone: address.phone,
            province: address.province, district: address.district, ward: address.ward, addressDetail: address.detail,
            subtotal: g.subtotal, discount: g.discount, voucherCode: voucherCode ?? null, shippingMethod, shippingFee: g.shippingFee, total: g.total, note: note ?? null,
            items: {
              create: g.items.map((it) => ({
                productId: it.product.id, variantId: it.variantId,
                name: it.product.name, size: it.variant?.size ?? null,
                quantity: it.quantity, price: effPrice(it), // snapshot giá đã áp Flash Sale
              })),
            },
          },
        });
        created.push(o);
      }
      // giữ chỗ tồn kho (reserved) cho toàn bộ mục
      for (const it of rows) {
        if (it.variantId) await db.productVariant.update({ where: { id: it.variantId }, data: { reserved: { increment: it.quantity } } });
      }
      await db.cartItem.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });

      // UC13.1 - trừ suất Flash Sale + ghi nhận số suất theo khách (perUserLimit)
      for (const [flashSaleId, qty] of consume) {
        await db.flashSale.update({ where: { id: flashSaleId }, data: { soldCount: { increment: qty } } });
        await db.flashSaleUsage.upsert({
          where: { flashSaleId_userId: { flashSaleId, userId } },
          update: { quantity: { increment: qty } },
          create: { flashSaleId, userId, quantity: qty },
        });
      }
      // Voucher: tăng tổng lượt (1 lần/checkout) + lượt theo khách (perUserLimit)
      if (voucherCode && discount > 0) {
        const vrow = await db.voucher.findUnique({ where: { code: voucherCode.toUpperCase() }, select: { id: true } });
        if (vrow) {
          await db.voucher.update({ where: { id: vrow.id }, data: { usedCount: { increment: 1 } } });
          await db.voucherUsage.upsert({
            where: { voucherId_userId: { voucherId: vrow.id, userId } },
            update: { count: { increment: 1 } },
            create: { voucherId: vrow.id, userId, count: 1 },
          });
        }
      }
      return created;
    });

    // Online -> MỘT giao dịch gộp cho tổng tất cả đơn (UC9.2)
    if (online) {
      const combinedTotal = orders.reduce((a, o) => a + o.total, 0);
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const { payUrl } = await startOnlinePayment(orders[0], ip, combinedTotal);
      return res.status(201).json({ orders, payUrl, checkoutCode });
    }
    res.status(201).json({ orders, checkoutCode });
  } catch (err) {
    next(err);
  }
}

function serializeOrder(o: any) {
  return { ...o, items: o.items };
}

const VALID_STATUS = ['AWAITING_PAYMENT', 'PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'PAID'];

// GET /api/orders?status= - danh sách đơn của khách (UC10.1 - lọc theo trạng thái)
export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' && VALID_STATUS.includes(req.query.status) ? req.query.status : undefined;
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json({ orders: orders.map(serializeOrder) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/orders/:id/confirm-receipt - UC10.3 khách xác nhận đã nhận hàng
export async function confirmReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.order.findFirst({ where: { id: Number(req.params.id), userId: req.user!.userId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' }); // 2E
    if (order.status === 'COMPLETED') return res.status(400).json({ message: 'Đơn đã được xác nhận nhận hàng.' }); // 5E
    if (order.status !== 'DELIVERED') return res.status(400).json({ message: 'Đơn chưa ở trạng thái Đã giao nên chưa thể xác nhận.' }); // 2E

    const now = new Date();
    await prisma.$transaction(async (db) => {
      await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', completedAt: now } });
      await finalizeStock(db, order.items); // chốt tồn kho khi hoàn tất
    });
    res.json({ ok: true, status: 'COMPLETED', completedAt: now });
  } catch (err) {
    next(err);
  }
}

const cancelSchema = z.object({ reason: z.string().trim().min(1, 'Vui lòng chọn lý do hủy.') });

// POST /api/orders/:id/cancel - UC10.5 khách hủy đơn (trực tiếp hoặc tạo yêu cầu hủy)
export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const body = cancelSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng chọn lý do hủy.' });
    const order = await prisma.order.findFirst({ where: { id: Number(req.params.id), userId: req.user!.userId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' }); // 2E
    const st = order.status as OrderStatusValue;

    // 3E - đã hoàn tất/đã hủy: không cho hủy
    if (st === 'COMPLETED' || st === 'CANCELLED') return res.status(400).json({ message: 'Đơn đã hoàn tất hoặc đã hủy, không thể hủy.' });

    // Chờ xác nhận / chờ thanh toán: hủy trực tiếp
    if (CANCELLABLE_DIRECT.includes(st)) {
      const needRefund = order.paymentStatus === 'PAID'; // 9a COD chưa trả -> không hoàn tiền
      await prisma.$transaction(async (db) => {
        await db.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'CUSTOMER', cancelReason: body.data.reason, cancelRequested: false, refundStatus: needRefund ? 'PENDING' : null },
        });
        await releaseReserved(db, order.items); // hoàn kho
      });
      return res.json({ ok: true, status: 'CANCELLED', refund: needRefund });
    }

    // Đã xác nhận / đang chuẩn bị: tạo yêu cầu hủy, chờ người bán duyệt (3a)
    if (CANCELLABLE_REQUEST.includes(st)) {
      if (order.cancelRequested) return res.status(400).json({ message: 'Đã gửi yêu cầu hủy, đang chờ người bán duyệt.' });
      await prisma.order.update({ where: { id: order.id }, data: { cancelRequested: true, cancelReason: body.data.reason } });
      return res.json({ requested: true, message: 'Đã gửi yêu cầu hủy, chờ người bán duyệt.' });
    }

    // Đang giao trở đi (3d/3E.1): không cho hủy trực tiếp
    return res.status(409).json({ message: 'Đơn đã được bàn giao vận chuyển, không thể hủy. Vui lòng dùng đổi/trả hoặc khiếu nại (UC11).', code: 'NOT_CANCELLABLE' });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id - chi tiết đơn (chỉ của chính mình)
export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), userId: req.user!.userId },
      include: { items: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    res.json({ order: serializeOrder(order) });
  } catch (err) {
    next(err);
  }
}

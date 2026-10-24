import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { SHIPPING_METHODS, shippingFeeFor } from '../constants/shipping';
import { computeVoucher } from './voucher.controller';
import { startOnlinePayment } from '../services/payment.service';
import { vnpayEnabled } from '../config/env';

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
      product: { select: { id: true, name: true, price: true, status: true, deletedAt: true, seller: { select: { id: true, shopName: true, fullName: true } } } },
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
    const items = rows.map((it) => {
      const valid = it.product.status === 'ACTIVE' && !it.product.deletedAt && (!it.variant || availableOf(it.variant) >= it.quantity);
      return {
        cartItemId: it.id, productId: it.product.id, name: it.product.name, price: it.product.price,
        size: it.variant?.size ?? null, quantity: it.quantity, lineTotal: it.product.price * it.quantity,
        seller: it.product.seller.shopName || it.product.seller.fullName, valid,
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

// POST /api/orders - đặt hàng (UC9.1 bước 9-12)
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

    // Tính tiền ở phía hệ thống (không tin số từ frontend)
    const subtotal = rows.reduce((a, it) => a + it.product.price * it.quantity, 0);
    let discount = 0;
    if (voucherCode) {
      const v = await computeVoucher(voucherCode, subtotal);
      if (!v.valid) return res.status(400).json({ message: v.message, code: 'VOUCHER_INVALID' }); // 10c
      discount = v.discount;
    }
    const shippingFee = shippingFeeFor(shippingMethod, subtotal);
    const total = Math.max(0, subtotal - discount + shippingFee);
    const code = await genOrderCode();

    // Nguyên tử: tạo đơn + mục + giữ chỗ tồn kho + xóa mục khỏi giỏ + tăng lượt voucher (11E)
    const order = await prisma.$transaction(async (db) => {
      const o = await db.order.create({
        data: {
          code, userId,
          status: online ? 'AWAITING_PAYMENT' : 'PENDING',
          paymentMethod, paymentStatus: online ? 'PENDING' : 'UNPAID',
          recipientName: address.recipientName, phone: address.phone,
          province: address.province, district: address.district, ward: address.ward, addressDetail: address.detail,
          subtotal, discount, voucherCode: voucherCode ?? null, shippingMethod, shippingFee, total, note: note ?? null,
          items: {
            create: rows.map((it) => ({
              productId: it.product.id, variantId: it.variantId,
              name: it.product.name, size: it.variant?.size ?? null,
              quantity: it.quantity, price: it.product.price,
            })),
          },
        },
      });
      // giữ chỗ tồn kho (reserved) để tránh bán vượt
      for (const it of rows) {
        if (it.variantId) await db.productVariant.update({ where: { id: it.variantId }, data: { reserved: { increment: it.quantity } } });
      }
      // xóa các mục đã đặt khỏi giỏ
      await db.cartItem.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      // UC8.3 - đánh dấu đã dùng voucher theo đơn
      if (voucherCode && discount > 0) await db.voucher.updateMany({ where: { code: voucherCode.toUpperCase() }, data: { usedCount: { increment: 1 } } });
      return o;
    });

    // Online -> tạo giao dịch + URL thanh toán (chuyển UC9.2)
    if (online) {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const { payUrl } = await startOnlinePayment(order, ip);
      return res.status(201).json({ order, payUrl });
    }
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

function serializeOrder(o: any) {
  return { ...o, items: o.items };
}

// GET /api/orders - danh sách đơn của khách
export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json({ orders: orders.map(serializeOrder) });
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

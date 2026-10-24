import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { computeVoucher } from './voucher.controller';

// ============================================================
//  UC8.1 - Quản lý giỏ hàng
//  Mỗi mục = sản phẩm + biến thể (size). Khác size là mục khác.
//  Thêm vào giỏ KHÔNG giữ hàng/giữ giá — kiểm tra lại khi thanh toán.
// ============================================================

const PURCHASE_LIMIT = 10; // giới hạn mua mỗi mục (13E)

const availableOf = (v: { stock: number; reserved: number } | null | undefined) =>
  v ? Math.max(0, v.stock - v.reserved) : 0;

// Tải 1 mục giỏ kèm dữ liệu cần để hiển thị + kiểm tra hợp lệ
async function loadUserCart(userId: number) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, shopName: true, fullName: true } },
          variants: { select: { id: true, size: true, stock: true, reserved: true } },
        },
      },
      variant: { select: { id: true, size: true, stock: true, reserved: true } },
    },
  });
  return items;
}

// Chuẩn hóa 1 mục giỏ -> payload cho client + cờ hợp lệ
function serializeItem(it: Awaited<ReturnType<typeof loadUserCart>>[number]) {
  const p = it.product;
  const sellable = p.status === 'ACTIVE' && !p.deletedAt; // 8a - sản phẩm phải đang bán
  const available = availableOf(it.variant);
  const inStock = it.variant ? available > 0 : true;
  const maxQty = Math.min(PURCHASE_LIMIT, it.variant ? available : PURCHASE_LIMIT);
  // Mục chỉ hợp lệ để thanh toán khi: còn bán + còn hàng + số lượng trong giới hạn
  const valid = sellable && inStock && it.quantity <= maxQty;
  return {
    id: it.id,
    quantity: it.quantity,
    selected: it.selected,
    price: p.price,
    lineTotal: p.price * it.quantity,
    variant: it.variant ? { id: it.variant.id, size: it.variant.size } : null,
    available,
    maxQty,
    inStock,
    sellable,
    valid,
    product: {
      id: p.id,
      name: p.name,
      color: p.color,
      image: p.images[0]?.url ?? null,
      category: p.category,
      sizes: p.variants.map((v) => ({ id: v.id, size: v.size, available: availableOf(v) })),
    },
    seller: { id: p.seller.id, name: p.seller.shopName || p.seller.fullName },
  };
}

// GET /api/cart - giỏ hàng, nhóm theo gian hàng + tổng tạm tính của các mục đang chọn
export async function getCart(req: Request, res: Response, next: NextFunction) {
  try {
    const items = (await loadUserCart(req.user!.userId)).map(serializeItem);
    // Nhóm theo gian hàng (UC8.1 - giỏ có thể chứa SP từ nhiều Người bán)
    const shopMap = new Map<number, { seller: { id: number; name: string }; items: typeof items }>();
    for (const it of items) {
      if (!shopMap.has(it.seller.id)) shopMap.set(it.seller.id, { seller: it.seller, items: [] });
      shopMap.get(it.seller.id)!.items.push(it);
    }
    const shops = [...shopMap.values()];
    const selected = items.filter((i) => i.selected && i.valid);
    const selectedSubtotal = selected.reduce((a, i) => a + i.lineTotal, 0);
    res.json({
      shops,
      totalCount: items.length,
      selectedCount: selected.length,
      selectedSubtotal,
      hasInvalid: items.some((i) => i.selected && !i.valid), // có mục đang chọn nhưng không hợp lệ (8a)
    });
  } catch (err) {
    next(err);
  }
}

const addSchema = z.object({
  productId: z.coerce.number().int(),
  variantId: z.coerce.number().int().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
});

// POST /api/cart - thêm sản phẩm vào giỏ (gộp nếu trùng product+variant)
export async function addToCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const body = addSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const { productId, variantId, quantity } = body.data;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { select: { id: true, size: true, stock: true, reserved: true } } },
    });
    if (!product || product.deletedAt || product.status !== 'ACTIVE') {
      return res.status(404).json({ message: 'Sản phẩm không khả dụng.' }); // 8a
    }

    // 4E - sản phẩm có biến thể thì bắt buộc chọn size
    let variant = null as (typeof product.variants)[number] | null;
    if (product.variants.length > 0) {
      if (!variantId) return res.status(400).json({ message: 'Vui lòng chọn size trước khi thêm vào giỏ.', code: 'VARIANT_REQUIRED' });
      variant = product.variants.find((v) => v.id === variantId) ?? null;
      if (!variant) return res.status(400).json({ message: 'Biến thể không hợp lệ.' });
    }

    const available = availableOf(variant);
    if (variant && available <= 0) return res.status(409).json({ message: 'Biến thể đã hết hàng.', code: 'OUT_OF_STOCK' }); // 4E.1

    // 3a - đã có cùng product+variant -> cộng dồn, không vượt tồn kho / giới hạn mua
    const existing = await prisma.cartItem.findFirst({ where: { userId, productId, variantId: variantId ?? null } });
    const cap = Math.min(PURCHASE_LIMIT, variant ? available : PURCHASE_LIMIT);
    if (existing) {
      const newQty = Math.min(existing.quantity + quantity, cap);
      const item = await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty, selected: true } });
      return res.json({ item, capped: existing.quantity + quantity > cap, maxQty: cap });
    }
    const item = await prisma.cartItem.create({
      data: { userId, productId, variantId: variantId ?? null, quantity: Math.min(quantity, cap) },
    });
    res.status(201).json({ item, capped: quantity > cap, maxQty: cap });
  } catch (err) {
    next(err);
  }
}

const updateSchema = z.object({
  quantity: z.coerce.number().int().min(1).optional(),
  variantId: z.coerce.number().int().optional(),
  selected: z.boolean().optional(),
});

// PATCH /api/cart/:id - cập nhật số lượng / đổi biến thể / chọn-bỏ chọn
export async function updateCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const body = updateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });

    const item = await prisma.cartItem.findFirst({
      where: { id, userId },
      include: { product: { include: { variants: { select: { id: true, size: true, stock: true, reserved: true } } } } },
    });
    if (!item) return res.status(404).json({ message: 'Không tìm thấy mục giỏ hàng.' });

    const data: { quantity?: number; variantId?: number; selected?: boolean } = {};

    // 5a - đổi size/màu: kiểm tra biến thể mới còn hàng
    let targetVariantId = item.variantId;
    if (body.data.variantId != null && body.data.variantId !== item.variantId) {
      const v = item.product.variants.find((x) => x.id === body.data.variantId);
      if (!v) return res.status(400).json({ message: 'Biến thể không hợp lệ.' });
      if (availableOf(v) <= 0) return res.status(409).json({ message: 'Biến thể mới đã hết hàng.', code: 'OUT_OF_STOCK' });
      // Nếu đã có mục khác cùng biến thể -> gộp vào mục đó, xóa mục hiện tại
      const dup = await prisma.cartItem.findFirst({ where: { userId, productId: item.productId, variantId: v.id, id: { not: id } } });
      if (dup) {
        const cap = Math.min(PURCHASE_LIMIT, availableOf(v));
        await prisma.cartItem.update({ where: { id: dup.id }, data: { quantity: Math.min(dup.quantity + item.quantity, cap), selected: true } });
        await prisma.cartItem.delete({ where: { id } });
        return res.json({ merged: true, into: dup.id });
      }
      data.variantId = v.id;
      targetVariantId = v.id;
    }

    // 13E - số lượng hợp lệ (>=1, <= tồn kho và giới hạn mua)
    if (body.data.quantity != null) {
      const v = item.product.variants.find((x) => x.id === targetVariantId);
      const cap = Math.min(PURCHASE_LIMIT, v ? availableOf(v) : PURCHASE_LIMIT);
      if (body.data.quantity > cap) {
        return res.status(400).json({ message: `Số lượng tối đa cho mục này là ${cap}.`, code: 'QTY_LIMIT', maxQty: cap });
      }
      data.quantity = body.data.quantity;
    }

    if (body.data.selected != null) data.selected = body.data.selected;

    const updated = await prisma.cartItem.update({ where: { id }, data });
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart/:id - 5b xóa mục khỏi giỏ
export async function removeCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const item = await prisma.cartItem.findFirst({ where: { id, userId } });
    if (!item) return res.status(404).json({ message: 'Không tìm thấy mục giỏ hàng.' });
    await prisma.cartItem.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

const checkoutSchema = z.object({ voucherCode: z.string().trim().optional() });

// POST /api/cart/checkout - UC8.1 bước 8-9: kiểm tra lại giá/tồn kho các mục đang chọn,
// áp voucher (UC8.3) rồi trả bản tóm tắt để chuyển sang UC9 (đặt hàng - chưa triển khai).
export async function checkoutPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const body = checkoutSchema.safeParse(req.body ?? {});
    const items = (await loadUserCart(req.user!.userId)).map(serializeItem);
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) return res.status(400).json({ message: 'Chưa chọn sản phẩm nào để thanh toán.', code: 'EMPTY_SELECTION' });

    // 8a - loại mục không hợp lệ (hết hàng / ngừng bán)
    const invalid = selected.filter((i) => !i.valid);
    const valid = selected.filter((i) => i.valid);
    if (valid.length === 0) {
      return res.status(409).json({ message: 'Các sản phẩm đang chọn không còn hợp lệ để thanh toán.', code: 'ALL_INVALID', invalid });
    }

    const subtotal = valid.reduce((a, i) => a + i.lineTotal, 0);

    // UC8.3 - áp voucher (nếu có)
    let voucher = null as Awaited<ReturnType<typeof computeVoucher>> | null;
    const code = body.success ? body.data.voucherCode : undefined;
    if (code) {
      voucher = await computeVoucher(code, subtotal);
      if (!voucher.valid) return res.status(400).json({ message: voucher.message, code: 'VOUCHER_INVALID' });
    }
    const discount = voucher?.valid ? voucher.discount : 0;
    const total = Math.max(0, subtotal - discount);

    res.json({
      ready: true,
      items: valid,
      removed: invalid, // mục bị loại do không hợp lệ
      subtotal,
      voucher: voucher?.valid ? voucher.voucher : null,
      discount,
      total,
      note: 'Đặt hàng & thanh toán thuộc UC9 — sẽ bổ sung sau.',
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/cart/count - số mục trong giỏ (cho badge trên navbar)
export async function getCartCount(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await prisma.cartItem.count({ where: { userId: req.user!.userId } });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

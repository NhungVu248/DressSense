import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  ERD 3.3 - shop_shipping_methods (Seller #6)
//  Người bán tự khai đơn vị vận chuyển, dịch vụ & phí ship cho gian hàng mình.
//  Không kết nối API hãng vận chuyển; trạng thái giao hàng cập nhật thủ công ở Đơn hàng.
// ============================================================

// Lấy shopId của Người bán đang đăng nhập (mỗi Seller 1 shop)
async function getMyShopId(user: JwtPayload): Promise<number | null> {
  const shop = await prisma.shop.findUnique({ where: { ownerId: user.userId }, select: { id: true } });
  return shop?.id ?? null;
}

// GET /api/seller/shipping-methods
export async function listShippingMethods(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const shopId = await getMyShopId(user);
    if (!shopId) return res.json({ methods: [] });
    const methods = await prisma.shopShippingMethod.findMany({
      where: { shopId }, orderBy: { createdAt: 'asc' },
    });
    res.json({ methods });
  } catch (err) {
    next(err);
  }
}

const methodSchema = z.object({
  carrierName: z.string().trim().min(1, 'Nhập tên đơn vị vận chuyển').max(100),
  serviceName: z.string().trim().max(100).optional(),
  shippingFee: z.number().int().min(0).default(0),
  estimatedDays: z.number().int().min(0).nullable().optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// POST /api/seller/shipping-methods
export async function createShippingMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const shopId = await getMyShopId(user);
    if (!shopId) return res.status(400).json({ message: 'Bạn chưa có gian hàng.' });
    const parsed = methodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
    const method = await prisma.shopShippingMethod.create({ data: { shopId, ...parsed.data } });
    res.status(201).json({ method });
  } catch (err) {
    next(err);
  }
}

// PUT /api/seller/shipping-methods/:id
export async function updateShippingMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const shopId = await getMyShopId(user);
    const id = Number(req.params.id);
    const existing = await prisma.shopShippingMethod.findUnique({ where: { id } });
    if (!existing || existing.shopId !== shopId)
      return res.status(404).json({ message: 'Không tìm thấy phương thức vận chuyển.' });
    const parsed = methodSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const method = await prisma.shopShippingMethod.update({ where: { id }, data: parsed.data });
    res.json({ method });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/seller/shipping-methods/:id
export async function deleteShippingMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const shopId = await getMyShopId(user);
    const id = Number(req.params.id);
    const existing = await prisma.shopShippingMethod.findUnique({ where: { id } });
    if (!existing || existing.shopId !== shopId)
      return res.status(404).json({ message: 'Không tìm thấy phương thức vận chuyển.' });
    await prisma.shopShippingMethod.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

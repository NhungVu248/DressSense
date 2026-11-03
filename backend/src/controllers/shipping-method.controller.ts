import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getShippingMethods as getSystemMethods } from '../services/shipping.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  ERD 3.3 - shop_shipping_methods (Seller #6)
//  Người bán có thể: (a) TÍCH CHỌN các phương thức hệ thống cấu hình sẵn
//  (STANDARD/EXPRESS...) - không bắt buộc, không cần đặt mặc định (tuỳ khu vực);
//  (b) tự khai thêm đơn vị/dịch vụ/phí riêng của gian hàng.
//  Không kết nối API hãng vận chuyển; trạng thái giao hàng cập nhật thủ công ở Đơn hàng.
// ============================================================

// Lấy shopId của Người bán đang đăng nhập (mỗi Seller 1 shop)
async function getMyShopId(user: JwtPayload): Promise<number | null> {
  const shop = await prisma.shop.findUnique({ where: { ownerId: user.userId }, select: { id: true } });
  return shop?.id ?? null;
}

// GET /api/seller/shipping-methods
// Trả về: phương thức hệ thống (kèm cờ đã bật) + phương thức shop đã khai báo.
export async function listShippingMethods(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const shopId = await getMyShopId(user);
    const systemDefs = await getSystemMethods();
    if (!shopId) return res.json({ methods: [], system: systemDefs.map((m) => ({ ...m, enabled: false })) });

    const methods = await prisma.shopShippingMethod.findMany({
      where: { shopId }, orderBy: { createdAt: 'asc' },
    });
    const enabledCodes = new Set(methods.filter((m) => m.systemCode).map((m) => m.systemCode as string));
    const system = systemDefs.map((m) => ({ ...m, enabled: enabledCodes.has(m.code) }));
    res.json({ methods, system });
  } catch (err) {
    next(err);
  }
}

// POST /api/seller/shipping-methods/system - bật/tắt một phương thức hệ thống cho gian hàng
export async function toggleSystemMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const shopId = await getMyShopId(user);
    if (!shopId) return res.status(400).json({ message: 'Bạn chưa có gian hàng.' });
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const enabled = req.body?.enabled !== false;

    const systemDefs = await getSystemMethods();
    const def = systemDefs.find((m) => m.code === code);
    if (!def) return res.status(400).json({ message: 'Phương thức hệ thống không hợp lệ.' });

    const existing = await prisma.shopShippingMethod.findFirst({ where: { shopId, systemCode: code } });
    if (enabled) {
      // Bật: tạo bản ghi tham chiếu phương thức hệ thống (snapshot nhãn/phí/ETA để hiển thị)
      if (!existing) {
        await prisma.shopShippingMethod.create({
          data: { shopId, systemCode: code, carrierName: def.label, shippingFee: def.fee, estimatedDays: def.eta, status: 'ACTIVE' },
        });
      }
    } else if (existing) {
      await prisma.shopShippingMethod.delete({ where: { id: existing.id } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

const methodSchema = z.object({
  carrierName: z.string().trim().min(1, 'Nhập tên đơn vị vận chuyển').max(100),
  serviceName: z.string().trim().max(100).optional(),
  shippingFee: z.number().int().min(0).default(0),
  estimatedDays: z.string().trim().max(100).nullable().optional(), // text tự do (vd "2-3 ngày")
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

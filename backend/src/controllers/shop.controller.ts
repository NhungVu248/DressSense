import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC14.1 - Quản lý gian hàng (Seller Portal) + kiểm duyệt (UC16.3).
// ============================================================

const shopSchema = z.object({
  name: z.string().trim().min(1, 'Tên gian hàng bắt buộc').max(120),
  logoUrl: z.string().trim().optional().nullable(),
  coverUrl: z.string().trim().optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  contactEmail: z.string().trim().email('Email không hợp lệ').optional().nullable().or(z.literal('')),
  contactPhone: z.string().trim().max(20).optional().nullable(),
  pickupName: z.string().trim().optional().nullable(),
  pickupPhone: z.string().trim().optional().nullable(),
  pickupProvince: z.string().trim().optional().nullable(),
  pickupDistrict: z.string().trim().optional().nullable(),
  pickupWard: z.string().trim().optional().nullable(),
  pickupDetail: z.string().trim().optional().nullable(),
  returnSameAsPickup: z.boolean().optional(),
  returnName: z.string().trim().optional().nullable(),
  returnPhone: z.string().trim().optional().nullable(),
  returnProvince: z.string().trim().optional().nullable(),
  returnDistrict: z.string().trim().optional().nullable(),
  returnWard: z.string().trim().optional().nullable(),
  returnDetail: z.string().trim().optional().nullable(),
});

// ---------- Người bán ----------

// GET /api/seller/shop - hồ sơ gian hàng của tôi (tự tạo bản nháp nếu chưa có)
export async function getMyShop(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    let shop = await prisma.shop.findUnique({ where: { ownerId: user.userId } });
    if (!shop) {
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { shopName: true, email: true, phone: true },
      });
      shop = await prisma.shop.create({
        data: {
          ownerId: user.userId,
          name: u?.shopName || 'Gian hàng của tôi',
          contactEmail: u?.email ?? null,
          contactPhone: u?.phone ?? null,
          status: 'DRAFT',
        },
      });
    }
    res.json({ shop });
  } catch (err) {
    next(err);
  }
}

// PUT /api/seller/shop - lưu/cập nhật hồ sơ. Thay đổi thông thường áp dụng ngay (7a);
// không tự đổi trạng thái kiểm duyệt (quy tắc: không tự ý đổi trạng thái).
export async function updateMyShop(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const parsed = shopSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Dữ liệu gian hàng không hợp lệ.', errors: parsed.error.flatten() }); // 5E
    }
    const d = parsed.data;
    const data = { ...d, contactEmail: d.contactEmail ? d.contactEmail : null };
    const existing = await prisma.shop.findUnique({ where: { ownerId: user.userId } });
    const shop = existing
      ? await prisma.shop.update({ where: { ownerId: user.userId }, data })
      : await prisma.shop.create({ data: { ...data, ownerId: user.userId, status: 'DRAFT' } });
    res.json({ shop });
  } catch (err) {
    next(err);
  }
}

// POST /api/seller/shop/submit - gửi kiểm duyệt (UC14.1 -> UC16.3)
export async function submitMyShop(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const shop = await prisma.shop.findUnique({ where: { ownerId: user.userId } });
    if (!shop) return res.status(404).json({ message: 'Chưa có hồ sơ gian hàng.' });
    if (shop.status === 'PENDING') return res.status(409).json({ message: 'Hồ sơ đang chờ duyệt.' });
    if (shop.status === 'ACTIVE') return res.status(409).json({ message: 'Gian hàng đã được duyệt và đang hoạt động.' });

    // 5E.2 - không cho gửi duyệt nếu thiếu thông tin bắt buộc
    const missing: string[] = [];
    if (!shop.name?.trim()) missing.push('tên gian hàng');
    if (!shop.description?.trim()) missing.push('mô tả gian hàng');
    if (!shop.contactPhone?.trim() && !shop.contactEmail?.trim()) missing.push('thông tin liên hệ');
    if (!shop.pickupProvince || !shop.pickupDistrict || !shop.pickupWard || !shop.pickupDetail) {
      missing.push('địa chỉ lấy hàng');
    }
    if (missing.length) {
      return res.status(422).json({ message: `Thiếu thông tin bắt buộc: ${missing.join(', ')}.` });
    }

    const updated = await prisma.shop.update({
      where: { ownerId: user.userId },
      data: { status: 'PENDING', submittedAt: new Date(), rejectReason: null },
    });
    res.json({ shop: updated, message: 'Đã gửi hồ sơ chờ Quản trị viên kiểm duyệt.' });
  } catch (err) {
    next(err);
  }
}

// ---------- Quản trị viên kiểm duyệt (UC16.3) ----------

// GET /api/admin/shops?status= - danh sách gian hàng để kiểm duyệt
export async function listShopsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const where: any = {};
    if (status) where.status = status;
    const shops = await prisma.shop.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: { owner: { select: { id: true, fullName: true, email: true } } },
    });
    const counts = await prisma.shop.groupBy({ by: ['status'], _count: { _all: true } });
    res.json({ shops, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/shops/:id/approve - 9a phê duyệt -> Đang hoạt động
export async function approveShop(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const shop = await prisma.shop.findUnique({ where: { id } });
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy gian hàng.' });
    const updated = await prisma.shop.update({
      where: { id },
      data: { status: 'ACTIVE', reviewedAt: new Date(), reviewedById: user.userId, rejectReason: null },
    });
    await notify(shop.ownerId, 'SHOP', 'Gian hàng được duyệt',
      `Gian hàng "${shop.name}" đã được phê duyệt và đang hoạt động.`, '/seller/shop');
    res.json({ shop: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/shops/:id/reject - 9b từ chối (kèm lý do)
export async function rejectShop(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối.' });
    const shop = await prisma.shop.findUnique({ where: { id } });
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy gian hàng.' });
    const updated = await prisma.shop.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedById: user.userId, rejectReason: reason },
    });
    await notify(shop.ownerId, 'SHOP', 'Hồ sơ gian hàng bị từ chối', `Lý do: ${reason}`, '/seller/shop');
    res.json({ shop: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/shops/:id/request-info - 5a yêu cầu bổ sung thông tin
export async function requestInfoShop(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note) return res.status(400).json({ message: 'Vui lòng nhập nội dung cần bổ sung.' });
    const shop = await prisma.shop.findUnique({ where: { id } });
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy gian hàng.' });
    const updated = await prisma.shop.update({
      where: { id },
      data: { status: 'NEEDS_INFO', rejectReason: note, reviewedAt: new Date(), reviewedById: user.userId },
    });
    await notify(shop.ownerId, 'SHOP', 'Hồ sơ gian hàng cần bổ sung',
      `Nội dung cần bổ sung: ${note}. Vui lòng cập nhật và gửi lại.`, '/seller/shop');
    res.json({ shop: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/shops/:id/suspension - tạm ngưng / mở lại (vi phạm)
export async function setShopSuspension(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const suspend = req.body?.suspend !== false; // mặc định true
    const shop = await prisma.shop.findUnique({ where: { id } });
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy gian hàng.' });
    const updated = await prisma.shop.update({
      where: { id },
      data: { status: suspend ? 'SUSPENDED' : 'ACTIVE', reviewedAt: new Date(), reviewedById: user.userId },
    });
    await notify(shop.ownerId, 'SHOP', suspend ? 'Gian hàng bị tạm ngưng' : 'Gian hàng được mở lại',
      suspend ? 'Gian hàng của bạn đã bị tạm ngưng.' : 'Gian hàng của bạn đã hoạt động trở lại.', '/seller/shop');
    res.json({ shop: updated });
  } catch (err) {
    next(err);
  }
}

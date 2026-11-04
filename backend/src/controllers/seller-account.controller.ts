import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  Cài đặt người bán - tự quản lý trạng thái gian hàng & tài khoản.
//  (Admin cũng khóa được qua cổng Admin; đây là phần self-service của seller.)
// ============================================================

const shopSchema = z.object({ action: z.enum(['suspend', 'reopen']) });

// PATCH /api/seller/account/shop-status - tạm ngưng / mở lại gian hàng
export async function setMyShopStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const body = shopSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const shop = await prisma.shop.findUnique({ where: { ownerId: req.user!.userId } });
    if (!shop) return res.status(404).json({ message: 'Chưa có gian hàng.' });

    if (body.data.action === 'suspend') {
      if (shop.status !== 'ACTIVE') return res.status(400).json({ message: 'Chỉ tạm ngưng gian hàng đang hoạt động.' });
      const updated = await prisma.shop.update({ where: { id: shop.id }, data: { status: 'SUSPENDED' } });
      return res.json({ shop: updated, message: 'Đã tạm ngưng gian hàng. Sản phẩm sẽ ẩn khỏi khách cho tới khi mở lại.' });
    }
    // reopen
    if (shop.status !== 'SUSPENDED') return res.status(400).json({ message: 'Gian hàng không ở trạng thái tạm ngưng.' });
    const updated = await prisma.shop.update({ where: { id: shop.id }, data: { status: 'ACTIVE' } });
    res.json({ shop: updated, message: 'Đã mở lại gian hàng.' });
  } catch (err) { next(err); }
}

const lockSchema = z.object({ mode: z.enum(['temporary', 'permanent']) });

// PATCH /api/seller/account/lock - tự khóa tài khoản (tạm thời/vĩnh viễn).
// temporary -> LOCKED (Admin có thể mở lại); permanent -> DISABLED (đóng tài khoản).
// Sau thao tác này tài khoản bị khóa, phiên hiện tại nên đăng xuất.
export async function lockMyAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const body = lockSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const status = body.data.mode === 'permanent' ? 'DISABLED' : 'LOCKED';
    await prisma.user.update({ where: { id: req.user!.userId }, data: { status } });
    res.json({
      ok: true, status,
      message: status === 'DISABLED'
        ? 'Tài khoản đã được đóng vĩnh viễn. Liên hệ quản trị viên nếu cần khôi phục.'
        : 'Tài khoản đã bị khóa tạm thời. Liên hệ quản trị viên để mở lại.',
    });
  } catch (err) { next(err); }
}

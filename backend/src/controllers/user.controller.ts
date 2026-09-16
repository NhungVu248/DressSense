import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isDev } from '../config/env';
import { identifierSchema, parseIdentifier, maskTarget } from '../utils/validators';
import { createAndSendOtp, verifyOtp } from '../services/otp.service';

// Trả hồ sơ công khai (không lộ password) - UC1.4
function publicUser(u: any) {
  return {
    id: u.id, email: u.email, phone: u.phone, fullName: u.fullName,
    role: u.role, status: u.status, avatarUrl: u.avatarUrl, shopName: u.shopName,
    provider: u.provider, createdAt: u.createdAt,
  };
}

// ============================================================
//  UC1.4 - XEM HỒ SƠ
// ============================================================

// GET /api/users/me
export async function getMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        profile: true, // CustomerProfile (style, budget...) nếu có
        addresses: { orderBy: { isDefault: 'desc' } },
      },
    });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    // 4a: đánh dấu các trường còn trống để gợi ý bổ sung
    const missingFields = [
      !user.email && 'email',
      !user.phone && 'phone',
      !user.avatarUrl && 'avatarUrl',
    ].filter(Boolean);

    res.json({
      user: publicUser(user),
      addresses: user.addresses,
      customerProfile: user.profile,
      missingFields,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
//  UC1.5 - CẬP NHẬT HỒ SƠ
// ============================================================

const updateSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập họ tên').optional(),
  phone: z.string().optional(), // đổi trực tiếp CHỈ khi chưa có SĐT (lần đầu khai báo)
});

// PATCH /api/users/me - cập nhật các trường không nhạy cảm
export async function updateMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSchema.parse(req.body);
    const current = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!current) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const patch: Record<string, unknown> = {};
    if (data.fullName !== undefined) patch.fullName = data.fullName;

    // Khai báo SĐT lần đầu (chưa có) không cần OTP; đổi SĐT đã có -> dùng luồng OTP riêng (3b)
    if (data.phone !== undefined && !current.phone) {
      const { phone } = parseIdentifier(data.phone);
      const dup = await prisma.user.findFirst({ where: { phone, NOT: { id: current.id } } });
      if (dup) return res.status(409).json({ message: 'Số điện thoại đã được sử dụng bởi tài khoản khác' });
      patch.phone = phone;
    }

    const user = await prisma.user.update({ where: { id: current.id }, data: patch });
    res.json({ message: 'Cập nhật hồ sơ thành công', user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/me/avatar - luồng thay thế 3a: tải ảnh đại diện mới
export async function updateAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn ảnh (JPG/PNG/WEBP, tối đa 3MB)' });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatarUrl },
    });
    res.json({ message: 'Cập nhật ảnh đại diện thành công', user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// ---- 3b: Đổi email/SĐT đã có -> xác thực OTP tới địa chỉ MỚI trước khi áp dụng ----

const changeContactRequestSchema = z.object({ newIdentifier: identifierSchema });

// POST /api/users/me/contact/request
export async function requestChangeContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { newIdentifier } = changeContactRequestSchema.parse(req.body);
    const { email, phone } = parseIdentifier(newIdentifier);
    const target = email ?? phone!;

    // 3F: giá trị mới đã được dùng bởi tài khoản khác
    const dup = await prisma.user.findFirst({
      where: {
        OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any,
        NOT: { id: req.user!.userId },
      },
    });
    if (dup) return res.status(409).json({ message: 'Email/số điện thoại đã được sử dụng bởi tài khoản khác' });

    const { expiresAt, devOtp } = await createAndSendOtp({
      target,
      purpose: 'CHANGE_CONTACT',
      payload: { userId: req.user!.userId, email: email ?? null, phone: phone ?? null },
    });
    res.json({ message: 'Mã xác thực đã gửi tới địa chỉ mới', target: maskTarget(target), expiresAt, ...(isDev ? { devOtp } : {}) });
  } catch (err) {
    next(err);
  }
}

const changeContactVerifySchema = z.object({
  newIdentifier: z.string().min(1),
  code: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
});

// POST /api/users/me/contact/verify
export async function verifyChangeContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { newIdentifier, code } = changeContactVerifySchema.parse(req.body);
    const { email, phone } = parseIdentifier(newIdentifier);
    const target = email ?? phone!;

    const result = await verifyOtp({ target, purpose: 'CHANGE_CONTACT', code });
    if (!result.ok) {
      const msg =
        result.error === 'EXPIRED' ? 'Mã xác thực đã hết hạn. Vui lòng gửi lại mã.' :
        result.error === 'TOO_MANY' ? 'Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã.' :
        result.error === 'NOT_FOUND' ? 'Không tìm thấy mã xác thực. Vui lòng gửi lại mã.' :
        'Mã xác thực không đúng.';
      return res.status(400).json({ message: msg, code: result.error });
    }

    const p = result.payload as { userId: number; email: string | null; phone: string | null };
    if (p.userId !== req.user!.userId) {
      return res.status(403).json({ message: 'Phiên xác thực không hợp lệ' });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { email: p.email ?? undefined, phone: p.phone ?? undefined },
    });
    res.json({ message: 'Cập nhật email/số điện thoại thành công', user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

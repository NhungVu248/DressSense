import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { signToken } from '../utils/jwt';
import { env, isDev, AUTH_RULES } from '../config/env';
import {
  passwordSchema,
  identifierSchema,
  parseIdentifier,
  maskTarget,
} from '../utils/validators';
import { createAndSendOtp, verifyOtp, getPendingPayload } from '../services/otp.service';
import { OAuth2Client } from 'google-auth-library';

// Bỏ trường nhạy cảm khi trả user về client
function publicUser(u: {
  id: number; email: string | null; phone: string | null; fullName: string;
  role: string; status: string; avatarUrl: string | null; shopName: string | null;
}) {
  return {
    id: u.id, email: u.email, phone: u.phone, fullName: u.fullName,
    role: u.role, status: u.status, avatarUrl: u.avatarUrl, shopName: u.shopName,
  };
}

// ============================================================
//  UC1.1 - ĐĂNG KÝ (2 cổng: Khách hàng & Người bán)
// ============================================================

const registerSchema = z
  .object({
    portal: z.enum(['customer', 'seller']),
    fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
    identifier: identifierSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    shopName: z.string().optional(),
    contactPhone: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })
  .refine((d) => d.portal !== 'seller' || (d.shopName && d.shopName.trim().length > 0), {
    message: 'Vui lòng nhập tên gian hàng',
    path: ['shopName'],
  });

// Bước 1: kiểm tra dữ liệu, gửi OTP (chưa tạo tài khoản)
export async function registerRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const { email, phone } = parseIdentifier(data.identifier);
    const target = email ?? phone!;

    // 5E: email/SĐT đã tồn tại
    const existing = await prisma.user.findFirst({
      where: { OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any },
    });
    if (existing) {
      return res.status(409).json({
        message: 'Tài khoản đã tồn tại. Vui lòng đăng nhập hoặc khôi phục mật khẩu.',
      });
    }

    // Mã hóa mật khẩu (bcrypt) rồi lưu tạm trong payload OTP
    const passwordHash = await bcrypt.hash(data.password, 10);
    const payload: Prisma.InputJsonValue = {
      fullName: data.fullName,
      email: email ?? null,
      phone: phone ?? null,
      passwordHash,
      role: data.portal === 'seller' ? 'SELLER' : 'CUSTOMER',
      status: data.portal === 'seller' ? 'PENDING_APPROVAL' : 'ACTIVE',
      shopName: data.portal === 'seller' ? data.shopName ?? null : null,
    };

    const { expiresAt, devOtp } = await createAndSendOtp({ target, purpose: 'REGISTER', payload });
    res.status(200).json({
      message: 'Mã xác thực đã được gửi',
      target: maskTarget(target),
      identifier: target,
      expiresAt,
      ...(isDev ? { devOtp } : {}),
    });
  } catch (err) {
    next(err);
  }
}

const verifyRegisterSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
});

// Bước 2: xác thực OTP -> tạo tài khoản
export async function registerVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, code } = verifyRegisterSchema.parse(req.body);
    const { email, phone } = parseIdentifier(identifier);
    const target = email ?? phone!;

    const result = await verifyOtp({ target, purpose: 'REGISTER', code });
    if (!result.ok) return res.status(400).json({ message: otpErrorMessage(result.error), code: result.error });

    const p = result.payload as {
      fullName: string; email: string | null; phone: string | null;
      passwordHash: string; role: 'CUSTOMER' | 'SELLER'; status: string; shopName: string | null;
    };

    const user = await prisma.user.create({
      data: {
        fullName: p.fullName,
        email: p.email,
        phone: p.phone,
        password: p.passwordHash,
        role: p.role,
        status: p.status as any,
        shopName: p.shopName,
      },
    });

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({
      token,
      user: publicUser(user),
      redirect: redirectByRole(user.role, user.status),
    });
  } catch (err) {
    next(err);
  }
}

// Gửi lại mã OTP (dùng cho đăng ký & khôi phục MK)
const resendSchema = z.object({
  identifier: z.string().min(1),
  purpose: z.enum(['REGISTER', 'RESET_PASSWORD']),
});
export async function resendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, purpose } = resendSchema.parse(req.body);
    const { email, phone } = parseIdentifier(identifier);
    const target = email ?? phone!;

    // Với REGISTER cần giữ lại payload đăng ký tạm
    const payload = purpose === 'REGISTER' ? await getPendingPayload(target, 'REGISTER') : null;
    if (purpose === 'REGISTER' && !payload) {
      return res.status(400).json({ message: 'Không có yêu cầu đăng ký đang chờ. Vui lòng đăng ký lại.' });
    }

    const { expiresAt, devOtp } = await createAndSendOtp({
      target,
      purpose,
      payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
    });
    res.json({ message: 'Đã gửi lại mã', target: maskTarget(target), expiresAt, ...(isDev ? { devOtp } : {}) });
  } catch (err) {
    next(err);
  }
}

// ============================================================
//  UC1.2 - ĐĂNG NHẬP
// ============================================================

const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  rememberMe: z.boolean().optional(),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, password, rememberMe } = loginSchema.parse(req.body);
    const { email, phone } = parseIdentifier(identifier);

    const user = await prisma.user.findFirst({
      where: { OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any },
    });

    // 5E: không tiết lộ email hay mật khẩu sai
    const GENERIC = 'Thông tin đăng nhập không chính xác';
    if (!user || !user.password) {
      return res.status(401).json({ message: GENERIC });
    }

    // 5F: tài khoản bị khóa/vô hiệu hóa
    if (user.status === 'DISABLED') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.' });
    }
    if (user.status === 'LOCKED' || (user.lockedUntil && user.lockedUntil > new Date())) {
      return res.status(423).json({
        message: 'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.',
        lockedUntil: user.lockedUntil,
      });
    }

    // 6E: so khớp mật khẩu (bcrypt)
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const attempts = user.failedLoginAttempts + 1;
      const willLock = attempts >= AUTH_RULES.LOGIN_MAX_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: willLock ? 0 : attempts,
          lockedUntil: willLock ? new Date(Date.now() + AUTH_RULES.LOCK_MINUTES * 60_000) : undefined,
          status: willLock ? undefined : undefined,
        },
      });
      if (willLock) {
        return res.status(423).json({
          message: `Đăng nhập sai quá ${AUTH_RULES.LOGIN_MAX_ATTEMPTS} lần. Tài khoản tạm khóa ${AUTH_RULES.LOCK_MINUTES} phút.`,
        });
      }
      return res.status(401).json({ message: GENERIC });
    }

    // Thành công: reset bộ đếm, cấp JWT (ghi nhớ đăng nhập -> hạn dài hơn)
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const token = signToken(
      { userId: user.id, role: user.role },
      rememberMe ? env.jwtRememberExpiresIn : env.jwtExpiresIn,
    );

    res.json({
      token,
      user: publicUser(user),
      redirect: redirectByRole(user.role, user.status),
      // 8a: Người bán chờ kiểm duyệt -> chỉ vào khu hoàn thiện hồ sơ
      pendingApproval: user.role === 'SELLER' && user.status === 'PENDING_APPROVAL',
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// ============================================================
//  UC1.3 - KHÔI PHỤC MẬT KHẨU
// ============================================================

const forgotSchema = z.object({ identifier: identifierSchema });

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier } = forgotSchema.parse(req.body);
    const { email, phone } = parseIdentifier(identifier);
    const target = email ?? phone!;

    const user = await prisma.user.findFirst({
      where: { OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any },
    });

    // 4E: phản hồi trung lập, không tiết lộ tài khoản tồn tại hay không
    const NEUTRAL = { message: 'Nếu tài khoản tồn tại, mã xác thực đã được gửi.', target: maskTarget(target) };

    if (!user || user.status === 'DISABLED') {
      return res.json(NEUTRAL);
    }

    const { expiresAt, devOtp } = await createAndSendOtp({ target, purpose: 'RESET_PASSWORD' });
    res.json({ ...NEUTRAL, expiresAt, ...(isDev ? { devOtp } : {}) });
  } catch (err) {
    next(err);
  }
}

const resetSchema = z
  .object({
    identifier: z.string().min(1),
    code: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, code, newPassword } = resetSchema.parse(req.body);
    const { email, phone } = parseIdentifier(identifier);
    const target = email ?? phone!;

    const result = await verifyOtp({ target, purpose: 'RESET_PASSWORD', code });
    if (!result.ok) return res.status(400).json({ message: otpErrorMessage(result.error), code: result.error });

    const user = await prisma.user.findFirst({
      where: { OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any },
    });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      // 12a: reset bộ đếm khóa; mật khẩu mới đã mã hóa
      data: { password: passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    res.json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' });
  } catch (err) {
    next(err);
  }
}

// ---------- Helpers ----------
function redirectByRole(role: string, status: string): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'SELLER') return status === 'PENDING_APPROVAL' ? '/seller/pending' : '/seller';
  return '/';
}

function otpErrorMessage(e: string): string {
  switch (e) {
    case 'EXPIRED': return 'Mã xác thực đã hết hạn. Vui lòng gửi lại mã.';
    case 'TOO_MANY': return 'Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã.';
    case 'NOT_FOUND': return 'Không tìm thấy mã xác thực. Vui lòng gửi lại mã.';
    default: return 'Mã xác thực không đúng.';
  }
}


// ============================================================
//  UC1.1 / UC1.2 - luồng 3a: ĐĂNG NHẬP / ĐĂNG KÝ QUA GOOGLE (OAuth)
// ============================================================
const googleClient = new OAuth2Client(env.googleClientId);

export async function googleAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!env.googleClientId) {
      return res.status(500).json({ message: 'Máy chủ chưa cấu hình Google Client ID' });
    }
    const { credential } = z.object({ credential: z.string().min(1) }).parse(req.body);

    // Xác minh ID token với Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
    const p = ticket.getPayload();
    if (!p?.email || !p.email_verified) {
      return res.status(400).json({ message: 'Tài khoản Google không hợp lệ hoặc email chưa xác thực' });
    }

    const email = p.email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { email } });
    let isNewUser = false;

    if (!user) {
      // Chưa có tài khoản -> tạo mới (vai trò Khách hàng, kích hoạt ngay)
      user = await prisma.user.create({
        data: {
          email,
          fullName: p.name || email.split('@')[0],
          avatarUrl: p.picture || null,
          provider: 'GOOGLE',
          status: 'ACTIVE',
          role: 'CUSTOMER',
        },
      });
      isNewUser = true;
    } else {
      if (user.status === 'DISABLED') {
        return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.' });
      }
      if (user.status === 'LOCKED') {
        return res.status(423).json({ message: 'Tài khoản đang tạm khóa. Vui lòng thử lại sau.' });
      }
      // Bổ sung ảnh đại diện nếu tài khoản chưa có
      if (!user.avatarUrl && p.picture) {
        user = await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: p.picture } });
      }
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({
      token,
      user: publicUser(user),
      redirect: redirectByRole(user.role, user.status),
      isNewUser,
    });
  } catch (err) {
    next(err);
  }
}

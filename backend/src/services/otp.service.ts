import type { OtpPurpose, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateOtp, hashOtp, verifyOtpHash } from '../utils/otp';
import { AUTH_RULES, isDev } from '../config/env';

export type OtpError =
  | 'NOT_FOUND'      // không có OTP đang chờ
  | 'EXPIRED'        // hết hạn
  | 'TOO_MANY'       // vượt số lần nhập sai
  | 'INVALID';       // mã sai

/**
 * Tạo và "gửi" OTP. Ở môi trường phát triển: in ra console và trả devOtp
 * để tiện kiểm thử (KHÔNG bật ở production). Thực tế sẽ nối SMTP/SMS tại đây.
 */
export async function createAndSendOtp(params: {
  target: string;
  purpose: OtpPurpose;
  payload?: Prisma.InputJsonValue;
}): Promise<{ expiresAt: Date; devOtp?: string }> {
  const { target, purpose, payload } = params;

  // Vô hiệu hóa các OTP cũ cùng mục đích chưa dùng
  await prisma.otpCode.updateMany({
    where: { target, purpose, consumed: false },
    data: { consumed: true },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + AUTH_RULES.OTP_TTL_MINUTES * 60_000);

  await prisma.otpCode.create({
    data: {
      target,
      purpose,
      codeHash: hashOtp(code),
      payload: payload ?? undefined,
      expiresAt,
    },
  });

  // TODO: tích hợp dịch vụ gửi email/SMS thật ở đây
  console.log(`[OTP] purpose=${purpose} target=${target} code=${code} (hết hạn ${AUTH_RULES.OTP_TTL_MINUTES} phút)`);

  return { expiresAt, devOtp: isDev ? code : undefined };
}

/**
 * Xác thực OTP. Trả về payload đã lưu (nếu có) khi thành công.
 * Đánh dấu consumed=true khi đúng; tăng attempts khi sai.
 */
export async function verifyOtp(params: {
  target: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ ok: true; payload: any } | { ok: false; error: OtpError }> {
  const { target, purpose, code } = params;

  const otp = await prisma.otpCode.findFirst({
    where: { target, purpose, consumed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return { ok: false, error: 'NOT_FOUND' };
  if (otp.expiresAt < new Date()) return { ok: false, error: 'EXPIRED' };
  if (otp.attempts >= AUTH_RULES.OTP_MAX_ATTEMPTS) return { ok: false, error: 'TOO_MANY' };

  if (!verifyOtpHash(code, otp.codeHash)) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: 'INVALID' };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumed: true },
  });
  return { ok: true, payload: otp.payload };
}

/** Lấy payload của OTP đang chờ (phục vụ "Gửi lại mã" khi đăng ký). */
export async function getPendingPayload(target: string, purpose: OtpPurpose) {
  const otp = await prisma.otpCode.findFirst({
    where: { target, purpose, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  return otp?.payload ?? null;
}

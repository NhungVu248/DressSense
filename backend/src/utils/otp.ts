import crypto from 'crypto';
import { env } from '../config/env';

// Sinh mã OTP 6 chữ số
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// Băm OTP bằng HMAC-SHA256 (không lưu mã dạng thuần)
export function hashOtp(code: string): string {
  return crypto.createHmac('sha256', env.jwtSecret).update(code).digest('hex');
}

// So khớp an toàn theo thời gian
export function verifyOtpHash(code: string, hash: string): boolean {
  const a = Buffer.from(hashOtp(code));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

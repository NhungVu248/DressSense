import { z } from 'zod';
import { AUTH_RULES } from '../config/env';

// Nhận diện email hay số điện thoại Việt Nam
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(0|\+84)(\d{9})$/; // 0xxxxxxxxx hoặc +84xxxxxxxxx

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}
export function isPhone(v: string): boolean {
  return PHONE_RE.test(v.replace(/\s/g, ''));
}

// Chuẩn hóa SĐT về dạng 0xxxxxxxxx
export function normalizePhone(v: string): string {
  const s = v.replace(/\s/g, '');
  return s.startsWith('+84') ? '0' + s.slice(3) : s;
}

// Tách định danh thành { email } hoặc { phone }
export function parseIdentifier(v: string): { email?: string; phone?: string } {
  const s = v.trim();
  if (isEmail(s)) return { email: s.toLowerCase() };
  if (isPhone(s)) return { phone: normalizePhone(s) };
  throw new Error('INVALID_IDENTIFIER');
}

// Che bớt định danh khi phản hồi (b***@mail.com / 09****1234)
export function maskTarget(v: string): string {
  if (isEmail(v)) {
    const [name, domain] = v.split('@');
    const head = name.slice(0, 1);
    return `${head}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`;
  }
  return v.slice(0, 2) + '****' + v.slice(-3);
}

// Mật khẩu: tối thiểu 8 ký tự, gồm chữ và số
export const passwordSchema = z
  .string()
  .min(AUTH_RULES.PASSWORD_MIN_LENGTH, `Mật khẩu tối thiểu ${AUTH_RULES.PASSWORD_MIN_LENGTH} ký tự`)
  .regex(/[A-Za-z]/, 'Mật khẩu phải có chữ')
  .regex(/[0-9]/, 'Mật khẩu phải có số');

export const identifierSchema = z
  .string()
  .min(1, 'Vui lòng nhập email hoặc số điện thoại')
  .refine((v) => isEmail(v) || isPhone(v), 'Email hoặc số điện thoại không hợp lệ');

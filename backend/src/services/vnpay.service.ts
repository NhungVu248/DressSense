import crypto from 'crypto';
import { env } from '../config/env';

// ============================================================
//  UC9.2 - Tích hợp VNPAY sandbox (thật).
//  - Ký HMAC-SHA512 theo chuẩn VNPAY (sắp xếp tham số, encode, nối chuỗi).
//  - Visa/thẻ quốc tế đi qua VNPAY với vnp_BankCode = INTCARD.
//  Tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
// ============================================================

// Sắp xếp tham số theo key và encode giá trị đúng cách VNPAY yêu cầu (space -> '+')
function sortAndEncode(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[encodeURIComponent(key)] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
  }
  return sorted;
}

function toQuery(obj: Record<string, string>): string {
  return Object.keys(obj).map((k) => `${k}=${obj[k]}`).join('&');
}

function hmac512(data: string): string {
  return crypto.createHmac('sha512', env.vnp.hashSecret).update(Buffer.from(data, 'utf-8')).digest('hex');
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export interface BuildUrlInput {
  txnRef: string;      // mã giao dịch (duy nhất)
  amount: number;      // số tiền (VND, chưa nhân 100)
  orderInfo: string;   // mô tả đơn
  ipAddr: string;      // IP khách
  intcard?: boolean;   // true -> ép thẻ quốc tế (Visa)
}

// Tạo URL thanh toán VNPAY (đã ký). Khách được chuyển hướng tới URL này.
export function buildPaymentUrl(input: BuildUrlInput): string {
  const now = new Date();
  const expire = new Date(now.getTime() + 15 * 60 * 1000); // hết hạn sau 15 phút (5E.2)

  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: env.vnp.tmnCode,
    vnp_Amount: String(input.amount * 100), // VNPAY nhận số tiền x100
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: env.vnp.returnUrl,
    vnp_IpAddr: input.ipAddr || '127.0.0.1',
    vnp_CreateDate: formatDate(now),
    vnp_ExpireDate: formatDate(expire),
  };
  if (input.intcard) params.vnp_BankCode = 'INTCARD'; // Visa/thẻ quốc tế

  const sorted = sortAndEncode(params);
  const signData = toQuery(sorted);
  const secureHash = hmac512(signData);
  return `${env.vnp.url}?${signData}&vnp_SecureHash=${secureHash}`;
}

export interface VerifyResult {
  valid: boolean;      // chữ ký hợp lệ
  success: boolean;    // ResponseCode == '00'
  txnRef: string;
  amount: number;      // VND (đã chia 100)
  responseCode: string;
  transactionNo?: string;
  bankCode?: string;
  cardType?: string;
}

// Xác minh dữ liệu VNPAY trả về (return URL / IPN): kiểm tra chữ ký trên toàn bộ tham số.
export function verifyReturn(query: Record<string, string>): VerifyResult {
  const received = query.vnp_SecureHash || '';
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
    data[k] = v;
  }
  const sorted = sortAndEncode(data);
  const signData = toQuery(sorted);
  const expected = hmac512(signData);
  const valid = expected.toLowerCase() === received.toLowerCase();
  const responseCode = query.vnp_ResponseCode || '';
  return {
    valid,
    success: valid && responseCode === '00' && query.vnp_TransactionStatus === '00',
    txnRef: query.vnp_TxnRef || '',
    amount: Number(query.vnp_Amount || 0) / 100,
    responseCode,
    transactionNo: query.vnp_TransactionNo,
    bankCode: query.vnp_BankCode,
    cardType: query.vnp_CardType,
  };
}

// Backlog B.27/C.45 - Đơn mua gói voucher
import api from './api';

export type VoucherPackage = 'SINGLE' | 'COMBO_MONTH';
export const PACKAGE_LABEL: Record<VoucherPackage, string> = {
  SINGLE: 'Mua lẻ (1 voucher)',
  COMBO_MONTH: 'Combo tháng',
};

export const VO_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
};

export interface VoucherOrder {
  id: number;
  code: string;
  sellerId: number;
  shopName?: string;
  packageType: VoucherPackage;
  packageLabel?: string;
  fee: number;
  desiredCode: string;
  description: string | null;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  perUserLimit: number | null;
  paymentMethod: 'VNPAY' | 'VISA';
  paymentStatus: 'UNPAID' | 'PAID';
  status: string;
  reviewReason: string | null;
  voucherId: number | null;
  createdAt: string;
}

export interface CreateVoucherOrderInput {
  packageType: VoucherPackage;
  desiredCode: string;
  description?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  minOrder: number;
  maxDiscount?: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  paymentMethod: 'VNPAY' | 'VISA';
}

// ---- Người bán ----
export const listMyVoucherOrders = () => api.get<{ orders: VoucherOrder[] }>('/seller/voucher-orders').then((r) => r.data.orders);
export const createVoucherOrder = (data: CreateVoucherOrderInput) => api.post<{ order: VoucherOrder }>('/seller/voucher-orders', data).then((r) => r.data.order);
export const payVoucherOrder = (id: number) => api.post<{ payUrl: string }>(`/seller/voucher-orders/${id}/pay`).then((r) => r.data.payUrl);
export const markVoucherOrderPaid = (id: number) => api.post(`/seller/voucher-orders/${id}/mark-paid`).then((r) => r.data);
export const cancelVoucherOrder = (id: number) => api.delete(`/seller/voucher-orders/${id}`).then((r) => r.data);

// ---- Admin ----
export const listAdminVoucherOrders = (status?: string) =>
  api.get<{ orders: VoucherOrder[] }>('/admin/voucher-orders', { params: status ? { status } : {} }).then((r) => r.data.orders);
export const approveVoucherOrder = (id: number) => api.post(`/admin/voucher-orders/${id}/approve`).then((r) => r.data);
export const rejectVoucherOrder = (id: number, reason: string) => api.post(`/admin/voucher-orders/${id}/reject`, { reason }).then((r) => r.data);

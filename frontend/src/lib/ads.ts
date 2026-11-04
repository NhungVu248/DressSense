// Backlog B.26/C.41 - Đơn đăng ký chạy banner quảng cáo
import api from './api';

export type AdPosition = 'HOME_HERO' | 'HOME_STRIP' | 'PROMO_PAGE';
export const AD_POSITION_LABEL: Record<AdPosition, string> = {
  HOME_HERO: 'Banner lớn trang chủ',
  HOME_STRIP: 'Dải banner trang chủ',
  PROMO_PAGE: 'Trang khuyến mãi',
};

export type AdStatus = 'PENDING_PAYMENT' | 'PENDING_REVIEW' | 'APPROVED' | 'RUNNING' | 'REJECTED' | 'ENDED' | 'CANCELLED';
export const AD_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  RUNNING: 'Đang chạy',
  REJECTED: 'Bị từ chối',
  ENDED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
};

export interface BannerOrder {
  id: number;
  code: string;
  sellerId: number;
  shopName?: string;
  name: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  position: AdPosition;
  linkType: 'NONE' | 'PRODUCT' | 'CATEGORY' | 'PROMO' | 'URL';
  linkValue: string | null;
  startsAt: string;
  endsAt: string;
  weeks: number;
  amount: number;
  paymentMethod: 'VNPAY' | 'VISA';
  paymentStatus: 'UNPAID' | 'PAID';
  status: AdStatus;
  reviewReason: string | null;
  bannerId: number | null;
  createdAt: string;
}

export interface CreateBannerOrderInput {
  name: string;
  imageUrl: string;
  title?: string | null;
  subtitle?: string | null;
  position: AdPosition;
  linkType?: 'NONE' | 'PRODUCT' | 'CATEGORY' | 'PROMO' | 'URL';
  linkValue?: string | null;
  startsAt: string;
  endsAt: string;
  paymentMethod: 'VNPAY' | 'VISA';
  // Thông tin xuất hóa đơn VAT (tuỳ chọn)
  buyerName?: string | null;
  buyerTaxCode?: string | null;
  buyerAddress?: string | null;
  buyerEmail?: string | null;
}

// ---- Người bán ----
export const listMyAdOrders = () => api.get<{ orders: BannerOrder[] }>('/seller/ad-orders').then((r) => r.data.orders);
export const createAdOrder = (data: CreateBannerOrderInput) => api.post<{ order: BannerOrder }>('/seller/ad-orders', data).then((r) => r.data.order);
export const payAdOrder = (id: number) => api.post<{ payUrl: string }>(`/seller/ad-orders/${id}/pay`).then((r) => r.data.payUrl);
export const markAdOrderPaid = (id: number) => api.post(`/seller/ad-orders/${id}/mark-paid`).then((r) => r.data);
export const cancelAdOrder = (id: number) => api.delete(`/seller/ad-orders/${id}`).then((r) => r.data);
// Xuất hóa đơn VAT (HTML) -> mở tab mới để in/lưu PDF
export async function openAdInvoice(id: number) {
  const res = await api.get(`/seller/ad-orders/${id}/invoice`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- Admin ----
export const listAdminAdOrders = (status?: string) =>
  api.get<{ orders: BannerOrder[] }>('/admin/ad-orders', { params: status ? { status } : {} }).then((r) => r.data.orders);
export interface TimelineItem { id: number; code: string; name: string; position: AdPosition; startsAt: string; endsAt: string; shopName: string; status: string }
export const getAdTimeline = (position?: string) =>
  api.get<{ items: TimelineItem[] }>('/admin/ad-orders/timeline', { params: position ? { position } : {} }).then((r) => r.data.items);
export const approveAdOrder = (id: number) => api.post(`/admin/ad-orders/${id}/approve`).then((r) => r.data);
export const rejectAdOrder = (id: number, reason: string) => api.post(`/admin/ad-orders/${id}/reject`, { reason }).then((r) => r.data);

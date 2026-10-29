// UC14 - Gian hàng (Seller Portal): hồ sơ gian hàng, kiểm duyệt, báo cáo doanh thu
import api from './api';

export type ShopStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export const SHOP_STATUS_LABEL: Record<ShopStatus, string> = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  ACTIVE: 'Đang hoạt động',
  REJECTED: 'Bị từ chối',
  SUSPENDED: 'Tạm ngưng',
};

export const SHOP_STATUS_CLS: Record<ShopStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  SUSPENDED: 'bg-orange-100 text-orange-700',
};

export interface Shop {
  id: number;
  ownerId: number;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  pickupName: string | null;
  pickupPhone: string | null;
  pickupProvince: string | null;
  pickupDistrict: string | null;
  pickupWard: string | null;
  pickupDetail: string | null;
  returnSameAsPickup: boolean;
  returnName: string | null;
  returnPhone: string | null;
  returnProvince: string | null;
  returnDistrict: string | null;
  returnWard: string | null;
  returnDetail: string | null;
  status: ShopStatus;
  rejectReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: number; fullName: string; email: string | null };
}

// ---- Người bán (UC14.1) ----
export async function getMyShop() {
  return (await api.get<{ shop: Shop }>('/seller/shop')).data.shop;
}
export async function updateMyShop(data: Partial<Shop>) {
  return (await api.put<{ shop: Shop }>('/seller/shop', data)).data.shop;
}
export async function submitMyShop() {
  return (await api.post<{ shop: Shop; message: string }>('/seller/shop/submit')).data;
}

// ---- Quản trị viên kiểm duyệt (UC16.3) ----
export async function listShopsAdmin(status?: string) {
  return (await api.get<{ shops: Shop[]; counts: Record<string, number> }>('/admin/shops', {
    params: status ? { status } : {},
  })).data;
}
export async function approveShop(id: number) {
  return (await api.patch<{ shop: Shop }>(`/admin/shops/${id}/approve`)).data.shop;
}
export async function rejectShop(id: number, reason: string) {
  return (await api.patch<{ shop: Shop }>(`/admin/shops/${id}/reject`, { reason })).data.shop;
}
export async function setShopSuspension(id: number, suspend: boolean) {
  return (await api.patch<{ shop: Shop }>(`/admin/shops/${id}/suspension`, { suspend })).data.shop;
}

// ---- UC14.4 Báo cáo doanh thu ----
export interface ReportMetrics {
  revenue: number;
  orderCount: number;
  soldQuantity: number;
  avgOrderValue: number;
  completedCount: number;
  cancelledCount: number;
  refundAmount: number;
  netRevenue: number;
}
export interface ReportResponse {
  range: { from: string; to: string; preset: string };
  metrics: ReportMetrics;
  timeSeries: { date: string; revenue: number }[];
  bestSellers: { productId: number; name: string; quantity: number; revenue: number }[];
}
export async function getSellerReport(params: { preset?: string; from?: string; to?: string }) {
  return (await api.get<ReportResponse>('/seller/report', { params })).data;
}

// UC16 - Quản trị hệ thống (Dashboard, Cấu hình, Kiểm duyệt nội dung)
import api from './api';

// ---- UC16.1 Dashboard ----
export interface AdminDashboard {
  range: { from: string; to: string; preset: string };
  kpis: { customers: number; sellers: number; activeShops: number; activeProducts: number; totalOrders: number; revenue: number; cancelledOrders: number; refundAmount: number };
  todo: { pendingShops: number; pendingProducts: number; escalatedComplaints: number; hiddenReviews: number };
  revenueSeries: { date: string; revenue: number }[];
  newUserSeries: { date: string; count: number }[];
  bestSellers: { productId: number; name: string; quantity: number; revenue: number }[];
}
export const getAdminDashboard = (params: { preset?: string; from?: string; to?: string }) =>
  api.get<AdminDashboard>('/admin/dashboard', { params }).then((r) => r.data);

// ---- UC16.5 Cấu hình hệ thống ----
export interface Setting { key: string; value: string; type: string; label: string; description: string | null; group: string; updatedAt: string }
export interface SettingLog { id: number; key: string; valueBefore: string | null; valueAfter: string; actorId: number; createdAt: string }
export const listSettings = () => api.get<{ settings: Setting[] }>('/admin/settings').then((r) => r.data.settings);
export const updateSettings = (updates: { key: string; value: string }[]) =>
  api.put<{ updated: string[] }>('/admin/settings', { updates }).then((r) => r.data);
export const getSettingHistory = () => api.get<{ logs: SettingLog[] }>('/admin/settings/history').then((r) => r.data.logs);

// ---- UC16.4 Kiểm duyệt nội dung (sản phẩm) ----
export interface ModProduct {
  id: number; name: string; price: number; status: string;
  seller: { id: number; fullName: string }; category: { name: string } | null; images: { url: string }[];
}
export const listModProducts = (status?: string) =>
  api.get<{ products: ModProduct[]; counts: Record<string, number> }>('/admin/moderation/products', { params: status ? { status } : {} }).then((r) => r.data);
export const moderateProduct = (id: number, action: 'approve' | 'hide' | 'reject', reason?: string) =>
  api.patch(`/admin/moderation/products/${id}`, { action, reason }).then((r) => r.data);

// ---- Admin quên mật khẩu (admin khác cấp) ----
export interface AdminResetReq {
  id: number; userId: number; requestedAt: string;
  user: { id: number; fullName: string; email: string | null } | null;
}
export const listAdminPasswordResets = () =>
  api.get<{ resets: AdminResetReq[] }>('/admin/password-resets').then((r) => r.data.resets);
export const resolveAdminPasswordReset = (id: number) =>
  api.post<{ message: string; password?: string; email?: string }>(`/admin/password-resets/${id}/resolve`).then((r) => r.data);

import api from './api';

// ============================================================
//  Phần Admin bổ sung theo ERD: Đơn hàng (#6), Báo cáo vi phạm (3.19),
//  Kiểm duyệt (3.18), Nhật ký hoạt động (3.17), Thông báo toàn sàn (3.22).
// ============================================================

// ----- Đơn hàng toàn sàn -----
export async function getAllOrders(params: { status?: string; q?: string; payment?: string } = {}) {
  const { data } = await api.get('/admin/orders', { params });
  return data as { orders: any[]; counts: Record<string, number> };
}

// ----- Báo cáo vi phạm (user_reports) -----
export type UserReport = {
  id: number;
  reporterId: number;
  targetType: 'SHOP' | 'PRODUCT' | 'USER';
  targetId: number;
  reason: string;
  description: string | null;
  evidenceUrl: string | null;
  status: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: number; fullName: string; email: string | null } | null;
};

export const REPORT_TARGET_LABEL: Record<string, string> = { SHOP: 'Gian hàng', PRODUCT: 'Sản phẩm', USER: 'Người dùng' };
export const REPORT_STATUS_LABEL: Record<string, string> = { PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', RESOLVED: 'Đã giải quyết', REJECTED: 'Từ chối' };

export async function getReports(params: { status?: string; targetType?: string } = {}) {
  const { data } = await api.get('/admin/reports', { params });
  return data as { reports: UserReport[]; counts: Record<string, number> };
}

export async function resolveReport(id: number, body: { status: 'PROCESSING' | 'RESOLVED' | 'REJECTED'; resolutionNote?: string }) {
  const { data } = await api.patch(`/admin/reports/${id}`, body);
  return data.report as UserReport;
}

// ----- Kiểm duyệt (moderation_logs) & Nhật ký hoạt động (admin_action_logs) -----
export type AdminUser = { id: number; fullName: string; email: string | null } | null;

export type ModerationLog = {
  id: number; adminId: number; targetType: 'SHOP' | 'PRODUCT'; targetId: number;
  action: 'APPROVE' | 'REJECT' | 'HIDE' | 'RESTORE'; reason: string | null; createdAt: string; admin: AdminUser;
};
export const MOD_ACTION_LABEL: Record<string, string> = { APPROVE: 'Duyệt', REJECT: 'Từ chối', HIDE: 'Ẩn/Ngưng', RESTORE: 'Khôi phục' };

export type ActionLog = {
  id: number; adminId: number; action: string;
  targetType: 'USER' | 'SHOP' | 'PRODUCT' | 'ORDER' | 'SETTING' | 'REPORT';
  targetId: number | null; description: string | null; ipAddress: string | null; createdAt: string; admin: AdminUser;
};

export async function getModerationLogs(targetType?: string) {
  const { data } = await api.get('/admin/moderation-logs', { params: { targetType } });
  return data.logs as ModerationLog[];
}

export async function getActionLogs(targetType?: string) {
  const { data } = await api.get('/admin/action-logs', { params: { targetType } });
  return data.logs as ActionLog[];
}

// ----- Thông báo toàn sàn (platform_announcements) -----
export type Announcement = {
  id: number; adminId: number; title: string; content: string;
  targetAudience: 'ALL' | 'BUYER' | 'SELLER';
  startAt: string | null; endAt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'EXPIRED'; recipientCount: number; createdAt: string;
};
export const AUDIENCE_LABEL: Record<string, string> = { ALL: 'Tất cả', BUYER: 'Khách hàng', SELLER: 'Người bán' };
export const ANN_STATUS_LABEL: Record<string, string> = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã phát hành', EXPIRED: 'Hết hạn' };

export async function getAnnouncements() {
  const { data } = await api.get('/admin/announcements');
  return data.announcements as Announcement[];
}
export async function createAnnouncement(body: { title: string; content: string; targetAudience: string }) {
  const { data } = await api.post('/admin/announcements', body);
  return data.announcement as Announcement;
}
export async function publishAnnouncement(id: number) {
  const { data } = await api.post(`/admin/announcements/${id}/publish`, {});
  return data.announcement as Announcement;
}
export async function deleteAnnouncement(id: number) {
  await api.delete(`/admin/announcements/${id}`);
}

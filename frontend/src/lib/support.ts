// UC11 - Đổi/trả, khiếu nại, sự cố giao hàng, hoàn tiền
import api from './api';

export type ReturnType = 'EXCHANGE' | 'RETURN';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export type ComplaintStatus = 'PENDING' | 'SELLER_RESPONDED' | 'RESOLVED' | 'ESCALATED' | 'ADMIN_RESOLVED' | 'REJECTED';
export type IncidentType = 'LATE' | 'FAILED' | 'LOST';

export interface ReturnItemRow { id: number; orderItemId: number; quantity: number; orderItem?: { name: string | null; size: string | null; price: number } }
export interface ReturnRequest {
  id: number; code: string; orderId: number; type: ReturnType; reason: string; description: string | null;
  evidence: string | null; exchangeSize: string | null; status: RequestStatus; sellerNote: string | null;
  refundAmount: number | null; createdAt: string; resolvedAt: string | null;
  items: ReturnItemRow[]; order?: { code: string }; user?: { fullName: string };
}
export interface Complaint {
  id: number; code: string; orderId: number; type: string; content: string; evidence: string | null;
  status: ComplaintStatus; sellerProposal: string | null; adminDecision: string | null;
  createdAt: string; escalatedAt: string | null; resolvedAt: string | null;
  order?: { code: string; total?: number; paymentStatus?: string }; user?: { fullName: string };
}
export interface Incident {
  id: number; orderId: number; type: IncidentType; note: string | null; resolution: string | null;
  createdAt: string; resolvedAt: string | null; order?: { code: string; status: string; carrier: string | null; trackingNumber: string | null };
}

export const RETURN_TYPE_LABEL: Record<ReturnType, string> = { EXCHANGE: 'Đổi hàng', RETURN: 'Trả hàng & hoàn tiền' };
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: 'Chờ xử lý', APPROVED: 'Đã chấp thuận', REJECTED: 'Bị từ chối', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy',
};
export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  PENDING: 'Chờ người bán', SELLER_RESPONDED: 'Người bán đã đề xuất', RESOLVED: 'Đã giải quyết',
  ESCALATED: 'Chờ quản trị phân xử', ADMIN_RESOLVED: 'Quản trị đã xử lý', REJECTED: 'Bị từ chối',
};
export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = { LATE: 'Giao chậm', FAILED: 'Giao thất bại', LOST: 'Thất lạc' };

// ---- Khách ----
export async function createReturn(body: { orderId: number; type: ReturnType; items: { orderItemId: number; quantity: number }[]; reason: string; description?: string; evidence?: string; exchangeSize?: string }) {
  return (await api.post('/returns', body)).data;
}
export async function getReturns(): Promise<ReturnRequest[]> { return (await api.get('/returns')).data.requests; }
export async function createComplaint(body: { orderId: number; type: string; content: string; evidence?: string }) {
  return (await api.post('/complaints', body)).data;
}
export async function getComplaints(): Promise<Complaint[]> { return (await api.get('/complaints')).data.complaints; }
export async function respondComplaint(id: number, accept: boolean) { return (await api.patch(`/complaints/${id}/respond`, { accept })).data; }

// ---- Người bán ----
export async function getSellerReturns(): Promise<ReturnRequest[]> { return (await api.get('/seller/returns')).data.requests; }
export async function approveReturn(id: number, note?: string) { return (await api.patch(`/seller/returns/${id}/approve`, { note })).data; }
export async function rejectReturn(id: number, note: string) { return (await api.patch(`/seller/returns/${id}/reject`, { note })).data; }
export async function getSellerComplaints(): Promise<Complaint[]> { return (await api.get('/seller/complaints')).data.complaints; }
export async function sellerRespondComplaint(id: number, proposal: string) { return (await api.patch(`/seller/complaints/${id}/respond`, { proposal })).data; }
export async function getSellerIncidents(): Promise<Incident[]> { return (await api.get('/seller/incidents')).data.incidents; }
export async function createIncident(orderId: number, type: IncidentType, note?: string) { return (await api.post(`/seller/orders/${orderId}/incident`, { type, note })).data; }
export async function resolveIncident(id: number, resolution: string, newEta?: string) { return (await api.patch(`/seller/incidents/${id}/resolve`, { resolution, newEta })).data; }

// ---- Quản trị viên ----
export async function getAdminComplaints(status?: string): Promise<Complaint[]> { return (await api.get('/admin/complaints', { params: status ? { status } : {} })).data.complaints; }
export async function adminResolveComplaint(id: number, body: { decision: string; refundAmount?: number; reject?: boolean }) { return (await api.patch(`/admin/complaints/${id}/resolve`, body)).data; }

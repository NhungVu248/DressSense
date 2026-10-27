// UC12 - Đánh giá, hỏi đáp, thông báo
import api from './api';

export interface Review {
  id: number; rating: number; comment: string | null; images: string[];
  userName: string; sellerReply: string | null; sellerReplyAt: string | null; createdAt: string;
}
export interface ProductReviews { count: number; average: number; reviews: Review[] }
export interface PublicQuestion { id: number; question: string; answer: string | null; askedBy: string; answeredAt: string | null; createdAt: string }

export type NotificationType = 'ORDER' | 'PAYMENT' | 'RETURN' | 'COMPLAINT' | 'REVIEW' | 'QA' | 'PROMO' | 'SUGGEST';
export interface Notification { id: number; type: NotificationType; title: string; content: string; link: string | null; read: boolean; createdAt: string }

export const NOTIF_TYPE_LABEL: Record<NotificationType, string> = {
  ORDER: 'Đơn hàng', PAYMENT: 'Thanh toán', RETURN: 'Đổi/trả', COMPLAINT: 'Khiếu nại',
  REVIEW: 'Đánh giá', QA: 'Hỏi đáp', PROMO: 'Khuyến mãi', SUGGEST: 'Gợi ý',
};

// ---- Đánh giá (UC12.1) ----
export async function getProductReviews(productId: number | string): Promise<ProductReviews> {
  return (await api.get(`/reviews/product/${productId}`)).data;
}
export async function createReview(body: { orderId: number; productId: number; rating: number; comment?: string; images?: string[] }) {
  return (await api.post('/reviews', body)).data;
}
// UC12.1 - tải ảnh đánh giá, trả về danh sách URL
export async function uploadReviewImages(files: File[]): Promise<string[]> {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  return (await api.post('/reviews/upload', fd)).data.urls;
}

// ---- Hỏi đáp (UC12.3) ----
export async function getProductQuestions(productId: number | string): Promise<PublicQuestion[]> {
  return (await api.get(`/questions/product/${productId}`)).data.questions;
}
export async function createQuestion(productId: number, question: string) {
  return (await api.post('/questions', { productId, question })).data;
}

// ---- Thông báo (UC12.4) ----
export async function getNotifications(filter?: { type?: string; unread?: boolean }): Promise<{ items: Notification[]; unread: number }> {
  const params: Record<string, string> = {};
  if (filter?.type) params.type = filter.type;
  if (filter?.unread) params.unread = 'true';
  return (await api.get('/notifications', { params })).data;
}
export async function notificationCount(): Promise<number> { return (await api.get('/notifications/count')).data.count; }
export async function markNotificationRead(id: number) { return (await api.patch(`/notifications/${id}/read`)).data; }
export async function markAllNotificationsRead() { return (await api.patch('/notifications/read-all')).data; }

// ---- Người bán (UC12.2/12.3) ----
export interface SellerReview { id: number; rating: number; comment: string | null; sellerReply: string | null; createdAt: string; user?: { fullName: string }; product?: { name: string } }
export interface SellerQuestion { id: number; question: string; answer: string | null; createdAt: string; user?: { fullName: string }; product?: { name: string } }
export async function getSellerReviews(): Promise<SellerReview[]> { return (await api.get('/seller/reviews')).data.reviews; }
export async function replyReview(id: number, reply: string) { return (await api.patch(`/seller/reviews/${id}/reply`, { reply })).data; }
export async function getSellerQuestions(): Promise<SellerQuestion[]> { return (await api.get('/seller/questions')).data.questions; }
export async function answerQuestion(id: number, answer: string) { return (await api.patch(`/seller/questions/${id}/answer`, { answer })).data; }

// ---- Quản trị viên: kiểm duyệt đánh giá (UC12.1) ----
export interface AdminReview { id: number; rating: number; comment: string | null; status: 'VISIBLE' | 'HIDDEN'; images: string[] | null; createdAt: string; user?: { fullName: string }; product?: { name: string } }
export async function getAdminReviews(status?: string): Promise<AdminReview[]> { return (await api.get('/admin/reviews', { params: status ? { status } : {} })).data.reviews; }
export async function moderateReview(id: number, hide: boolean, note?: string) { return (await api.patch(`/admin/reviews/${id}/moderate`, { hide, note })).data; }

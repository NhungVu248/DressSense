// Tin nhắn / Chăm sóc khách hàng (CSKH)
import api from './api';

export interface ConversationItem {
  id: number; type: 'SELLER' | 'ADMIN'; counterpart: string; orderId: number | null;
  lastMessage: string | null; lastMessageAt: string; unread: number; starred: boolean;
}
export interface Msg { id: number; content: string; createdAt: string; mine: boolean }

export const openConversation = (p: { type: 'SELLER' | 'ADMIN'; sellerId?: number; orderId?: number }) =>
  api.post<{ conversationId: number }>('/messages/conversation', p).then((r) => r.data.conversationId);
export const listConversations = () =>
  api.get<{ conversations: ConversationItem[] }>('/messages/conversations').then((r) => r.data.conversations);
export const getConversation = (id: number) =>
  api.get<{ conversation: { id: number; type: string; counterpart: string; orderId: number | null }; messages: Msg[] }>(`/messages/conversations/${id}`).then((r) => r.data);
export const sendMessage = (id: number, content: string) =>
  api.post<Msg>(`/messages/conversations/${id}/messages`, { content }).then((r) => r.data);
export const toggleStar = (id: number) =>
  api.patch<{ starred: boolean }>(`/messages/conversations/${id}/star`).then((r) => r.data.starred);

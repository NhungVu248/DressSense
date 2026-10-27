import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  NOTIF_TYPE_LABEL, type Notification, type NotificationType,
} from '../lib/interact';

const FILTERS: { v: string; label: string }[] = [
  { v: '', label: 'Tất cả' },
  { v: 'ORDER', label: 'Đơn hàng' }, { v: 'PAYMENT', label: 'Thanh toán' },
  { v: 'RETURN', label: 'Đổi/trả' }, { v: 'COMPLAINT', label: 'Khiếu nại' },
  { v: 'REVIEW', label: 'Đánh giá' }, { v: 'QA', label: 'Hỏi đáp' },
  { v: 'PROMO', label: 'Khuyến mãi' }, { v: 'SUGGEST', label: 'Gợi ý' },
];

const TYPE_CLS: Record<NotificationType, string> = {
  ORDER: 'bg-amber-100 text-amber-700', PAYMENT: 'bg-brand-light text-brand',
  RETURN: 'bg-indigo-100 text-indigo-700', COMPLAINT: 'bg-red-100 text-red-600',
  REVIEW: 'bg-sky-100 text-sky-700', QA: 'bg-teal-100 text-teal-700',
  PROMO: 'bg-pink-100 text-pink-600', SUGGEST: 'bg-violet-100 text-violet-600',
};

// UC12.4 - Quản lý thông báo
export default function NotificationsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [type, setType] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data } = useQuery({ queryKey: ['notifications', type, unreadOnly], queryFn: () => getNotifications({ type: type || undefined, unread: unreadOnly }) });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notif-count'] }); };

  async function open(n: Notification) {
    if (!n.read) { await markNotificationRead(n.id); refresh(); }
    if (n.link) nav(n.link); // 8a/8E - điều hướng nếu còn khả dụng
  }
  async function readAll() { await markAllNotificationsRead(); refresh(); }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-400">A little update, just for you</p>
          <h1 className="font-display text-3xl text-ink mt-1">Thông báo của bạn</h1>
        </div>
        {(data?.unread ?? 0) > 0 && <button onClick={readAll} className="text-sm border border-black/10 rounded-full px-4 py-2 hover:border-brand whitespace-nowrap">✓ Đánh dấu tất cả đã đọc</button>}
      </div>
      <p className="text-sm text-gray-500 mb-5">Những cập nhật nhỏ, để bạn luôn an tâm với mỗi lựa chọn.{data && data.unread > 0 ? ` · ${data.unread} chưa đọc` : ''}</p>

      <div className="flex items-center gap-2 flex-wrap mb-5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button key={f.v} onClick={() => setType(f.v)} className={`whitespace-nowrap text-sm px-3.5 py-1.5 rounded-full border ${type === f.v ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600 hover:border-brand'}`}>{f.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-500 ml-auto whitespace-nowrap">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="accent-brand" /> Chỉ hiện chưa đọc
        </label>
      </div>

      {!data || data.items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-black/10 rounded-xl">
          <p className="font-display text-xl text-ink">Chưa có thông báo nào</p>
          <p className="text-sm text-gray-500 mt-2">Mọi cập nhật về đơn hàng và gợi ý sẽ xuất hiện ở đây.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => (
            <button key={n.id} onClick={() => open(n)} className={`w-full text-left rounded-xl border p-4 transition-colors ${n.read ? 'bg-white border-black/5' : 'bg-brand-light/30 border-brand/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_CLS[n.type]}`}>{NOTIF_TYPE_LABEL[n.type]}</span>
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                <span className="ml-auto text-xs text-gray-400">{new Date(n.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              <p className={`text-sm ${n.read ? 'text-ink' : 'text-ink font-medium'}`}>{n.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{n.content}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

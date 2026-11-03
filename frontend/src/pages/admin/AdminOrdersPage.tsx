import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllOrders } from '../../lib/admin-ops';
import { formatVND } from '../../lib/products';

const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán', PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Chuẩn bị', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã huỷ', PAID: 'Đã thanh toán',
};
const PAY_LABEL: Record<string, string> = {
  UNPAID: 'Chưa TT', PENDING: 'Chờ TT', PAID: 'Đã TT', FAILED: 'TT lỗi', CANCELLED: 'Huỷ', EXPIRED: 'Hết hạn', REFUNDED: 'Đã hoàn',
};
const FILTERS = [
  { v: '', label: 'Tất cả' }, { v: 'PENDING', label: 'Chờ xác nhận' }, { v: 'SHIPPING', label: 'Đang giao' },
  { v: 'COMPLETED', label: 'Hoàn tất' }, { v: 'CANCELLED', label: 'Đã huỷ' },
];

// Admin #6 - Quản lý đơn hàng: theo dõi toàn sàn (chỉ đọc).
export default function AdminOrdersPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['admin-orders', status, q], queryFn: () => getAllOrders({ status: status || undefined, q: q || undefined }) });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Quản lý đơn hàng</h1>
      <p className="text-sm text-ink/50 mb-5">Theo dõi tất cả đơn hàng toàn sàn. Thao tác xử lý đơn do Người bán thực hiện.</p>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setStatus(f.v)} className={`text-sm px-4 py-1.5 rounded-full border ${status === f.v ? 'border-brand bg-brand text-white' : 'border-brand/20 text-ink/60'}`}>
            {f.label}{data?.counts && f.v && data.counts[f.v] ? ` (${data.counts[f.v]})` : ''}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã đơn / người nhận / SĐT…" className="border border-brand/20 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
      </div>

      {isLoading ? <p className="text-ink/40">Đang tải…</p>
        : !data || data.orders.length === 0 ? <p className="text-ink/40 text-center py-16 border border-dashed border-brand/20 rounded-xl">Không có đơn hàng.</p>
          : (
            <div className="overflow-x-auto bg-white rounded-xl border border-brand/10">
              <table className="w-full text-sm">
                <thead className="text-left text-ink/50 border-b border-brand/10">
                  <tr><th className="px-4 py-3">Mã đơn</th><th className="px-3 py-3">Khách</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3">Thanh toán</th><th className="px-3 py-3 text-right">Tổng</th><th className="px-3 py-3">Ngày</th></tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-b border-brand/5">
                      <td className="px-4 py-3 font-medium text-ink">{o.code}<span className="block text-[11px] text-ink/40">{o.items?.length || 0} SP</span></td>
                      <td className="px-3 py-3 text-ink/70">{o.user?.fullName || o.recipientName}</td>
                      <td className="px-3 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand">{STATUS_LABEL[o.status] || o.status}</span></td>
                      <td className="px-3 py-3 text-ink/60">{PAY_LABEL[o.paymentStatus] || o.paymentStatus}</td>
                      <td className="px-3 py-3 text-right font-medium">{formatVND(o.total)}</td>
                      <td className="px-3 py-3 text-ink/50">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}

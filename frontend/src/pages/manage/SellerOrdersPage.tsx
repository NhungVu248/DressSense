import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import {
  getSellerOrders, sellerUpdateStatus, sellerApproveCancel, sellerRejectCancel,
  ORDER_STATUS_LABEL, type Order, type OrderStatus,
} from '../../lib/order';

const STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700', CONFIRMED: 'bg-sky-100 text-sky-700',
  PREPARING: 'bg-indigo-100 text-indigo-700', SHIPPING: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-teal-100 text-teal-700', COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500', AWAITING_PAYMENT: 'bg-orange-100 text-orange-700', PAID: 'bg-brand-light text-brand',
};

// Hành động kế tiếp theo trạng thái (UC10.4 - đúng thứ tự)
const NEXT: Partial<Record<OrderStatus, { to: string; label: string; needShip?: boolean }>> = {
  PENDING: { to: 'CONFIRMED', label: 'Xác nhận đơn' },
  CONFIRMED: { to: 'PREPARING', label: 'Chuẩn bị hàng' },
  PREPARING: { to: 'SHIPPING', label: 'Bàn giao vận chuyển', needShip: true },
  SHIPPING: { to: 'DELIVERED', label: 'Đánh dấu đã giao' },
};

const FILTERS = [
  { value: '', label: 'Tất cả' }, { value: 'PENDING', label: 'Chờ xác nhận' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' }, { value: 'PREPARING', label: 'Đang chuẩn bị' },
  { value: 'SHIPPING', label: 'Đang giao' }, { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'COMPLETED', label: 'Hoàn tất' }, { value: 'CANCELLED', label: 'Đã hủy' },
];

// UC10.4 - Người bán quản lý & cập nhật đơn hàng
export default function SellerOrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: orders, isLoading } = useQuery({ queryKey: ['seller-orders', status], queryFn: () => getSellerOrders(status || undefined) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['seller-orders'] });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-5">Quản lý đơn hàng</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setStatus(f.value)}
            className={`whitespace-nowrap text-sm px-4 py-1.5 rounded-full border transition-colors ${status === f.value ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600 hover:border-brand'}`}>{f.label}</button>
        ))}
      </div>

      {isLoading ? <p className="text-gray-400">Đang tải…</p>
        : !orders || orders.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-black/10 rounded-xl"><p className="font-display text-xl text-ink">Chưa có đơn hàng nào</p></div>
        ) : (
          <div className="space-y-3">{orders.map((o) => <SellerOrderCard key={o.id} o={o} onChanged={refresh} />)}</div>
        )}
    </div>
  );
}

function SellerOrderCard({ o, onChanged }: { o: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [shipForm, setShipForm] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [eta, setEta] = useState('');
  const next = NEXT[o.status];

  async function advance() {
    const n = NEXT[o.status];
    if (!n) return;
    if (n.needShip && !shipForm) { setShipForm(true); return; }
    setBusy(true);
    try {
      await sellerUpdateStatus(o.id, { to: n.to, ...(n.needShip ? { carrier, trackingNumber: tracking || undefined, estimatedDelivery: eta || undefined } : {}) });
      setShipForm(false); onChanged();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Không cập nhật được.'); }
    finally { setBusy(false); }
  }
  async function approve() { setBusy(true); try { await sellerApproveCancel(o.id); onChanged(); } catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); } finally { setBusy(false); } }
  async function reject() { setBusy(true); try { await sellerRejectCancel(o.id); onChanged(); } catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); } finally { setBusy(false); } }

  return (
    <div className="bg-white rounded-xl border border-black/5 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium text-ink">{o.code}</p>
          <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString('vi-VN')} · {o.user?.fullName ?? 'Khách'} · {o.paymentMethod}</p>
        </div>
        <div className="text-right">
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
          <p className="font-semibold text-ink mt-1">{formatVND(o.total)}</p>
        </div>
      </div>

      <ul className="text-sm text-gray-500 mt-2 border-t border-black/5 pt-2">
        {o.items.map((it) => <li key={it.id}>{it.name}{it.size && ` · Size ${it.size}`} × {it.quantity}</li>)}
      </ul>
      <p className="text-xs text-gray-400 mt-1">Giao đến: {o.recipientName} · {o.phone} · {o.addressDetail}, {o.ward}, {o.district}, {o.province}</p>

      {/* Yêu cầu hủy từ khách (UC10.5 3a) */}
      {o.cancelRequested && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 text-sm">
          <p className="text-amber-700 mb-2">Khách yêu cầu hủy{o.cancelReason ? `: ${o.cancelReason}` : ''}</p>
          <div className="flex gap-2">
            <button onClick={approve} disabled={busy} className="bg-red-600 text-white rounded-lg px-3 py-1.5 text-xs disabled:opacity-50">Chấp nhận hủy</button>
            <button onClick={reject} disabled={busy} className="border border-black/15 rounded-lg px-3 py-1.5 text-xs">Từ chối</button>
          </div>
        </div>
      )}

      {/* Form vận chuyển khi bàn giao */}
      {shipForm && (
        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Đơn vị vận chuyển *" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Mã vận đơn" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
        </div>
      )}

      {next && o.status !== 'CANCELLED' && (
        <div className="flex gap-2 mt-3">
          <button onClick={advance} disabled={busy || (next.needShip && shipForm && !carrier)} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm">{busy ? 'Đang lưu…' : next.label}</button>
          {shipForm && <button onClick={() => setShipForm(false)} className="border border-black/15 rounded-lg px-4 py-2 text-sm">Hủy</button>}
        </div>
      )}
    </div>
  );
}

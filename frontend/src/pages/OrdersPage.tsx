import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { formatVND } from '../lib/products';
import {
  getOrders, getOrder, retryPayment, confirmReceipt, cancelOrder, TRACKING_STEPS,
  ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL,
  type Order, type OrderStatus,
} from '../lib/order';
import { ReturnModal, ComplaintModal, ReviewModal } from '../components/SupportModals';

const STATUS_CLS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-700', PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-sky-100 text-sky-700', PREPARING: 'bg-indigo-100 text-indigo-700',
  SHIPPING: 'bg-blue-100 text-blue-700', DELIVERED: 'bg-teal-100 text-teal-700',
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-gray-100 text-gray-500',
  PAID: 'bg-brand-light text-brand',
};

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xác nhận' },
  { value: 'SHIPPING', label: 'Đang giao' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

// UC10.1 - danh sách đơn hàng của khách (lọc theo trạng thái)
export function OrdersPage() {
  const [status, setStatus] = useState('');
  const { data: orders, isLoading } = useQuery({ queryKey: ['orders', status], queryFn: () => getOrders(status || undefined) });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-5">Đơn hàng của tôi</h1>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setStatus(f.value)}
            className={`whitespace-nowrap text-sm px-4 py-1.5 rounded-full border transition-colors ${status === f.value ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600 hover:border-brand'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-400">Đang tải…</p>
      ) : !orders || orders.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-black/10 rounded-xl">
          <p className="font-display text-xl text-ink">Bạn chưa có đơn hàng nào</p>
          <Link to="/" className="inline-block mt-4 bg-brand text-white rounded-full px-5 py-2.5 text-sm">Mua sắm ngay</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="block bg-white rounded-xl border border-black/5 p-4 hover:border-brand/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{o.code} {o.cancelRequested && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">Chờ duyệt hủy</span>}</p>
                  <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString('vi-VN')} · {o.items.length} sản phẩm · {o.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                  <p className="font-semibold text-ink mt-1">{formatVND(o.total)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// UC10.2 - tiến trình theo dõi
function Tracking({ o }: { o: Order }) {
  if (o.status === 'CANCELLED') {
    return (
      <div className="bg-gray-50 rounded-xl border border-black/5 p-4 text-sm">
        <p className="text-gray-600">Đơn đã hủy{o.cancelledBy ? ` bởi ${o.cancelledBy === 'SELLER' ? 'người bán' : o.cancelledBy === 'SYSTEM' ? 'hệ thống' : 'bạn'}` : ''}.</p>
        {o.cancelReason && <p className="text-gray-400 mt-1">Lý do: {o.cancelReason}</p>}
        {o.refundStatus === 'PENDING' && <p className="text-amber-600 mt-1">Đang xử lý hoàn tiền (UC11).</p>}
      </div>
    );
  }
  const times: Record<string, string | null> = { PENDING: o.createdAt, CONFIRMED: o.confirmedAt, SHIPPING: o.shippedAt, DELIVERED: o.deliveredAt, COMPLETED: o.completedAt };
  const curIdx = TRACKING_STEPS.findIndex((s) => s.status === o.status);
  return (
    <div className="bg-white rounded-xl border border-black/5 p-5">
      <h2 className="font-medium text-ink mb-4 text-sm">Theo dõi đơn hàng</h2>
      <ol className="space-y-0">
        {TRACKING_STEPS.map((s, i) => {
          const done = i <= curIdx;
          return (
            <li key={s.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`w-3 h-3 rounded-full ${done ? 'bg-brand' : 'bg-black/15'}`} />
                {i < TRACKING_STEPS.length - 1 && <span className={`w-0.5 flex-1 min-h-[28px] ${i < curIdx ? 'bg-brand' : 'bg-black/10'}`} />}
              </div>
              <div className="pb-4 -mt-1">
                <p className={`text-sm ${done ? 'text-ink font-medium' : 'text-gray-400'}`}>{s.label}</p>
                {times[s.status] && done && <p className="text-xs text-gray-400">{new Date(times[s.status]!).toLocaleString('vi-VN')}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {(o.carrier || o.trackingNumber) ? (
        <div className="border-t border-black/5 pt-3 mt-1 text-sm space-y-1">
          {o.carrier && <p className="text-gray-500">Đơn vị vận chuyển: <span className="text-ink">{o.carrier}</span></p>}
          {o.trackingNumber && <p className="text-gray-500">Mã vận đơn: <span className="text-ink">{o.trackingNumber}</span></p>}
          {o.estimatedDelivery && <p className="text-gray-500">Dự kiến giao: <span className="text-ink">{new Date(o.estimatedDelivery).toLocaleDateString('vi-VN')}</span></p>}
        </div>
      ) : (o.status === 'CONFIRMED' || o.status === 'PREPARING') ? (
        <p className="text-xs text-gray-400 border-t border-black/5 pt-3 mt-1">Đang chờ thông tin vận chuyển.</p>
      ) : null}
    </div>
  );
}

const CANCEL_REASONS = ['Đổi ý không mua nữa', 'Đặt nhầm sản phẩm/số lượng', 'Tìm được nơi bán tốt hơn', 'Thời gian giao quá lâu', 'Lý do khác'];

// UC10.1/10.2/10.3/10.5 - chi tiết đơn hàng
export function OrderDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: o, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id!), enabled: !!id });
  const [showCancel, setShowCancel] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showComplaint, setShowComplaint] = useState(false);
  const [reviewItem, setReviewItem] = useState<Order['items'][number] | null>(null);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['order', id] });

  async function retry() {
    try { const r = await retryPayment(Number(id)); window.location.href = r.payUrl; }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Không thể thanh toán lại.'); }
  }
  async function doConfirm() {
    if (!confirm('Xác nhận bạn đã nhận được hàng?')) return;
    setBusy(true);
    try { await confirmReceipt(Number(id)); refresh(); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Không xác nhận được.'); }
    finally { setBusy(false); }
  }
  async function doCancel() {
    setBusy(true);
    try {
      const r = await cancelOrder(Number(id), reason);
      setShowCancel(false); refresh();
      alert(r.requested ? 'Đã gửi yêu cầu hủy, chờ người bán duyệt.' : 'Đã hủy đơn hàng.');
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Không hủy được đơn.'); }
    finally { setBusy(false); }
  }

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải…</p>;
  if (!o) return <p className="text-center py-24 text-gray-400">Không tìm thấy đơn hàng.</p>;

  const canConfirm = o.status === 'DELIVERED';
  const canCancelDirect = o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT';
  const canCancelRequest = (o.status === 'CONFIRMED' || o.status === 'PREPARING') && !o.cancelRequested;
  const canReturn = o.status === 'DELIVERED' || o.status === 'COMPLETED'; // UC11.1
  const canReview = o.status === 'DELIVERED' || o.status === 'COMPLETED'; // UC12.1
  const canComplain = ['CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'COMPLETED'].includes(o.status); // UC11.2

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => nav('/orders')} className="text-sm text-gray-400 hover:text-gray-600">← Đơn hàng của tôi</button>
      <div className="flex items-center justify-between gap-3 mt-2 mb-6 flex-wrap">
        <h1 className="font-display text-3xl text-ink">Đơn {o.code}</h1>
        <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_CLS[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
      </div>

      {o.status === 'AWAITING_PAYMENT' && o.paymentMethod !== 'COD' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-orange-700">Đơn hàng đang chờ thanh toán.</p>
          <button onClick={retry} className="bg-brand text-white rounded-full px-4 py-2 text-sm whitespace-nowrap">Thanh toán lại</button>
        </div>
      )}
      {o.cancelRequested && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-700">Yêu cầu hủy đang chờ người bán duyệt. Lý do: {o.cancelReason}</div>
      )}

      <div className="mb-5"><Tracking o={o} /></div>

      <div className="grid sm:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl border border-black/5 p-4 text-sm">
          <h2 className="font-medium text-ink mb-2">Giao đến</h2>
          <p className="text-ink">{o.recipientName} · {o.phone}</p>
          <p className="text-gray-500">{o.addressDetail}, {o.ward}, {o.district}, {o.province}</p>
        </section>
        <section className="bg-white rounded-xl border border-black/5 p-4 text-sm">
          <h2 className="font-medium text-ink mb-2">Thanh toán</h2>
          <p className="text-gray-500">Phương thức: <span className="text-ink">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</span></p>
          <p className="text-gray-500">Trạng thái: <span className="text-ink">{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span></p>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-black/5 p-4 mt-4">
        <h2 className="font-medium text-ink mb-2 text-sm">Sản phẩm</h2>
        <ul className="divide-y divide-black/5">
          {o.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="text-ink flex-1">{it.name}{it.size && <span className="text-gray-400"> · Size {it.size}</span>} <span className="text-gray-400">× {it.quantity}</span></span>
              {canReview && <button onClick={() => setReviewItem(it)} className="text-xs text-brand border border-brand/30 rounded-full px-2.5 py-1 hover:bg-brand-light whitespace-nowrap">Đánh giá</button>}
              <span>{formatVND(it.price * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-black/5 mt-2 pt-2 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Tạm tính</span><span>{formatVND(o.subtotal)}</span></div>
          {o.discount > 0 && <div className="flex justify-between text-brand"><span>Giảm giá {o.voucherCode && `(${o.voucherCode})`}</span><span>−{formatVND(o.discount)}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500">Vận chuyển</span><span>{o.shippingFee === 0 ? 'Miễn phí' : formatVND(o.shippingFee)}</span></div>
          <div className="flex justify-between font-semibold text-ink text-base pt-1"><span>Tổng cộng</span><span>{formatVND(o.total)}</span></div>
        </div>
      </section>

      {/* Thao tác theo trạng thái */}
      {(canConfirm || canCancelDirect || canCancelRequest || canReturn || canComplain) && (
        <div className="flex flex-wrap gap-2 mt-5">
          {canConfirm && <button onClick={doConfirm} disabled={busy} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm">Đã nhận được hàng</button>}
          {canReturn && <button onClick={() => setShowReturn(true)} className="border border-black/15 text-ink hover:border-brand rounded-lg px-5 py-2.5 text-sm">Đổi/trả hàng</button>}
          {canComplain && <button onClick={() => setShowComplaint(true)} className="border border-black/15 text-ink hover:border-brand rounded-lg px-5 py-2.5 text-sm">Gửi khiếu nại</button>}
          {(canCancelDirect || canCancelRequest) && <button onClick={() => setShowCancel(true)} className="border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-5 py-2.5 text-sm">{canCancelDirect ? 'Hủy đơn hàng' : 'Yêu cầu hủy'}</button>}
        </div>
      )}

      {showReturn && <ReturnModal order={o} onClose={() => setShowReturn(false)} onDone={() => { setShowReturn(false); refresh(); }} />}
      {showComplaint && <ComplaintModal orderId={o.id} onClose={() => setShowComplaint(false)} onDone={() => setShowComplaint(false)} />}
      {reviewItem && <ReviewModal orderId={o.id} item={reviewItem} onClose={() => setReviewItem(null)} onDone={() => setReviewItem(null)} />}

      {showCancel && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancel(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-display text-xl text-ink mb-3">{canCancelDirect ? 'Hủy đơn hàng' : 'Yêu cầu hủy đơn'}</h3>
            <p className="text-sm text-gray-500 mb-3">Vui lòng chọn lý do:</p>
            <div className="space-y-1.5 mb-4">
              {CANCEL_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-brand" />{r}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={doCancel} disabled={busy} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm">{busy ? 'Đang xử lý…' : 'Xác nhận'}</button>
              <button onClick={() => setShowCancel(false)} className="border border-black/15 rounded-lg px-4 py-2.5 text-sm">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

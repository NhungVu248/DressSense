import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { formatVND } from '../lib/products';
import {
  getOrders, getOrder, retryPayment,
  ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL,
  type OrderStatus,
} from '../lib/order';

const STATUS_CLS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700', AWAITING_PAYMENT: 'bg-orange-100 text-orange-700',
  PAID: 'bg-brand-light text-brand', SHIPPING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-gray-100 text-gray-500',
};

// UC9.1 - danh sách đơn hàng của khách
export function OrdersPage() {
  const { data: orders, isLoading } = useQuery({ queryKey: ['orders'], queryFn: getOrders });
  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải đơn hàng…</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-6">Đơn hàng của tôi</h1>
      {!orders || orders.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-black/10 rounded-xl">
          <p className="font-display text-xl text-ink">Chưa có đơn hàng nào</p>
          <Link to="/" className="inline-block mt-4 bg-brand text-white rounded-full px-5 py-2.5 text-sm">Mua sắm ngay</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="block bg-white rounded-xl border border-black/5 p-4 hover:border-brand/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{o.code}</p>
                  <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString('vi-VN')} · {o.items.length} sản phẩm · {PAYMENT_METHOD_LABEL[o.paymentMethod].split(' ')[0]}</p>
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

// UC9.1 - chi tiết đơn hàng
export function OrderDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: o, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id!), enabled: !!id });

  async function retry() {
    try { const r = await retryPayment(Number(id)); window.location.href = r.payUrl; }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Không thể thanh toán lại.'); }
  }

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải…</p>;
  if (!o) return <p className="text-center py-24 text-gray-400">Không tìm thấy đơn hàng.</p>;

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
            <li key={it.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">{it.name}{it.size && <span className="text-gray-400"> · Size {it.size}</span>} <span className="text-gray-400">× {it.quantity}</span></span>
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

      {o.payments && o.payments.length > 0 && (
        <section className="bg-white rounded-xl border border-black/5 p-4 mt-4 text-sm">
          <h2 className="font-medium text-ink mb-2">Giao dịch thanh toán</h2>
          <ul className="divide-y divide-black/5">
            {o.payments.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className="text-gray-500">{t.code} · {new Date(t.createdAt).toLocaleString('vi-VN')}</span>
                <span className="text-ink">{PAYMENT_STATUS_LABEL[t.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

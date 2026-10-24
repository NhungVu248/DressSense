import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { formatVND } from '../lib/products';
import { getOrder, retryPayment, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '../lib/order';

// UC9.1/9.2 - trang kết quả sau khi đặt hàng / thanh toán (VNPAY return điều hướng về đây)
export default function CheckoutResultPage() {
  const [sp] = useSearchParams();
  const orderId = sp.get('orderId');
  const status = sp.get('status'); // success | fail
  const success = status === 'success';

  const { data: order } = useQuery({ queryKey: ['order', orderId], queryFn: () => getOrder(orderId!), enabled: !!orderId });

  async function retry() {
    if (!orderId) return;
    try { const r = await retryPayment(Number(orderId)); window.location.href = r.payUrl; }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Không thể thanh toán lại.'); }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12 text-center">
      <div className={`w-16 h-16 mx-auto rounded-full grid place-items-center text-3xl ${success ? 'bg-brand-light text-brand' : 'bg-red-50 text-red-500'}`}>
        {success ? '✓' : '✕'}
      </div>
      <h1 className="font-display text-3xl text-ink mt-4">{success ? 'Đặt hàng thành công' : 'Thanh toán chưa hoàn tất'}</h1>
      <p className="text-sm text-gray-500 mt-2">
        {success ? 'Cảm ơn bạn! Đơn hàng của bạn đã được ghi nhận.' : 'Giao dịch chưa thành công. Bạn có thể thử thanh toán lại.'}
      </p>

      {order && (
        <div className="bg-white rounded-xl border border-black/5 p-5 mt-6 text-left text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Mã đơn</span><span className="font-medium text-ink">{order.code}</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">Trạng thái đơn</span><span>{ORDER_STATUS_LABEL[order.status]}</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">Thanh toán</span><span>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">Tổng tiền</span><span className="font-semibold text-ink">{formatVND(order.total)}</span></div>
        </div>
      )}

      <div className="flex gap-2 justify-center mt-6">
        {!success && order && order.paymentMethod !== 'COD' && order.paymentStatus !== 'PAID' && (
          <button onClick={retry} className="bg-brand text-white rounded-full px-5 py-2.5 text-sm">Thanh toán lại</button>
        )}
        {order && <Link to={`/orders/${order.id}`} className="border border-black/15 rounded-full px-5 py-2.5 text-sm text-ink">Xem chi tiết đơn</Link>}
        <Link to="/" className="border border-black/15 rounded-full px-5 py-2.5 text-sm text-ink">Tiếp tục mua sắm</Link>
      </div>
    </div>
  );
}

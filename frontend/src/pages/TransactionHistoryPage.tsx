import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatVND } from '../lib/products';
import { getTransactions, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL, type PaymentStatus } from '../lib/order';

const STATUS_CLS: Record<string, string> = {
  PAID: 'bg-brand-light text-brand', PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-600', CANCELLED: 'bg-gray-100 text-gray-500',
  EXPIRED: 'bg-gray-100 text-gray-500', REFUNDED: 'bg-blue-100 text-blue-700', UNPAID: 'bg-gray-100 text-gray-500',
};

// UC9.3 - Lịch sử giao dịch thanh toán của khách
export default function TransactionHistoryPage() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const { data: items, isLoading } = useQuery({
    queryKey: ['transactions', status, method],
    queryFn: () => getTransactions({ status: status || undefined, method: method || undefined }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-1">Lịch sử giao dịch</h1>
      <p className="text-sm text-gray-500 mb-5">Các giao dịch thanh toán cho đơn hàng của bạn.</p>

      {/* Lọc (4a) */}
      <div className="flex flex-wrap gap-2 mb-5 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-black/10 rounded-full px-3 py-2 bg-white">
          <option value="">Mọi trạng thái</option>
          {(['PAID', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'] as PaymentStatus[]).map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="border border-black/10 rounded-full px-3 py-2 bg-white">
          <option value="">Mọi phương thức</option>
          <option value="VNPAY">VNPAY</option>
          <option value="VISA">Visa</option>
          <option value="COD">COD</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Đang tải…</p>
      ) : !items || items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-black/10 rounded-xl">
          <p className="font-display text-xl text-ink">Bạn chưa có giao dịch thanh toán nào.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-black/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream text-gray-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-2.5">Mã giao dịch</th><th className="text-left">Đơn</th><th className="text-left">Thời gian</th><th className="text-right">Số tiền</th><th className="text-left px-3">Phương thức</th><th className="text-left px-3">Trạng thái</th></tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-black/5">
                  <td className="px-4 py-3 text-ink">{t.code}</td>
                  <td className="text-gray-500">{t.orderCode}</td>
                  <td className="text-gray-500">{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
                  <td className="text-right text-ink">{formatVND(t.amount)}</td>
                  <td className="px-3 text-gray-500">{PAYMENT_METHOD_LABEL[t.method].split(' ')[0]}{t.cardLast4 ? ` •••• ${t.cardLast4}` : ''}</td>
                  <td className="px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[t.status] ?? ''}`}>{PAYMENT_STATUS_LABEL[t.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">Giao dịch thất bại vẫn được lưu để tra cứu. Xem đơn hàng trong <Link to="/orders" className="text-brand underline">Đơn hàng của tôi</Link>.</p>
    </div>
  );
}

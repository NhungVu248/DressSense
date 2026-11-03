import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { formatVND } from '../lib/products';
import { getInvoice, emailInvoice } from '../lib/order';

// Backlog - Hóa đơn VAT (trang để xem & in). Giá là giá cuối đã gồm thuế; tách phần chưa thuế + VAT.
export default function InvoicePage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['invoice', id], queryFn: () => getInvoice(id!), enabled: !!id, retry: false });
  const [sending, setSending] = useState(false);

  async function sendEmail() {
    setSending(true);
    try { const r = await emailInvoice(id!); alert(r.message); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Gửi email thất bại.'); }
    finally { setSending(false); }
  }

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải hóa đơn…</p>;
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="font-display text-xl text-ink mb-3">Chưa có hóa đơn cho đơn này</p>
        <p className="text-sm text-gray-500 mb-5">Hãy bấm “Xuất hóa đơn VAT” ở trang đơn hàng trước.</p>
        <Link to={`/orders/${id}`} className="text-sm text-brand hover:underline">← Về đơn hàng</Link>
      </div>
    );
  }

  const { invoice, company, breakdown, order } = data;
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Thanh thao tác (ẩn khi in) */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <Link to={`/orders/${id}`} className="text-sm text-gray-400 hover:text-gray-600">← Về đơn hàng</Link>
        <div className="flex gap-2">
          {invoice.buyerEmail && (
            <button onClick={sendEmail} disabled={sending} className="border border-brand/30 text-brand rounded-full px-4 py-2 text-sm disabled:opacity-50">{sending ? 'Đang gửi…' : 'Gửi qua email'}</button>
          )}
          <button onClick={() => window.print()} className="bg-brand text-white rounded-full px-5 py-2 text-sm">In hóa đơn</button>
        </div>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-6 md:p-8">
        <div className="text-center border-b border-black/10 pb-4 mb-4">
          <h1 className="font-display text-2xl text-ink">HÓA ĐƠN GIÁ TRỊ GIA TĂNG (VAT)</h1>
          <p className="text-xs text-gray-400 mt-1">Số hóa đơn: HD{String(invoice.id).padStart(6, '0')} · Ngày xuất: {new Date(invoice.issuedAt).toLocaleString('vi-VN')}{invoice.issueCount > 1 && ` · Lần xuất ${invoice.issueCount}`}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm mb-5">
          <div>
            <p className="text-gray-400 text-xs uppercase mb-1">Đơn vị bán hàng</p>
            <p className="text-ink font-medium">{company.name}</p>
            {company.taxCode && <p className="text-gray-600">MST: {company.taxCode}</p>}
            {company.address && <p className="text-gray-600">{company.address}</p>}
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase mb-1">Người mua</p>
            <p className="text-ink font-medium">{invoice.buyerName}</p>
            {invoice.buyerTaxCode && <p className="text-gray-600">MST: {invoice.buyerTaxCode}</p>}
            <p className="text-gray-600">{invoice.buyerAddress}</p>
            {invoice.buyerEmail && <p className="text-gray-600">{invoice.buyerEmail}</p>}
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-2">Đơn hàng {order.code} · {new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
        <table className="w-full text-sm border-t border-black/10">
          <thead>
            <tr className="text-left text-gray-400 text-xs">
              <th className="py-2">Sản phẩm</th><th className="py-2 text-center">SL</th><th className="py-2 text-right">Đơn giá</th><th className="py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i} className="border-t border-black/5">
                <td className="py-2 text-ink">{it.name}{it.size && <span className="text-gray-400"> · {it.size}</span>}</td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">{formatVND(it.price)}</td>
                <td className="py-2 text-right">{formatVND(it.price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-black/10 mt-3 pt-3 space-y-1 text-sm max-w-xs ml-auto">
          <div className="flex justify-between"><span className="text-gray-500">Tiền hàng (chưa thuế)</span><span>{formatVND(breakdown.goodsBeforeTax)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Thuế VAT ({breakdown.taxRate}%)</span><span>{formatVND(breakdown.taxAmount)}</span></div>
          {breakdown.discount > 0 && <div className="flex justify-between text-brand"><span>Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ''}</span><span>−{formatVND(breakdown.discount)}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500">Phí vận chuyển</span><span>{breakdown.shippingFee === 0 ? 'Miễn phí' : formatVND(breakdown.shippingFee)}</span></div>
          <div className="flex justify-between font-semibold text-ink text-base border-t border-black/10 pt-1 mt-1"><span>Tổng thanh toán</span><span>{formatVND(breakdown.total)}</span></div>
        </div>

        {invoice.note && <p className="text-xs text-gray-400 mt-4">Ghi chú: {invoice.note}</p>}
        <p className="text-[11px] text-gray-400 mt-5 text-center">Hóa đơn phát hành điện tử bởi {company.name}. Giá đã bao gồm thuế VAT theo quy định.</p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listOrderCommissions, COMMISSION_STATUS_LABEL, METHOD_LABEL } from '../../lib/finance';
import { formatVND } from '../../lib/products';

// 2.3 - Quản lý giao dịch hoa hồng: xem từng khoản hoa hồng đã phát sinh từ đơn.
const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700', PENDING: 'bg-amber-100 text-amber-700',
  REFUNDED: 'bg-blue-100 text-blue-700', CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function AdminCommissionsPage() {
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params: any = {};
  if (status) params.status = status;
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading } = useQuery({
    queryKey: ['commission-txns', status, from, to],
    queryFn: () => listOrderCommissions(params),
  });

  const total = (data ?? []).reduce((s, t) => s + (t.status === 'CONFIRMED' ? t.commissionAmount : 0), 0);

  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-ink/40">Tài chính · Hoa hồng</p>
        <h1 className="font-display text-3xl font-bold">Giao dịch hoa hồng</h1>
        <p className="text-sm text-ink/50 mt-1">Từng khoản hoa hồng phát sinh theo dòng hàng khi đơn hoàn tất.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-brand/20 rounded-lg px-3 py-1.5">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(COMMISSION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-brand/20 rounded-lg px-2 py-1.5" />
        <span className="text-ink/40">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-brand/20 rounded-lg px-2 py-1.5" />
        <span className="ml-auto text-ink/60">Tổng hoa hồng đã xác nhận: <b className="text-brand">{formatVND(total)}</b></span>
      </div>

      {isLoading ? <p className="text-ink/40">Đang tải…</p> : (
        <div className="bg-white rounded-2xl border border-brand/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-brand/10">
                <th className="py-2.5 px-3 font-medium">Mã đơn</th>
                <th className="py-2.5 px-3 font-medium">Gian hàng</th>
                <th className="py-2.5 px-3 font-medium text-right">Giá trị tính phí</th>
                <th className="py-2.5 px-3 font-medium text-right">Tỷ lệ</th>
                <th className="py-2.5 px-3 font-medium text-right">Hoa hồng</th>
                <th className="py-2.5 px-3 font-medium">PT</th>
                <th className="py-2.5 px-3 font-medium">Trạng thái</th>
                <th className="py-2.5 px-3 font-medium">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan={8} className="text-center text-ink/40 py-10">Chưa có giao dịch hoa hồng.</td></tr>
              ) : data.map((t) => (
                <tr key={t.id} className="border-b border-brand/5 last:border-0">
                  <td className="py-2.5 px-3 font-medium">{t.orderCode}</td>
                  <td className="py-2.5 px-3">{t.shopName}</td>
                  <td className="py-2.5 px-3 text-right">{formatVND(t.baseAmount)}</td>
                  <td className="py-2.5 px-3 text-right">{t.commissionRate}%</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-brand">{formatVND(t.commissionAmount)}</td>
                  <td className="py-2.5 px-3 text-ink/60">{METHOD_LABEL[t.method] ?? t.method}</td>
                  <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>{COMMISSION_STATUS_LABEL[t.status]}</span></td>
                  <td className="py-2.5 px-3 text-ink/50 text-[13px]">{new Date(t.createdAt).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

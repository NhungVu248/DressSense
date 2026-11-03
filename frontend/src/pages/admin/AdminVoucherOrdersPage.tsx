import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import {
  listAdminVoucherOrders, approveVoucherOrder, rejectVoucherOrder, PACKAGE_LABEL, VO_STATUS_LABEL,
} from '../../lib/voucherOrders';

// Backlog C.45 - Admin duyệt đơn mua gói voucher (mức chiết khấu, combo/lẻ).
const STATUS_TABS = [
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
];

export default function AdminVoucherOrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [err, setErr] = useState('');
  const { data: orders, isLoading } = useQuery({ queryKey: ['admin-voucher-orders', status], queryFn: () => listAdminVoucherOrders(status) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-voucher-orders'] });
  const approveM = useMutation({ mutationFn: (id: number) => approveVoucherOrder(id), onSuccess: () => { setErr(''); refresh(); }, onError: (e: any) => setErr(e?.response?.data?.message ?? 'Không thể duyệt.') });
  const rejectM = useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectVoucherOrder(id, reason), onSuccess: refresh });

  return (
    <div className="p-5 md:p-8 max-w-5xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-ink/40">Khuyến mãi</p>
        <h1 className="font-display text-3xl font-bold">Duyệt đơn mua voucher</h1>
      </div>

      {err && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2">{err}</div>}

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setStatus(t.value)} className={`px-3 py-1.5 rounded-full text-sm border ${status === t.value ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>{t.label}</button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-ink/50">Đang tải…</p> : !orders?.length ? <p className="text-sm text-ink/40">Không có đơn nào.</p> : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-brand/10 bg-white p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{o.desiredCode}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">{PACKAGE_LABEL[o.packageType]}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{VO_STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <p className="text-xs text-ink/50 mt-0.5">{o.shopName}</p>
                <p className="text-xs text-ink/60 mt-0.5">
                  Mức chiết khấu: {o.discountType === 'PERCENT' ? `${o.value}%${o.maxDiscount ? ` (tối đa ${formatVND(o.maxDiscount)})` : ''}` : formatVND(o.value)}
                  {o.minOrder ? ` · đơn từ ${formatVND(o.minOrder)}` : ''}
                  {o.usageLimit ? ` · tối đa ${o.usageLimit} lượt` : ''} · {o.startsAt.slice(0, 10)} → {o.endsAt.slice(0, 10)}
                </p>
                <p className="text-sm mt-0.5">Phí gói: <span className="font-semibold text-brand">{formatVND(o.fee)}</span> · {o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
                {o.reviewReason && <p className="text-xs text-red-600 mt-0.5">Lý do: {o.reviewReason}</p>}
              </div>
              {o.status === 'PENDING_REVIEW' && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => approveM.mutate(o.id)} disabled={approveM.isPending} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">Duyệt</button>
                  <button onClick={() => { const r = window.prompt('Lý do từ chối:'); if (r && r.trim()) rejectM.mutate({ id: o.id, reason: r.trim() }); }} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-500 text-sm">Từ chối</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

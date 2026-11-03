import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import {
  listAdminAdOrders, getAdTimeline, approveAdOrder, rejectAdOrder,
  AD_POSITION_LABEL, AD_STATUS_LABEL, type AdPosition,
} from '../../lib/ads';
import { promptDialog } from '../../components/Dialog';

// Backlog C.41 - Admin duyệt đơn chạy banner + bảng timeline theo tuần/tháng.
const STATUS_TABS = [
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'RUNNING', label: 'Đang chạy' },
  { value: 'REJECTED', label: 'Từ chối' },
];

function OrdersTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING_REVIEW');
  const { data: orders, isLoading } = useQuery({ queryKey: ['admin-ad-orders', status], queryFn: () => listAdminAdOrders(status) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-ad-orders'] });
  const approveM = useMutation({ mutationFn: (id: number) => approveAdOrder(id), onSuccess: refresh });
  const rejectM = useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectAdOrder(id, reason), onSuccess: refresh });

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setStatus(t.value)} className={`px-3 py-1.5 rounded-full text-sm border ${status === t.value ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>{t.label}</button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-ink/50">Đang tải…</p> : !orders?.length ? <p className="text-sm text-ink/40">Không có đơn nào.</p> : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-brand/10 bg-white p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-28 h-16 rounded-lg overflow-hidden bg-brand/5 shrink-0"><img src={o.imageUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.opacity = '0'; }} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">{AD_STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <p className="text-xs text-ink/50 mt-0.5">{o.shopName} · {AD_POSITION_LABEL[o.position]} · {o.weeks} tuần · {o.startsAt.slice(0, 10)} → {o.endsAt.slice(0, 10)}</p>
                <p className="text-sm mt-0.5">Phí: <span className="font-semibold text-brand">{formatVND(o.amount)}</span> · {o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
                {o.reviewReason && <p className="text-xs text-red-600 mt-0.5">Lý do: {o.reviewReason}</p>}
              </div>
              {o.status === 'PENDING_REVIEW' && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => approveM.mutate(o.id)} disabled={approveM.isPending} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">Duyệt</button>
                  <button onClick={async () => { const r = await promptDialog('Lý do từ chối:'); if (r && r.trim()) rejectM.mutate({ id: o.id, reason: r.trim() }); }} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-500 text-sm">Từ chối</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function dayDiff(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

function TimelineTab() {
  const [position, setPosition] = useState<string>('');
  const { data: items, isLoading } = useQuery({ queryKey: ['ad-timeline', position], queryFn: () => getAdTimeline(position || undefined) });

  const bounds = useMemo(() => {
    if (!items?.length) return null;
    const starts = items.map((i) => new Date(i.startsAt).getTime());
    const ends = items.map((i) => new Date(i.endsAt).getTime());
    const min = new Date(Math.min(...starts)); min.setHours(0, 0, 0, 0);
    const max = new Date(Math.max(...ends)); max.setHours(23, 59, 59, 0);
    const totalDays = Math.max(1, dayDiff(min, max));
    // mốc tuần
    const weeks: { label: string; left: number }[] = [];
    const cur = new Date(min);
    while (cur <= max) {
      weeks.push({ label: `${cur.getDate()}/${cur.getMonth() + 1}`, left: (dayDiff(min, cur) / totalDays) * 100 });
      cur.setDate(cur.getDate() + 7);
    }
    return { min, max, totalDays, weeks };
  }, [items]);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setPosition('')} className={`px-3 py-1.5 rounded-full text-sm border ${position === '' ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>Tất cả vị trí</button>
        {(Object.keys(AD_POSITION_LABEL) as AdPosition[]).map((p) => (
          <button key={p} onClick={() => setPosition(p)} className={`px-3 py-1.5 rounded-full text-sm border ${position === p ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>{AD_POSITION_LABEL[p]}</button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-ink/50">Đang tải…</p> : !items?.length || !bounds ? <p className="text-sm text-ink/40">Chưa có lịch chạy banner nào.</p> : (
        <div className="rounded-2xl border border-brand/10 bg-white p-4 overflow-x-auto">
          {/* thanh mốc tuần */}
          <div className="relative h-5 mb-2 min-w-[600px] text-[10px] text-ink/40">
            {bounds.weeks.map((w, i) => (
              <span key={i} className="absolute -translate-x-1/2" style={{ left: `${w.left}%` }}>{w.label}</span>
            ))}
          </div>
          <div className="space-y-2 min-w-[600px]">
            {items.map((it) => {
              const s = new Date(it.startsAt); const e = new Date(it.endsAt);
              const left = (dayDiff(bounds.min, s) / bounds.totalDays) * 100;
              const width = Math.max(2, (dayDiff(s, e) / bounds.totalDays) * 100);
              return (
                <div key={it.id} className="relative h-8">
                  <div className="absolute inset-y-0 rounded-md bg-brand/80 text-white text-[11px] px-2 flex items-center overflow-hidden whitespace-nowrap" style={{ left: `${left}%`, width: `${width}%` }} title={`${it.shopName} · ${it.name} · ${it.startsAt.slice(0, 10)} → ${it.endsAt.slice(0, 10)}`}>
                    {it.shopName}: {it.name}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink/40 mt-3">Mỗi vạch là mốc 1 tuần. Di chuột lên thanh để xem chi tiết lịch chạy.</p>
        </div>
      )}
    </div>
  );
}

export default function AdminAdOrdersPage() {
  const [tab, setTab] = useState<'orders' | 'timeline'>('orders');
  return (
    <div className="p-5 md:p-8 max-w-5xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-ink/40">Quảng cáo</p>
        <h1 className="font-display text-3xl font-bold">Duyệt banner & lịch chạy</h1>
      </div>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('orders')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'orders' ? 'bg-brand text-white' : 'bg-brand/10 text-ink/70'}`}>Đơn đăng ký</button>
        <button onClick={() => setTab('timeline')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'timeline' ? 'bg-brand text-white' : 'bg-brand/10 text-ink/70'}`}>Lịch chạy (timeline)</button>
      </div>
      {tab === 'orders' ? <OrdersTab /> : <TimelineTab />}
    </div>
  );
}

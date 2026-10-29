import { useMemo, useState, type ReactNode } from 'react';
import { formatVND } from '../../lib/products';
import type { NV } from '../../lib/analytics';

// Dùng chung cho các trang Phân tích (UC15) ở cả Seller Portal và Admin.
const PRESETS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'month', label: 'Tháng này' },
  { value: 'custom', label: 'Tùy chọn' },
];

export function usePeriod() {
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => {
    if (preset === 'custom') return from && to ? { from, to } : null;
    return { preset };
  }, [preset, from, to]);
  return { preset, setPreset, from, setFrom, to, setTo, params };
}

export function PeriodBar(p: ReturnType<typeof usePeriod>) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      {PRESETS.map((x) => (
        <button key={x.value} onClick={() => p.setPreset(x.value)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            p.preset === x.value ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70 hover:border-brand/50'
          }`}>{x.label}</button>
      ))}
      {p.preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={p.from} onChange={(e) => p.setFrom(e.target.value)} className="border border-brand/20 rounded-lg px-2 py-1" />
          <span className="text-ink/40">→</span>
          <input type="date" value={p.to} onChange={(e) => p.setTo(e.target.value)} className="border border-brand/20 rounded-lg px-2 py-1" />
        </div>
      )}
    </div>
  );
}

export function PageHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-widest text-ink/40">{kicker}</p>
      <h1 className="font-display text-3xl font-bold">{title}</h1>
    </div>
  );
}

export function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

export function StatCard({ label, value, hint, delta, accent }: {
  label: string; value: string; hint?: string; delta?: number | null; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-brand/30 bg-brand/5' : 'border-brand/10 bg-white'}`}>
      <p className="text-xs text-ink/50">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`font-display text-2xl font-bold ${accent ? 'text-brand' : 'text-ink'}`}>{value}</p>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
      {hint && <p className="mt-0.5 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}

// Danh sách thanh ngang cho các xu hướng (phong cách, màu, danh mục…)
export function BarList({ title, items, unit }: { title: string; items: NV[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="rounded-2xl border border-brand/10 bg-white p-4">
      <h3 className="font-display text-base font-bold mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink/40">Chưa có dữ liệu.</p>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.name}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className="text-ink/70 truncate pr-2">{i.name}</span>
                <span className="text-ink/50">{i.value}{unit ?? ''}</span>
              </div>
              <div className="h-2 rounded-full bg-brand/10 overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: `${(i.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Biểu đồ cột doanh thu theo ngày (SVG)
export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-sm text-ink/40">Chưa có dữ liệu doanh thu trong kỳ.</div>;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const W = 720, H = 170, pad = 8, bw = (W - pad * 2) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full min-w-[460px]" role="img" aria-label="Biểu đồ doanh thu">
        {data.map((d, i) => {
          const h = Math.round((d.revenue / max) * H);
          const x = pad + i * bw;
          const show = data.length <= 16 || i % Math.ceil(data.length / 12) === 0;
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.15} y={H - h} width={bw * 0.7} height={h} rx="3" className="fill-brand">
                <title>{`${d.date}: ${formatVND(d.revenue)}`}</title>
              </rect>
              {show && <text x={x + bw / 2} y={H + 15} textAnchor="middle" className="fill-ink/40" fontSize="9">{d.date.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function StateMsg({ loading, error, empty, emptyText }: { loading?: boolean; error?: boolean; empty?: boolean; emptyText?: string }) {
  if (loading) return <p className="text-sm text-ink/50">Đang tổng hợp số liệu…</p>;
  if (error) return <p className="text-sm text-red-500">Lỗi tổng hợp dữ liệu. Vui lòng thử lại.</p>;
  if (empty) return <p className="text-sm text-ink/40">{emptyText ?? 'Chưa có dữ liệu trong khoảng thời gian này.'}</p>;
  return null;
}

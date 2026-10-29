import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import { getSellerReport } from '../../lib/shop';

// UC14.4 - Báo cáo doanh thu gian hàng (style dashboard theo Figma)
const PRESETS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'month', label: 'Tháng này' },
  { value: 'custom', label: 'Tùy chọn' },
];

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-brand/30 bg-brand/5' : 'border-brand/10 bg-white'}`}>
      <p className="text-xs text-ink/50">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? 'text-brand' : 'text-ink'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}

// Biểu đồ cột doanh thu theo ngày (SVG, không thêm thư viện)
function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (!data.length) {
    return <div className="h-48 flex items-center justify-center text-sm text-ink/40">Chưa có dữ liệu doanh thu trong kỳ.</div>;
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const W = 720;
  const H = 180;
  const pad = 8;
  const bw = (W - pad * 2) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 26}`} className="w-full min-w-[480px]" role="img" aria-label="Biểu đồ doanh thu">
        {data.map((d, i) => {
          const h = Math.round((d.revenue / max) * H);
          const x = pad + i * bw;
          const showLabel = data.length <= 16 || i % Math.ceil(data.length / 12) === 0;
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.15} y={H - h} width={bw * 0.7} height={h} rx="3" className="fill-brand">
                <title>{`${d.date}: ${formatVND(d.revenue)}`}</title>
              </rect>
              {showLabel && (
                <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="fill-ink/40" fontSize="9">
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function SellerReportPage() {
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = useMemo(() => {
    if (preset === 'custom') return from && to ? { from, to } : null;
    return { preset };
  }, [preset, from, to]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['seller-report', params],
    queryFn: () => getSellerReport(params!),
    enabled: !!params,
  });

  const m = data?.metrics;

  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink/40">Tổng quan gian hàng</p>
          <h1 className="font-display text-3xl font-bold">Báo cáo doanh thu</h1>
        </div>
      </div>

      {/* Chọn khoảng thời gian */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              preset === p.value ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70 hover:border-brand/50'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-brand/20 rounded-lg px-2 py-1" />
            <span className="text-ink/40">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-brand/20 rounded-lg px-2 py-1" />
          </div>
        )}
      </div>

      {preset === 'custom' && !params && <p className="text-sm text-ink/50">Chọn ngày bắt đầu và kết thúc để xem báo cáo.</p>}
      {isLoading && <p className="text-sm text-ink/50">Đang tổng hợp số liệu…</p>}
      {isError && <p className="text-sm text-red-500">Không thể tổng hợp dữ liệu. Vui lòng thử lại.</p>}

      {m && (
        <>
          {/* Thẻ chỉ số */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Tổng doanh thu" value={formatVND(m.revenue)} accent />
            <StatCard label="Doanh thu thực nhận" value={formatVND(m.netRevenue)} hint="Sau khi trừ hoàn tiền" />
            <StatCard label="Số đơn hàng" value={String(m.orderCount)} />
            <StatCard label="Giá trị đơn trung bình" value={formatVND(m.avgOrderValue)} />
            <StatCard label="Sản phẩm đã bán" value={String(m.soldQuantity)} />
            <StatCard label="Đơn hoàn tất" value={String(m.completedCount)} />
            <StatCard label="Đơn đã hủy" value={String(m.cancelledCount)} />
            <StatCard label="Tiền hoàn trả" value={formatVND(m.refundAmount)} />
          </div>

          {/* Biểu đồ doanh thu */}
          <div className="rounded-2xl border border-brand/10 bg-white p-4 mb-6">
            <h2 className="font-display text-lg font-bold mb-3">Doanh thu theo thời gian</h2>
            <RevenueChart data={data!.timeSeries} />
          </div>

          {/* Sản phẩm bán chạy */}
          <div className="rounded-2xl border border-brand/10 bg-white p-4">
            <h2 className="font-display text-lg font-bold mb-3">Sản phẩm bán chạy</h2>
            {data!.bestSellers.length === 0 ? (
              <p className="text-sm text-ink/40">Chưa có dữ liệu bán hàng trong kỳ.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink/50 border-b border-brand/10">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                      <th className="py-2 pr-3 font-medium text-right">Đã bán</th>
                      <th className="py-2 font-medium text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.bestSellers.map((p, i) => (
                      <tr key={p.productId} className="border-b border-brand/5 last:border-0">
                        <td className="py-2 pr-3 text-ink/40">{i + 1}</td>
                        <td className="py-2 pr-3">{p.name}</td>
                        <td className="py-2 pr-3 text-right font-medium">{p.quantity}</td>
                        <td className="py-2 text-right text-brand font-medium">{formatVND(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

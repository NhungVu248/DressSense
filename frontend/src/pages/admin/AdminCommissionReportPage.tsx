import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import { getCommissionReport } from '../../lib/finance';

// 2.5 - Báo cáo doanh thu hoa hồng (gộp doanh thu sàn C.42: + banner + voucher).
const PRESETS = [
  { value: 'today', label: 'Hôm nay' }, { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' }, { value: 'month', label: 'Tháng này' }, { value: 'custom', label: 'Tùy chọn' },
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

function FeeChart({ data }: { data: { date: string; commission: number }[] }) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-sm text-ink/40">Chưa có hoa hồng trong kỳ.</div>;
  const max = Math.max(...data.map((d) => d.commission), 1);
  const W = 720, H = 180, pad = 8;
  const bw = (W - pad * 2) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 26}`} className="w-full min-w-[480px]" role="img" aria-label="Biểu đồ hoa hồng">
        {data.map((d, i) => {
          const h = Math.round((d.commission / max) * H);
          const x = pad + i * bw;
          const showLabel = data.length <= 16 || i % Math.ceil(data.length / 12) === 0;
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.15} y={H - h} width={bw * 0.7} height={h} rx="3" className="fill-brand">
                <title>{`${d.date}: ${formatVND(d.commission)}`}</title>
              </rect>
              {showLabel && <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="fill-ink/40" fontSize="9">{d.date.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AdminCommissionReportPage() {
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => (preset === 'custom' ? (from && to ? { from, to } : null) : { preset }), [preset, from, to]);
  const { data, isLoading, isError } = useQuery({ queryKey: ['commission-report', params], queryFn: () => getCommissionReport(params!), enabled: !!params });
  const m = data?.metrics;

  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-ink/40">Tài chính</p>
        <h1 className="font-display text-3xl font-bold">Báo cáo doanh thu hoa hồng</h1>
        <p className="text-sm text-ink/50 mt-1">Doanh thu sàn = hoa hồng người bán + phí banner + phí voucher. GMV không phải doanh thu của sàn.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {PRESETS.map((p) => (
          <button key={p.value} onClick={() => setPreset(p.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${preset === p.value ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70 hover:border-brand/50'}`}>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Tổng thu của sàn" value={formatVND(m.platformIncome)} hint="Hoa hồng + banner + voucher" accent />
            <StatCard label="Hoa hồng phát sinh" value={formatVND(m.commissionTotal)} hint="Trong kỳ" />
            <StatCard label="Hoa hồng đã xác nhận" value={formatVND(m.confirmedCommission)} />
            <StatCard label="Hoa hồng hoàn/điều chỉnh" value={formatVND(m.refundedCommission)} />
            <StatCard label="GMV toàn sàn" value={formatVND(m.gmv)} hint="Tổng giá trị giao dịch" />
            <StatCard label="Phí banner quảng cáo" value={formatVND(m.bannerRevenue)} />
            <StatCard label="Phí bán voucher" value={formatVND(m.voucherRevenue)} />
            <StatCard label="Số đơn hợp lệ" value={String(m.orderCount)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            <StatCard label="Đang phải trả Seller" value={formatVND(m.payableToSellers)} hint="Đơn online chưa đối soát" />
            <StatCard label="Seller phải trả sàn" value={formatVND(m.receivableFromSellers)} hint="Hoa hồng COD chưa đối soát" />
            <StatCard label="Đã thanh toán Seller" value={formatVND(m.paidToSellers)} hint="Các đợt đã chi trả" />
          </div>

          <div className="rounded-2xl border border-brand/10 bg-white p-4 mb-6">
            <h2 className="font-display text-lg font-bold mb-3">Hoa hồng theo thời gian</h2>
            <FeeChart data={data!.commissionSeries} />
          </div>

          <div className="rounded-2xl border border-brand/10 bg-white p-4">
            <h2 className="font-display text-lg font-bold mb-3">Hoa hồng theo gian hàng</h2>
            {data!.byShop.length === 0 ? <p className="text-sm text-ink/40">Chưa có dữ liệu trong kỳ.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink/50 border-b border-brand/10">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Gian hàng</th>
                      <th className="py-2 pr-3 font-medium text-right">Giá trị tính phí</th>
                      <th className="py-2 font-medium text-right">Hoa hồng sàn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.byShop.map((s, i) => (
                      <tr key={s.sellerId} className="border-b border-brand/5 last:border-0">
                        <td className="py-2 pr-3 text-ink/40">{i + 1}</td>
                        <td className="py-2 pr-3">{s.shopName}</td>
                        <td className="py-2 pr-3 text-right font-medium">{formatVND(s.base)}</td>
                        <td className="py-2 text-right text-brand font-medium">{formatVND(s.commission)}</td>
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

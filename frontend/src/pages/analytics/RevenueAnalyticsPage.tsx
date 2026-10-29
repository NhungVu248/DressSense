import { useQuery } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import { getRevenueAnalytics } from '../../lib/analytics';
import { usePeriod, PeriodBar, PageHead, StatCard, RevenueChart, StateMsg } from './_shared';

// UC15.4 - Thống kê doanh thu
export default function RevenueAnalyticsPage() {
  const p = usePeriod();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['an-revenue', p.params], queryFn: () => getRevenueAnalytics(p.params!), enabled: !!p.params,
  });
  const m = data?.metrics;
  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <PageHead kicker="Phân tích · UC15.4" title="Thống kê doanh thu" />
      <PeriodBar {...p} />
      <StateMsg loading={isLoading} error={isError} />
      {m && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Tổng doanh thu" value={formatVND(m.revenue)} delta={data!.compare.revenue} accent />
            <StatCard label="Doanh thu thực nhận" value={formatVND(m.netRevenue)} delta={data!.compare.netRevenue} hint="Sau khi trừ hoàn tiền" />
            <StatCard label="Số đơn hàng" value={String(m.orderCount)} delta={data!.compare.orderCount} />
            <StatCard label="Số khách mua" value={String(m.customers)} delta={data!.compare.customers} />
            <StatCard label="Sản phẩm đã bán" value={String(m.soldQuantity)} />
            <StatCard label="Giá trị đơn trung bình" value={formatVND(m.avgOrderValue)} />
            <StatCard label="Tiền hoàn trả" value={formatVND(m.refundAmount)} />
          </div>
          <div className="rounded-2xl border border-brand/10 bg-white p-4 mb-6">
            <h2 className="font-display text-lg font-bold mb-3">Doanh thu theo thời gian</h2>
            <RevenueChart data={data!.timeSeries} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-brand/10 bg-white p-4">
              <h2 className="font-display text-lg font-bold mb-3">Sản phẩm bán chạy</h2>
              {data!.bestSellers.length === 0 ? <p className="text-sm text-ink/40">Chưa có dữ liệu.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-ink/50 border-b border-brand/10"><th className="py-1.5">Sản phẩm</th><th className="py-1.5 text-right">Đã bán</th><th className="py-1.5 text-right">Doanh thu</th></tr></thead>
                  <tbody>{data!.bestSellers.map((b) => (
                    <tr key={b.productId} className="border-b border-brand/5 last:border-0"><td className="py-1.5 pr-2">{b.name}</td><td className="py-1.5 text-right">{b.quantity}</td><td className="py-1.5 text-right text-brand font-medium">{formatVND(b.revenue)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="rounded-2xl border border-brand/10 bg-white p-4">
              <h2 className="font-display text-lg font-bold mb-3">Tỷ trọng doanh thu theo danh mục</h2>
              {data!.categoryShare.length === 0 ? <p className="text-sm text-ink/40">Chưa có dữ liệu.</p> : (
                <div className="space-y-2">{data!.categoryShare.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-0.5"><span className="text-ink/70">{c.name}</span><span className="text-ink/50">{c.pct}% · {formatVND(c.revenue)}</span></div>
                    <div className="h-2 rounded-full bg-brand/10 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${c.pct}%` }} /></div>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

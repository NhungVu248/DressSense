import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatVND } from '../../lib/products';
import { getAdminDashboard } from '../../lib/admin';
import { usePeriod, PeriodBar, StatCard, RevenueChart, StateMsg } from '../analytics/_shared';

// UC16.1 - Dashboard quản trị (tổng hợp + điều hướng)
function TodoCard({ to, label, count, tone }: { to: string; label: string; count: number; tone: string }) {
  return (
    <Link to={to} className={`rounded-2xl border p-4 flex items-center justify-between transition-colors hover:shadow-sm ${count > 0 ? tone : 'border-brand/10 bg-white'}`}>
      <span className="text-sm font-medium text-ink/80">{label}</span>
      <span className={`font-display text-2xl font-bold ${count > 0 ? '' : 'text-ink/30'}`}>{count}</span>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const p = usePeriod();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dashboard', p.params], queryFn: () => getAdminDashboard(p.params!), enabled: !!p.params,
  });
  const k = data?.kpis;
  const maxU = data ? Math.max(...data.newUserSeries.map((d) => d.count), 1) : 1;

  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-ink/40">UC16.1 · Quản trị hệ thống</p>
        <h1 className="font-display text-3xl font-bold">Tổng quan</h1>
      </div>
      <PeriodBar {...p} />
      <StateMsg loading={isLoading} error={isError} />

      {k && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Khách hàng" value={String(k.customers)} />
            <StatCard label="Người bán" value={String(k.sellers)} />
            <StatCard label="Gian hàng hoạt động" value={String(k.activeShops)} />
            <StatCard label="Sản phẩm đang bán" value={String(k.activeProducts)} />
            <StatCard label="Đơn hàng (kỳ)" value={String(k.totalOrders)} />
            <StatCard label="Doanh thu (kỳ)" value={formatVND(k.revenue)} accent />
            <StatCard label="Đơn đã hủy" value={String(k.cancelledOrders)} />
            <StatCard label="Tiền hoàn trả" value={formatVND(k.refundAmount)} />
          </div>

          {/* Mục cần xử lý */}
          <h2 className="font-display text-lg font-bold mb-3">Cần xử lý</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <TodoCard to="/admin/shops" label="Gian hàng chờ duyệt" count={data!.todo.pendingShops} tone="border-amber-200 bg-amber-50" />
            <TodoCard to="/admin/content" label="Sản phẩm chờ duyệt" count={data!.todo.pendingProducts} tone="border-amber-200 bg-amber-50" />
            <TodoCard to="/admin/complaints" label="Khiếu nại cần phân xử" count={data!.todo.escalatedComplaints} tone="border-red-200 bg-red-50" />
            <TodoCard to="/admin/reviews" label="Đánh giá bị ẩn" count={data!.todo.hiddenReviews} tone="border-sky-200 bg-sky-50" />
          </div>

          {/* Biểu đồ */}
          <div className="rounded-2xl border border-brand/10 bg-white p-4 mb-4">
            <h2 className="font-display text-lg font-bold mb-3">Doanh thu theo thời gian</h2>
            <RevenueChart data={data!.revenueSeries} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-brand/10 bg-white p-4">
              <h2 className="font-display text-lg font-bold mb-3">Người dùng mới</h2>
              {data!.newUserSeries.length === 0 ? <p className="text-sm text-ink/40">Chưa có người dùng mới trong kỳ.</p> : (
                <div className="space-y-2">
                  {data!.newUserSeries.map((d) => (
                    <div key={d.date} className="flex items-center gap-2 text-sm">
                      <span className="w-16 text-ink/50 text-xs">{d.date.slice(5)}</span>
                      <div className="flex-1 h-3 rounded-full bg-brand/10 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${(d.count / maxU) * 100}%` }} /></div>
                      <span className="w-8 text-right text-ink/60">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-brand/10 bg-white p-4">
              <h2 className="font-display text-lg font-bold mb-3">Sản phẩm bán chạy</h2>
              {data!.bestSellers.length === 0 ? <p className="text-sm text-ink/40">Chưa có dữ liệu.</p> : (
                <table className="w-full text-sm">
                  <tbody>{data!.bestSellers.map((b, i) => (
                    <tr key={b.productId} className="border-b border-brand/5 last:border-0">
                      <td className="py-1.5 text-ink/40 w-6">{i + 1}</td><td className="py-1.5 pr-2">{b.name}</td>
                      <td className="py-1.5 text-right">{b.quantity}</td><td className="py-1.5 text-right text-brand font-medium">{formatVND(b.revenue)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

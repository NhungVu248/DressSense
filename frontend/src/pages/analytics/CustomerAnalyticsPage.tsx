import { useQuery } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import { getCustomerAnalytics } from '../../lib/analytics';
import { usePeriod, PeriodBar, PageHead, StatCard, BarList, StateMsg } from './_shared';

// UC15.1 - Phân tích khách hàng
export default function CustomerAnalyticsPage() {
  const p = usePeriod();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['an-customers', p.params], queryFn: () => getCustomerAnalytics(p.params!), enabled: !!p.params,
  });
  const m = data?.metrics;
  const t = data?.trends;
  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <PageHead kicker="Phân tích · UC15.1" title="Phân tích khách hàng" />
      <PeriodBar {...p} />
      <StateMsg loading={isLoading} error={isError} />
      {m && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            <StatCard label="Tổng khách mua" value={String(m.totalCustomers)} accent />
            <StatCard label="Khách mới" value={String(m.newCustomers)} />
            <StatCard label="Khách quay lại" value={String(m.returningCustomers)} hint={`Tỷ lệ quay lại ${m.returnRate}%`} />
            <StatCard label="Giá trị mua TB" value={formatVND(m.avgPurchaseValue)} />
            <StatCard label="Tần suất mua" value={`${m.purchaseFrequency} đơn/khách`} />
          </div>
          {m.totalCustomers === 0 && <StateMsg empty emptyText="Chưa có khách mua trong kỳ để phân tích xu hướng." />}
          {t && m.totalCustomers > 0 && (
            <>
              <h2 className="font-display text-lg font-bold mb-3">Xu hướng quan tâm</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BarList title="Phong cách được mua nhiều" items={t.styles} />
                <BarList title="Màu sắc ưa chuộng" items={t.colors} />
                <BarList title="Danh mục được mua nhiều" items={t.categories} />
                <BarList title="Khoảng giá quan tâm" items={t.priceRanges} />
                <BarList title="Sản phẩm được xem nhiều" items={t.mostViewed} />
                <BarList title="Sản phẩm thêm giỏ nhiều" items={t.mostAddedToCart} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

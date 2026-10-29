import { useQuery } from '@tanstack/react-query';
import { getBehaviorAnalytics } from '../../lib/analytics';
import { usePeriod, PeriodBar, PageHead, StateMsg } from './_shared';

// UC15.2 - Phân tích hành vi (phễu chuyển đổi)
export default function BehaviorAnalyticsPage() {
  const p = usePeriod();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['an-behavior', p.params], queryFn: () => getBehaviorAnalytics(p.params!), enabled: !!p.params,
  });
  const max = data ? Math.max(...data.funnel.map((f) => f.count), 1) : 1;
  return (
    <div className="p-5 md:p-8 max-w-3xl">
      <PageHead kicker="Phân tích · UC15.2" title="Phân tích hành vi" />
      <PeriodBar {...p} />
      <StateMsg loading={isLoading} error={isError} />
      {data && (
        <>
          <div className="rounded-2xl border border-brand/10 bg-white p-5 mb-4">
            <h2 className="font-display text-lg font-bold mb-4">Phễu chuyển đổi</h2>
            <div className="space-y-3">
              {data.funnel.map((f, i) => (
                <div key={f.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-ink/80">{f.label}</span>
                    <span className="text-ink/50">
                      {f.count.toLocaleString('vi-VN')}
                      {i > 0 && <span className="ml-2 text-xs">(chuyển đổi {f.stepRate}%)</span>}
                    </span>
                  </div>
                  <div className="h-7 rounded-lg bg-brand/10 overflow-hidden">
                    <div className="h-full bg-brand rounded-lg flex items-center justify-end px-2 text-white text-xs font-medium"
                      style={{ width: `${Math.max((f.count / max) * 100, f.count > 0 ? 6 : 0)}%` }}>
                      {f.ofTop > 0 && `${f.ofTop}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {data.biggestDropOff && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
              ⚠️ Bước rời bỏ cao nhất: <b>{data.biggestDropOff.from} → {data.biggestDropOff.to}</b> (giảm {data.biggestDropOff.dropPct}%). Nên tối ưu bước này.
            </div>
          )}
          <p className="text-xs text-ink/40 mt-3">
            Phễu dựa trên sự kiện đã ghi nhận (xem, wishlist, giỏ hàng) và đơn hàng. Bước "Truy cập" cần bật theo dõi phiên để đo đầy đủ.
          </p>
        </>
      )}
    </div>
  );
}

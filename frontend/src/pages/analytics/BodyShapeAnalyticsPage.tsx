import { useQuery } from '@tanstack/react-query';
import { getBodyShapeAnalytics } from '../../lib/analytics';
import { usePeriod, PeriodBar, PageHead, StateMsg } from './_shared';

// UC15.3 - Phân tích dáng người (ẩn danh, tổng hợp)
export default function BodyShapeAnalyticsPage() {
  const p = usePeriod();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['an-body', p.params], queryFn: () => getBodyShapeAnalytics(p.params!), enabled: !!p.params,
  });
  const shapeMax = data?.enough ? Math.max(...data.shapes.map((s) => s.count), 1) : 1;
  return (
    <div className="p-5 md:p-8 max-w-4xl">
      <PageHead kicker="Phân tích · UC15.3" title="Phân tích dáng người" />
      <p className="text-sm text-ink/50 -mt-2 mb-4">Dữ liệu tổng hợp & ẩn danh từ hồ sơ dáng người (UC3) — không hiển thị ảnh hay số đo cá nhân.</p>
      <PeriodBar {...p} />
      <StateMsg loading={isLoading} error={isError} />
      {data && !data.enough && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 text-ink/60 text-sm px-4 py-3">
          Chưa đủ dữ liệu để hiển thị (cần tối thiểu {data.minSample} mẫu, hiện có {data.total}).
        </div>
      )}
      {data && data.enough && (
        <>
          <p className="text-sm text-ink/50 mb-3">Dựa trên <b>{data.total}</b> hồ sơ dáng người.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-brand/10 bg-white p-4">
              <h2 className="font-display text-lg font-bold mb-3">Phân bố nhóm dáng người</h2>
              <div className="space-y-2">
                {data.shapes.map((s) => (
                  <div key={s.key}>
                    <div className="flex justify-between text-sm mb-0.5"><span className="text-ink/70">{s.label}</span><span className="text-ink/50">{s.pct}% ({s.count})</span></div>
                    <div className="h-2.5 rounded-full bg-brand/10 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${(s.count / shapeMax) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-brand/10 bg-white p-4">
              <h2 className="font-display text-lg font-bold mb-3">Phân bố size ước lượng</h2>
              {data.sizes.length === 0 ? (
                <p className="text-sm text-ink/40">Chưa đủ dữ liệu số đo để ước lượng size.</p>
              ) : (
                <>
                  {data.popularSize && <p className="text-sm text-ink/60 mb-2">Size phổ biến nhất: <b className="text-brand">{data.popularSize}</b></p>}
                  <div className="grid grid-cols-4 gap-2">
                    {data.sizes.map((s) => (
                      <div key={s.name} className="rounded-xl border border-brand/10 p-3 text-center">
                        <p className="font-display text-xl font-bold">{s.name}</p>
                        <p className="text-xs text-ink/50">{s.pct}% ({s.count})</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-ink/40 mt-4">Dùng để tham khảo kế hoạch sản phẩm và tồn kho theo nhu cầu dáng/size của khách.</p>
        </>
      )}
    </div>
  );
}

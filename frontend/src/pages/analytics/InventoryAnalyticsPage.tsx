import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInventoryAnalytics, type InventoryItem } from '../../lib/analytics';
import { PageHead, StatCard, StateMsg } from './_shared';

// UC15.5 - Phân tích tồn kho
const HORIZONS = [7, 14, 30, 60];
const STATUS: Record<InventoryItem['status'], { label: string; cls: string }> = {
  LOW: { label: 'Sắp hết', cls: 'bg-red-100 text-red-600' },
  NORMAL: { label: 'Bình thường', cls: 'bg-green-100 text-green-700' },
  OVERSTOCK: { label: 'Tồn cao', cls: 'bg-amber-100 text-amber-700' },
};

export default function InventoryAnalyticsPage() {
  const [horizon, setHorizon] = useState(30);
  const [filter, setFilter] = useState<'' | InventoryItem['status']>('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['an-inventory', horizon], queryFn: () => getInventoryAnalytics({ horizon }),
  });
  const items = (data?.items ?? []).filter((i) => !filter || i.status === filter);

  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <PageHead kicker="Phân tích · UC15.5" title="Phân tích tồn kho" />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-sm text-ink/50">Khoảng dự báo:</span>
        {HORIZONS.map((h) => (
          <button key={h} onClick={() => setHorizon(h)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${horizon === h ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70 hover:border-brand/50'}`}>
            {h} ngày
          </button>
        ))}
      </div>
      <StateMsg loading={isLoading} error={isError} />
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard label="Tổng biến thể (SKU)" value={String(data.summary.totalVariants)} accent />
            <StatCard label="Sắp hết hàng" value={String(data.summary.low)} />
            <StatCard label="Bình thường" value={String(data.summary.normal)} />
            <StatCard label="Nguy cơ tồn cao" value={String(data.summary.overstock)} />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {([['', 'Tất cả'], ['LOW', 'Sắp hết'], ['NORMAL', 'Bình thường'], ['OVERSTOCK', 'Tồn cao']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v as any)}
                className={`px-3 py-1 rounded-full text-sm border ${filter === v ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70 hover:border-brand/50'}`}>{l}</button>
            ))}
          </div>

          <div className="rounded-2xl border border-brand/10 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-ink/50 border-b border-brand/10">
                  <th className="py-2.5 px-3">Sản phẩm</th><th className="px-2">Size</th>
                  <th className="px-2 text-right">Khả dụng</th><th className="px-2 text-right">Đã bán ({data.lookbackDays}n)</th>
                  <th className="px-2 text-right">Tốc độ/ngày</th><th className="px-2 text-right">Dự báo {horizon}n</th>
                  <th className="px-2 text-right">Ngày tồn</th><th className="px-2 text-right">Đề xuất nhập</th><th className="px-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.variantId} className="border-b border-brand/5 last:border-0">
                    <td className="py-2 px-3">{i.product}<span className="text-ink/40 text-xs block">{i.category}</span></td>
                    <td className="px-2">{i.size}</td>
                    <td className="px-2 text-right">{i.available}<span className="text-ink/30 text-xs"> /{i.stock}</span></td>
                    <td className="px-2 text-right">{i.sold}</td>
                    <td className="px-2 text-right">{i.sellRate}</td>
                    <td className="px-2 text-right">{i.forecast}</td>
                    <td className="px-2 text-right">{i.daysOfCover ?? '—'}</td>
                    <td className="px-2 text-right font-medium">{i.suggestedReorder > 0 ? <span className="text-brand">+{i.suggestedReorder}</span> : '0'}</td>
                    <td className="px-3 text-right"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-ink/40">Không có biến thể nào.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink/40 mt-3">Dự báo chỉ hỗ trợ ra quyết định, không tự thay đổi tồn kho. Khả dụng = tồn kho − đang giữ cho đơn chưa hoàn tất.</p>
        </>
      )}
    </div>
  );
}

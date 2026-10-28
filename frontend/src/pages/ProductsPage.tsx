import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  fetchProducts, fetchFacets, formatVND, colorHex,
  type SortKey, type ListParams,
} from '../lib/products';
import ProductCard from '../components/ProductCard';
import HomePromos from '../components/HomePromos';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'bestselling', label: 'Bán chạy' },
  { key: 'price_asc', label: 'Giá: thấp → cao' },
  { key: 'price_desc', label: 'Giá: cao → thấp' },
];

function csv(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}

export default function ProductsPage() {
  const [sp, setSp] = useSearchParams();
  const [showFilter, setShowFilter] = useState(false); // bộ lọc trên điện thoại

  // Đọc trạng thái lọc từ URL (chia sẻ/định tuyến được)
  const q = sp.get('q') ?? '';
  const categoryId = sp.get('categoryId') ? Number(sp.get('categoryId')) : undefined;
  const sizes = csv(sp.get('size'));
  const colors = csv(sp.get('color'));
  const styles = csv(sp.get('style'));
  const minPrice = sp.get('minPrice') ? Number(sp.get('minPrice')) : undefined;
  const maxPrice = sp.get('maxPrice') ? Number(sp.get('maxPrice')) : undefined;
  const sort = (sp.get('sort') as SortKey) || 'newest';

  const params: ListParams = { q, categoryId, size: sizes, color: colors, style: styles, minPrice, maxPrice, sort, limit: 24 };

  const { data: facets } = useQuery({ queryKey: ['facets'], queryFn: fetchFacets, staleTime: 5 * 60 * 1000 });
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', sp.toString()],
    queryFn: () => fetchProducts(params),
    placeholderData: keepPreviousData,
  });

  const activeCount = (categoryId ? 1 : 0) + sizes.length + colors.length + styles.length + (minPrice != null ? 1 : 0) + (maxPrice != null ? 1 : 0);

  // Cập nhật 1 tham số (giữ nguyên các tham số khác)
  function patch(next: Record<string, string | null>) {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(next)) { if (v == null || v === '') n.delete(k); else n.set(k, v); }
    setSp(n, { replace: true });
  }
  function toggleMulti(key: 'size' | 'color' | 'style', val: string) {
    const cur = csv(sp.get(key));
    const nextArr = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    patch({ [key]: nextArr.join(',') || null });
  }
  function clearAll() {
    const n = new URLSearchParams();
    if (q) n.set('q', q); // giữ từ khóa tìm kiếm, chỉ xóa bộ lọc
    setSp(n, { replace: true });
  }

  const Sidebar = (
    <FilterPanel
      facets={facets} categoryId={categoryId} sizes={sizes} colors={colors} styles={styles}
      minPrice={minPrice} maxPrice={maxPrice} activeCount={activeCount}
      onCategory={(id) => patch({ categoryId: categoryId === id ? null : String(id) })}
      onToggle={toggleMulti}
      onPrice={(min, max) => patch({ minPrice: min == null ? null : String(min), maxPrice: max == null ? null : String(max) })}
      onClear={clearAll}
    />
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* UC13 - banner & Flash Sale (chỉ ở trang chủ, khi không tìm kiếm/lọc) */}
      {!q && activeCount === 0 && <HomePromos />}

      {/* Tiêu đề */}
      <div className="mb-6">
        {q ? (
          <>
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Kết quả tìm kiếm</p>
            <h1 className="font-display text-3xl text-ink mt-1">“{q}”</h1>
          </>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Tìm thấy điều bạn yêu</p>
            <h1 className="font-display text-3xl text-ink mt-1">Khám phá sản phẩm</h1>
          </>
        )}
        {data && <p className="text-sm text-gray-500 mt-1">{data.total} sản phẩm</p>}
      </div>

      {/* Thanh công cụ: bộ lọc (mobile) + sắp xếp */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <button onClick={() => setShowFilter(true)} className="lg:hidden inline-flex items-center gap-2 text-sm border border-black/10 rounded-full px-4 py-2">
          Bộ lọc{activeCount > 0 && <span className="bg-brand text-white text-[10px] px-1.5 rounded-full">{activeCount}</span>}
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label className="text-gray-500 hidden sm:inline">Sắp xếp:</label>
          <select
            value={sort}
            onChange={(e) => patch({ sort: e.target.value })}
            className="border border-black/10 rounded-full px-3 py-2 bg-white text-ink focus:outline-none focus:border-brand"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Bộ lọc - desktop */}
        <aside className="hidden lg:block w-60 shrink-0">{Sidebar}</aside>

        {/* Lưới sản phẩm */}
        <div className="flex-1 min-w-0">
          {error ? (
            <EmptyBox title="Không tải được sản phẩm" hint="Kiểm tra backend đã chạy chưa, rồi thử lại." />
          ) : isLoading && !data ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse"><div className="aspect-[4/5] rounded-lg bg-black/5" /><div className="h-3 bg-black/5 rounded mt-3 w-2/3" /><div className="h-3 bg-black/5 rounded mt-2 w-1/3" /></div>
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-8">
              {data.items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          ) : (
            <EmptyBox
              title="Không tìm thấy sản phẩm phù hợp"
              hint={activeCount > 0 ? 'Hãy thử bỏ bớt bộ lọc hoặc đổi từ khóa.' : 'Hãy thử một từ khóa khác.'}
              action={activeCount > 0 ? { label: 'Xóa bộ lọc', onClick: clearAll } : undefined}
            />
          )}
        </div>
      </div>

      {/* Bộ lọc - điện thoại (ngăn kéo) */}
      {showFilter && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowFilter(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85%] bg-cream p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">Bộ lọc</h2>
              <button onClick={() => setShowFilter(false)} className="text-gray-500">✕</button>
            </div>
            {Sidebar}
            <button onClick={() => setShowFilter(false)} className="w-full mt-5 bg-brand text-white rounded-full py-2.5">Xem {data?.total ?? ''} sản phẩm</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyBox({ title, hint, action }: { title: string; hint?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="text-center py-20 border border-dashed border-black/10 rounded-xl">
      <p className="font-display text-xl text-ink">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-2">{hint}</p>}
      {action && <button onClick={action.onClick} className="mt-4 text-sm text-brand underline underline-offset-2">{action.label}</button>}
    </div>
  );
}

/* ---- Khu vực bộ lọc (UC7.2) ---- */
function FilterPanel(props: {
  facets?: import('../lib/products').Facets;
  categoryId?: number; sizes: string[]; colors: string[]; styles: string[];
  minPrice?: number; maxPrice?: number; activeCount: number;
  onCategory: (id: number) => void;
  onToggle: (key: 'size' | 'color' | 'style', val: string) => void;
  onPrice: (min: number | null, max: number | null) => void;
  onClear: () => void;
}) {
  const { facets } = props;
  const [min, setMin] = useState(props.minPrice?.toString() ?? '');
  const [max, setMax] = useState(props.maxPrice?.toString() ?? '');
  const priceErr = useMemo(() => (min && max && Number(min) > Number(max) ? 'Giá tối thiểu lớn hơn giá tối đa' : ''), [min, max]);

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Bộ lọc</h2>
        {props.activeCount > 0 && <button onClick={props.onClear} className="text-xs text-brand hover:underline">Xóa tất cả</button>}
      </div>

      {/* Danh mục */}
      <Section title="Danh mục">
        <ul className="space-y-1.5">
          {facets?.categories.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-ink">
                <input type="checkbox" checked={props.categoryId === c.id} onChange={() => props.onCategory(c.id)} className="accent-brand" />
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-gray-400">{c.count}</span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      {/* Khoảng giá */}
      <Section title="Khoảng giá">
        <div className="flex items-center gap-2">
          <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder={facets ? formatVND(facets.priceMin) : 'Từ'} className="w-full border border-black/10 rounded-lg px-2.5 py-1.5 text-xs" />
          <span className="text-gray-300">–</span>
          <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} placeholder={facets ? formatVND(facets.priceMax) : 'Đến'} className="w-full border border-black/10 rounded-lg px-2.5 py-1.5 text-xs" />
        </div>
        {priceErr && <p className="text-xs text-red-500 mt-1.5">{priceErr}</p>}
        <button
          disabled={!!priceErr}
          onClick={() => props.onPrice(min ? Number(min) : null, max ? Number(max) : null)}
          className="mt-2 w-full border border-brand/30 text-brand rounded-lg py-1.5 text-xs hover:bg-brand-light disabled:opacity-40"
        >
          Áp dụng
        </button>
      </Section>

      {/* Kích cỡ */}
      {facets && facets.sizes.length > 0 && (
        <Section title="Kích cỡ">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button key={s} onClick={() => props.onToggle('size', s)}
                className={`min-w-9 h-9 px-2 rounded-md border text-xs transition-colors ${props.sizes.includes(s) ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600 hover:border-brand'}`}>
                {s}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Màu sắc */}
      {facets && facets.colors.length > 0 && (
        <Section title="Màu sắc">
          <div className="flex flex-wrap gap-2.5">
            {facets.colors.map((c) => (
              <button key={c} onClick={() => props.onToggle('color', c)} title={c}
                className={`w-7 h-7 rounded-full border-2 transition ${props.colors.includes(c) ? 'border-brand ring-2 ring-brand/30' : 'border-black/10'}`}
                style={{ background: colorHex(c) }} aria-label={c} />
            ))}
          </div>
        </Section>
      )}

      {/* Phong cách */}
      {facets && facets.styles.length > 0 && (
        <Section title="Phong cách">
          <div className="flex flex-wrap gap-2">
            {facets.styles.map((s) => (
              <button key={s} onClick={() => props.onToggle('style', s)}
                className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${props.styles.includes(s) ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600 hover:border-brand'}`}>
                {s}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-black/5 pt-4 first:border-0 first:pt-0">
      <h3 className="font-medium text-ink mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchShop } from '../lib/storefront';
import { openConversation } from '../lib/messages';
import { useAuth } from '../context/AuthContext';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';
import ProductCard from '../components/ProductCard';

// Ảnh tải lên có URL tương đối /uploads/... -> thêm origin của API để hiển thị
const MEDIA_ORIGIN = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');
const mediaUrl = (u?: string | null) => (!u ? '' : u.startsWith('http') ? u : MEDIA_ORIGIN + u);

export default function ShopPage() {
  const { sellerId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [catId, setCatId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['shop', sellerId], queryFn: () => fetchShop(sellerId!), enabled: !!sellerId });

  const shown = useMemo(
    () => (catId == null ? data?.products ?? [] : (data?.products ?? []).filter((p) => p.category.id === catId)),
    [data, catId],
  );

  async function contact() {
    if (!user) { nav('/login'); return; }
    try { const cid = await openConversation({ type: 'SELLER', sellerId: Number(sellerId) }); nav(`/messages?c=${cid}`); } catch { /* bỏ qua */ }
  }

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải gian hàng…</p>;
  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <p className="font-display text-2xl text-ink">Gian hàng không khả dụng</p>
        <p className="text-sm text-gray-500 mt-2">Gian hàng có thể chưa hoạt động hoặc không tồn tại.</p>
        <Link to="/" className="inline-block mt-5 bg-brand text-white rounded-full px-5 py-2.5 text-sm">← Về trang chủ</Link>
      </div>
    );
  }

  const { shop, stats, categories, featured } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Banner gian hàng */}
      <div className="relative rounded-2xl overflow-hidden bg-brand-light">
        <div className="h-40 sm:h-52 w-full bg-brand-light">
          {shop.coverUrl
            ? <img src={mediaUrl(shop.coverUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            : <div className="w-full h-full bg-gradient-to-r from-brand/20 via-brand-light to-brand/10" />}
        </div>
        <div className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shadow -mt-12 border-4 border-white shrink-0">
            <img src={mediaUrl(shop.logoUrl) || PRODUCT_PLACEHOLDER} alt={shop.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }} />
          </div>
          <div className="flex-1 min-w-48">
            <h1 className="font-display text-2xl text-ink">{shop.name}</h1>
            {shop.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2 max-w-xl">{shop.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span>{stats.productCount} sản phẩm</span>
              <span>Đã bán {stats.soldTotal}</span>
              {stats.ratingCount > 0 && <span className="text-amber-500">★ {stats.ratingAvg.toFixed(1)} <span className="text-gray-400">({stats.ratingCount})</span></span>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={contact} className="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm inline-flex items-center gap-2">
              💬 Liên hệ shop
            </button>
            {(shop.contactPhone || shop.contactEmail) && (
              <span className="text-[11px] text-gray-400 text-center">{shop.contactPhone || shop.contactEmail}</span>
            )}
          </div>
        </div>
      </div>

      {/* Danh mục của gian hàng */}
      {categories.length > 0 && (
        <div className="mt-6 flex gap-2 flex-wrap">
          <button onClick={() => setCatId(null)} className={`text-sm rounded-full px-4 py-1.5 border transition-colors ${catId == null ? 'bg-brand text-white border-brand' : 'border-black/15 text-ink hover:border-brand'}`}>
            Tất cả
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCatId(c.id)} className={`text-sm rounded-full px-4 py-1.5 border transition-colors ${catId === c.id ? 'bg-brand text-white border-brand' : 'border-black/15 text-ink hover:border-brand'}`}>
              {c.name} <span className="text-xs opacity-70">({c.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Sản phẩm nổi bật (chỉ hiện khi đang xem tất cả) */}
      {catId == null && featured.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink mb-4 flex items-center gap-2">⭐ Sản phẩm nổi bật</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-8">
            {featured.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Toàn bộ sản phẩm (lọc theo danh mục) */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-ink mb-4">
          {catId == null ? 'Tất cả sản phẩm' : categories.find((c) => c.id === catId)?.name ?? 'Sản phẩm'}
          <span className="text-sm text-gray-400 ml-2">· {shown.length}</span>
        </h2>
        {shown.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">Gian hàng chưa có sản phẩm trong danh mục này.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-8">
            {shown.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}

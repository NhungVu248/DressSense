import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';
import { formatVND, colorHex } from '../lib/products';
import { getWishlist, removeWishlist, wishlistToCart, type WishlistItem } from '../lib/cart';

export default function WishlistPage() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useQuery({ queryKey: ['wishlist'], queryFn: getWishlist });

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải danh sách yêu thích…</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-1">Sản phẩm yêu thích</h1>
      <p className="text-sm text-gray-500 mb-6">{items?.length ?? 0} sản phẩm đã lưu</p>

      {!items || items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-black/10 rounded-xl">
          <p className="font-display text-xl text-ink">Chưa có sản phẩm yêu thích</p>
          <p className="text-sm text-gray-500 mt-2">Bấm ♡ trên sản phẩm để lưu lại xem sau.</p>
          <Link to="/" className="inline-block mt-4 bg-brand text-white rounded-full px-5 py-2.5 text-sm">Khám phá sản phẩm</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
          {items.map((it) => <WishCard key={it.productId} it={it} onChange={() => { qc.invalidateQueries({ queryKey: ['wishlist'] }); qc.invalidateQueries({ queryKey: ['wishlist-ids'] }); }} onCart={() => qc.invalidateQueries({ queryKey: ['cart-count'] })} />)}
        </div>
      )}
    </div>
  );
}

function WishCard({ it, onChange, onCart }: { it: WishlistItem; onChange: () => void; onCart: () => void }) {
  const firstAvail = it.sizes.find((s) => s.available > 0)?.id ?? it.sizes[0]?.id ?? null;
  const [variantId, setVariantId] = useState<number | null>(firstAvail);
  const [busy, setBusy] = useState(false);
  const canBuy = it.sellable && it.inStock;

  async function addToCart() {
    setBusy(true);
    try {
      await wishlistToCart(it.productId, variantId);
      onCart();
      alert('Đã thêm vào giỏ hàng.');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Không thêm được vào giỏ.'); // 7a/14E
    } finally { setBusy(false); }
  }
  async function remove() { await removeWishlist(it.productId); onChange(); }

  return (
    <div className="group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-brand-light">
        <Link to={`/products/${it.productId}`}>
          <img src={it.image || PRODUCT_PLACEHOLDER} alt={it.name} onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        </Link>
        <button onClick={remove} className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full bg-white/85 text-red-500 shadow-sm" title="Bỏ yêu thích">♥</button>
        {!canBuy && <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-xs text-center py-1.5">{it.sellable ? 'Tạm hết hàng' : 'Ngừng bán'}</span>}
      </div>
      <div className="pt-3">
        <div className="flex items-center gap-1.5 mb-1">
          {it.color && <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: colorHex(it.color) }} />}
          <span className="text-[11px] uppercase tracking-wide text-gray-400">{it.category?.name}</span>
        </div>
        <Link to={`/products/${it.productId}`} className="font-medium text-sm text-ink line-clamp-1 hover:text-brand">{it.name}</Link>
        <p className="mt-1 font-semibold text-ink">{formatVND(it.price)}</p>

        <div className="mt-2 flex items-center gap-2">
          {it.sizes.length > 0 && (
            <select value={variantId ?? ''} onChange={(e) => setVariantId(Number(e.target.value))} disabled={!canBuy}
              className="text-xs border border-black/10 rounded-md px-2 py-1.5 bg-white disabled:opacity-50">
              {it.sizes.map((s) => <option key={s.id} value={s.id} disabled={s.available <= 0}>{s.size}{s.available <= 0 ? ' (hết)' : ''}</option>)}
            </select>
          )}
          <button onClick={addToCart} disabled={!canBuy || busy}
            className="flex-1 bg-brand hover:bg-brand-dark disabled:opacity-40 text-white rounded-md py-1.5 text-xs">
            {busy ? '...' : 'Thêm vào giỏ'}
          </button>
        </div>
      </div>
    </div>
  );
}

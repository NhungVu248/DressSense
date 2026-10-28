import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { recordBehavior } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { addWishlist, removeWishlist, getWishlistIds } from '../lib/cart';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';
import {
  type ProductCard as Product, formatVND, primaryImage, isNew, colorHex,
} from '../lib/products';

// Ngôi sao đánh giá (UC7.1/7.4 - hiển thị rating trên thẻ sản phẩm)
function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500 tracking-tight" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}>{value >= i ? '★' : value >= i - 0.5 ? '⯨' : '☆'}</span>
      ))}
    </span>
  );
}

function WishlistButton({ productId }: { productId: number }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: ids } = useQuery({ queryKey: ['wishlist-ids'], queryFn: getWishlistIds, enabled: !!user, staleTime: 60_000 });
  const liked = !!ids?.includes(productId);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { nav('/login'); return; } // UC8.2 3E - cần đăng nhập
    try {
      if (liked) await removeWishlist(productId);
      else { await addWishlist(productId); recordBehavior(productId, 'WISHLIST'); }
      qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
      qc.invalidateQueries({ queryKey: ['wishlist'] });
    } catch { /* bỏ qua lỗi tạm thời */ }
  }

  return (
    <button
      onClick={toggle}
      className={`absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full backdrop-blur
        bg-white/80 shadow-sm transition-colors ${liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
      title={liked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'} aria-label="Yêu thích"
    >
      {liked ? '♥' : '♡'}
    </button>
  );
}

export default function ProductCard({ p }: { p: Product }) {
  const onSale = !!p.onSale && p.salePrice != null; // UC13.1 - đang Flash Sale
  const badge = onSale ? { text: 'FLASH SALE', cls: 'bg-red-600 text-white' }
    : isNew(p.createdAt) ? { text: 'MỚI', cls: 'bg-white text-ink' }
    : p.soldCount > 0 ? { text: 'BÁN CHẠY', cls: 'bg-brand text-white' } : null;

  return (
    <Link to={`/products/${p.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-brand-light">
        <img
          src={primaryImage(p.images) || PRODUCT_PLACEHOLDER}
          alt={p.name}
          onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {badge && (
          <span className={`absolute top-3 left-3 text-[10px] font-semibold tracking-wide px-2 py-1 rounded ${badge.cls}`}>
            {badge.text}
          </span>
        )}
        <WishlistButton productId={p.id} />
        {!p.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-xs text-center py-1.5">Tạm hết hàng</span>
        )}
      </div>
      <div className="pt-3">
        <div className="flex items-center gap-1.5 mb-1">
          {p.color && <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: colorHex(p.color) }} title={p.color} />}
          <span className="text-[11px] uppercase tracking-wide text-gray-400">{p.category?.name}</span>
        </div>
        <h3 className="font-medium text-sm text-ink line-clamp-1 group-hover:text-brand transition-colors">{p.name}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          {p.ratingCount > 0 ? (
            <><Stars value={p.ratingAvg} /><span>{p.ratingAvg.toFixed(1)} ({p.ratingCount})</span></>
          ) : (
            <span className="text-gray-400">Chưa có đánh giá</span>
          )}
        </div>
        {onSale ? (
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-semibold text-red-600">{formatVND(p.salePrice!)}</span>
            <span className="text-xs text-gray-400 line-through">{formatVND(p.price)}</span>
          </p>
        ) : (
          <p className="mt-1 font-semibold text-ink">{formatVND(p.price)}</p>
        )}
      </div>
    </Link>
  );
}

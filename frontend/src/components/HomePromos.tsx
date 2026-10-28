import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { formatVND } from '../lib/products';

// UC13.2/UC13.1 - Khối khuyến mãi trang chủ: banner Hero + dải Flash Sale.

interface Banner { id: number; imageUrl: string; title: string | null; subtitle: string | null; linkType: string; linkValue: string | null }
interface FlashItem { id: number; productId: number; salePrice: number; originalPrice: number; remaining: number; endsAt: string; product: { id: number; name: string; image: string | null } }

function bannerHref(b: Banner): string {
  switch (b.linkType) {
    case 'PRODUCT': return `/products/${b.linkValue}`;
    case 'CATEGORY': return `/?categoryId=${b.linkValue}`;
    case 'PROMO':
    case 'URL': return b.linkValue || '/';
    default: return '/';
  }
}

// Đếm ngược tới thời điểm sớm nhất kết thúc
function useCountdown(target: string | null) {
  const [left, setLeft] = useState(() => (target ? Math.max(0, new Date(target).getTime() - Date.now()) : 0));
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setLeft(Math.max(0, new Date(target).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d} ngày ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function HomePromos() {
  const { data: banners } = useQuery({
    queryKey: ['home-banner'],
    queryFn: () => api.get('/banners?position=HOME_HERO').then((r) => r.data.banners as Banner[]),
    staleTime: 5 * 60 * 1000,
  });
  const { data: flash } = useQuery({
    queryKey: ['home-flash'],
    queryFn: () => api.get('/promotions/flash-sales/active').then((r) => r.data.items as FlashItem[]),
    staleTime: 60 * 1000,
  });

  const banner = banners?.[0];
  const soonest = flash && flash.length ? flash.reduce((a, b) => (new Date(a.endsAt) < new Date(b.endsAt) ? a : b)).endsAt : null;
  const countdown = useCountdown(soonest);

  return (
    <div className="mb-8 space-y-8">
      {banner && (
        <Link to={bannerHref(banner)} className="block relative rounded-2xl overflow-hidden group">
          <img src={banner.imageUrl} alt={banner.title ?? 'Khuyến mãi'} className="w-full h-48 sm:h-64 object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10 text-white max-w-lg">
            {banner.title && <h2 className="font-display text-2xl sm:text-4xl font-bold">{banner.title}</h2>}
            {banner.subtitle && <p className="mt-2 text-sm sm:text-base text-white/85">{banner.subtitle}</p>}
          </div>
        </Link>
      )}

      {flash && flash.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl text-ink flex items-center gap-2">
              <span className="text-red-600">⚡ Flash Sale</span>
            </h2>
            {countdown && <span className="text-sm text-gray-500">Kết thúc sau <span className="font-mono font-semibold text-red-600">{countdown}</span></span>}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {flash.map((f) => {
              const pct = Math.round(((f.originalPrice - f.salePrice) / f.originalPrice) * 100);
              return (
                <Link key={f.id} to={`/products/${f.productId}`} className="group shrink-0 w-40">
                  <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-brand-light">
                    <img src={f.product.image || 'https://placehold.co/400x500?text=%20'} alt={f.product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">-{pct}%</span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-ink line-clamp-1 group-hover:text-brand">{f.product.name}</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-red-600 text-sm">{formatVND(f.salePrice)}</span>
                    <span className="text-xs text-gray-400 line-through">{formatVND(f.originalPrice)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Còn {f.remaining} suất</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

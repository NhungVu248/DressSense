import { useNavigate } from 'react-router-dom';
import { formatVND } from '../lib/products';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';

export interface OutfitDetailItem {
  id: number;
  name: string;
  slot: string;
  color?: string | null;
  style?: string | null;
  price: number;
  image?: string | null;
}

export interface OutfitDetailData {
  id?: number | string;
  title: string;
  style: string;
  description: string;
  items: OutfitDetailItem[];
  totalPrice?: number;
  coverImage?: string;
  why?: string;
}

interface OutfitDetailModalProps {
  outfit: OutfitDetailData | null;
  onClose: () => void;
}

const SLOT_LABEL: Record<string, string> = {
  DRESS: 'Đầm liền',
  TOP: 'Áo',
  BOTTOM: 'Quần / Chân váy',
  OUTER: 'Áo khoác',
  SHOES: 'Giày dép',
  ACCESSORY: 'Phụ kiện',
};

export default function OutfitDetailModal({ outfit, onClose }: OutfitDetailModalProps) {
  const nav = useNavigate();
  if (!outfit) return null;

  const total = outfit.totalPrice ?? outfit.items.reduce((acc, it) => acc + (it.price || 0), 0);

  function goProduct(id: number) {
    onClose();
    nav(`/products/${id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-black/10 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-ink grid place-items-center transition-colors"
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="flex flex-col sm:flex-row gap-6 mb-6">
          {outfit.coverImage && (
            <div className="sm:w-1/3 aspect-[3/4] rounded-xl overflow-hidden bg-brand-light shrink-0">
              <img
                src={outfit.coverImage}
                alt={outfit.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-brand bg-brand/10 px-2.5 py-1 rounded-full mb-2">
                {outfit.style}
              </span>
              <h2 className="font-display text-2xl font-bold text-ink">{outfit.title}</h2>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{outfit.description}</p>
              {outfit.why && (
                <div className="mt-3 p-3 bg-brand-light/70 rounded-xl text-xs text-brand-dark flex items-start gap-2">
                  <span className="text-base leading-none">✨</span>
                  <span>{outfit.why}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex items-baseline justify-between">
              <div>
                <span className="text-xs text-gray-400 block">Tổng dự kiến ({outfit.items.length} món)</span>
                <span className="font-display text-2xl font-bold text-brand">{formatVND(total)}</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  nav(`/products?style=${encodeURIComponent(outfit.style)}`);
                }}
                className="text-xs font-medium text-brand hover:underline"
              >
                Khám phá phong cách này →
              </button>
            </div>
          </div>
        </div>

        {/* Danh sách các sản phẩm thành phần */}
        <div>
          <h3 className="font-medium text-base text-ink mb-3">Các món trong bộ trang phục:</h3>
          <div className="space-y-3">
            {outfit.items.map((it) => (
              <div
                key={it.id}
                onClick={() => goProduct(it.id)}
                className="group flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-brand/30 hover:bg-cream cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={it.image || PRODUCT_PLACEHOLDER}
                    alt={it.name}
                    onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }}
                    className="w-14 h-16 object-cover rounded-lg bg-gray-100 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="inline-block text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                      {SLOT_LABEL[it.slot] || it.slot}
                    </span>
                    <h4 className="text-sm font-medium text-ink truncate group-hover:text-brand transition-colors">
                      {it.name}
                    </h4>
                    {it.color && <span className="text-xs text-gray-500">Màu: {it.color}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-sm font-semibold text-ink">{formatVND(it.price)}</span>
                  <span className="text-xs font-medium text-brand border border-brand/20 px-2.5 py-1 rounded-full group-hover:bg-brand group-hover:text-white transition-colors">
                    Xem chi tiết
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


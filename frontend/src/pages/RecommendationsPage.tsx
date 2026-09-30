import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage, recordBehavior } from '../lib/api';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';

// UC5 - Gợi ý sản phẩm cá nhân hóa + giải thích "Vì sao hợp với bạn"

interface RecProduct {
  id: number;
  name: string;
  price: number;
  category: { name: string };
  images: { url: string; isPrimary: boolean }[];
}
interface RecItem {
  product: RecProduct;
  score: number;
  why: string;
  breakdown: Record<string, number>;
}
interface RecResponse {
  bodyShape: string | null;
  hasBodyProfile: boolean;
  hasPersonalization: boolean;
  items: RecItem[];
}

const SHAPE_LABEL: Record<string, string> = {
  HOURGLASS: 'Đồng hồ cát', RECTANGLE: 'Chữ nhật', PEAR: 'Quả lê',
  APPLE: 'Quả táo', INVERTED_TRIANGLE: 'Tam giác ngược',
};

// Nút "Thích" -> ghi nhận hành vi WISHLIST (GĐ6), phản hồi lại gợi ý vòng sau
function WishlistButton({ productId }: { productId: number }) {
  const [liked, setLiked] = useState(false);
  return (
    <button
      onClick={() => { setLiked(true); recordBehavior(productId, 'WISHLIST'); }}
      className={`text-sm rounded-full border px-2.5 py-1 transition-colors ${
        liked ? 'border-red-300 bg-red-50 text-red-500' : 'border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500'
      }`}
      title="Thêm vào yêu thích"
    >
      {liked ? '♥ Đã thích' : '♡ Thích'}
    </button>
  );
}

export default function RecommendationsPage() {
  const [data, setData] = useState<RecResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/recommendations?limit=12')
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="max-w-5xl mx-auto px-4 py-10 text-gray-400">Đang tạo gợi ý...</p>;
  if (error) return <p className="max-w-5xl mx-auto px-4 py-10 text-red-500">{error}</p>;
  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Gợi ý cho bạn</h1>
      <p className="text-sm text-gray-500 mb-4">
        {data.bodyShape
          ? <>Xếp hạng theo dáng <span className="font-medium text-gray-900">{SHAPE_LABEL[data.bodyShape]}</span>, sở thích và thuộc tính sản phẩm.</>
          : 'Gợi ý phổ biến — hãy phân tích dáng người để cá nhân hóa chính xác hơn.'}
      </p>

      {/* Nhắc hoàn thiện hồ sơ để gợi ý tốt hơn */}
      {(!data.hasBodyProfile || !data.hasPersonalization) && (
        <div className="bg-indigo-50 text-indigo-700 text-sm rounded-lg px-4 py-3 mb-5 flex flex-wrap gap-x-4 gap-y-1">
          {!data.hasBodyProfile && <Link to="/profile/body" className="underline font-medium">+ Phân tích dáng người</Link>}
          {!data.hasPersonalization && <Link to="/profile/personalization" className="underline font-medium">+ Khai báo sở thích</Link>}
          <span className="text-indigo-500/80">để nâng độ chính xác của gợi ý.</span>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((it, i) => {
          const img = it.product.images.find((x) => x.isPrimary)?.url || it.product.images[0]?.url || PRODUCT_PLACEHOLDER;
          return (
            <div key={it.product.id} className="bg-white rounded-xl border overflow-hidden flex flex-col">
              <div className="relative">
                <img
                  src={img}
                  alt={it.product.name}
                  onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }}
                  className="w-full aspect-[4/5] object-cover bg-gray-100"
                />
                {i === 0 && (
                  <span className="absolute top-2 left-2 text-xs bg-gray-900 text-white rounded-full px-2 py-0.5">Hợp nhất</span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="text-xs text-gray-400">{it.product.category.name}</p>
                <p className="font-medium text-sm line-clamp-2">{it.product.name}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-brand font-semibold">{it.product.price.toLocaleString('vi-VN')}₫</p>
                  <WishlistButton productId={it.product.id} />
                </div>
                {/* WHY THIS SUITS YOU - điểm nhấn UX */}
                <div className="mt-1 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">Vì sao hợp với bạn</p>
                  <p className="text-xs text-gray-600">{it.why}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api, { recordBehavior } from '../lib/api';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';

interface Product {
  id: number;
  name: string;
  price: number;
  images: { url: string; isPrimary: boolean }[];
  category: { name: string };
}

// Nút "Thích" trong thẻ Link -> chặn điều hướng, ghi hành vi WISHLIST (GĐ6)
function WishlistButton({ productId }: { productId: number }) {
  const [liked, setLiked] = useState(false);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLiked(true); recordBehavior(productId, 'WISHLIST'); }}
      className={`text-xs rounded-full border px-2 py-0.5 transition-colors ${
        liked ? 'border-red-300 bg-red-50 text-red-500' : 'border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500'
      }`}
      title="Thêm vào yêu thích"
    >
      {liked ? '♥' : '♡'}
    </button>
  );
}

export default function ProductsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data.items as Product[];
    },
  });

  if (isLoading) return <p className="text-center py-10 text-gray-500">Đang tải sản phẩm...</p>;
  if (error) return <p className="text-center py-10 text-red-500">Không tải được sản phẩm. Kiểm tra backend đã chạy chưa?</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Gợi ý dành cho bạn</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {data?.map((p) => (
          <Link
            key={p.id}
            to={`/products/${p.id}`}
            className="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
          >
            <img
              src={p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || PRODUCT_PLACEHOLDER}
              alt={p.name}
              onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }}
              className="w-full aspect-[4/5] object-cover bg-gray-100"
            />
            <div className="p-3">
              <p className="text-xs text-gray-400">{p.category.name}</p>
              <p className="font-medium text-sm line-clamp-2">{p.name}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-brand font-semibold">{p.price.toLocaleString('vi-VN')}₫</p>
                <WishlistButton productId={p.id} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

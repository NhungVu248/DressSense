import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface Product {
  id: number;
  name: string;
  price: number;
  images: { url: string; isPrimary: boolean }[];
  category: { name: string };
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
              src={p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url}
              alt={p.name}
              className="w-full aspect-[4/5] object-cover bg-gray-100"
            />
            <div className="p-3">
              <p className="text-xs text-gray-400">{p.category.name}</p>
              <p className="font-medium text-sm line-clamp-2">{p.name}</p>
              <p className="text-brand font-semibold mt-1">
                {p.price.toLocaleString('vi-VN')}₫
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Trang gian hàng công khai (khách xem) - kiểu Shopee
import api from './api';
import type { ProductCard } from './products';

export interface StorefrontProfile {
  sellerId: number;
  name: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  createdAt: string;
}

export interface StorefrontStats {
  productCount: number;
  soldTotal: number;
  ratingAvg: number;
  ratingCount: number;
}

export interface StorefrontData {
  shop: StorefrontProfile;
  stats: StorefrontStats;
  categories: { id: number; name: string; count: number }[];
  featured: ProductCard[];
  products: ProductCard[];
}

export async function fetchShop(sellerId: number | string): Promise<StorefrontData> {
  const res = await api.get(`/shops/${sellerId}`);
  return res.data;
}

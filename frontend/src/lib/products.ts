// UC7 - Truy cập dữ liệu sản phẩm công khai (tìm kiếm / lọc / sắp xếp / chi tiết)
import api from './api';

export interface ProductImage { url: string; isPrimary: boolean }
export interface ProductVariant { id?: number; size: string; stock: number; reserved?: number }
export interface CategoryRef { id: number; name: string }

// Thẻ sản phẩm trong danh sách/kết quả tìm kiếm (UC7.1/7.2/7.3)
export interface ProductCard {
  id: number;
  name: string;
  price: number;
  color?: string | null;
  style?: string | null;
  brand?: string | null;
  category: CategoryRef;
  images: ProductImage[];
  sizes: string[];
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  inStock: boolean;
  createdAt: string;
  salePrice?: number | null; // UC13.1 - giá Flash Sale (nếu đang có)
  onSale?: boolean;
}

// UC13.1 - Flash Sale đang diễn ra của sản phẩm (trang chi tiết)
export interface FlashSaleInfo {
  salePrice: number;
  variantId: number | null;
  remaining: number;
  perUserLimit: number | null;
  endsAt: string;
}

// Chi tiết đầy đủ (UC7.4)
export interface ProductDetail extends Omit<ProductCard, 'sizes' | 'ratingAvg' | 'ratingCount' | 'soldCount' | 'inStock'> {
  description?: string | null;
  material?: string | null;
  pattern?: string | null;
  brand?: string | null;
  garmentType?: string | null;
  variants: ProductVariant[];
  reviews: { id: number; rating: number; comment?: string | null; createdAt: string }[];
  salePrice?: number | null;
  onSale?: boolean;
  flashSale?: FlashSaleInfo | null; // UC13.1
}

export interface Facets {
  categories: { id: number; name: string; count: number }[];
  colors: string[];
  styles: string[];
  sizes: string[];
  priceMin: number;
  priceMax: number;
}

export type SortKey = 'newest' | 'bestselling' | 'price_asc' | 'price_desc';

export interface ListParams {
  q?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  size?: string[];
  color?: string[];
  style?: string[];
  sort?: SortKey;
  page?: number;
  limit?: number;
}

export interface ListResponse { items: ProductCard[]; total: number; page: number; totalPages: number }

// GET /products - danh sách có tìm kiếm + lọc + sắp xếp
export async function fetchProducts(p: ListParams): Promise<ListResponse> {
  const params: Record<string, string | number> = {};
  if (p.q) params.q = p.q;
  if (p.categoryId) params.categoryId = p.categoryId;
  if (p.minPrice != null) params.minPrice = p.minPrice;
  if (p.maxPrice != null) params.maxPrice = p.maxPrice;
  if (p.size?.length) params.size = p.size.join(',');
  if (p.color?.length) params.color = p.color.join(',');
  if (p.style?.length) params.style = p.style.join(',');
  if (p.sort) params.sort = p.sort;
  if (p.page) params.page = p.page;
  if (p.limit) params.limit = p.limit;
  const res = await api.get('/products', { params });
  return res.data;
}

export async function fetchFacets(): Promise<Facets> {
  const res = await api.get('/products/facets');
  return res.data;
}

export interface Suggestion { id: number; name: string; price: number; image: string | null }
export async function fetchSuggestions(q: string): Promise<Suggestion[]> {
  const res = await api.get('/products/suggest', { params: { q } });
  return res.data.items;
}

export async function fetchProduct(id: number | string): Promise<ProductDetail> {
  const res = await api.get(`/products/${id}`);
  return { ...res.data.product, flashSale: res.data.flashSale ?? null }; // UC13.1 - kèm Flash Sale
}

export async function fetchRelated(id: number | string): Promise<ProductCard[]> {
  const res = await api.get(`/products/${id}/related`);
  return res.data.items;
}

// Tiện ích hiển thị
export function formatVND(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}

export function primaryImage(images: ProductImage[]): string | undefined {
  return images.find((i) => i.isPrimary)?.url || images[0]?.url;
}

// Badge "MỚI" nếu tạo trong 14 ngày gần đây
export function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 14 * 24 * 60 * 60 * 1000;
}

// Bản đồ mã màu hiển thị swatch từ tên màu tiếng Việt (gần đúng; chỉ để minh họa)
const COLOR_HEX: Record<string, string> = {
  'đen': '#2b2b2b', 'trắng': '#f5f5f0', 'trắng kem': '#efe9db', 'be': '#d8c9ad',
  'xám': '#9aa0a6', 'nâu': '#7a5c42', 'đỏ đô': '#6e1f2a', 'đỏ': '#c0392b',
  'hồng pastel': '#f3c9d3', 'hồng': '#e79ab0', 'xanh navy': '#28344d', 'xanh than': '#223047',
  'xanh rêu': '#5a6b4a', 'xanh denim': '#5b7a99', 'xanh': '#3b6ea5', 'vàng': '#e3b94f',
};
export function colorHex(name?: string | null): string {
  if (!name) return '#d1d5db';
  return COLOR_HEX[name.trim().toLowerCase()] ?? '#cbb79a';
}

// UC8 - Truy cập dữ liệu giỏ hàng, wishlist, voucher
import api from './api';
import type { CategoryRef } from './products';

export interface CartVariant { id: number; size: string }
export interface CartProductSize { id: number; size: string; available: number }
export interface CartItem {
  id: number;
  quantity: number;
  selected: boolean;
  price: number;
  lineTotal: number;
  variant: CartVariant | null;
  available: number;
  maxQty: number;
  inStock: boolean;
  sellable: boolean;
  valid: boolean;
  product: { id: number; name: string; color?: string | null; image: string | null; category: CategoryRef; sizes: CartProductSize[] };
  seller: { id: number; name: string };
}
export interface CartShop { seller: { id: number; name: string }; items: CartItem[] }
export interface Cart {
  shops: CartShop[];
  totalCount: number;
  selectedCount: number;
  selectedSubtotal: number;
  hasInvalid: boolean;
}

export async function getCart(): Promise<Cart> {
  return (await api.get('/cart')).data;
}
export async function getCartCount(): Promise<number> {
  return (await api.get('/cart/count')).data.count;
}
export async function addToCart(productId: number, variantId: number | null, quantity = 1) {
  return (await api.post('/cart', { productId, variantId: variantId ?? undefined, quantity })).data;
}
export async function updateCartItem(id: number, patch: { quantity?: number; variantId?: number; selected?: boolean }) {
  return (await api.patch(`/cart/${id}`, patch)).data;
}
export async function removeCartItem(id: number) {
  return (await api.delete(`/cart/${id}`)).data;
}
export interface CheckoutSummary {
  ready: boolean;
  items: CartItem[];
  removed: CartItem[];
  subtotal: number;
  voucher: Voucher | null;
  discount: number;
  total: number;
  note: string;
}
export async function checkoutPreview(voucherCode?: string): Promise<CheckoutSummary> {
  return (await api.post('/cart/checkout', { voucherCode })).data;
}

// ---- Wishlist (UC8.2) ----
export interface WishlistItem {
  productId: number;
  name: string;
  price: number;
  color?: string | null;
  image: string | null;
  category: CategoryRef;
  sizes: CartProductSize[];
  sellable: boolean;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
}
export async function getWishlist(): Promise<WishlistItem[]> {
  return (await api.get('/wishlist')).data.items;
}
export async function getWishlistIds(): Promise<number[]> {
  return (await api.get('/wishlist/ids')).data.ids;
}
export async function addWishlist(productId: number) {
  return (await api.post('/wishlist', { productId })).data;
}
export async function removeWishlist(productId: number) {
  return (await api.delete(`/wishlist/${productId}`)).data;
}
export async function wishlistToCart(productId: number, variantId: number | null, quantity = 1) {
  return (await api.post(`/wishlist/${productId}/to-cart`, { variantId: variantId ?? undefined, quantity })).data;
}

// ---- Voucher (UC8.3) ----
export interface Voucher {
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  endsAt?: string | null;
}
export interface VoucherResult { valid: boolean; message: string; discount: number; voucher: Voucher | null }
export async function listVouchers(): Promise<Voucher[]> {
  return (await api.get('/vouchers')).data.vouchers;
}
export async function applyVoucher(code: string, subtotal: number): Promise<VoucherResult> {
  return (await api.post('/vouchers/apply', { code, subtotal })).data;
}

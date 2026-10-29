// UC15 - Phân tích dữ liệu kinh doanh (BI). Scope theo vai trò ở backend.
import api from './api';

export type NV = { name: string; value: number };
export interface Range { from: string; to: string; preset: string }
export interface AnalyticsParams { preset?: string; from?: string; to?: string; sellerId?: number; horizon?: number }

// UC15.4
export interface RevenueAnalytics {
  range: Range;
  metrics: { revenue: number; orderCount: number; soldQuantity: number; customers: number; avgOrderValue: number; refundAmount: number; netRevenue: number };
  compare: { revenue: number | null; orderCount: number | null; customers: number | null; netRevenue: number | null };
  timeSeries: { date: string; revenue: number }[];
  bestSellers: { productId: number; name: string; quantity: number; revenue: number }[];
  categoryShare: { name: string; revenue: number; pct: number }[];
}
// UC15.1
export interface CustomerAnalytics {
  range: Range;
  metrics: { totalCustomers: number; newCustomers: number; returningCustomers: number; returnRate: number; avgPurchaseValue: number; purchaseFrequency: number };
  trends: { styles: NV[]; colors: NV[]; categories: NV[]; priceRanges: NV[]; mostViewed: NV[]; mostAddedToCart: NV[] };
}
// UC15.2
export interface BehaviorAnalytics {
  range: Range;
  funnel: { key: string; label: string; count: number; ofTop: number; stepRate: number }[];
  biggestDropOff: { from: string; to: string; dropPct: number } | null;
}
// UC15.3
export interface BodyShapeAnalytics {
  range: Range; enough: boolean; minSample?: number; total: number;
  shapes: { key: string; label: string; count: number; pct: number }[];
  sizes: { name: string; count: number; pct: number }[];
  popularSize?: string | null;
}
// UC15.5
export interface InventoryItem {
  variantId: number; productId: number; product: string; category: string; size: string;
  stock: number; reserved: number; available: number; sold: number; sellRate: number;
  forecast: number; daysOfCover: number | null; suggestedReorder: number;
  status: 'LOW' | 'NORMAL' | 'OVERSTOCK'; enoughData: boolean;
}
export interface InventoryAnalytics {
  horizon: number; lookbackDays: number;
  summary: { low: number; overstock: number; normal: number; totalVariants: number };
  items: InventoryItem[];
}

const get = <T>(path: string, params: AnalyticsParams) => api.get<T>(`/analytics/${path}`, { params }).then((r) => r.data);

export const getRevenueAnalytics = (p: AnalyticsParams) => get<RevenueAnalytics>('revenue', p);
export const getCustomerAnalytics = (p: AnalyticsParams) => get<CustomerAnalytics>('customers', p);
export const getBehaviorAnalytics = (p: AnalyticsParams) => get<BehaviorAnalytics>('behavior', p);
export const getBodyShapeAnalytics = (p: AnalyticsParams) => get<BodyShapeAnalytics>('body-shapes', p);
export const getInventoryAnalytics = (p: AnalyticsParams) => get<InventoryAnalytics>('inventory', p);

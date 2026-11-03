import api from './api';

// ============================================================
//  Tồn kho (ERD 3.8/3.9) + Vận chuyển (ERD 3.3) - phần Người bán
// ============================================================

export type InventoryItem = {
  variantId: number;
  productId: number;
  productName: string;
  productStatus: string;
  size: string;
  stock: number;
  reserved: number;
  available: number;
  lowStockThreshold: number | null;
  isLow: boolean;
};

export type StockMovement = {
  id: number;
  variantId: number;
  type: 'IMPORT' | 'EXPORT' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  referenceType: string | null;
  referenceId: number | null;
  note: string | null;
  createdAt: string;
  productName: string;
  size: string;
};

export const MOVEMENT_LABEL: Record<string, string> = {
  IMPORT: 'Nhập kho', EXPORT: 'Xuất kho', ADJUSTMENT: 'Điều chỉnh', RETURN: 'Hàng hoàn',
};

export async function getInventory(params: { q?: string; lowStock?: boolean } = {}): Promise<InventoryItem[]> {
  const { data } = await api.get('/seller/inventory', { params: { q: params.q || undefined, lowStock: params.lowStock ? '1' : undefined } });
  return data.items;
}

export async function adjustStock(variantId: number, body: { type: 'IMPORT' | 'EXPORT' | 'ADJUSTMENT'; quantity: number; note?: string; lowStockThreshold?: number | null }) {
  const { data } = await api.patch(`/seller/inventory/${variantId}`, body);
  return data;
}

export async function getStockMovements(variantId?: number): Promise<StockMovement[]> {
  const { data } = await api.get('/seller/inventory/movements', { params: { variantId } });
  return data.movements;
}

export type ShippingMethod = {
  id: number;
  shopId: number;
  carrierName: string;
  serviceName: string | null;
  shippingFee: number;
  estimatedDays: number | null;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  const { data } = await api.get('/seller/shipping-methods');
  return data.methods;
}

export async function createShippingMethod(body: Partial<ShippingMethod>) {
  const { data } = await api.post('/seller/shipping-methods', body);
  return data.method;
}

export async function updateShippingMethod(id: number, body: Partial<ShippingMethod>) {
  const { data } = await api.put(`/seller/shipping-methods/${id}`, body);
  return data.method;
}

export async function deleteShippingMethod(id: number) {
  await api.delete(`/seller/shipping-methods/${id}`);
}

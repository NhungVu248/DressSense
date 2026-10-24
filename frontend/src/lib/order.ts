// UC9 - Truy cập dữ liệu đặt hàng & thanh toán
import api from './api';

export interface Address {
  id: number; recipientName: string; phone: string;
  province: string; district: string; ward: string; detail: string; isDefault: boolean;
}
export interface ShippingMethod { code: string; label: string; fee: number; eta: string }
export interface CheckoutItem {
  cartItemId: number; productId: number; name: string; price: number;
  size: string | null; quantity: number; lineTotal: number; seller: string; valid: boolean;
}
export interface CheckoutInfo {
  addresses: Address[]; shippingMethods: ShippingMethod[];
  items: CheckoutItem[]; subtotal: number; vnpayEnabled: boolean;
}

export type OrderStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'PAID' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
export type PaymentMethod = 'COD' | 'VNPAY' | 'VISA';

export interface OrderItem { id: number; productId: number; name: string | null; size: string | null; quantity: number; price: number }
export interface Transaction {
  id: number; code: string; orderCode?: string; method: PaymentMethod; amount: number;
  status: PaymentStatus; bankCode?: string | null; cardLast4?: string | null; responseCode?: string | null;
  createdAt: string; paidAt?: string | null;
}
export interface Order {
  id: number; code: string; status: OrderStatus;
  paymentMethod: PaymentMethod; paymentStatus: PaymentStatus;
  recipientName: string; phone: string; province: string; district: string; ward: string; addressDetail: string;
  subtotal: number; discount: number; voucherCode: string | null;
  shippingMethod: string; shippingFee: number; total: number; note: string | null;
  paidAt: string | null; createdAt: string;
  items: OrderItem[]; payments?: Transaction[];
}

export interface PlaceOrderBody {
  addressId: number; shippingMethod: string; paymentMethod: PaymentMethod; voucherCode?: string; note?: string;
}

export async function getCheckoutInfo(): Promise<CheckoutInfo> {
  return (await api.get('/orders/checkout')).data;
}
export async function placeOrder(body: PlaceOrderBody): Promise<{ order: Order; payUrl?: string }> {
  return (await api.post('/orders', body)).data;
}
export async function getOrders(): Promise<Order[]> {
  return (await api.get('/orders')).data.orders;
}
export async function getOrder(id: number | string): Promise<Order> {
  return (await api.get(`/orders/${id}`)).data.order;
}
export async function retryPayment(orderId: number): Promise<{ payUrl: string }> {
  return (await api.post(`/payments/orders/${orderId}/retry`)).data;
}
export async function getTransactions(filter?: { status?: string; method?: string }): Promise<Transaction[]> {
  return (await api.get('/payments', { params: filter })).data.items;
}
export async function createAddress(a: Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean }) {
  return (await api.post('/addresses', a)).data;
}

// Nhãn hiển thị
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận', AWAITING_PAYMENT: 'Chờ thanh toán', PAID: 'Đã thanh toán',
  SHIPPING: 'Đang giao', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
};
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán', PENDING: 'Đang xử lý', PAID: 'Đã thanh toán',
  FAILED: 'Thất bại', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', REFUNDED: 'Đã hoàn tiền',
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: 'Thanh toán khi nhận hàng (COD)', VNPAY: 'VNPAY (ATM/QR nội địa)', VISA: 'Thẻ Visa/quốc tế (qua VNPAY)',
};

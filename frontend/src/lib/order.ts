// UC9 - Truy cập dữ liệu đặt hàng & thanh toán
import api from './api';

export interface Address {
  id: number; recipientName: string; phone: string;
  province: string; district: string; ward: string; detail: string; isDefault: boolean;
}
export interface ShippingMethod { code: string; label: string; fee: number; eta: string; intl?: boolean }
export interface ShippingConfig { threshold: number; surcharge: number; remoteProvinces: string[] }
export interface CheckoutItem {
  cartItemId: number; productId: number; name: string; price: number;
  size: string | null; quantity: number; lineTotal: number; sellerId: number; seller: string; valid: boolean;
  selfDelivery?: boolean; selfDeliveryFee?: number | null; // B.30 - gian hàng tự giao
}
export interface CheckoutInfo {
  addresses: Address[]; shippingMethods: ShippingMethod[]; shippingConfig: ShippingConfig;
  items: CheckoutItem[]; subtotal: number; vnpayEnabled: boolean;
  paymentMethods?: { COD: boolean; VNPAY: boolean; VISA: boolean }; // Backlog C.37 - Admin bật/tắt
}

export type OrderStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'PAID';
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
export type PaymentMethod = 'COD' | 'VNPAY' | 'VISA';

export interface OrderItem { id: number; productId: number; name: string | null; size: string | null; quantity: number; price: number }
export interface Transaction {
  id: number; code: string; orderCode?: string; method: PaymentMethod; amount: number;
  status: PaymentStatus; bankCode?: string | null; cardLast4?: string | null; responseCode?: string | null;
  createdAt: string; paidAt?: string | null;
}
export interface Order {
  id: number; code: string; status: OrderStatus; sellerId?: number | null;
  paymentMethod: PaymentMethod; paymentStatus: PaymentStatus;
  recipientName: string; phone: string; province: string; district: string; ward: string; addressDetail: string;
  subtotal: number; discount: number; voucherCode: string | null;
  shippingMethod: string; shippingFee: number; total: number; note: string | null;
  paidAt: string | null; createdAt: string;
  // UC10 - giao nhận + hủy
  carrier: string | null; trackingNumber: string | null; estimatedDelivery: string | null;
  confirmedAt: string | null; shippedAt: string | null; deliveredAt: string | null;
  completedAt: string | null; cancelledAt: string | null;
  cancelRequested: boolean; cancelReason: string | null; cancelledBy: string | null; refundStatus: string | null;
  items: OrderItem[]; payments?: Transaction[];
  user?: { fullName: string }; // chỉ ở danh sách của người bán
}

// UC10.2 - các bước tiến trình theo dõi
export const TRACKING_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING', label: 'Chờ xác nhận' },
  { status: 'CONFIRMED', label: 'Đã xác nhận' },
  { status: 'PREPARING', label: 'Đang chuẩn bị' },
  { status: 'SHIPPING', label: 'Đang giao' },
  { status: 'DELIVERED', label: 'Đã giao' },
  { status: 'COMPLETED', label: 'Hoàn tất' },
];

export interface PlaceOrderBody {
  addressId: number; shippingMethod: string; paymentMethod: PaymentMethod; voucherCode?: string; note?: string;
}

export async function getCheckoutInfo(): Promise<CheckoutInfo> {
  return (await api.get('/orders/checkout')).data;
}
export async function placeOrder(body: PlaceOrderBody): Promise<{ orders: Order[]; payUrl?: string; checkoutCode?: string }> {
  return (await api.post('/orders', body)).data;
}
export async function getOrders(status?: string): Promise<Order[]> {
  return (await api.get('/orders', { params: status ? { status } : {} })).data.orders;
}

// UC10.3 - xác nhận đã nhận hàng
export async function confirmReceipt(orderId: number) {
  return (await api.patch(`/orders/${orderId}/confirm-receipt`)).data;
}
// UC10.5 - hủy đơn / yêu cầu hủy
export async function cancelOrder(orderId: number, reason: string) {
  return (await api.post(`/orders/${orderId}/cancel`, { reason })).data;
}

// ---- UC10.4 - Người bán ----
export async function getSellerOrders(status?: string): Promise<Order[]> {
  return (await api.get('/seller/orders', { params: status ? { status } : {} })).data.orders;
}
export async function sellerUpdateStatus(orderId: number, body: { to: string; carrier?: string; trackingNumber?: string; estimatedDelivery?: string }) {
  return (await api.patch(`/seller/orders/${orderId}/status`, body)).data;
}
export async function sellerApproveCancel(orderId: number) {
  return (await api.patch(`/seller/orders/${orderId}/cancel/approve`)).data;
}
export async function sellerRejectCancel(orderId: number) {
  return (await api.patch(`/seller/orders/${orderId}/cancel/reject`)).data;
}
export async function getOrder(id: number | string): Promise<Order> {
  return (await api.get(`/orders/${id}`)).data.order;
}

// ---- Backlog - Hóa đơn VAT ----
export interface InvoiceBreakdown { goodsBeforeTax: number; taxRate: number; taxAmount: number; subtotal: number; discount: number; shippingFee: number; total: number }
export interface InvoiceCompany { name: string; taxCode: string; address: string }
export interface InvoiceInfo { id: number; orderId: number; buyerName: string; buyerTaxCode: string | null; buyerAddress: string; buyerEmail: string | null; note: string | null; issueCount: number; issuedAt: string }
export interface InvoiceData {
  invoice: InvoiceInfo; company: InvoiceCompany; breakdown: InvoiceBreakdown;
  order: { code: string; createdAt: string; recipientName: string; phone: string; voucherCode: string | null; items: { name: string | null; size: string | null; quantity: number; price: number }[] };
}
export interface IssueInvoiceBody { buyerName: string; buyerAddress: string; buyerTaxCode?: string; buyerEmail?: string; note?: string }
export async function issueInvoice(orderId: number | string, body: IssueInvoiceBody) {
  return (await api.post(`/orders/${orderId}/invoice`, body)).data;
}
export async function getInvoice(orderId: number | string): Promise<InvoiceData> {
  return (await api.get(`/orders/${orderId}/invoice`)).data;
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
  AWAITING_PAYMENT: 'Chờ thanh toán', PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', PAID: 'Đã thanh toán',
};
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán', PENDING: 'Đang xử lý', PAID: 'Đã thanh toán',
  FAILED: 'Thất bại', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', REFUNDED: 'Đã hoàn tiền',
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: 'Thanh toán khi nhận hàng (COD)', VNPAY: 'VNPAY (ATM/QR nội địa)', VISA: 'Thẻ Visa/quốc tế (qua VNPAY)',
};

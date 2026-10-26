// UC10 - vòng đời trạng thái đơn hàng & quy tắc chuyển trạng thái
export type OrderStatusValue =
  | 'AWAITING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'PREPARING'
  | 'SHIPPING' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'PAID';

// Thứ tự tiến của luồng giao hàng (UC10.4 - không được nhảy cóc / quay ngược)
export const SELLER_NEXT: Partial<Record<OrderStatusValue, OrderStatusValue>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'SHIPPING',
  SHIPPING: 'DELIVERED',
};

// UC10.5 - điều kiện hủy theo trạng thái
export const CANCELLABLE_DIRECT: OrderStatusValue[] = ['AWAITING_PAYMENT', 'PENDING']; // khách hủy trực tiếp
export const CANCELLABLE_REQUEST: OrderStatusValue[] = ['CONFIRMED', 'PREPARING'];     // cần người bán duyệt

// Các bước hiển thị tiến trình theo dõi (UC10.2)
export const TRACKING_STEPS: { status: OrderStatusValue; label: string }[] = [
  { status: 'PENDING', label: 'Chờ xác nhận' },
  { status: 'CONFIRMED', label: 'Đã xác nhận' },
  { status: 'PREPARING', label: 'Đang chuẩn bị hàng' },
  { status: 'SHIPPING', label: 'Đang giao' },
  { status: 'DELIVERED', label: 'Đã giao' },
  { status: 'COMPLETED', label: 'Hoàn tất' },
];

// Mục 2/3 - Hoa hồng & đối soát: API cho cổng Admin và Seller.
import api from './api';

// ---------- Nhãn trạng thái dùng chung ----------
export const COMMISSION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', REFUNDED: 'Đã hoàn/điều chỉnh', CANCELLED: 'Không phát sinh',
};
export const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ thanh toán', PROCESSING: 'Đang xử lý', PAID: 'Đã thanh toán', FAILED: 'Đã hủy',
};
export const DIRECTION_LABEL: Record<string, string> = {
  PAYABLE: 'Sàn trả Seller', RECEIVABLE: 'Seller trả sàn',
};
export const METHOD_LABEL: Record<string, string> = { COD: 'COD', VNPAY: 'VNPAY', VISA: 'Visa' };

// ---------- 2.1/2.2 - Chính sách hoa hồng ----------
export interface CommissionPolicy {
  id: number; name: string; categoryId: number | null; categoryName?: string;
  commissionRate: number; effectiveFrom: string; effectiveTo: string | null;
  status: 'ACTIVE' | 'INACTIVE'; note: string | null; createdAt: string;
}
export interface PolicyLog { id: number; policyId: number | null; action: string; before: any; after: any; actorId: number | null; createdAt: string }

export const listCommissionPolicies = (params?: { categoryId?: string | number; status?: string }) =>
  api.get<{ policies: CommissionPolicy[] }>('/admin/commission/policies', { params }).then((r) => r.data.policies);
export const createCommissionPolicy = (data: Partial<CommissionPolicy>) =>
  api.post('/admin/commission/policies', data).then((r) => r.data);
export const updateCommissionPolicy = (id: number, data: Partial<CommissionPolicy>) =>
  api.put(`/admin/commission/policies/${id}`, data).then((r) => r.data);
export const setCommissionPolicyStatus = (id: number, status: 'ACTIVE' | 'INACTIVE') =>
  api.patch(`/admin/commission/policies/${id}/status`, { status }).then((r) => r.data);
export const getCommissionPolicyHistory = (policyId?: number) =>
  api.get<{ logs: PolicyLog[] }>('/admin/commission/policies/history', { params: policyId ? { policyId } : {} }).then((r) => r.data.logs);

// ---------- 2.3 - Giao dịch hoa hồng ----------
export interface CommissionTxn {
  id: number; orderId: number; orderCode: string; sellerId: number; shopName: string;
  baseAmount: number; commissionRate: number; commissionAmount: number;
  method: string; status: string; settlementId: number | null; createdAt: string; note: string | null;
}
export const listOrderCommissions = (params?: { sellerId?: number; status?: string; from?: string; to?: string }) =>
  api.get<{ transactions: CommissionTxn[] }>('/admin/commission/transactions', { params }).then((r) => r.data.transactions);

// ---------- 2.4 - Đối soát & thanh toán ----------
export interface SettlementBalance {
  sellerId: number; shopName: string; orderCount: number; goods: number; commission: number;
  direction: 'PAYABLE' | 'RECEIVABLE'; amount: number;
  bank: { bankName: string | null; bankAccountNo: string | null; bankAccountName: string | null } | null;
}
export interface EligibleOrder { orderId: number; orderCode: string; sellerId: number; method: string; goods: number; commission: number; net: number }
export interface Settlement {
  id: number; code: string; sellerId: number; shopName?: string; periodFrom: string | null; periodTo: string | null;
  grossAmount: number; commissionAmount: number; adjustmentAmount: number; netAmount: number;
  direction: 'PAYABLE' | 'RECEIVABLE'; status: string; paymentMethod: string | null;
  transactionReference: string | null; note: string | null; paidAt: string | null; createdAt: string;
  items?: SettlementItem[]; bank?: { bankName: string | null; bankAccountNo: string | null; bankAccountName: string | null } | null;
}
export interface SettlementItem { id: number; orderId: number; orderCode: string | null; orderAmount: number; commissionAmount: number; netAmount: number }

export const getSettlementBalances = () =>
  api.get<{ balances: SettlementBalance[] }>('/admin/commission/settlements/balances').then((r) => r.data.balances);
export const listEligibleOrders = (sellerId: number) =>
  api.get<{ orders: EligibleOrder[] }>('/admin/commission/settlements/eligible', { params: { sellerId } }).then((r) => r.data.orders);
export const createSettlement = (data: { sellerId: number; orderIds?: number[]; note?: string }) =>
  api.post<{ settlement: Settlement }>('/admin/commission/settlements', data).then((r) => r.data.settlement);
export const listSettlements = (params?: { sellerId?: number; status?: string }) =>
  api.get<{ settlements: Settlement[] }>('/admin/commission/settlements', { params }).then((r) => r.data.settlements);
export const getSettlement = (id: number) =>
  api.get<{ settlement: Settlement }>(`/admin/commission/settlements/${id}`).then((r) => r.data.settlement);
export const confirmSettlementPayment = (id: number, data: { paymentMethod: string; transactionReference: string; note?: string }) =>
  api.post(`/admin/commission/settlements/${id}/pay`, data).then((r) => r.data);
export const cancelSettlement = (id: number) =>
  api.post(`/admin/commission/settlements/${id}/cancel`).then((r) => r.data);

// ---------- 2.5 - Báo cáo doanh thu hoa hồng ----------
export interface CommissionReport {
  range: { from: string; to: string; preset: string };
  metrics: {
    gmv: number; commissionTotal: number; confirmedCommission: number; refundedCommission: number;
    payableToSellers: number; receivableFromSellers: number; paidToSellers: number;
    bannerRevenue: number; voucherRevenue: number; platformIncome: number; orderCount: number;
  };
  commissionSeries: { date: string; commission: number }[];
  byShop: { sellerId: number; shopName: string; base: number; commission: number }[];
}
export const getCommissionReport = (params: { preset?: string; from?: string; to?: string }) =>
  api.get<CommissionReport>('/admin/commission/report', { params }).then((r) => r.data);

// ---------- Mục 3 - Seller: Tài chính & doanh thu ----------
export interface SellerFinance {
  metrics: {
    totalGoods: number; totalCommission: number; netGoods: number;
    pendingPayable: number; pendingCodOwed: number; paidToMe: number; paidToPlatform: number;
  };
  bank: { bankName: string | null; bankAccountNo: string | null; bankAccountName: string | null };
}
export const getSellerFinance = () => api.get<SellerFinance>('/seller/finance').then((r) => r.data);
export const listSellerCommissions = () =>
  api.get<{ commissions: CommissionTxn[] }>('/seller/finance/commissions').then((r) => r.data.commissions);
export const listSellerSettlements = () =>
  api.get<{ settlements: Settlement[] }>('/seller/finance/settlements').then((r) => r.data.settlements);
export const updateSellerBankInfo = (data: { bankName?: string; bankAccountNo?: string; bankAccountName?: string }) =>
  api.put('/seller/finance/bank', data).then((r) => r.data);

// Danh mục (cho form chính sách)
export interface CategoryItem { id: number; name: string; parentId: number | null }
export const listAdminCategories = () =>
  api.get<{ items: CategoryItem[] }>('/admin/categories').then((r) => r.data.items);

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSellerFinance, listSellerCommissions, listSellerSettlements, updateSellerBankInfo,
  COMMISSION_STATUS_LABEL, SETTLEMENT_STATUS_LABEL, DIRECTION_LABEL, METHOD_LABEL,
} from '../../lib/finance';
import { formatVND } from '../../lib/products';
import { getErrorMessage } from '../../lib/api';

// Mục 3 - Seller: Tài chính & doanh thu (chỉ xem dữ liệu gian hàng mình).
function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-brand/30 bg-brand/5' : 'border-brand/10 bg-white'}`}>
      <p className="text-xs text-ink/50">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? 'text-brand' : 'text-ink'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}

const CSTATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700', PENDING: 'bg-amber-100 text-amber-700',
  REFUNDED: 'bg-blue-100 text-blue-700', CANCELLED: 'bg-gray-100 text-gray-500',
};
const SSTATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700', PROCESSING: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700', FAILED: 'bg-gray-100 text-gray-500',
};

export default function SellerFinancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'commissions' | 'settlements'>('commissions');
  const { data: fin, isLoading } = useQuery({ queryKey: ['seller-finance'], queryFn: getSellerFinance });
  const { data: commissions } = useQuery({ queryKey: ['seller-commissions'], queryFn: listSellerCommissions, enabled: tab === 'commissions' });
  const { data: settlements } = useQuery({ queryKey: ['seller-settlements'], queryFn: listSellerSettlements, enabled: tab === 'settlements' });

  const m = fin?.metrics;

  // form thông tin nhận tiền
  const [bank, setBank] = useState({ bankName: '', bankAccountNo: '', bankAccountName: '' });
  const [savingBank, setSavingBank] = useState(false);
  useEffect(() => {
    if (fin?.bank) setBank({ bankName: fin.bank.bankName ?? '', bankAccountNo: fin.bank.bankAccountNo ?? '', bankAccountName: fin.bank.bankAccountName ?? '' });
  }, [fin]);
  async function saveBank() {
    setSavingBank(true);
    try { await updateSellerBankInfo(bank); qc.invalidateQueries({ queryKey: ['seller-finance'] }); alert('Đã lưu thông tin nhận tiền.'); }
    catch (e) { alert(getErrorMessage(e)); } finally { setSavingBank(false); }
  }

  return (
    <div className="p-5 md:p-8 max-w-5xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-ink/40">Tài chính</p>
        <h1 className="font-display text-3xl font-bold">Tài chính & doanh thu</h1>
        <p className="text-sm text-ink/50 mt-1">Tổng quan doanh thu, hoa hồng sàn, số dư chờ thanh toán và thông tin nhận tiền. Tỷ lệ hoa hồng & trạng thái thanh toán do sàn quản lý.</p>
      </div>

      {isLoading || !m ? <p className="text-ink/40">Đang tải…</p> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <StatCard label="Tổng tiền hàng" value={formatVND(m.totalGoods)} hint="Hàng chưa thuế, sau giảm" />
            <StatCard label="Hoa hồng sàn" value={formatVND(m.totalCommission)} />
            <StatCard label="Số tiền được nhận" value={formatVND(m.netGoods)} hint="Tiền hàng − hoa hồng" accent />
            <StatCard label="Đã thanh toán" value={formatVND(m.paidToMe)} hint="Sàn đã chi trả" />
            <StatCard label="Còn phải thanh toán" value={formatVND(m.pendingPayable)} hint="Đơn online chờ đối soát" />
            <StatCard label="Phải trả sàn (COD)" value={formatVND(m.pendingCodOwed)} hint="Hoa hồng đơn COD chờ đối soát" />
          </div>

          {/* Thông tin nhận tiền */}
          <div className="bg-white rounded-2xl border border-brand/10 p-4 mb-6">
            <h2 className="font-display text-lg font-bold mb-1">Thông tin nhận tiền</h2>
            <p className="text-sm text-ink/50 mb-3">Dùng để sàn đối soát và chuyển khoản phần doanh thu được nhận.</p>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <label className="block"><span className="text-ink/60">Ngân hàng</span>
                <input value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" placeholder="Vietcombank" />
              </label>
              <label className="block"><span className="text-ink/60">Số tài khoản</span>
                <input value={bank.bankAccountNo} onChange={(e) => setBank({ ...bank, bankAccountNo: e.target.value })} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" />
              </label>
              <label className="block"><span className="text-ink/60">Chủ tài khoản</span>
                <input value={bank.bankAccountName} onChange={(e) => setBank({ ...bank, bankAccountName: e.target.value })} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" />
              </label>
            </div>
            <button onClick={saveBank} disabled={savingBank} className="mt-3 bg-brand text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50">Lưu</button>
          </div>

          <div className="flex gap-2 mb-4 text-sm">
            <button onClick={() => setTab('commissions')} className={`px-4 py-1.5 rounded-full border ${tab === 'commissions' ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>Chi tiết hoa hồng</button>
            <button onClick={() => setTab('settlements')} className={`px-4 py-1.5 rounded-full border ${tab === 'settlements' ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>Lịch sử thanh toán</button>
          </div>

          {tab === 'commissions' && (
            <div className="bg-white rounded-2xl border border-brand/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink/50 border-b border-brand/10">
                    <th className="py-2.5 px-3 font-medium">Mã đơn</th>
                    <th className="py-2.5 px-3 font-medium text-right">Giá trị tính phí</th>
                    <th className="py-2.5 px-3 font-medium text-right">Tỷ lệ</th>
                    <th className="py-2.5 px-3 font-medium text-right">Hoa hồng</th>
                    <th className="py-2.5 px-3 font-medium">PT</th>
                    <th className="py-2.5 px-3 font-medium">Trạng thái</th>
                    <th className="py-2.5 px-3 font-medium">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {(!commissions || commissions.length === 0) ? (
                    <tr><td colSpan={7} className="text-center text-ink/40 py-10">Chưa có hoa hồng phát sinh.</td></tr>
                  ) : commissions.map((c) => (
                    <tr key={c.id} className="border-b border-brand/5 last:border-0">
                      <td className="py-2.5 px-3 font-medium">{c.orderCode}</td>
                      <td className="py-2.5 px-3 text-right">{formatVND(c.baseAmount)}</td>
                      <td className="py-2.5 px-3 text-right">{c.commissionRate}%</td>
                      <td className="py-2.5 px-3 text-right text-brand font-semibold">{formatVND(c.commissionAmount)}</td>
                      <td className="py-2.5 px-3 text-ink/60">{METHOD_LABEL[c.method] ?? c.method}</td>
                      <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${CSTATUS_STYLE[c.status]}`}>{COMMISSION_STATUS_LABEL[c.status]}</span></td>
                      <td className="py-2.5 px-3 text-ink/50 text-[13px]">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'settlements' && (
            <div className="bg-white rounded-2xl border border-brand/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink/50 border-b border-brand/10">
                    <th className="py-2.5 px-3 font-medium">Mã đợt</th>
                    <th className="py-2.5 px-3 font-medium">Chiều</th>
                    <th className="py-2.5 px-3 font-medium text-right">Số tiền</th>
                    <th className="py-2.5 px-3 font-medium">Trạng thái</th>
                    <th className="py-2.5 px-3 font-medium">Mã giao dịch</th>
                    <th className="py-2.5 px-3 font-medium">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {(!settlements || settlements.length === 0) ? (
                    <tr><td colSpan={6} className="text-center text-ink/40 py-10">Chưa có đợt thanh toán nào.</td></tr>
                  ) : settlements.map((s) => (
                    <tr key={s.id} className="border-b border-brand/5 last:border-0">
                      <td className="py-2.5 px-3 font-medium">{s.code}</td>
                      <td className="py-2.5 px-3 text-[13px]">{DIRECTION_LABEL[s.direction]}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">{formatVND(s.netAmount)}</td>
                      <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${SSTATUS_STYLE[s.status]}`}>{SETTLEMENT_STATUS_LABEL[s.status]}</span></td>
                      <td className="py-2.5 px-3 text-ink/60 text-[13px]">{s.transactionReference ?? '—'}</td>
                      <td className="py-2.5 px-3 text-ink/50 text-[13px]">{s.paidAt ? new Date(s.paidAt).toLocaleDateString('vi-VN') : new Date(s.createdAt).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

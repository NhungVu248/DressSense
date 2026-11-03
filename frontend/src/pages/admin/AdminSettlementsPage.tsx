import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSettlementBalances, listSettlements, createSettlement, getSettlement,
  confirmSettlementPayment, cancelSettlement, SETTLEMENT_STATUS_LABEL, DIRECTION_LABEL,
  type Settlement, type SettlementBalance,
} from '../../lib/finance';
import { formatVND } from '../../lib/products';
import { getErrorMessage } from '../../lib/api';

// 2.4 - Quản lý đối soát & thanh toán Seller.
const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700', PROCESSING: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700', FAILED: 'bg-gray-100 text-gray-500',
};

export default function AdminSettlementsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'balances' | 'settlements'>('balances');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [payFor, setPayFor] = useState<Settlement | null>(null);

  const { data: balances, isLoading: loadingBal } = useQuery({ queryKey: ['stl-balances'], queryFn: getSettlementBalances });
  const { data: settlements, isLoading: loadingStl } = useQuery({ queryKey: ['settlements'], queryFn: () => listSettlements() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['stl-balances'] });
    qc.invalidateQueries({ queryKey: ['settlements'] });
  };

  async function makeSettlement(b: SettlementBalance) {
    if (!confirm(`Tạo đợt đối soát cho ${b.shopName} (${b.orderCount} đơn, ${DIRECTION_LABEL[b.direction]} ${formatVND(b.amount)})?`)) return;
    try { await createSettlement({ sellerId: b.sellerId }); refresh(); setTab('settlements'); }
    catch (e) { alert(getErrorMessage(e)); }
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-ink/40">Tài chính · Hoa hồng</p>
        <h1 className="font-display text-3xl font-bold">Đối soát & thanh toán</h1>
        <p className="text-sm text-ink/50 mt-1">Đơn online đã thu hộ: sàn trả Seller phần net. Đơn COD: Seller trả sàn phần hoa hồng. Tiền chuyển thủ công, ghi nhận mã giao dịch.</p>
      </div>

      <div className="flex gap-2 mb-5 text-sm">
        <button onClick={() => setTab('balances')} className={`px-4 py-1.5 rounded-full border ${tab === 'balances' ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>Số dư chờ đối soát</button>
        <button onClick={() => setTab('settlements')} className={`px-4 py-1.5 rounded-full border ${tab === 'settlements' ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>Các đợt đối soát</button>
      </div>

      {tab === 'balances' && (
        loadingBal ? <p className="text-ink/40">Đang tải…</p> : (
          <div className="bg-white rounded-2xl border border-brand/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/50 border-b border-brand/10">
                  <th className="py-2.5 px-3 font-medium">Gian hàng</th>
                  <th className="py-2.5 px-3 font-medium text-right">Số đơn</th>
                  <th className="py-2.5 px-3 font-medium text-right">Tiền hàng</th>
                  <th className="py-2.5 px-3 font-medium text-right">Hoa hồng</th>
                  <th className="py-2.5 px-3 font-medium">Chiều tiền</th>
                  <th className="py-2.5 px-3 font-medium text-right">Số tiền</th>
                  <th className="py-2.5 px-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(!balances || balances.length === 0) ? (
                  <tr><td colSpan={7} className="text-center text-ink/40 py-10">Không có khoản nào chờ đối soát.</td></tr>
                ) : balances.map((b) => (
                  <tr key={b.sellerId} className="border-b border-brand/5 last:border-0">
                    <td className="py-2.5 px-3 font-medium">{b.shopName}
                      {!b.bank?.bankAccountNo && <span className="ml-2 text-[11px] text-amber-600">(chưa có TK nhận tiền)</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right">{b.orderCount}</td>
                    <td className="py-2.5 px-3 text-right">{formatVND(b.goods)}</td>
                    <td className="py-2.5 px-3 text-right text-brand">{formatVND(b.commission)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${b.direction === 'PAYABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{DIRECTION_LABEL[b.direction]}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">{formatVND(b.amount)}</td>
                    <td className="py-2.5 px-3 text-right"><button onClick={() => makeSettlement(b)} className="text-brand hover:underline">Tạo đợt</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'settlements' && (
        loadingStl ? <p className="text-ink/40">Đang tải…</p> : (
          <div className="bg-white rounded-2xl border border-brand/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/50 border-b border-brand/10">
                  <th className="py-2.5 px-3 font-medium">Mã đợt</th>
                  <th className="py-2.5 px-3 font-medium">Gian hàng</th>
                  <th className="py-2.5 px-3 font-medium">Chiều</th>
                  <th className="py-2.5 px-3 font-medium text-right">Số tiền</th>
                  <th className="py-2.5 px-3 font-medium">Trạng thái</th>
                  <th className="py-2.5 px-3 font-medium">Ngày tạo</th>
                  <th className="py-2.5 px-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(!settlements || settlements.length === 0) ? (
                  <tr><td colSpan={7} className="text-center text-ink/40 py-10">Chưa có đợt đối soát.</td></tr>
                ) : settlements.map((s) => (
                  <tr key={s.id} className="border-b border-brand/5 last:border-0">
                    <td className="py-2.5 px-3 font-medium">{s.code}</td>
                    <td className="py-2.5 px-3">{s.shopName}</td>
                    <td className="py-2.5 px-3 text-[13px]">{DIRECTION_LABEL[s.direction]}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">{formatVND(s.netAmount)}</td>
                    <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>{SETTLEMENT_STATUS_LABEL[s.status]}</span></td>
                    <td className="py-2.5 px-3 text-ink/50 text-[13px]">{new Date(s.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button onClick={() => setDetailId(s.id)} className="text-ink/60 hover:underline mr-3">Chi tiết</button>
                      {s.status !== 'PAID' && s.status !== 'FAILED' && <button onClick={() => setPayFor(s)} className="text-brand hover:underline">Xác nhận TT</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {detailId != null && <DetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={refresh} />}
      {payFor && <PayModal settlement={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); refresh(); }} />}
    </div>
  );
}

function DetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { data: s, isLoading } = useQuery({ queryKey: ['settlement', id], queryFn: () => getSettlement(id) });
  async function doCancel() {
    if (!confirm('Hủy đợt đối soát này? Các đơn sẽ trở lại trạng thái chờ đối soát.')) return;
    try { await cancelSettlement(id); onChanged(); onClose(); } catch (e) { alert(getErrorMessage(e)); }
  }
  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold">Chi tiết đợt đối soát</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>
        {isLoading || !s ? <p className="text-ink/40 text-sm">Đang tải…</p> : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <p className="text-ink/50">Mã đợt</p><p className="font-medium text-right">{s.code}</p>
              <p className="text-ink/50">Gian hàng</p><p className="font-medium text-right">{s.shopName}</p>
              <p className="text-ink/50">Chiều tiền</p><p className="text-right">{DIRECTION_LABEL[s.direction]}</p>
              <p className="text-ink/50">Tổng tiền hàng</p><p className="text-right">{formatVND(s.grossAmount)}</p>
              <p className="text-ink/50">Hoa hồng</p><p className="text-right text-brand">{formatVND(s.commissionAmount)}</p>
              <p className="text-ink/50">Số thực chi trả</p><p className="text-right font-semibold">{formatVND(s.netAmount)}</p>
              <p className="text-ink/50">Trạng thái</p><p className="text-right">{SETTLEMENT_STATUS_LABEL[s.status]}</p>
              {s.transactionReference && (<><p className="text-ink/50">Mã giao dịch</p><p className="text-right">{s.transactionReference}</p></>)}
              {s.bank?.bankAccountNo && (<><p className="text-ink/50">Tài khoản nhận</p><p className="text-right">{s.bank.bankName} · {s.bank.bankAccountNo} · {s.bank.bankAccountName}</p></>)}
            </div>
            <h4 className="font-medium text-sm mb-2">Các đơn trong đợt</h4>
            <div className="overflow-x-auto border border-brand/10 rounded-lg">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-ink/50 border-b border-brand/10">
                  <th className="py-2 px-2 font-medium">Mã đơn</th>
                  <th className="py-2 px-2 font-medium text-right">Tiền hàng</th>
                  <th className="py-2 px-2 font-medium text-right">Hoa hồng</th>
                  <th className="py-2 px-2 font-medium text-right">Net</th>
                </tr></thead>
                <tbody>
                  {s.items?.map((it) => (
                    <tr key={it.id} className="border-b border-brand/5 last:border-0">
                      <td className="py-2 px-2">{it.orderCode ?? `#${it.orderId}`}</td>
                      <td className="py-2 px-2 text-right">{formatVND(it.orderAmount)}</td>
                      <td className="py-2 px-2 text-right text-brand">{formatVND(it.commissionAmount)}</td>
                      <td className="py-2 px-2 text-right">{formatVND(it.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.status !== 'PAID' && (
              <div className="mt-4 text-right"><button onClick={doCancel} className="text-red-500 hover:underline text-sm">Hủy đợt đối soát</button></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PayModal({ settlement, onClose, onDone }: { settlement: Settlement; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState('Chuyển khoản ngân hàng');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!ref.trim()) { alert('Nhập mã giao dịch / chứng từ.'); return; }
    setBusy(true);
    try { await confirmSettlementPayment(settlement.id, { paymentMethod: method, transactionReference: ref.trim(), note: note.trim() || undefined }); onDone(); }
    catch (e) { alert(getErrorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold mb-1">Xác nhận thanh toán</h3>
        <p className="text-sm text-ink/50 mb-4">{settlement.code} · {DIRECTION_LABEL[settlement.direction]} · <b>{formatVND(settlement.netAmount)}</b></p>
        <div className="space-y-3 text-sm">
          <label className="block"><span className="text-ink/60">Hình thức</span>
            <input value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" />
          </label>
          <label className="block"><span className="text-ink/60">Mã giao dịch / chứng từ</span>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" placeholder="VD: FT24xxxx" />
          </label>
          <label className="block"><span className="text-ink/60">Ghi chú</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" />
          </label>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="border border-brand/20 rounded-lg px-4 py-2 text-sm">Hủy</button>
          <button onClick={submit} disabled={busy} className="bg-brand text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50">Xác nhận đã chi trả</button>
        </div>
      </div>
    </div>
  );
}

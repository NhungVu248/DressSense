import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listVouchers, applyVoucher, type Voucher, type VoucherKind } from '../lib/cart';
import { formatVND } from '../lib/products';

export interface AppliedVoucher { code: string; discount: number; kind: VoucherKind }

// Bộ chọn voucher kiểu Shopee: 2 mục Giảm giá & Vận chuyển, chọn 1 mã mỗi loại.
export default function VoucherPicker({
  subtotal, shipFee, applied, appliedShip, onApply, onClear, onClose,
}: {
  subtotal: number;
  shipFee: number;
  applied: AppliedVoucher | null;
  appliedShip: AppliedVoucher | null;
  onApply: (v: AppliedVoucher) => void; // kind quyết định ô nào được set
  onClear: (kind: VoucherKind) => void;
  onClose: () => void;
}) {
  const { data: vouchers } = useQuery({ queryKey: ['vouchers-list'], queryFn: listVouchers });
  const [manual, setManual] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const discountList = useMemo(() => (vouchers ?? []).filter((v) => v.kind !== 'SHIPPING'), [vouchers]);
  const shipList = useMemo(() => (vouchers ?? []).filter((v) => v.kind === 'SHIPPING'), [vouchers]);

  async function pick(code: string) {
    setMsg(''); setBusy(true);
    try {
      const r = await applyVoucher(code.trim().toUpperCase(), subtotal, shipFee);
      if (r.valid && r.voucher) onApply({ code: r.voucher.code, discount: r.discount, kind: r.voucher.kind });
      else setMsg(r.message);
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? 'Không áp dụng được mã này.');
    } finally { setBusy(false); }
  }

  const isPicked = (code: string) => applied?.code === code || appliedShip?.code === code;

  function Row({ v }: { v: Voucher }) {
    const picked = isPicked(v.code);
    const isShip = v.kind === 'SHIPPING';
    const belowMin = subtotal < v.minOrder;
    const shipNoFee = isShip && shipFee <= 0; // trong giỏ hàng chưa biết phí ship -> áp ở bước thanh toán
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${picked ? 'border-brand bg-brand-light/40' : 'border-black/10'}`}>
        <div className={`w-10 h-10 rounded-lg grid place-items-center text-white shrink-0 ${isShip ? 'bg-emerald-500' : 'bg-brand'}`}>
          {isShip ? '🚚' : '%'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">{v.code}</p>
          <p className="text-xs text-gray-500 truncate">
            {v.type === 'PERCENT' ? `Giảm ${v.value}%` : `Giảm ${formatVND(v.value)}`}
            {v.maxDiscount ? ` (tối đa ${formatVND(v.maxDiscount)})` : ''}
            {v.minOrder > 0 ? ` · đơn từ ${formatVND(v.minOrder)}` : ''}
          </p>
          {v.description && <p className="text-[11px] text-gray-400 truncate">{v.description}</p>}
        </div>
        {picked ? (
          <button onClick={() => onClear(v.kind)} className="text-xs text-gray-500 border border-black/10 rounded-full px-3 py-1">Bỏ</button>
        ) : (
          <button onClick={() => pick(v.code)} disabled={busy || belowMin || shipNoFee}
            className="text-xs bg-brand text-white rounded-full px-3 py-1 disabled:opacity-40">
            {shipNoFee ? 'Khi thanh toán' : belowMin ? 'Chưa đủ ĐK' : 'Chọn'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-ink">Chọn mã khuyến mãi</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Nhập tay */}
        <div className="flex gap-2 mb-4">
          <input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="Nhập mã" className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm uppercase" />
          <button onClick={() => manual.trim() && pick(manual)} disabled={busy} className="bg-ink text-white rounded-lg px-3 text-sm disabled:opacity-50">Áp dụng</button>
        </div>
        {msg && <p className="text-xs text-red-500 mb-3">{msg}</p>}

        {/* Mã giảm giá */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mã giảm giá</p>
        <div className="space-y-2 mb-4">
          {discountList.length === 0 ? <p className="text-xs text-gray-400">Chưa có mã giảm giá khả dụng.</p>
            : discountList.map((v) => <Row key={v.code} v={v} />)}
        </div>

        {/* Mã vận chuyển */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mã vận chuyển</p>
        <div className="space-y-2">
          {shipList.length === 0 ? <p className="text-xs text-gray-400">Chưa có mã vận chuyển khả dụng.</p>
            : shipList.map((v) => <Row key={v.code} v={v} />)}
        </div>

        <button onClick={onClose} className="w-full mt-5 bg-brand text-white rounded-lg py-2.5 text-sm">Xong</button>
      </div>
    </div>
  );
}

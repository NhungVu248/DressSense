import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatVND } from '../lib/products';
import { applyVoucher } from '../lib/cart';
import {
  getCheckoutInfo, placeOrder, createAddress,
  PAYMENT_METHOD_LABEL, type PaymentMethod, type Address,
} from '../lib/order';

const FREE_SHIP = 699000;

export default function CheckoutPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['checkout'], queryFn: getCheckoutInfo });

  const [addressId, setAddressId] = useState<number | null>(null);
  const [shipping, setShipping] = useState('STANDARD');
  const [payment, setPayment] = useState<PaymentMethod>('COD');
  const [voucher, setVoucher] = useState('');
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [voucherMsg, setVoucherMsg] = useState('');
  const [note, setNote] = useState('');
  const [showAddr, setShowAddr] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const subtotal = data?.subtotal ?? 0;
  const shipFee = useMemo(() => {
    if (subtotal >= FREE_SHIP) return 0;
    return data?.shippingMethods.find((m) => m.code === shipping)?.fee ?? 0;
  }, [data, shipping, subtotal]);
  const discount = applied?.discount ?? 0;
  const total = Math.max(0, subtotal - discount + shipFee);

  // chọn địa chỉ mặc định khi tải xong
  const defaultAddr = data?.addresses.find((a) => a.isDefault) ?? data?.addresses[0];
  const selectedAddr = addressId ?? defaultAddr?.id ?? null;

  const paymentOptions: PaymentMethod[] = data?.vnpayEnabled ? ['COD', 'VNPAY', 'VISA'] : ['COD'];

  async function doApplyVoucher() {
    setVoucherMsg('');
    if (!voucher.trim()) return;
    const r = await applyVoucher(voucher.trim(), subtotal);
    if (r.valid && r.voucher) { setApplied({ code: r.voucher.code, discount: r.discount }); setVoucher(''); }
    else { setApplied(null); setVoucherMsg(r.message); }
  }

  async function submit() {
    setError('');
    if (!selectedAddr) { setError('Vui lòng chọn địa chỉ giao hàng.'); return; }
    setPlacing(true);
    try {
      const res = await placeOrder({ addressId: selectedAddr, shippingMethod: shipping, paymentMethod: payment, voucherCode: applied?.code, note: note || undefined });
      qc.invalidateQueries({ queryKey: ['cart-count'] });
      if (res.payUrl) { window.location.href = res.payUrl; return; } // chuyển sang cổng VNPAY
      nav(`/checkout/result?orderId=${res.order.id}&status=success&cod=1`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Không đặt được hàng, vui lòng thử lại.');
    } finally { setPlacing(false); }
  }

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải…</p>;
  const validItems = data?.items.filter((i) => i.valid) ?? [];
  if (validItems.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <p className="font-display text-2xl text-ink">Không có sản phẩm để đặt</p>
        <p className="text-sm text-gray-500 mt-2">Hãy chọn sản phẩm trong giỏ hàng trước khi thanh toán.</p>
        <button onClick={() => nav('/cart')} className="mt-5 bg-brand text-white rounded-full px-5 py-2.5 text-sm">Về giỏ hàng</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-6">Thanh toán</h1>
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5 mb-4">{error}</div>}

      <div className="grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
        <div className="space-y-5">
          {/* Địa chỉ giao hàng */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-ink">Địa chỉ giao hàng</h2>
              <button onClick={() => setShowAddr((v) => !v)} className="text-xs text-brand hover:underline">+ Thêm địa chỉ</button>
            </div>
            {data!.addresses.length === 0 && !showAddr && <p className="text-sm text-gray-400">Chưa có địa chỉ. Hãy thêm địa chỉ giao hàng.</p>}
            <div className="space-y-2">
              {data!.addresses.map((a) => (
                <label key={a.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${selectedAddr === a.id ? 'border-brand bg-brand-light/40' : 'border-black/10'}`}>
                  <input type="radio" name="addr" checked={selectedAddr === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-brand" />
                  <span className="text-sm">
                    <span className="font-medium text-ink">{a.recipientName}</span> · {a.phone}
                    {a.isDefault && <span className="ml-2 text-[10px] bg-brand text-white px-1.5 py-0.5 rounded">Mặc định</span>}
                    <span className="block text-gray-500">{a.detail}, {a.ward}, {a.district}, {a.province}</span>
                  </span>
                </label>
              ))}
            </div>
            {showAddr && <AddressForm onDone={async () => { setShowAddr(false); await refetch(); }} />}
          </section>

          {/* Vận chuyển */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <h2 className="font-medium text-ink mb-3">Phương thức vận chuyển</h2>
            <div className="space-y-2">
              {data!.shippingMethods.map((m) => (
                <label key={m.code} className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer ${shipping === m.code ? 'border-brand bg-brand-light/40' : 'border-black/10'}`}>
                  <span className="flex items-center gap-2 text-sm">
                    <input type="radio" name="ship" checked={shipping === m.code} onChange={() => setShipping(m.code)} className="accent-brand" />
                    <span><span className="text-ink">{m.label}</span> <span className="text-gray-400">· {m.eta}</span></span>
                  </span>
                  <span className="text-sm">{subtotal >= FREE_SHIP ? <span className="text-brand">Miễn phí</span> : formatVND(m.fee)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Thanh toán */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <h2 className="font-medium text-ink mb-3">Phương thức thanh toán</h2>
            <div className="space-y-2">
              {paymentOptions.map((m) => (
                <label key={m} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${payment === m ? 'border-brand bg-brand-light/40' : 'border-black/10'}`}>
                  <input type="radio" name="pay" checked={payment === m} onChange={() => setPayment(m)} className="accent-brand" />
                  <span className="text-ink">{PAYMENT_METHOD_LABEL[m]}</span>
                </label>
              ))}
              {!data!.vnpayEnabled && <p className="text-xs text-gray-400">Thanh toán online (VNPAY/Visa) chưa được cấu hình trên máy chủ — hiện dùng COD.</p>}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho đơn hàng (tuỳ chọn)" rows={2}
              className="w-full mt-3 border border-black/10 rounded-lg px-3 py-2 text-sm" />
          </section>

          {/* Sản phẩm */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <h2 className="font-medium text-ink mb-3">Sản phẩm ({validItems.length})</h2>
            <ul className="divide-y divide-black/5">
              {validItems.map((it) => (
                <li key={it.cartItemId} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{it.name} {it.size && <span className="text-gray-400">· Size {it.size}</span>} <span className="text-gray-400">× {it.quantity}</span></span>
                  <span>{formatVND(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Tóm tắt */}
        <aside className="bg-white rounded-xl border border-black/5 p-5 lg:sticky lg:top-28 space-y-4">
          <h2 className="font-medium text-ink">Tóm tắt</h2>
          <div className="flex gap-2">
            <input value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase())} placeholder="Mã giảm giá" className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm uppercase" />
            <button onClick={doApplyVoucher} className="bg-ink text-white rounded-lg px-3 text-sm">Áp dụng</button>
          </div>
          {voucherMsg && <p className="text-xs text-red-500">{voucherMsg}</p>}
          {applied && <div className="flex items-center justify-between text-sm bg-brand-light rounded-lg px-3 py-2"><span className="text-brand font-medium">{applied.code}</span><button onClick={() => setApplied(null)} className="text-xs text-gray-500">Bỏ</button></div>}

          <div className="border-t border-black/5 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Tạm tính</span><span>{formatVND(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-brand"><span>Giảm giá</span><span>−{formatVND(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Vận chuyển</span><span>{shipFee === 0 ? 'Miễn phí' : formatVND(shipFee)}</span></div>
            <div className="flex justify-between font-semibold text-ink text-base pt-1"><span>Tổng cộng</span><span>{formatVND(total)}</span></div>
          </div>

          <button onClick={submit} disabled={placing || !selectedAddr}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg py-3 font-medium">
            {placing ? 'Đang đặt hàng…' : payment === 'COD' ? 'Đặt hàng' : 'Đặt hàng & thanh toán'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Nhấn Đặt hàng nghĩa là bạn đồng ý với điều khoản mua hàng của DressSense.</p>
        </aside>
      </div>
    </div>
  );
}

function AddressForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ recipientName: '', phone: '', province: '', district: '', ward: '', detail: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  async function save() {
    if (!f.recipientName || !f.phone || !f.province || !f.district || !f.ward || !f.detail) { alert('Vui lòng điền đầy đủ thông tin địa chỉ.'); return; }
    setBusy(true);
    try { await createAddress({ ...f, isDefault: true }); onDone(); }
    catch { alert('Không lưu được địa chỉ.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3 border-t border-black/5 pt-3 grid grid-cols-2 gap-2">
      <input value={f.recipientName} onChange={set('recipientName')} placeholder="Họ tên người nhận" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.phone} onChange={set('phone')} placeholder="Số điện thoại" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.province} onChange={set('province')} placeholder="Tỉnh/Thành phố" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.district} onChange={set('district')} placeholder="Quận/Huyện" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.ward} onChange={set('ward')} placeholder="Phường/Xã" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.detail} onChange={set('detail')} placeholder="Địa chỉ chi tiết" className="border border-black/10 rounded-lg px-3 py-2 text-sm col-span-2" />
      <button onClick={save} disabled={busy} className="col-span-2 bg-brand text-white rounded-lg py-2 text-sm disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu địa chỉ'}</button>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { formatVND } from '../../lib/products';
import {
  listMyVoucherOrders, createVoucherOrder, payVoucherOrder, markVoucherOrderPaid, cancelVoucherOrder,
  PACKAGE_LABEL, VO_STATUS_LABEL, type VoucherPackage, type CreateVoucherOrderInput,
} from '../../lib/voucherOrders';

// Backlog B.27 - Người bán mua gói voucher (tự chịu phần giảm giá cho khách).
const inp = 'w-full border border-brand/20 rounded-lg px-3 py-2 text-sm';

const STATUS_CLS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700',
  PENDING_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
};

const EMPTY: CreateVoucherOrderInput = {
  packageType: 'SINGLE', desiredCode: '', description: '', discountType: 'PERCENT',
  value: 10, minOrder: 0, maxDiscount: null, startsAt: '', endsAt: '',
  usageLimit: null, perUserLimit: null, paymentMethod: 'VNPAY',
};

export default function SellerVoucherOrdersPage() {
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [f, setF] = useState<CreateVoucherOrderInput>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  const { data: orders, isLoading } = useQuery({ queryKey: ['my-voucher-orders'], queryFn: listMyVoucherOrders });
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-voucher-orders'] });

  const createM = useMutation({
    mutationFn: () => createVoucherOrder({
      ...f, description: f.description || null,
      maxDiscount: f.maxDiscount || null, usageLimit: f.usageLimit || null, perUserLimit: f.perUserLimit || null,
    }),
    onSuccess: () => { setF(EMPTY); setShowForm(false); setErr(''); refresh(); },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Không thể tạo đơn.'),
  });
  const payM = useMutation({ mutationFn: (id: number) => payVoucherOrder(id), onSuccess: (url) => { window.location.href = url; }, onError: (e: any) => setErr(e?.response?.data?.message ?? 'Lỗi thanh toán.') });
  const markM = useMutation({ mutationFn: (id: number) => markVoucherOrderPaid(id), onSuccess: refresh });
  const cancelM = useMutation({ mutationFn: (id: number) => cancelVoucherOrder(id), onSuccess: refresh });

  const payStatus = sp.get('status');

  return (
    <div className="p-5 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink/40">Khuyến mãi</p>
          <h1 className="font-display text-3xl font-bold">Mua gói voucher</h1>
          <p className="text-sm text-ink/50 mt-1">Người bán tự chịu phần tiền giảm cho khách; trả phí gói cho sàn.</p>
        </div>
        <button onClick={() => { setShowForm((v) => !v); setErr(''); }} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium shrink-0">
          {showForm ? 'Đóng' : '+ Mua voucher'}
        </button>
      </div>

      {payStatus === 'success' && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2">Thanh toán phí gói voucher thành công. Đơn đang chờ duyệt.</div>}
      {payStatus === 'fail' && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2">Thanh toán chưa thành công. Bạn có thể thử lại.</div>}
      {err && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2">{err}</div>}

      {showForm && (
        <div className="rounded-2xl border border-brand/10 bg-white p-4 mb-6 grid grid-cols-2 gap-3">
          <label className="text-sm">Loại gói
            <select value={f.packageType} onChange={(e) => setF({ ...f, packageType: e.target.value as VoucherPackage })} className={inp}>
              {(Object.keys(PACKAGE_LABEL) as VoucherPackage[]).map((p) => <option key={p} value={p}>{PACKAGE_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="text-sm">Phương thức thanh toán
            <select value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value as any })} className={inp}>
              <option value="VNPAY">VNPAY</option>
              <option value="VISA">Thẻ quốc tế (Visa)</option>
            </select>
          </label>
          <label className="text-sm">Mã voucher mong muốn<input value={f.desiredCode} onChange={(e) => setF({ ...f, desiredCode: e.target.value.toUpperCase() })} className={inp} placeholder="VD: SALE10" /></label>
          <label className="text-sm">Mô tả<input value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} className={inp} /></label>
          <label className="text-sm">Loại giảm
            <select value={f.discountType} onChange={(e) => setF({ ...f, discountType: e.target.value as any })} className={inp}>
              <option value="PERCENT">Phần trăm (%)</option>
              <option value="FIXED">Số tiền (đ)</option>
            </select>
          </label>
          <label className="text-sm">Giá trị giảm<input type="number" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} className={inp} /></label>
          <label className="text-sm">Đơn tối thiểu (đ)<input type="number" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: Number(e.target.value) })} className={inp} /></label>
          {f.discountType === 'PERCENT' && <label className="text-sm">Trần giảm (đ)<input type="number" value={f.maxDiscount ?? ''} onChange={(e) => setF({ ...f, maxDiscount: e.target.value ? Number(e.target.value) : null })} className={inp} /></label>}
          <label className="text-sm">Bắt đầu<input type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={inp} /></label>
          <label className="text-sm">Kết thúc<input type="date" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={inp} /></label>
          <label className="text-sm">Tổng lượt dùng<input type="number" value={f.usageLimit ?? ''} onChange={(e) => setF({ ...f, usageLimit: e.target.value ? Number(e.target.value) : null })} className={inp} placeholder="Không giới hạn" /></label>
          <label className="text-sm">Lượt / khách<input type="number" value={f.perUserLimit ?? ''} onChange={(e) => setF({ ...f, perUserLimit: e.target.value ? Number(e.target.value) : null })} className={inp} placeholder="Không giới hạn" /></label>
          <div className="col-span-2 flex items-center gap-3">
            <button onClick={() => createM.mutate()} disabled={createM.isPending || !f.desiredCode || !f.value || !f.startsAt || !f.endsAt} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">
              {createM.isPending ? 'Đang tạo…' : 'Tạo đơn (tính phí gói)'}
            </button>
            <p className="text-xs text-ink/50">Phí gói tính theo loại gói, hiển thị sau khi tạo đơn.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-ink/50">Đang tải…</p>
      ) : !orders?.length ? (
        <p className="text-sm text-ink/40">Chưa có đơn mua voucher nào.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-brand/10 bg-white p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{o.desiredCode}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">{PACKAGE_LABEL[o.packageType]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[o.status] ?? 'bg-gray-100'}`}>{VO_STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <p className="text-xs text-ink/50 mt-0.5">
                  Giảm {o.discountType === 'PERCENT' ? `${o.value}%${o.maxDiscount ? ` (tối đa ${formatVND(o.maxDiscount)})` : ''}` : formatVND(o.value)}
                  {o.minOrder ? ` · đơn từ ${formatVND(o.minOrder)}` : ''} · {o.startsAt.slice(0, 10)} → {o.endsAt.slice(0, 10)}
                </p>
                <p className="text-sm mt-0.5">Phí gói: <span className="font-semibold text-brand">{formatVND(o.fee)}</span> · {o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
                {o.status === 'REJECTED' && o.reviewReason && <p className="text-xs text-red-600 mt-0.5">Lý do từ chối: {o.reviewReason}</p>}
              </div>
              {o.status === 'PENDING_PAYMENT' && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => payM.mutate(o.id)} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm">Thanh toán VNPAY</button>
                  <button onClick={() => markM.mutate(o.id)} className="px-3 py-1.5 rounded-lg border border-brand/30 text-sm text-ink/70">Đánh dấu đã thanh toán (sandbox)</button>
                  <button onClick={() => cancelM.mutate(o.id)} className="px-3 py-1.5 rounded-lg text-sm text-red-500">Hủy đơn</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

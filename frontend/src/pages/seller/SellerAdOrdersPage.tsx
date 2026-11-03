import { useState } from 'react';
import { uploadFile } from '../../lib/upload';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { formatVND } from '../../lib/products';
import {
  listMyAdOrders, createAdOrder, payAdOrder, markAdOrderPaid, cancelAdOrder,
  AD_POSITION_LABEL, AD_STATUS_LABEL, type AdPosition, type CreateBannerOrderInput,
} from '../../lib/ads';

// Backlog B.26 - Người bán đăng ký chạy banner quảng cáo + trả phí.
const inp = 'w-full border border-brand/20 rounded-lg px-3 py-2 text-sm';

const STATUS_CLS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700',
  PENDING_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  RUNNING: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
  ENDED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const EMPTY: CreateBannerOrderInput = {
  name: '', imageUrl: '', title: '', subtitle: '',
  position: 'HOME_HERO', linkType: 'NONE', linkValue: '',
  startsAt: '', endsAt: '', paymentMethod: 'VNPAY',
};

export default function SellerAdOrdersPage() {
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [f, setF] = useState<CreateBannerOrderInput>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);

  const { data: orders, isLoading } = useQuery({ queryKey: ['my-ad-orders'], queryFn: listMyAdOrders });

  const refresh = () => qc.invalidateQueries({ queryKey: ['my-ad-orders'] });

  const createM = useMutation({
    mutationFn: () => createAdOrder({ ...f, title: f.title || null, subtitle: f.subtitle || null, linkValue: f.linkValue || null }),
    onSuccess: () => { setF(EMPTY); setShowForm(false); setErr(''); refresh(); },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Không thể tạo đơn.'),
  });
  const payM = useMutation({ mutationFn: (id: number) => payAdOrder(id), onSuccess: (url) => { window.location.href = url; }, onError: (e: any) => setErr(e?.response?.data?.message ?? 'Lỗi thanh toán.') });
  const markM = useMutation({ mutationFn: (id: number) => markAdOrderPaid(id), onSuccess: refresh });
  const cancelM = useMutation({ mutationFn: (id: number) => cancelAdOrder(id), onSuccess: refresh });

  const paidBanner = sp.get('status');

  return (
    <div className="p-5 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink/40">Quảng cáo</p>
          <h1 className="font-display text-3xl font-bold">Đăng ký chạy banner</h1>
        </div>
        <button onClick={() => { setShowForm((v) => !v); setErr(''); }} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium">
          {showForm ? 'Đóng' : '+ Đăng ký mới'}
        </button>
      </div>

      {paidBanner === 'success' && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2">Thanh toán phí quảng cáo thành công. Đơn đang chờ Quản trị viên duyệt.</div>}
      {paidBanner === 'fail' && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2">Thanh toán chưa thành công. Bạn có thể thử lại.</div>}
      {err && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2">{err}</div>}

      {showForm && (
        <div className="rounded-2xl border border-brand/10 bg-white p-4 mb-6 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm">Tên chiến dịch<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></label>
          <div className="col-span-2 space-y-1.5">
            <span className="block text-sm font-medium text-ink/80">Ảnh banner quảng cáo <span className="text-red-500">*</span></span>
            {f.imageUrl ? (
              <div className="relative group rounded-xl overflow-hidden border border-brand/20 bg-brand/5 h-36">
                <img src={f.imageUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.opacity = '0.3'; }} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="cursor-pointer bg-white text-ink text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-100">
                    {uploadingImg ? 'Đang tải…' : 'Đổi ảnh banner khác'}
                    <input type="file" accept="image/*" disabled={uploadingImg} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingImg(true);
                      try {
                        const url = await uploadFile(file);
                        setF((prev) => ({ ...prev, imageUrl: url }));
                      } catch (err: any) {
                        setErr(err?.response?.data?.message || 'Không thể tải ảnh lên.');
                      } finally { setUploadingImg(false); }
                    }} className="hidden" />
                  </label>
                  <button type="button" onClick={() => setF((prev) => ({ ...prev, imageUrl: '' }))} className="bg-red-600 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-700">Xóa</button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-brand/20 hover:border-brand/40 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-brand-light/20 hover:bg-brand-light/40">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-brand mb-1">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                </svg>
                <span className="text-xs font-medium text-brand">
                  {uploadingImg ? 'Đang tải ảnh lên…' : 'Bấm để tải tệp ảnh banner lên'}
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">JPG, PNG, WEBP (tối đa 10MB)</span>
                <input type="file" accept="image/*" disabled={uploadingImg} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingImg(true);
                  try {
                    const url = await uploadFile(file);
                    setF((prev) => ({ ...prev, imageUrl: url }));
                  } catch (err: any) {
                    setErr(err?.response?.data?.message || 'Không thể tải ảnh lên.');
                  } finally { setUploadingImg(false); }
                }} className="hidden" />
              </label>
            )}
          </div>
          <label className="text-sm">Tiêu đề<input value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} className={inp} /></label>
          <label className="text-sm">Mô tả ngắn<input value={f.subtitle ?? ''} onChange={(e) => setF({ ...f, subtitle: e.target.value })} className={inp} /></label>
          <label className="text-sm">Vị trí hiển thị
            <select value={f.position} onChange={(e) => setF({ ...f, position: e.target.value as AdPosition })} className={inp}>
              {(Object.keys(AD_POSITION_LABEL) as AdPosition[]).map((p) => <option key={p} value={p}>{AD_POSITION_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="text-sm">Phương thức thanh toán
            <select value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value as any })} className={inp}>
              <option value="VNPAY">VNPAY</option>
              <option value="VISA">Thẻ quốc tế (Visa)</option>
            </select>
          </label>
          <label className="text-sm">Bắt đầu<input type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={inp} /></label>
          <label className="text-sm">Kết thúc<input type="date" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={inp} /></label>
          <label className="text-sm">Liên kết đích
            <select value={f.linkType} onChange={(e) => setF({ ...f, linkType: e.target.value as any })} className={inp}>
              <option value="NONE">Không</option>
              <option value="PRODUCT">Sản phẩm (ID)</option>
              <option value="CATEGORY">Danh mục (ID)</option>
              <option value="PROMO">Chương trình</option>
              <option value="URL">Đường dẫn</option>
            </select>
          </label>
          {f.linkType !== 'NONE' && <label className="text-sm">Giá trị liên kết<input value={f.linkValue ?? ''} onChange={(e) => setF({ ...f, linkValue: e.target.value })} className={inp} /></label>}
          <div className="col-span-2 flex items-center gap-3">
            <button onClick={() => createM.mutate()} disabled={createM.isPending || !f.name || !f.imageUrl || !f.startsAt || !f.endsAt} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">
              {createM.isPending ? 'Đang tạo…' : 'Tạo đơn (tính phí theo tuần)'}
            </button>
            <p className="text-xs text-ink/50">Phí = đơn giá/tuần theo vị trí × số tuần, tính khi tạo đơn.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-ink/50">Đang tải…</p>
      ) : !orders?.length ? (
        <p className="text-sm text-ink/40">Chưa có đơn quảng cáo nào.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-brand/10 bg-white p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-28 h-16 rounded-lg overflow-hidden bg-brand/5 shrink-0"><img src={o.imageUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.opacity = '0'; }} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{o.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[o.status] ?? 'bg-gray-100'}`}>{AD_STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <p className="text-xs text-ink/50 mt-0.5">{AD_POSITION_LABEL[o.position]} · {o.weeks} tuần · {o.startsAt.slice(0, 10)} → {o.endsAt.slice(0, 10)}</p>
                <p className="text-sm mt-0.5">Phí: <span className="font-semibold text-brand">{formatVND(o.amount)}</span> · {o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
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

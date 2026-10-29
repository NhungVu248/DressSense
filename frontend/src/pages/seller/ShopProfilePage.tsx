import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyShop, updateMyShop, submitMyShop, SHOP_STATUS_LABEL, SHOP_STATUS_CLS, type Shop,
} from '../../lib/shop';

// UC14.1 - Quản lý gian hàng (hồ sơ + gửi kiểm duyệt)
type Form = Partial<Shop>;

function Field({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink/70">{label}{required && <span className="text-red-500"> *</span>}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
      />
    </label>
  );
}

export default function ShopProfilePage() {
  const qc = useQueryClient();
  const { data: shop, isLoading } = useQuery({ queryKey: ['my-shop'], queryFn: getMyShop });
  const [f, setF] = useState<Form>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { if (shop) setF(shop); }, [shop]);
  const set = (k: keyof Shop) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => updateMyShop(f),
    onSuccess: (s) => { qc.setQueryData(['my-shop'], s); setMsg({ type: 'ok', text: 'Đã lưu thông tin gian hàng.' }); },
    onError: (e: any) => setMsg({ type: 'err', text: e?.response?.data?.message ?? 'Lưu thất bại.' }),
  });

  const submitMut = useMutation({
    mutationFn: async () => { await updateMyShop(f); return submitMyShop(); },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['my-shop'] }); setMsg({ type: 'ok', text: r.message }); },
    onError: (e: any) => setMsg({ type: 'err', text: e?.response?.data?.message ?? 'Gửi duyệt thất bại.' }),
  });

  if (isLoading || !shop) return <div className="p-8 text-sm text-ink/50">Đang tải hồ sơ gian hàng…</div>;

  const st = f.status ?? shop.status;
  const canSubmit = st === 'DRAFT' || st === 'REJECTED';
  const busy = saveMut.isPending || submitMut.isPending;

  return (
    <div className="p-5 md:p-8 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl font-bold">Thông tin gian hàng</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${SHOP_STATUS_CLS[st!]}`}>{SHOP_STATUS_LABEL[st!]}</span>
      </div>
      <p className="text-sm text-ink/50 mb-5">
        Quy trình: Bản nháp → Chờ duyệt → Đang hoạt động. Gian hàng chưa được duyệt sẽ không thể bán sản phẩm.
      </p>

      {/* Trạng thái đặc biệt */}
      {st === 'PENDING' && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
          Hồ sơ đang chờ Quản trị viên kiểm duyệt. Bạn vẫn có thể chỉnh sửa và lưu, nhưng nên đợi kết quả duyệt.
        </div>
      )}
      {st === 'REJECTED' && shop.rejectReason && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          <b>Hồ sơ bị từ chối.</b> Lý do: {shop.rejectReason}. Vui lòng chỉnh sửa và gửi lại.
        </div>
      )}
      {st === 'SUSPENDED' && (
        <div className="mb-5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm px-4 py-3">
          Gian hàng đang bị tạm ngưng. Vui lòng liên hệ Quản trị viên.
        </div>
      )}

      {msg && (
        <div className={`mb-5 text-sm px-4 py-3 rounded-xl ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Thông tin cơ bản */}
        <section className="rounded-2xl border border-brand/10 bg-white p-5 space-y-4">
          <h2 className="font-display text-lg font-bold">Thông tin cơ bản</h2>
          <Field label="Tên gian hàng" value={f.name ?? ''} onChange={set('name')} required placeholder="VD: DressSense Store" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Logo (URL)" value={f.logoUrl ?? ''} onChange={set('logoUrl')} placeholder="https://…" />
            <Field label="Ảnh bìa (URL)" value={f.coverUrl ?? ''} onChange={set('coverUrl')} placeholder="https://…" />
          </div>
          <label className="block">
            <span className="text-sm text-ink/70">Mô tả gian hàng <span className="text-red-500">*</span></span>
            <textarea
              value={f.description ?? ''} onChange={(e) => set('description')(e.target.value)} rows={3}
              placeholder="Giới thiệu ngắn về gian hàng của bạn…"
              className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email liên hệ" value={f.contactEmail ?? ''} onChange={set('contactEmail')} type="email" placeholder="shop@email.com" />
            <Field label="Số điện thoại liên hệ" value={f.contactPhone ?? ''} onChange={set('contactPhone')} placeholder="09xxxxxxxx" />
          </div>
        </section>

        {/* Địa chỉ lấy hàng */}
        <section className="rounded-2xl border border-brand/10 bg-white p-5 space-y-4">
          <h2 className="font-display text-lg font-bold">Địa chỉ lấy hàng <span className="text-red-500">*</span></h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Người liên hệ" value={f.pickupName ?? ''} onChange={set('pickupName')} />
            <Field label="Số điện thoại" value={f.pickupPhone ?? ''} onChange={set('pickupPhone')} />
            <Field label="Tỉnh/Thành" value={f.pickupProvince ?? ''} onChange={set('pickupProvince')} />
            <Field label="Quận/Huyện" value={f.pickupDistrict ?? ''} onChange={set('pickupDistrict')} />
            <Field label="Phường/Xã" value={f.pickupWard ?? ''} onChange={set('pickupWard')} />
            <Field label="Địa chỉ chi tiết" value={f.pickupDetail ?? ''} onChange={set('pickupDetail')} />
          </div>
        </section>

        {/* Địa chỉ hoàn hàng */}
        <section className="rounded-2xl border border-brand/10 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Địa chỉ hoàn hàng</h2>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox" checked={f.returnSameAsPickup ?? true}
                onChange={(e) => setF((s) => ({ ...s, returnSameAsPickup: e.target.checked }))}
              />
              Dùng chung địa chỉ lấy hàng
            </label>
          </div>
          {!(f.returnSameAsPickup ?? true) && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Người liên hệ" value={f.returnName ?? ''} onChange={set('returnName')} />
              <Field label="Số điện thoại" value={f.returnPhone ?? ''} onChange={set('returnPhone')} />
              <Field label="Tỉnh/Thành" value={f.returnProvince ?? ''} onChange={set('returnProvince')} />
              <Field label="Quận/Huyện" value={f.returnDistrict ?? ''} onChange={set('returnDistrict')} />
              <Field label="Phường/Xã" value={f.returnWard ?? ''} onChange={set('returnWard')} />
              <Field label="Địa chỉ chi tiết" value={f.returnDetail ?? ''} onChange={set('returnDetail')} />
            </div>
          )}
        </section>

        {/* Hành động */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setMsg(null); saveMut.mutate(); }} disabled={busy}
            className="px-5 py-2.5 rounded-xl border border-brand/30 text-brand font-medium hover:bg-brand/5 disabled:opacity-50"
          >
            {saveMut.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
          </button>
          {canSubmit && (
            <button
              onClick={() => { setMsg(null); submitMut.mutate(); }} disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-brand text-white font-medium hover:bg-brand/90 disabled:opacity-50"
            >
              {submitMut.isPending ? 'Đang gửi…' : 'Gửi kiểm duyệt'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

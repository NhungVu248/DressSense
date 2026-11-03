import { useEffect, useState } from 'react';
import { uploadFile } from '../../lib/upload';
import { confirmDialog } from '../../components/Dialog';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';
import { fmtDate, toLocalInput, StatusBadge, inp, L, Modal, PageHeader, EmptyCard } from '../../components/promo-ui';

// UC13.2 - Quản lý banner quảng cáo (Quản trị viên).

interface Banner {
  id: number; name: string; imageUrl: string; title: string | null; subtitle: string | null;
  position: string; linkType: string; linkValue: string | null; priority: number;
  startsAt: string | null; endsAt: string | null; status: string;
}
const POSITION: Record<string, string> = { HOME_HERO: 'Trang chủ - Hero', HOME_STRIP: 'Trang chủ - Dải', PROMO_PAGE: 'Trang khuyến mãi' };
const LINK_TYPE: Record<string, string> = { NONE: 'Không', PRODUCT: 'Sản phẩm', CATEGORY: 'Danh mục', PROMO: 'Chương trình', URL: 'Đường dẫn' };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<Banner | 'new' | null>(null);

  function load() {
    setLoading(true);
    api.get('/admin/banners').then((r) => setBanners(r.data.banners)).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function act(url: string, okMsg: string) {
    setError(''); setSuccess('');
    try { await api.post(url); setSuccess(okMsg); load(); } catch (e) { setError(getErrorMessage(e)); }
  }
  async function del(b: Banner) {
    if (!(await confirmDialog(`Xóa banner "${b.name}"?`, { danger: true }))) return;
    setError(''); setSuccess('');
    try { await api.delete(`/admin/banners/${b.id}`); setSuccess('Đã xóa banner.'); load(); } catch (e) { setError(getErrorMessage(e)); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Banner quảng cáo" subtitle="Quản lý banner & chiến dịch nổi bật theo vị trí và thời gian hiển thị."
        action={<PrimaryButton style={{ width: 'auto' }} onClick={() => setForm('new')}>+ Tạo banner</PrimaryButton>} />
      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {loading ? <p className="text-gray-400">Đang tải...</p> : banners.length === 0 ? <EmptyCard label="Chưa có banner nào." /> : (
        <div className="grid sm:grid-cols-2 gap-4">
          {banners.map((b) => (
            <div key={b.id} className="bg-white border border-brand/10 rounded-xl overflow-hidden">
              <div className="h-28 bg-brand/5 relative">
                <img src={b.imageUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.opacity = '0'; }} />
                <div className="absolute top-2 right-2"><StatusBadge status={b.status} /></div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium line-clamp-1">{b.name}</span>
                  <span className="text-xs text-ink/50 shrink-0">Ưu tiên {b.priority}</span>
                </div>
                {b.title && <p className="text-sm text-ink/70 line-clamp-1">{b.title}</p>}
                <p className="text-xs text-gray-400 mt-1">{POSITION[b.position]} · Link: {LINK_TYPE[b.linkType]}</p>
                <p className="text-xs text-gray-400">{fmtDate(b.startsAt)} → {fmtDate(b.endsAt)}</p>
                <div className="flex gap-2 justify-end text-xs mt-2">
                  {(b.status === 'DRAFT' || b.status === 'SCHEDULED' || b.status === 'STOPPED') && <button onClick={() => act(`/admin/banners/${b.id}/activate`, 'Đã cho hiển thị banner.')} className="text-green-600 hover:underline">Hiển thị</button>}
                  {b.status === 'RUNNING' && <button onClick={() => act(`/admin/banners/${b.id}/hide`, 'Đã tạm ẩn banner.')} className="text-amber-600 hover:underline">Tạm ẩn</button>}
                  <button onClick={() => setForm(b)} className="text-brand hover:underline">Sửa</button>
                  <button onClick={() => del(b)} className="text-red-500 hover:underline">Xóa</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && <BannerFormModal initial={form === 'new' ? null : form} onClose={(ok) => { setForm(null); if (ok) { setSuccess('Đã lưu banner (trạng thái Nháp — nhớ bấm Hiển thị).'); load(); } }} />}
    </div>
  );
}

function BannerFormModal({ initial, onClose }: { initial: Banner | null; onClose: (ok: boolean) => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? '', imageUrl: initial?.imageUrl ?? '', title: initial?.title ?? '', subtitle: initial?.subtitle ?? '',
    position: initial?.position ?? 'HOME_HERO', linkType: initial?.linkType ?? 'NONE', linkValue: initial?.linkValue ?? '',
    priority: initial?.priority ?? 0, startsAt: toLocalInput(initial?.startsAt ?? null), endsAt: toLocalInput(initial?.endsAt ?? null),
  });
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false); const [uploadingImg, setUploadingImg] = useState(false);

  async function submit() {
    setErr(''); setSaving(true);
    const payload: any = {
      name: f.name, imageUrl: f.imageUrl, title: f.title || null, subtitle: f.subtitle || null,
      position: f.position, linkType: f.linkType, linkValue: f.linkType === 'NONE' ? null : (f.linkValue || null),
      priority: Number(f.priority), startsAt: f.startsAt || null, endsAt: f.endsAt || null,
    };
    try {
      if (initial) await api.patch(`/admin/banners/${initial.id}`, payload);
      else await api.post('/admin/banners', payload);
      onClose(true);
    } catch (e) { setErr(getErrorMessage(e)); setSaving(false); }
  }

  return (
    <Modal title={initial ? `Sửa banner` : 'Tạo banner'} onClose={() => onClose(false)}>
      <ErrorBox message={err} />
      <div className="grid grid-cols-2 gap-3">
        <L label="Tên banner" full><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></L>
        <div className="col-span-2 space-y-1.5">
          <span className="block text-xs font-medium text-gray-700">Ảnh banner <span className="text-red-500">*</span></span>
          {f.imageUrl ? (
            <div className="relative group rounded-xl overflow-hidden border border-brand/20 bg-brand/5 h-36">
              <img src={f.imageUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.opacity = '0.3'; }} />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <label className="cursor-pointer bg-white text-ink text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-100">
                  {uploadingImg ? 'Đang tải…' : 'Đổi ảnh banner'}
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
        <L label="Tiêu đề"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inp} /></L>
        <L label="Mô tả ngắn"><input value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} className={inp} /></L>
        <L label="Vị trí"><select value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} className={inp}>{Object.entries(POSITION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></L>
        <L label="Mức ưu tiên"><input type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value) })} className={inp} /></L>
        <L label="Loại liên kết"><select value={f.linkType} onChange={(e) => setF({ ...f, linkType: e.target.value })} className={inp}>{Object.entries(LINK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></L>
        {f.linkType !== 'NONE' && <L label={f.linkType === 'PRODUCT' || f.linkType === 'CATEGORY' ? 'ID đích' : 'Đường dẫn'}><input value={f.linkValue} onChange={(e) => setF({ ...f, linkValue: e.target.value })} className={inp} placeholder={f.linkType === 'PRODUCT' ? 'VD: 12' : '/...'} /></L>}
        <L label="Bắt đầu"><input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={inp} /></L>
        <L label="Kết thúc"><input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={inp} /></L>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <SecondaryButton type="button" onClick={() => onClose(false)}>Hủy</SecondaryButton>
        <PrimaryButton style={{ width: 'auto' }} onClick={submit} disabled={saving || !f.name || !f.imageUrl}>{saving ? 'Đang lưu...' : 'Lưu nháp'}</PrimaryButton>
      </div>
    </Modal>
  );
}

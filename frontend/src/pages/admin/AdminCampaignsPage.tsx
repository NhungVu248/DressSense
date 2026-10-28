import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';
import { fmtDate, toLocalInput, StatusBadge, inp, L, Modal, PageHeader, EmptyCard } from '../../components/promo-ui';

// UC13.3 - Chiến dịch thông báo khuyến mãi (Quản trị viên). Hiển thị cho Khách hàng qua UC12.4.

interface Campaign {
  id: number; name: string; title: string; content: string; imageUrl: string | null; link: string | null;
  audience: 'ALL' | 'SEGMENT'; segment: any; status: string; scheduledAt: string | null; sentAt: string | null;
  recipientCount: number;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<Campaign | 'new' | null>(null);

  function load() {
    setLoading(true);
    api.get('/admin/campaigns').then((r) => setCampaigns(r.data.campaigns)).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function send(c: Campaign) {
    if (!confirm(`Gửi chiến dịch "${c.name}" tới Khách hàng phù hợp ngay bây giờ?`)) return;
    setError(''); setSuccess('');
    try { const r = await api.post(`/admin/campaigns/${c.id}/send`); setSuccess(`Đã gửi tới ${r.data.recipientCount} khách hàng.`); load(); } catch (e) { setError(getErrorMessage(e)); }
  }
  async function cancel(c: Campaign) {
    setError(''); setSuccess('');
    try { await api.post(`/admin/campaigns/${c.id}/cancel`); setSuccess('Đã hủy chiến dịch.'); load(); } catch (e) { setError(getErrorMessage(e)); }
  }
  async function del(c: Campaign) {
    if (!confirm(`Xóa chiến dịch "${c.name}"?`)) return;
    setError(''); setSuccess('');
    try { await api.delete(`/admin/campaigns/${c.id}`); setSuccess('Đã xóa chiến dịch.'); load(); } catch (e) { setError(getErrorMessage(e)); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Thông báo khuyến mãi" subtitle="Tạo chiến dịch, chọn đối tượng rồi gửi ngay hoặc lên lịch. Chỉ gửi cho Khách hàng bật nhận marketing."
        action={<PrimaryButton style={{ width: 'auto' }} onClick={() => setForm('new')}>+ Tạo chiến dịch</PrimaryButton>} />
      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {loading ? <p className="text-gray-400">Đang tải...</p> : campaigns.length === 0 ? <EmptyCard label="Chưa có chiến dịch nào." /> : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white border border-brand/10 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-ink/80 mt-0.5 font-medium">{c.title}</p>
                  <p className="text-sm text-gray-500 line-clamp-2">{c.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Đối tượng: {c.audience === 'ALL' ? 'Tất cả khách hàng' : 'Nhóm theo tiêu chí'}
                    {c.status === 'SENT' && ` · Đã gửi ${c.recipientCount} người · ${fmtDate(c.sentAt)}`}
                    {c.status === 'SCHEDULED' && ` · Lên lịch ${fmtDate(c.scheduledAt)}`}
                    {c.link && ` · Link: ${c.link}`}
                  </p>
                </div>
                <div className="flex gap-2 text-xs shrink-0">
                  {c.status !== 'SENT' && c.status !== 'CANCELLED' && <>
                    <button onClick={() => send(c)} className="text-green-600 hover:underline">Gửi ngay</button>
                    <button onClick={() => setForm(c)} className="text-brand hover:underline">Sửa</button>
                  </>}
                  {c.status === 'SCHEDULED' && <button onClick={() => cancel(c)} className="text-amber-600 hover:underline">Hủy lịch</button>}
                  <button onClick={() => del(c)} className="text-red-500 hover:underline">Xóa</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && <CampaignFormModal initial={form === 'new' ? null : form} onClose={(ok, msg) => { setForm(null); if (ok) { setSuccess(msg ?? 'Đã lưu chiến dịch (Nháp).'); load(); } }} />}
    </div>
  );
}

function CampaignFormModal({ initial, onClose }: { initial: Campaign | null; onClose: (ok: boolean, msg?: string) => void }) {
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [f, setF] = useState({
    name: initial?.name ?? '', title: initial?.title ?? '', content: initial?.content ?? '',
    imageUrl: initial?.imageUrl ?? '', link: initial?.link ?? '',
    audience: initial?.audience ?? 'ALL',
    categoryIds: (initial?.segment?.categoryIds as number[] | undefined) ?? [],
    hasPurchased: !!initial?.segment?.hasPurchased,
    scheduledAt: toLocalInput(initial?.scheduledAt ?? null),
  });
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/categories').then((r) => setCategories(r.data.categories)).catch(() => {}); }, []);

  function buildPayload() {
    const segment = f.audience === 'SEGMENT'
      ? { ...(f.categoryIds.length ? { categoryIds: f.categoryIds } : {}), ...(f.hasPurchased ? { hasPurchased: true } : {}) }
      : null;
    return {
      name: f.name, title: f.title, content: f.content, imageUrl: f.imageUrl || null, link: f.link || null,
      audience: f.audience, segment,
    };
  }

  // Lưu nháp rồi trả về id (dùng cho các thao tác cần campaign tồn tại: xem trước/lên lịch)
  async function persist(): Promise<number | null> {
    const payload = buildPayload();
    if (initial) { await api.patch(`/admin/campaigns/${initial.id}`, payload); return initial.id; }
    const r = await api.post('/admin/campaigns', payload); return r.data.campaign.id;
  }

  async function saveDraft() {
    setErr(''); setSaving(true);
    try { await persist(); onClose(true); } catch (e) { setErr(getErrorMessage(e)); setSaving(false); }
  }
  async function preview() {
    setErr('');
    try { const id = await persist(); const r = await api.get(`/admin/campaigns/${id}/audience`); setAudienceCount(r.data.count); }
    catch (e) { setErr(getErrorMessage(e)); }
  }
  async function schedule() {
    setErr(''); setSaving(true);
    try {
      const id = await persist();
      await api.post(`/admin/campaigns/${id}/schedule`, { scheduledAt: f.scheduledAt });
      onClose(true, 'Đã lên lịch gửi chiến dịch.');
    } catch (e) { setErr(getErrorMessage(e)); setSaving(false); }
  }

  const toggleCat = (id: number) => setF((s) => ({ ...s, categoryIds: s.categoryIds.includes(id) ? s.categoryIds.filter((x) => x !== id) : [...s.categoryIds, id] }));

  return (
    <Modal title={initial ? 'Sửa chiến dịch' : 'Tạo chiến dịch'} onClose={() => onClose(false)} wide>
      <ErrorBox message={err} />
      <div className="grid grid-cols-2 gap-3">
        <L label="Tên chiến dịch" full><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></L>
        <L label="Tiêu đề thông báo" full><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inp} /></L>
        <L label="Nội dung" full><textarea value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} className={inp + ' h-24 resize-none'} /></L>
        <L label="Ảnh (URL, tùy chọn)"><input value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} className={inp} /></L>
        <L label="Liên kết (SP/chương trình)"><input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} className={inp} placeholder="/products/12" /></L>
        <L label="Đối tượng nhận" full>
          <select value={f.audience} onChange={(e) => { setF({ ...f, audience: e.target.value as any }); setAudienceCount(null); }} className={inp}>
            <option value="ALL">Tất cả Khách hàng (bật nhận marketing)</option>
            <option value="SEGMENT">Nhóm theo tiêu chí</option>
          </select>
        </L>
      </div>

      {f.audience === 'SEGMENT' && (
        <div className="mt-2 border border-brand/15 rounded-lg p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.hasPurchased} onChange={(e) => { setF({ ...f, hasPurchased: e.target.checked }); setAudienceCount(null); }} /> Đã từng mua hàng</label>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Đã mua trong danh mục</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {categories.map((c) => (
                <button key={c.id} type="button" onClick={() => { toggleCat(c.id); setAudienceCount(null); }}
                  className={`text-xs px-2 py-1 rounded-full border ${f.categoryIds.includes(c.id) ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-600'}`}>{c.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <SecondaryButton type="button" onClick={preview}>Xem trước số người nhận</SecondaryButton>
        {audienceCount != null && <span className={`text-sm ${audienceCount === 0 ? 'text-red-500' : 'text-brand'}`}>{audienceCount === 0 ? 'Không có khách hàng phù hợp.' : `≈ ${audienceCount} khách hàng sẽ nhận.`}</span>}
      </div>

      <div className="border-t border-brand/10 mt-4 pt-3 flex items-end gap-2 flex-wrap justify-between">
        <L label="Lên lịch gửi (tùy chọn)"><input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} className={inp} /></L>
        <div className="flex gap-2">
          <SecondaryButton type="button" onClick={() => onClose(false)}>Hủy</SecondaryButton>
          {f.scheduledAt && <SecondaryButton type="button" onClick={schedule}>Lên lịch</SecondaryButton>}
          <PrimaryButton style={{ width: 'auto' }} onClick={saveDraft} disabled={saving || !f.name || !f.title || !f.content}>{saving ? 'Đang lưu...' : 'Lưu nháp'}</PrimaryButton>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">Gợi ý: lưu nháp rồi bấm “Gửi ngay” ở danh sách để phát thông báo.</p>
    </Modal>
  );
}

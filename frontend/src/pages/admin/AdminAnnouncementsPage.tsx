import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAnnouncements, createAnnouncement, publishAnnouncement, deleteAnnouncement,
  AUDIENCE_LABEL, ANN_STATUS_LABEL,
} from '../../lib/admin-ops';
import { getErrorMessage } from '../../lib/api';

// Admin #11 - Thông báo toàn sàn (ERD 3.22): gửi thông báo tới nhóm Khách hàng / Người bán.
export default function AdminAnnouncementsPage() {
  const qc = useQueryClient();
  const { data: list, isLoading } = useQuery({ queryKey: ['announcements'], queryFn: getAnnouncements });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['announcements'] });

  async function create() {
    if (!title.trim() || !content.trim()) { alert('Nhập tiêu đề và nội dung.'); return; }
    setBusy(true);
    try { await createAnnouncement({ title, content, targetAudience: audience }); setTitle(''); setContent(''); refresh(); }
    catch (e) { alert(getErrorMessage(e)); } finally { setBusy(false); }
  }
  async function publish(id: number) {
    if (!confirm('Phát hành và gửi thông báo tới nhóm người dùng đã chọn?')) return;
    try { const a = await publishAnnouncement(id); refresh(); alert(`Đã gửi tới ${a.recipientCount} người.`); }
    catch (e) { alert(getErrorMessage(e)); }
  }
  async function remove(id: number) {
    if (!confirm('Xoá thông báo này?')) return;
    try { await deleteAnnouncement(id); refresh(); } catch (e) { alert(getErrorMessage(e)); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Thông báo toàn sàn</h1>
      <p className="text-sm text-ink/50 mb-5">Soạn thông báo chính sách / bảo trì / chương trình và gửi tới nhóm người dùng.</p>

      <div className="bg-white rounded-xl border border-brand/10 p-4 mb-6 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" className="w-full border border-brand/20 rounded-lg px-3 py-2 text-sm" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung" rows={3} className="w-full border border-brand/20 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-sm text-ink/60">Gửi tới:</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="border border-brand/20 rounded-lg px-3 py-2 text-sm">
            <option value="ALL">Tất cả</option><option value="BUYER">Khách hàng</option><option value="SELLER">Người bán</option>
          </select>
          <button onClick={create} disabled={busy} className="bg-brand text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50 ml-auto">Tạo bản nháp</button>
        </div>
      </div>

      {isLoading ? <p className="text-ink/40">Đang tải…</p>
        : !list || list.length === 0 ? <p className="text-ink/40 text-center py-12 border border-dashed border-brand/20 rounded-xl">Chưa có thông báo.</p>
          : (
            <div className="space-y-3">
              {list.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-brand/10 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink">{a.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : a.status === 'DRAFT' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{ANN_STATUS_LABEL[a.status]}</span>
                  </div>
                  <p className="text-sm text-ink/60 mt-1">{a.content}</p>
                  <p className="text-[11px] text-ink/40 mt-1">Nhóm: {AUDIENCE_LABEL[a.targetAudience]}{a.status === 'PUBLISHED' ? ` · đã gửi ${a.recipientCount} người` : ''} · {new Date(a.createdAt).toLocaleDateString('vi-VN')}</p>
                  <div className="flex gap-3 text-sm mt-2">
                    {a.status === 'DRAFT' && <button onClick={() => publish(a.id)} className="text-brand hover:underline">Phát hành & gửi</button>}
                    <button onClick={() => remove(a.id)} className="text-red-500 hover:underline">Xoá</button>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

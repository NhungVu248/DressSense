import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getReports, resolveReport, REPORT_TARGET_LABEL, REPORT_STATUS_LABEL, type UserReport,
} from '../../lib/admin-ops';
import { getErrorMessage } from '../../lib/api';

const FILTERS = [
  { v: 'PENDING', label: 'Chờ xử lý' }, { v: 'PROCESSING', label: 'Đang xử lý' },
  { v: '', label: 'Tất cả' }, { v: 'RESOLVED', label: 'Đã giải quyết' }, { v: 'REJECTED', label: 'Từ chối' },
];

// Admin #8 - Báo cáo vi phạm (ERD 3.19): tiếp nhận & xử lý báo cáo về shop/sản phẩm/người dùng.
export default function AdminReportsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const { data, isLoading } = useQuery({ queryKey: ['admin-reports', status], queryFn: () => getReports({ status: status || undefined }) });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Báo cáo vi phạm</h1>
      <p className="text-sm text-ink/50 mb-5">Báo cáo do Khách hàng / Người bán gửi về gian hàng, sản phẩm hoặc người dùng.</p>
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setStatus(f.v)} className={`text-sm px-4 py-1.5 rounded-full border ${status === f.v ? 'border-brand bg-brand text-white' : 'border-brand/20 text-ink/60'}`}>
            {f.label}{data?.counts && f.v && data.counts[f.v] ? ` (${data.counts[f.v]})` : ''}
          </button>
        ))}
      </div>
      {isLoading ? <p className="text-ink/40">Đang tải…</p>
        : !data || data.reports.length === 0 ? <p className="text-ink/40 text-center py-16 border border-dashed border-brand/20 rounded-xl">Không có báo cáo.</p>
          : <div className="space-y-3">{data.reports.map((r) => <Row key={r.id} r={r} onDone={() => qc.invalidateQueries({ queryKey: ['admin-reports'] })} />)}</div>}
    </div>
  );
}

function Row({ r, onDone }: { r: UserReport; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const canHandle = r.status === 'PENDING' || r.status === 'PROCESSING';

  async function act(status: 'PROCESSING' | 'RESOLVED' | 'REJECTED') {
    setBusy(true);
    try { await resolveReport(r.id, { status, resolutionNote: note || undefined }); setOpen(false); setNote(''); onDone(); }
    catch (e) { alert(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-brand/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-ink">{REPORT_TARGET_LABEL[r.targetType]} #{r.targetId} <span className="text-xs text-ink/40">· {r.reporter?.fullName || 'Ẩn danh'}</span></p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{REPORT_STATUS_LABEL[r.status]}</span>
      </div>
      <p className="text-sm text-ink/70 mt-1"><span className="font-medium">{r.reason}</span>{r.description ? ` — ${r.description}` : ''}</p>
      {r.evidenceUrl && <a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">Xem minh chứng</a>}
      {r.resolutionNote && <p className="text-xs text-sky-600 mt-1">Kết quả: {r.resolutionNote}</p>}
      <p className="text-[11px] text-ink/40 mt-1">{new Date(r.createdAt).toLocaleString('vi-VN')}</p>

      {canHandle && (open ? (
        <div className="mt-3 space-y-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú xử lý" rows={2} className="w-full border border-brand/20 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => act('RESOLVED')} disabled={busy} className="bg-brand text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">Đã giải quyết</button>
            <button onClick={() => act('PROCESSING')} disabled={busy} className="border border-brand/20 rounded-lg px-4 py-2 text-sm">Đang xử lý</button>
            <button onClick={() => act('REJECTED')} disabled={busy} className="border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">Từ chối</button>
            <button onClick={() => setOpen(false)} className="border border-brand/20 rounded-lg px-4 py-2 text-sm">Đóng</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-3 bg-brand text-white rounded-lg px-4 py-1.5 text-sm">Xử lý</button>
      ))}
    </div>
  );
}

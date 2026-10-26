import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import { getAdminComplaints, adminResolveComplaint, COMPLAINT_STATUS_LABEL, type Complaint } from '../../lib/support';

const FILTERS = [
  { v: 'ESCALATED', label: 'Chờ phân xử' }, { v: '', label: 'Tất cả' },
  { v: 'ADMIN_RESOLVED', label: 'Đã xử lý' }, { v: 'RESOLVED', label: 'Đã giải quyết' },
];

// UC11.2 - Quản trị viên phân xử khiếu nại
export default function AdminComplaintsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('ESCALATED');
  const { data: complaints, isLoading } = useQuery({ queryKey: ['admin-complaints', status], queryFn: () => getAdminComplaints(status || undefined) });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Phân xử khiếu nại</h1>
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setStatus(f.v)} className={`text-sm px-4 py-1.5 rounded-full border ${status === f.v ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-600'}`}>{f.label}</button>
        ))}
      </div>
      {isLoading ? <p className="text-gray-400">Đang tải…</p>
        : !complaints || complaints.length === 0 ? <p className="text-gray-400 text-center py-16 border border-dashed rounded-xl">Không có khiếu nại.</p>
          : <div className="space-y-3">{complaints.map((c) => <Row key={c.id} c={c} onDone={() => qc.invalidateQueries({ queryKey: ['admin-complaints'] })} />)}</div>}
    </div>
  );
}

function Row({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const canResolve = c.status === 'ESCALATED';

  async function submit(reject: boolean) {
    if (!decision.trim()) { alert('Vui lòng nhập quyết định.'); return; }
    setBusy(true);
    try {
      const r = await adminResolveComplaint(c.id, { decision, refundAmount: refundAmount ? Number(refundAmount) : undefined, reject });
      onDone(); setOpen(false);
      alert(r.refund?.transactionId ? 'Đã xử lý + hoàn tiền.' : 'Đã lưu quyết định.');
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-gray-900">{c.code} <span className="text-xs text-gray-400">· {c.type} · {c.user?.fullName}</span></p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{COMPLAINT_STATUS_LABEL[c.status]}</span>
      </div>
      <p className="text-sm text-gray-600 mt-1">Đơn {c.order?.code} ({c.order?.total != null ? formatVND(c.order.total) : ''} · {c.order?.paymentStatus}): {c.content}</p>
      {c.sellerProposal && <p className="text-xs text-gray-500 mt-1">Phương án người bán: {c.sellerProposal}</p>}
      {c.adminDecision && <p className="text-xs text-sky-600 mt-1">Quyết định: {c.adminDecision}</p>}

      {canResolve && (open ? (
        <div className="mt-3 space-y-2">
          <textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="Quyết định xử lý" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ''))} placeholder="Số tiền hoàn (để trống nếu không hoàn)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={() => submit(false)} disabled={busy} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">Xử lý</button>
            <button onClick={() => submit(true)} disabled={busy} className="border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">Từ chối (không hợp lệ)</button>
            <button onClick={() => setOpen(false)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm">Đóng</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-3 bg-gray-900 text-white rounded-lg px-4 py-1.5 text-sm">Phân xử</button>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatVND } from '../lib/products';
import {
  getReturns, getComplaints, respondComplaint,
  RETURN_TYPE_LABEL, REQUEST_STATUS_LABEL, COMPLAINT_STATUS_LABEL,
} from '../lib/support';

// UC11 - Khách theo dõi đổi/trả & khiếu nại
export default function SupportPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'returns' | 'complaints'>('returns');
  const { data: returns } = useQuery({ queryKey: ['returns'], queryFn: getReturns });
  const { data: complaints } = useQuery({ queryKey: ['complaints'], queryFn: getComplaints });

  async function respond(id: number, accept: boolean) {
    try { await respondComplaint(id, accept); qc.invalidateQueries({ queryKey: ['complaints'] }); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-5">Đổi/trả & Khiếu nại</h1>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('returns')} className={`text-sm px-4 py-1.5 rounded-full border ${tab === 'returns' ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>Đổi/trả ({returns?.length ?? 0})</button>
        <button onClick={() => setTab('complaints')} className={`text-sm px-4 py-1.5 rounded-full border ${tab === 'complaints' ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>Khiếu nại ({complaints?.length ?? 0})</button>
      </div>

      {tab === 'returns' ? (
        !returns || returns.length === 0 ? <Empty text="Chưa có yêu cầu đổi/trả nào" />
          : <div className="space-y-3">{returns.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{r.code} <span className="text-xs text-gray-400">· {RETURN_TYPE_LABEL[r.type]}</span></p>
                  <p className="text-xs text-gray-400">Đơn {r.order?.code} · {new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand">{REQUEST_STATUS_LABEL[r.status]}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">Lý do: {r.reason}</p>
              {r.refundAmount != null && <p className="text-sm text-ink mt-0.5">Hoàn dự kiến: {formatVND(r.refundAmount)}</p>}
              {r.sellerNote && <p className="text-xs text-gray-400 mt-1">Người bán: {r.sellerNote}</p>}
            </div>
          ))}</div>
      ) : (
        !complaints || complaints.length === 0 ? <Empty text="Chưa có khiếu nại nào" />
          : <div className="space-y-3">{complaints.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{c.code} <span className="text-xs text-gray-400">· {c.type}</span></p>
                  <p className="text-xs text-gray-400">Đơn {c.order?.code} · {new Date(c.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{COMPLAINT_STATUS_LABEL[c.status]}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{c.content}</p>
              {c.sellerProposal && <div className="bg-brand-light/50 rounded-lg p-3 mt-2 text-sm"><span className="text-gray-500">Phương án người bán:</span> <span className="text-ink">{c.sellerProposal}</span></div>}
              {c.adminDecision && <div className="bg-sky-50 rounded-lg p-3 mt-2 text-sm"><span className="text-gray-500">Quyết định quản trị:</span> <span className="text-ink">{c.adminDecision}</span></div>}
              {c.status === 'SELLER_RESPONDED' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => respond(c.id, true)} className="bg-brand text-white rounded-lg px-4 py-1.5 text-sm">Đồng ý</button>
                  <button onClick={() => respond(c.id, false)} className="border border-black/15 rounded-lg px-4 py-1.5 text-sm">Không đồng ý (chuyển quản trị)</button>
                </div>
              )}
            </div>
          ))}</div>
      )}
      <p className="text-xs text-gray-400 mt-5">Tạo yêu cầu đổi/trả hoặc khiếu nại từ <Link to="/orders" className="text-brand underline">chi tiết đơn hàng</Link>.</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-16 border border-dashed border-black/10 rounded-xl"><p className="font-display text-lg text-ink">{text}</p></div>;
}

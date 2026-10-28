import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatVND } from '../../lib/products';
import {
  getSellerReturns, approveReturn, rejectReturn,
  getSellerComplaints, sellerRespondComplaint,
  getSellerIncidents, resolveIncident,
  RETURN_TYPE_LABEL, REQUEST_STATUS_LABEL, COMPLAINT_STATUS_LABEL, INCIDENT_TYPE_LABEL,
} from '../../lib/support';

type Tab = 'returns' | 'complaints' | 'incidents';

const MEDIA_ORIGIN = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');
// UC11 - hiển thị ảnh/video bằng chứng (evidence lưu dưới dạng URL phân tách bằng dấu phẩy)
function Evidence({ value }: { value: string | null | undefined }) {
  const urls = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!urls.length) return null;
  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      {urls.map((u, i) => {
        const src = u.startsWith('http') ? u : MEDIA_ORIGIN + u;
        return /\.(mp4|webm|mov)$/i.test(u)
          ? <a key={i} href={src} target="_blank" rel="noreferrer" className="text-xs text-brand underline">▶ Video {i + 1}</a>
          : <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="w-14 h-14 object-cover rounded-lg bg-brand-light" /></a>;
      })}
    </div>
  );
}

// UC11 - Người bán xử lý đổi/trả, khiếu nại, sự cố giao hàng
export default function SellerSupportPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('returns');
  const { data: returns } = useQuery({ queryKey: ['seller-returns'], queryFn: getSellerReturns });
  const { data: complaints } = useQuery({ queryKey: ['seller-complaints'], queryFn: getSellerComplaints });
  const { data: incidents } = useQuery({ queryKey: ['seller-incidents'], queryFn: getSellerIncidents });
  const inv = (k: string) => qc.invalidateQueries({ queryKey: [k] });

  async function approve(id: number) { try { const r = await approveReturn(id); inv('seller-returns'); alert(r.refund?.skipped ? 'Đã duyệt (COD - không hoàn tiền).' : 'Đã duyệt yêu cầu.'); } catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); } }
  async function reject(id: number) { const note = prompt('Lý do từ chối:'); if (!note) return; try { await rejectReturn(id, note); inv('seller-returns'); } catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); } }
  async function respond(id: number) { const proposal = prompt('Phương án giải quyết:'); if (!proposal) return; try { await sellerRespondComplaint(id, proposal); inv('seller-complaints'); } catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); } }
  async function resolve(id: number, resolution: string) {
    let newEta: string | undefined;
    if (resolution === 'UPDATE_ETA') { newEta = prompt('Thời gian giao mới (YYYY-MM-DD):') || undefined; if (!newEta) return; }
    if (resolution === 'LOST_REFUND' && !confirm('Xác nhận thất lạc: hủy đơn và hoàn tiền (nếu đã thanh toán)?')) return;
    try { const r = await resolveIncident(id, resolution, newEta); inv('seller-incidents'); alert(r.refund?.transactionId ? 'Đã xử lý + hoàn tiền.' : 'Đã xử lý sự cố.'); } catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); }
  }

  const tabs: [Tab, string, number][] = [['returns', 'Đổi/trả', returns?.length ?? 0], ['complaints', 'Khiếu nại', complaints?.length ?? 0], ['incidents', 'Sự cố giao hàng', incidents?.length ?? 0]];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-5">Hỗ trợ sau bán</h1>
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
        {tabs.map(([v, label, n]) => (
          <button key={v} onClick={() => setTab(v)} className={`whitespace-nowrap text-sm px-4 py-1.5 rounded-full border ${tab === v ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>{label} ({n})</button>
        ))}
      </div>

      {tab === 'returns' && (
        !returns || returns.length === 0 ? <Empty text="Chưa có yêu cầu đổi/trả" />
          : <div className="space-y-3">{returns.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink">{r.code} <span className="text-xs text-gray-400">· {RETURN_TYPE_LABEL[r.type]} · {r.user?.fullName}</span></p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand">{REQUEST_STATUS_LABEL[r.status]}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Đơn {r.order?.code} · Lý do: {r.reason}{r.refundAmount != null && ` · Hoàn ${formatVND(r.refundAmount)}`}</p>
              {r.description && <p className="text-xs text-gray-400 mt-1">{r.description}</p>}
              <Evidence value={r.evidence} />
              {r.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => approve(r.id)} className="bg-brand text-white rounded-lg px-4 py-1.5 text-sm">Chấp thuận</button>
                  <button onClick={() => reject(r.id)} className="border border-red-200 text-red-600 rounded-lg px-4 py-1.5 text-sm">Từ chối</button>
                </div>
              )}
            </div>
          ))}</div>
      )}

      {tab === 'complaints' && (
        !complaints || complaints.length === 0 ? <Empty text="Chưa có khiếu nại" />
          : <div className="space-y-3">{complaints.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink">{c.code} <span className="text-xs text-gray-400">· {c.type} · {c.user?.fullName}</span></p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{COMPLAINT_STATUS_LABEL[c.status]}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Đơn {c.order?.code}: {c.content}</p>
              <Evidence value={c.evidence} />
              {c.sellerProposal && <p className="text-xs text-gray-500 mt-1">Phương án: {c.sellerProposal}</p>}
              {(c.status === 'PENDING' || c.status === 'SELLER_RESPONDED') && (
                <button onClick={() => respond(c.id)} className="mt-3 bg-brand text-white rounded-lg px-4 py-1.5 text-sm">{c.status === 'PENDING' ? 'Đề xuất phương án' : 'Cập nhật phương án'}</button>
              )}
              {c.status === 'ESCALATED' && <p className="text-xs text-sky-600 mt-2">Đã chuyển quản trị viên phân xử.</p>}
            </div>
          ))}</div>
      )}

      {tab === 'incidents' && (
        !incidents || incidents.length === 0 ? <Empty text="Chưa có sự cố giao hàng" />
          : <div className="space-y-3">{incidents.map((i) => (
            <div key={i.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink">Đơn {i.order?.code} <span className="text-xs text-gray-400">· {INCIDENT_TYPE_LABEL[i.type]}</span></p>
                <span className="text-xs text-gray-400">{new Date(i.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
              {i.note && <p className="text-sm text-gray-500 mt-1">{i.note}</p>}
              {i.resolution ? <p className="text-sm text-brand mt-1">Đã xử lý: {i.resolution}</p> : (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => resolve(i.id, 'UPDATE_ETA')} className="border border-black/15 rounded-lg px-3 py-1.5 text-xs">Cập nhật ngày giao</button>
                  <button onClick={() => resolve(i.id, 'REDELIVER')} className="border border-black/15 rounded-lg px-3 py-1.5 text-xs">Giao lại</button>
                  <button onClick={() => resolve(i.id, 'LOST_REFUND')} className="border border-red-200 text-red-600 rounded-lg px-3 py-1.5 text-xs">Thất lạc → hủy & hoàn tiền</button>
                </div>
              )}
            </div>
          ))}</div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-16 border border-dashed border-black/10 rounded-xl"><p className="font-display text-lg text-ink">{text}</p></div>;
}

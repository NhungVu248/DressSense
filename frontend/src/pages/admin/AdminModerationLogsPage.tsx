import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getModerationLogs, MOD_ACTION_LABEL } from '../../lib/admin-ops';

const FILTERS = [{ v: '', label: 'Tất cả' }, { v: 'SHOP', label: 'Gian hàng' }, { v: 'PRODUCT', label: 'Sản phẩm' }];
const ACTION_COLOR: Record<string, string> = { APPROVE: 'bg-green-100 text-green-700', RESTORE: 'bg-green-100 text-green-700', REJECT: 'bg-red-100 text-red-600', HIDE: 'bg-amber-100 text-amber-700' };

// Admin #9 - Kiểm duyệt: lịch sử duyệt/từ chối/ẩn/khôi phục (ERD 3.18) + lối tắt tới các mục kiểm duyệt.
export default function AdminModerationLogsPage() {
  const [targetType, setTargetType] = useState('');
  const { data: logs, isLoading } = useQuery({ queryKey: ['mod-logs', targetType], queryFn: () => getModerationLogs(targetType || undefined) });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Kiểm duyệt</h1>
      <p className="text-sm text-ink/50 mb-4">Lịch sử thao tác kiểm duyệt gian hàng và sản phẩm.</p>
      <div className="flex gap-2 mb-5 flex-wrap text-sm">
        <Link to="/admin/shops" className="px-3 py-1.5 rounded-lg border border-brand/20 text-ink/70 hover:bg-brand/5">Duyệt gian hàng →</Link>
        <Link to="/admin/content" className="px-3 py-1.5 rounded-lg border border-brand/20 text-ink/70 hover:bg-brand/5">Duyệt sản phẩm →</Link>
        <Link to="/admin/reviews" className="px-3 py-1.5 rounded-lg border border-brand/20 text-ink/70 hover:bg-brand/5">Duyệt đánh giá →</Link>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setTargetType(f.v)} className={`text-sm px-4 py-1.5 rounded-full border ${targetType === f.v ? 'border-brand bg-brand text-white' : 'border-brand/20 text-ink/60'}`}>{f.label}</button>
        ))}
      </div>
      {isLoading ? <p className="text-ink/40">Đang tải…</p>
        : !logs || logs.length === 0 ? <p className="text-ink/40 text-center py-16 border border-dashed border-brand/20 rounded-xl">Chưa có lịch sử kiểm duyệt.</p>
          : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="bg-white rounded-xl border border-brand/10 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink"><span className={`text-[11px] px-2 py-0.5 rounded-full ${ACTION_COLOR[l.action] || 'bg-gray-100 text-gray-600'}`}>{MOD_ACTION_LABEL[l.action]}</span>
                      <span className="ml-2">{l.targetType === 'SHOP' ? 'Gian hàng' : 'Sản phẩm'} #{l.targetId}</span></p>
                    {l.reason && <p className="text-xs text-ink/50 mt-0.5">Lý do: {l.reason}</p>}
                  </div>
                  <div className="text-right text-xs text-ink/40 shrink-0">
                    <p>{l.admin?.fullName || `Admin #${l.adminId}`}</p>
                    <p>{new Date(l.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

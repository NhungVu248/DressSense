import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActionLogs } from '../../lib/admin-ops';

const FILTERS = [
  { v: '', label: 'Tất cả' }, { v: 'USER', label: 'Người dùng' }, { v: 'SHOP', label: 'Gian hàng' },
  { v: 'PRODUCT', label: 'Sản phẩm' }, { v: 'REPORT', label: 'Báo cáo' }, { v: 'SETTING', label: 'Cấu hình' },
];
const TARGET_LABEL: Record<string, string> = { USER: 'Người dùng', SHOP: 'Gian hàng', PRODUCT: 'Sản phẩm', ORDER: 'Đơn hàng', SETTING: 'Cấu hình', REPORT: 'Báo cáo' };

// Admin #12 - Nhật ký hoạt động (ERD 3.17): truy vết thao tác quản trị.
export default function AdminActionLogsPage() {
  const [targetType, setTargetType] = useState('');
  const { data: logs, isLoading } = useQuery({ queryKey: ['action-logs', targetType], queryFn: () => getActionLogs(targetType || undefined) });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Nhật ký hoạt động</h1>
      <p className="text-sm text-ink/50 mb-4">Lịch sử thao tác của Quản trị viên để kiểm tra và truy vết.</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setTargetType(f.v)} className={`text-sm px-4 py-1.5 rounded-full border ${targetType === f.v ? 'border-brand bg-brand text-white' : 'border-brand/20 text-ink/60'}`}>{f.label}</button>
        ))}
      </div>
      {isLoading ? <p className="text-ink/40">Đang tải…</p>
        : !logs || logs.length === 0 ? <p className="text-ink/40 text-center py-16 border border-dashed border-brand/20 rounded-xl">Chưa có nhật ký.</p>
          : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="bg-white rounded-xl border border-brand/10 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink"><span className="font-mono text-[12px] bg-brand/5 text-brand px-1.5 py-0.5 rounded">{l.action}</span>
                      <span className="ml-2 text-ink/60">{TARGET_LABEL[l.targetType] || l.targetType}{l.targetId != null ? ` #${l.targetId}` : ''}</span></p>
                    {l.description && <p className="text-xs text-ink/50 mt-0.5">{l.description}</p>}
                  </div>
                  <div className="text-right text-xs text-ink/40 shrink-0">
                    <p>{l.admin?.fullName || `Admin #${l.adminId}`}</p>
                    <p>{new Date(l.createdAt).toLocaleString('vi-VN')}{l.ipAddress ? ` · ${l.ipAddress}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

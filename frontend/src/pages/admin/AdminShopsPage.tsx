import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listShopsAdmin, approveShop, rejectShop, setShopSuspension,
  SHOP_STATUS_LABEL, SHOP_STATUS_CLS, type Shop, type ShopStatus,
} from '../../lib/shop';

// UC14.1 / UC16.3 - Quản trị viên kiểm duyệt gian hàng
const TABS: { value: string; label: string }[] = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'SUSPENDED', label: 'Tạm ngưng' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: '', label: 'Tất cả' },
];

function addr(s: Shop) {
  const parts = [s.pickupDetail, s.pickupWard, s.pickupDistrict, s.pickupProvince].filter(Boolean);
  return parts.length ? parts.join(', ') : '(chưa có)';
}

export default function AdminShopsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PENDING');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-shops', tab],
    queryFn: () => listShopsAdmin(tab || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-shops'] });
  const approveMut = useMutation({ mutationFn: (id: number) => approveShop(id), onSuccess: invalidate });
  const rejectMut = useMutation({
    mutationFn: ({ id, r }: { id: number; r: string }) => rejectShop(id, r),
    onSuccess: () => { setRejectingId(null); setReason(''); invalidate(); },
  });
  const suspendMut = useMutation({
    mutationFn: ({ id, s }: { id: number; s: boolean }) => setShopSuspension(id, s),
    onSuccess: invalidate,
  });

  const counts = data?.counts ?? {};

  return (
    <div className="p-5 md:p-8 max-w-5xl">
      <h1 className="font-display text-3xl font-bold mb-1">Kiểm duyệt gian hàng</h1>
      <p className="text-sm text-ink/50 mb-5">Phê duyệt / từ chối hồ sơ gian hàng của Người bán (UC16.3).</p>

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.value || 'all'}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              tab === t.value ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70 hover:border-brand/50'
            }`}
          >
            {t.label}
            {t.value && counts[t.value] ? <span className="ml-1 opacity-70">({counts[t.value]})</span> : null}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-ink/50">Đang tải…</p>}
      {data && data.shops.length === 0 && <p className="text-sm text-ink/40">Không có gian hàng nào.</p>}

      <div className="space-y-4">
        {data?.shops.map((s) => (
          <div key={s.id} className="rounded-2xl border border-brand/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold truncate">{s.name}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SHOP_STATUS_CLS[s.status as ShopStatus]}`}>
                    {SHOP_STATUS_LABEL[s.status as ShopStatus]}
                  </span>
                </div>
                <p className="text-sm text-ink/50 mt-0.5">
                  Chủ: {s.owner?.fullName} ({s.owner?.email}) · {s.submittedAt ? `Gửi: ${new Date(s.submittedAt).toLocaleString('vi-VN')}` : 'Chưa gửi duyệt'}
                </p>
              </div>
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <p><span className="text-ink/50">Mô tả:</span> {s.description || '(chưa có)'}</p>
              <p><span className="text-ink/50">Liên hệ:</span> {s.contactPhone || s.contactEmail || '(chưa có)'}</p>
              <p className="sm:col-span-2"><span className="text-ink/50">Địa chỉ lấy hàng:</span> {addr(s)}</p>
            </div>

            {s.status === 'REJECTED' && s.rejectReason && (
              <p className="mt-2 text-sm text-red-600">Lý do từ chối: {s.rejectReason}</p>
            )}

            {/* Hành động theo trạng thái */}
            <div className="mt-4 flex flex-wrap gap-2">
              {s.status === 'PENDING' && (
                <>
                  <button onClick={() => approveMut.mutate(s.id)} disabled={approveMut.isPending}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    Phê duyệt
                  </button>
                  <button onClick={() => { setRejectingId(rejectingId === s.id ? null : s.id); setReason(''); }}
                    className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50">
                    Từ chối
                  </button>
                </>
              )}
              {s.status === 'ACTIVE' && (
                <button onClick={() => suspendMut.mutate({ id: s.id, s: true })} disabled={suspendMut.isPending}
                  className="px-4 py-2 rounded-lg border border-orange-300 text-orange-600 text-sm font-medium hover:bg-orange-50 disabled:opacity-50">
                  Tạm ngưng
                </button>
              )}
              {s.status === 'SUSPENDED' && (
                <button onClick={() => suspendMut.mutate({ id: s.id, s: false })} disabled={suspendMut.isPending}
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-50">
                  Mở lại hoạt động
                </button>
              )}
            </div>

            {/* Ô nhập lý do từ chối */}
            {rejectingId === s.id && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[220px]">
                  <span className="text-xs text-ink/60">Lý do từ chối</span>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do…"
                    className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand" />
                </label>
                <button
                  onClick={() => reason.trim() && rejectMut.mutate({ id: s.id, r: reason.trim() })}
                  disabled={!reason.trim() || rejectMut.isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  Xác nhận từ chối
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

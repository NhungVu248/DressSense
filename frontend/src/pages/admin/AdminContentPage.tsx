import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatVND } from '../../lib/products';
import { listModProducts, moderateProduct, type ModProduct } from '../../lib/admin';

// UC16.4 - Kiểm duyệt nội dung (sản phẩm). Đánh giá: xem trang "Đánh giá".
const MEDIA_ORIGIN = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');
const TABS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'ACTIVE', label: 'Đang bán' },
  { value: 'HIDDEN', label: 'Đã ẩn' },
];

export default function AdminContentPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PENDING');
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['mod-products', tab], queryFn: () => listModProducts(tab) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['mod-products'] });
  const approveMut = useMutation({ mutationFn: (id: number) => moderateProduct(id, 'approve'), onSuccess: invalidate });
  const hideMut = useMutation({ mutationFn: (id: number) => moderateProduct(id, 'hide', 'Ẩn bởi Quản trị viên'), onSuccess: invalidate });
  const rejectMut = useMutation({
    mutationFn: ({ id, r }: { id: number; r: string }) => moderateProduct(id, 'reject', r),
    onSuccess: () => { setRejectId(null); setReason(''); invalidate(); },
  });

  const counts = data?.counts ?? {};
  const img = (p: ModProduct) => (p.images[0]?.url ? (p.images[0].url.startsWith('/uploads') ? MEDIA_ORIGIN + p.images[0].url : p.images[0].url) : null);

  return (
    <div className="p-5 md:p-8 max-w-5xl">
      <h1 className="font-display text-3xl font-bold mb-1">Kiểm duyệt nội dung</h1>
      <p className="text-sm text-ink/50 mb-5">Duyệt/ẩn/từ chối sản phẩm (UC16.4). Kiểm duyệt đánh giá ở trang <Link to="/admin/reviews" className="text-brand hover:underline">Đánh giá</Link>.</p>

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${tab === t.value ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70 hover:border-brand/50'}`}>
            {t.label}{counts[t.value] ? <span className="ml-1 opacity-70">({counts[t.value]})</span> : null}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-ink/50">Đang tải…</p>}
      {data && data.products.length === 0 && <p className="text-sm text-ink/40">Không có sản phẩm nào.</p>}

      <div className="space-y-3">
        {data?.products.map((p) => (
          <div key={p.id} className="rounded-2xl border border-brand/10 bg-white p-4 flex flex-wrap gap-4">
            <div className="w-16 h-16 rounded-xl bg-brand/5 overflow-hidden shrink-0 flex items-center justify-center">
              {img(p) ? <img src={img(p)!} alt="" className="w-full h-full object-cover" /> : <span className="text-ink/30 text-xs">No img</span>}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">{p.name}</h3>
              <p className="text-sm text-ink/50">{formatVND(p.price)} · {p.category?.name ?? 'Khác'} · Người bán: {p.seller.fullName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.status !== 'ACTIVE' && (
                  <button onClick={() => approveMut.mutate(p.id)} disabled={approveMut.isPending}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">Phê duyệt</button>
                )}
                {p.status !== 'HIDDEN' && (
                  <button onClick={() => hideMut.mutate(p.id)} disabled={hideMut.isPending}
                    className="px-3 py-1.5 rounded-lg border border-orange-300 text-orange-600 text-sm font-medium hover:bg-orange-50">Ẩn</button>
                )}
                <button onClick={() => { setRejectId(rejectId === p.id ? null : p.id); setReason(''); }}
                  className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50">Từ chối (kèm lý do)</button>
              </div>
              {rejectId === p.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do từ chối…"
                    className="flex-1 min-w-[200px] border border-brand/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand" />
                  <button onClick={() => reason.trim() && rejectMut.mutate({ id: p.id, r: reason.trim() })} disabled={!reason.trim() || rejectMut.isPending}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">Xác nhận</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminReviews, moderateReview } from '../../lib/interact';

const FILTERS = [{ v: '', label: 'Tất cả' }, { v: 'VISIBLE', label: 'Đang hiển thị' }, { v: 'HIDDEN', label: 'Đã ẩn' }];

// UC12.1 - Quản trị viên kiểm duyệt đánh giá
export default function AdminReviewsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: reviews, isLoading } = useQuery({ queryKey: ['admin-reviews', status], queryFn: () => getAdminReviews(status || undefined) });

  async function hide(id: number) {
    const note = prompt('Lý do ẩn (gửi tới khách, tuỳ chọn):') ?? undefined;
    try { await moderateReview(id, true, note); qc.invalidateQueries({ queryKey: ['admin-reviews'] }); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); }
  }
  async function unhide(id: number) {
    try { await moderateReview(id, false); qc.invalidateQueries({ queryKey: ['admin-reviews'] }); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Kiểm duyệt đánh giá</h1>
      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setStatus(f.v)} className={`text-sm px-4 py-1.5 rounded-full border ${status === f.v ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-600'}`}>{f.label}</button>
        ))}
      </div>
      {isLoading ? <p className="text-gray-400">Đang tải…</p>
        : !reviews || reviews.length === 0 ? <p className="text-gray-400 text-center py-16 border border-dashed rounded-xl">Không có đánh giá.</p>
          : <div className="space-y-3">{reviews.map((r) => (
            <div key={r.id} className={`rounded-xl border p-4 ${r.status === 'HIDDEN' ? 'bg-gray-50 border-gray-200' : 'bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-amber-500">{'★'.repeat(r.rating)}<span className="text-gray-200">{'★'.repeat(5 - r.rating)}</span></span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'HIDDEN' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{r.status === 'HIDDEN' ? 'Đã ẩn' : 'Hiển thị'}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{r.user?.fullName} · {r.product?.name} · {new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
              {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}
              <div className="mt-2">
                {r.status === 'HIDDEN'
                  ? <button onClick={() => unhide(r.id)} className="border border-gray-300 rounded-lg px-4 py-1.5 text-sm">Hiện lại</button>
                  : <button onClick={() => hide(r.id)} className="border border-red-200 text-red-600 rounded-lg px-4 py-1.5 text-sm">Ẩn (vi phạm)</button>}
              </div>
            </div>
          ))}</div>}
    </div>
  );
}

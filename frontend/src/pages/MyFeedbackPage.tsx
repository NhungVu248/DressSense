import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMyReviews, getMyQuestions } from '../lib/interact';

// Khách hàng: Đánh giá & Hỏi đáp của tôi (gắn với đơn hàng), chia tab để dễ quản lý.
export default function MyFeedbackPage() {
  const [tab, setTab] = useState<'reviews' | 'questions'>('reviews');
  const { data: reviews } = useQuery({ queryKey: ['my-reviews'], queryFn: getMyReviews });
  const { data: questions } = useQuery({ queryKey: ['my-questions'], queryFn: getMyQuestions });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-1">Đánh giá & Hỏi đáp của tôi</h1>
      <p className="text-sm text-gray-500 mb-5">Các đánh giá và câu hỏi bạn đã gửi, gắn với từng đơn hàng.</p>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('reviews')} className={`text-sm px-4 py-1.5 rounded-full border ${tab === 'reviews' ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>Đánh giá ({reviews?.length ?? 0})</button>
        <button onClick={() => setTab('questions')} className={`text-sm px-4 py-1.5 rounded-full border ${tab === 'questions' ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>Hỏi đáp ({questions?.length ?? 0})</button>
      </div>

      {tab === 'reviews' ? (
        !reviews || reviews.length === 0 ? <Empty text="Bạn chưa có đánh giá nào. Vào đơn đã nhận để đánh giá sản phẩm." />
          : <div className="space-y-3">{reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-amber-500">{'★'.repeat(r.rating)}<span className="text-gray-200">{'★'.repeat(5 - r.rating)}</span></span>
                {r.order && <span className="text-xs text-gray-400">Đơn {r.order.code}</span>}
              </div>
              {r.product && <Link to={`/products/${r.product.id}`} className="text-sm text-ink font-medium hover:text-brand">{r.product.name}</Link>}
              {r.comment && <p className="text-sm text-ink mt-1">{r.comment}</p>}
              {r.sellerReply && <p className="text-sm text-brand mt-2 pl-3 border-l-2 border-brand/30">Phản hồi của shop: {r.sellerReply}</p>}
              <p className="text-[11px] text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>
          ))}</div>
      ) : (
        !questions || questions.length === 0 ? <Empty text="Bạn chưa đặt câu hỏi nào. Vào đơn hàng để hỏi về sản phẩm." />
          : <div className="space-y-3">{questions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center justify-between gap-2">
                {q.product ? <Link to={`/products/${q.product.id}`} className="text-sm text-ink font-medium hover:text-brand">{q.product.name}</Link> : <span />}
                {q.order && <span className="text-xs text-gray-400">Đơn {q.order.code}</span>}
              </div>
              <p className="text-sm text-ink mt-1">Hỏi: {q.question}</p>
              {q.answer ? <p className="text-sm text-brand mt-2 pl-3 border-l-2 border-brand/30">Trả lời: {q.answer}</p>
                : <p className="text-xs text-gray-400 mt-2">Đang chờ người bán trả lời…</p>}
              <p className="text-[11px] text-gray-400 mt-1">{new Date(q.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>
          ))}</div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-16 border border-dashed border-black/10 rounded-xl"><p className="text-sm text-gray-500">{text}</p></div>;
}

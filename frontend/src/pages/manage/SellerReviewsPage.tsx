import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSellerReviews, replyReview, getSellerQuestions, answerQuestion } from '../../lib/interact';

// UC12.2 + UC12.3 - Người bán phản hồi đánh giá & trả lời hỏi đáp
export default function SellerReviewsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'reviews' | 'questions'>('reviews');
  const { data: reviews } = useQuery({ queryKey: ['seller-reviews'], queryFn: getSellerReviews });
  const { data: questions } = useQuery({ queryKey: ['seller-questions'], queryFn: getSellerQuestions });

  async function reply(id: number) {
    const text = prompt('Nội dung phản hồi:'); if (!text) return;
    try { await replyReview(id, text); qc.invalidateQueries({ queryKey: ['seller-reviews'] }); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); }
  }
  async function answer(id: number) {
    const text = prompt('Câu trả lời:'); if (!text) return;
    try { await answerQuestion(id, text); qc.invalidateQueries({ queryKey: ['seller-questions'] }); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Lỗi'); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-5">Đánh giá & Hỏi đáp</h1>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('reviews')} className={`text-sm px-4 py-1.5 rounded-full border ${tab === 'reviews' ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>Đánh giá ({reviews?.length ?? 0})</button>
        <button onClick={() => setTab('questions')} className={`text-sm px-4 py-1.5 rounded-full border ${tab === 'questions' ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>Hỏi đáp ({questions?.length ?? 0})</button>
      </div>

      {tab === 'reviews' ? (
        !reviews || reviews.length === 0 ? <Empty text="Chưa có đánh giá" />
          : <div className="space-y-3">{reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-black/5 p-4">
              <div className="flex items-center gap-2">
                <span className="text-amber-500">{'★'.repeat(r.rating)}<span className="text-gray-200">{'★'.repeat(5 - r.rating)}</span></span>
                <span className="text-xs text-gray-400">{r.user?.fullName} · {r.product?.name}</span>
              </div>
              {r.comment && <p className="text-sm text-ink mt-1">{r.comment}</p>}
              {r.sellerReply ? <p className="text-sm text-brand mt-2 pl-3 border-l-2 border-brand/30">Phản hồi: {r.sellerReply}</p>
                : <button onClick={() => reply(r.id)} className="mt-2 bg-brand text-white rounded-lg px-4 py-1.5 text-sm">Phản hồi</button>}
            </div>
          ))}</div>
      ) : (
        !questions || questions.length === 0 ? <Empty text="Chưa có câu hỏi" />
          : <div className="space-y-3">{questions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border border-black/5 p-4">
              <p className="text-sm text-ink"><span className="text-xs text-gray-400">{q.user?.fullName} · {q.product?.name}:</span> {q.question}</p>
              {q.answer ? <p className="text-sm text-brand mt-2 pl-3 border-l-2 border-brand/30">Trả lời: {q.answer}</p>
                : <button onClick={() => answer(q.id)} className="mt-2 bg-brand text-white rounded-lg px-4 py-1.5 text-sm">Trả lời</button>}
            </div>
          ))}</div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-16 border border-dashed border-black/10 rounded-xl"><p className="font-display text-lg text-ink">{text}</p></div>;
}

import { useState } from 'react';
import { formatVND } from '../lib/products';
import { createReturn, createComplaint, type ReturnType } from '../lib/support';
import { createReview } from '../lib/interact';
import type { Order, OrderItem } from '../lib/order';

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl text-ink">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const RETURN_REASONS = ['Sản phẩm lỗi/hỏng', 'Giao sai sản phẩm', 'Không đúng mô tả', 'Đổi size/màu', 'Lý do khác'];

// UC11.1 - yêu cầu đổi/trả
export function ReturnModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<ReturnType>('RETURN');
  const [picked, setPicked] = useState<Record<number, number>>(() => Object.fromEntries(order.items.map((i) => [i.id, 0])));
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [exchangeSize, setExchangeSize] = useState('');
  const [busy, setBusy] = useState(false);

  const items = order.items.filter((i) => picked[i.id] > 0).map((i) => ({ orderItemId: i.id, quantity: picked[i.id] }));

  async function submit() {
    if (items.length === 0) { alert('Vui lòng chọn ít nhất một sản phẩm.'); return; }
    setBusy(true);
    try {
      await createReturn({ orderId: order.id, type, items, reason, description: description || undefined, evidence: evidence || undefined, exchangeSize: type === 'EXCHANGE' ? exchangeSize || undefined : undefined });
      onDone(); alert('Đã gửi yêu cầu đổi/trả. Người bán sẽ xét duyệt.');
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Không gửi được yêu cầu.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Đổi / Trả hàng" onClose={onClose}>
      <div className="flex gap-2 mb-4">
        {(['RETURN', 'EXCHANGE'] as ReturnType[]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`flex-1 text-sm rounded-lg py-2 border ${type === t ? 'border-brand bg-brand text-white' : 'border-black/15 text-gray-600'}`}>
            {t === 'RETURN' ? 'Trả & hoàn tiền' : 'Đổi hàng'}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-2">Chọn sản phẩm:</p>
      <div className="space-y-2 mb-4">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={picked[i.id] > 0} onChange={(e) => setPicked((p) => ({ ...p, [i.id]: e.target.checked ? 1 : 0 }))} className="accent-brand" />
            <span className="flex-1 text-ink">{i.name}{i.size && ` · ${i.size}`} <span className="text-gray-400">({formatVND(i.price)})</span></span>
            {picked[i.id] > 0 && (
              <select value={picked[i.id]} onChange={(e) => setPicked((p) => ({ ...p, [i.id]: Number(e.target.value) }))} className="border border-black/10 rounded px-1 text-xs">
                {Array.from({ length: i.quantity }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      {type === 'EXCHANGE' && (
        <input value={exchangeSize} onChange={(e) => setExchangeSize(e.target.value)} placeholder="Size/màu muốn đổi (vd: L)" className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-3" />
      )}
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-3 bg-white">
        {RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả chi tiết (tuỳ chọn)" rows={2} className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-2" />
      <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link ảnh/video bằng chứng (tuỳ chọn)" className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-4" />
      <button onClick={submit} disabled={busy} className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg py-2.5 text-sm">{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
    </Modal>
  );
}

const COMPLAINT_TYPES = ['Giao hàng chậm', 'Chưa nhận được hàng', 'Sản phẩm lỗi/hư hỏng', 'Thiếu sản phẩm', 'Vấn đề khác'];

// UC11.2 - gửi khiếu nại
export function ComplaintModal({ orderId, onClose, onDone }: { orderId: number; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState(COMPLAINT_TYPES[0]);
  const [content, setContent] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!content.trim()) { alert('Vui lòng nhập nội dung khiếu nại.'); return; }
    setBusy(true);
    try {
      await createComplaint({ orderId, type, content, evidence: evidence || undefined });
      onDone(); alert('Đã gửi khiếu nại. Người bán sẽ phản hồi.');
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Không gửi được khiếu nại.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Gửi khiếu nại" onClose={onClose}>
      <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-3 bg-white">
        {COMPLAINT_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mô tả vấn đề bạn gặp phải" rows={4} className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-2" />
      <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link ảnh/video bằng chứng (tuỳ chọn)" className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-4" />
      <button onClick={submit} disabled={busy} className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg py-2.5 text-sm">{busy ? 'Đang gửi…' : 'Gửi khiếu nại'}</button>
    </Modal>
  );
}

// UC12.1 - đánh giá sản phẩm (từ đơn đã nhận)
export function ReviewModal({ orderId, item, onClose, onDone }: { orderId: number; item: OrderItem; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const imgs = images.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      await createReview({ orderId, productId: item.productId, rating, comment: comment || undefined, images: imgs.length ? imgs : undefined });
      onDone(); alert('Cảm ơn bạn đã đánh giá!');
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Không gửi được đánh giá.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Đánh giá sản phẩm" onClose={onClose}>
      <p className="text-sm text-ink mb-3">{item.name}{item.size && ` · Size ${item.size}`}</p>
      <div className="flex gap-1 mb-4 text-3xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-amber-500' : 'text-gray-300'}>★</button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Chia sẻ cảm nhận của bạn (tuỳ chọn)" rows={3} className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-2" />
      <input value={images} onChange={(e) => setImages(e.target.value)} placeholder="Link ảnh thực tế, phân tách bằng dấu phẩy (tuỳ chọn)" className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-4" />
      <button onClick={submit} disabled={busy} className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg py-2.5 text-sm">{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
    </Modal>
  );
}

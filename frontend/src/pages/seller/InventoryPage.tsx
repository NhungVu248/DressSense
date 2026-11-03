import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getInventory, adjustStock, getStockMovements, MOVEMENT_LABEL,
  type InventoryItem,
} from '../../lib/seller-ops';
import { getErrorMessage } from '../../lib/api';

// Seller #4 - Quản lý tồn kho: theo dõi tồn/giữ chỗ, nhập/xuất/điều chỉnh + lịch sử.
export default function InventoryPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', q, lowOnly],
    queryFn: () => getInventory({ q: q || undefined, lowStock: lowOnly }),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Quản lý tồn kho</h1>
      <p className="text-sm text-ink/50 mb-5">Theo dõi số lượng tồn, số đang giữ chỗ và điều chỉnh kho theo từng biến thể.</p>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên sản phẩm…"
          className="border border-brand/20 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Chỉ hàng sắp hết
        </label>
      </div>

      {isLoading ? <p className="text-ink/40">Đang tải…</p>
        : !items || items.length === 0 ? <p className="text-ink/40 text-center py-16 border border-dashed border-brand/20 rounded-xl">Chưa có dữ liệu tồn kho.</p>
          : (
            <div className="overflow-x-auto bg-white rounded-xl border border-brand/10">
              <table className="w-full text-sm">
                <thead className="text-left text-ink/50 border-b border-brand/10">
                  <tr>
                    <th className="px-4 py-3">Sản phẩm</th><th className="px-3 py-3">Size</th>
                    <th className="px-3 py-3 text-right">Tồn</th><th className="px-3 py-3 text-right">Giữ chỗ</th>
                    <th className="px-3 py-3 text-right">Có thể bán</th><th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <Row key={it.variantId} it={it} onDone={() => qc.invalidateQueries({ queryKey: ['inventory'] })} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}

function Row({ it, onDone }: { it: InventoryItem; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(false);
  const [type, setType] = useState<'IMPORT' | 'EXPORT' | 'ADJUSTMENT'>('IMPORT');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = Number(qty);
    if (!Number.isFinite(n)) { alert('Nhập số lượng hợp lệ.'); return; }
    setBusy(true);
    try {
      await adjustStock(it.variantId, { type, quantity: n, note: note || undefined });
      setOpen(false); setQty(''); setNote(''); onDone();
    } catch (e) { alert(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <tr className="border-b border-brand/5">
        <td className="px-4 py-3 text-ink">{it.productName}
          {it.isLow && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">Sắp hết</span>}
        </td>
        <td className="px-3 py-3 text-ink/70">{it.size}</td>
        <td className="px-3 py-3 text-right font-medium">{it.stock}</td>
        <td className="px-3 py-3 text-right text-ink/50">{it.reserved}</td>
        <td className="px-3 py-3 text-right font-medium">{it.available}</td>
        <td className="px-3 py-3 text-right whitespace-nowrap">
          <button onClick={() => { setOpen((v) => !v); setHistory(false); }} className="text-brand hover:underline mr-3">Điều chỉnh</button>
          <button onClick={() => { setHistory((v) => !v); setOpen(false); }} className="text-ink/50 hover:underline">Lịch sử</button>
        </td>
      </tr>
      {open && (
        <tr className="bg-cream/40"><td colSpan={6} className="px-4 py-3">
          <div className="flex gap-2 flex-wrap items-center">
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="border border-brand/20 rounded-lg px-2 py-1.5 text-sm">
              <option value="IMPORT">Nhập kho (+)</option>
              <option value="EXPORT">Xuất kho (−)</option>
              <option value="ADJUSTMENT">Đặt tồn kho =</option>
            </select>
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))} placeholder={type === 'ADJUSTMENT' ? 'Tồn kho mới' : 'Số lượng'}
              className="border border-brand/20 rounded-lg px-3 py-1.5 text-sm w-32" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn)"
              className="border border-brand/20 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]" />
            <button onClick={submit} disabled={busy} className="bg-brand text-white rounded-lg px-4 py-1.5 text-sm disabled:opacity-50">Lưu</button>
          </div>
        </td></tr>
      )}
      {history && <HistoryRow variantId={it.variantId} />}
    </>
  );
}

function HistoryRow({ variantId }: { variantId: number }) {
  const { data: moves, isLoading } = useQuery({ queryKey: ['stock-moves', variantId], queryFn: () => getStockMovements(variantId) });
  return (
    <tr className="bg-cream/40"><td colSpan={6} className="px-4 py-3">
      {isLoading ? <p className="text-ink/40 text-sm">Đang tải lịch sử…</p>
        : !moves || moves.length === 0 ? <p className="text-ink/40 text-sm">Chưa có biến động kho.</p>
          : (
            <ul className="text-sm space-y-1">
              {moves.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 text-ink/70">
                  <span>{new Date(m.createdAt).toLocaleString('vi-VN')} · {MOVEMENT_LABEL[m.type]}{m.note ? ` · ${m.note}` : ''}</span>
                  <span className={m.quantity >= 0 ? 'text-green-600' : 'text-red-600'}>{m.quantity >= 0 ? '+' : ''}{m.quantity}</span>
                </li>
              ))}
            </ul>
          )}
    </td></tr>
  );
}

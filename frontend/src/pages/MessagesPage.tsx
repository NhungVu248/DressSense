import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listConversations, getConversation, sendMessage, toggleStar, type ConversationItem } from '../lib/messages';

// Trang Tin nhắn / CSKH - dùng chung cho Khách hàng, Người bán, Quản trị viên.
type Filter = 'all' | 'unread' | 'starred';

export default function MessagesPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selected = params.get('c') ? Number(params.get('c')) : null;
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'], queryFn: listConversations, refetchInterval: 10000,
  });
  const { data: active } = useQuery({
    queryKey: ['conversation', selected], queryFn: () => getConversation(selected!), enabled: !!selected, refetchInterval: 6000,
  });

  // đánh dấu đã đọc -> cập nhật badge danh sách
  useEffect(() => { if (selected) qc.invalidateQueries({ queryKey: ['conversations'] }); }, [selected, active?.messages.length, qc]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages.length]);

  const sendMut = useMutation({
    mutationFn: (content: string) => sendMessage(selected!, content),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['conversation', selected] }); qc.invalidateQueries({ queryKey: ['conversations'] }); },
  });
  const starMut = useMutation({
    mutationFn: (id: number) => toggleStar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const filtered = conversations.filter((c) => filter === 'all' || (filter === 'unread' ? c.unread > 0 : c.starred));
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const select = (id: number) => setParams(id ? { c: String(id) } : {});

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-3xl font-bold mb-4">Tin nhắn {totalUnread > 0 && <span className="text-base align-middle ml-2 bg-brand text-white rounded-full px-2 py-0.5">{totalUnread}</span>}</h1>
      <div className="grid md:grid-cols-[320px_1fr] gap-4 min-h-[60vh]">
        {/* Danh sách hội thoại */}
        <aside className={`rounded-2xl border border-brand/10 bg-white overflow-hidden ${selected ? 'hidden md:block' : ''}`}>
          <div className="flex gap-1 p-2 border-b border-brand/10">
            {([['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['starred', 'Quan trọng']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`flex-1 text-sm py-1.5 rounded-lg ${filter === v ? 'bg-brand text-white' : 'text-ink/60 hover:bg-brand/5'}`}>{l}</button>
            ))}
          </div>
          <div className="divide-y divide-brand/5 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 && <p className="p-4 text-sm text-ink/40">Chưa có hội thoại nào.</p>}
            {filtered.map((c: ConversationItem) => (
              <button key={c.id} onClick={() => select(c.id)}
                className={`w-full text-left px-4 py-3 hover:bg-brand/5 ${selected === c.id ? 'bg-brand/5' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate ${c.unread > 0 ? 'font-semibold' : 'font-medium'}`}>
                    {c.starred && <span className="text-amber-500 mr-1">★</span>}{c.counterpart}
                  </span>
                  {c.unread > 0 && <span className="shrink-0 bg-brand text-white text-xs rounded-full px-1.5">{c.unread}</span>}
                </div>
                <p className="text-xs text-ink/40 truncate mt-0.5">{c.lastMessage ?? 'Bắt đầu trò chuyện…'}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Khung chat */}
        <section className={`rounded-2xl border border-brand/10 bg-white flex flex-col ${selected ? '' : 'hidden md:flex'}`}>
          {!selected || !active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-ink/40">Chọn một hội thoại để xem.</div>
          ) : (
            <>
              <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-brand/10">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => select(0)} className="md:hidden text-ink/50">←</button>
                  <span className="font-display font-bold truncate">{active.conversation.counterpart}</span>
                  <span className="text-xs text-ink/40">{active.conversation.type === 'ADMIN' ? '· CSKH' : '· Gian hàng'}</span>
                </div>
                <button onClick={() => starMut.mutate(selected)} title="Đánh dấu quan trọng"
                  className={`text-lg ${conversations.find((c) => c.id === selected)?.starred ? 'text-amber-500' : 'text-ink/30 hover:text-amber-500'}`}>★</button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[52vh]">
                {active.messages.length === 0 && <p className="text-sm text-ink/40 text-center">Chưa có tin nhắn.</p>}
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.mine ? 'bg-brand text-white' : 'bg-brand/10 text-ink'}`}>
                      {m.content}
                      <span className={`block text-[10px] mt-0.5 ${m.mine ? 'text-white/60' : 'text-ink/40'}`}>{new Date(m.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) sendMut.mutate(text.trim()); }}
                className="flex gap-2 p-3 border-t border-brand/10">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhập tin nhắn…"
                  className="flex-1 border border-brand/20 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand" />
                <button type="submit" disabled={!text.trim() || sendMut.isPending}
                  className="px-5 rounded-full bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-50">Gửi</button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';

// ============================================================
//  Hộp thoại nhập liệu / xác nhận canh GIỮA màn hình, theo theme.
//  Thay cho window.prompt() và window.confirm() (gốc xấu, không chỉnh được).
//  Dùng dạng Promise: const v = await promptDialog('...'); if (!v) return;
// ============================================================

interface DialogReq {
  kind: 'prompt' | 'confirm';
  message: string;
  defaultValue?: string;
  okLabel?: string;
  danger?: boolean;
  resolve: (v: string | null | boolean) => void;
}

let listener: ((r: DialogReq) => void) | null = null;

// Hộp nhập liệu: trả về chuỗi người dùng nhập, hoặc null nếu hủy.
export function promptDialog(message: string, opts?: { defaultValue?: string; okLabel?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) return resolve(null);
    listener({ kind: 'prompt', message, defaultValue: opts?.defaultValue, okLabel: opts?.okLabel, resolve: resolve as any });
  });
}

// Hộp xác nhận: trả về true/false.
export function confirmDialog(message: string, opts?: { okLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) return resolve(false);
    listener({ kind: 'confirm', message, okLabel: opts?.okLabel, danger: opts?.danger, resolve: resolve as any });
  });
}

export default function GlobalDialog() {
  const [req, setReq] = useState<DialogReq | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    listener = (r) => { setReq((cur) => { cur?.resolve(cur.kind === 'confirm' ? false : null); return r; }); setValue(r.defaultValue ?? ''); };
    return () => { listener = null; };
  }, []);

  if (!req) return null;

  const close = (result: string | null | boolean) => { req.resolve(result); setReq(null); };
  const onOk = () => close(req.kind === 'prompt' ? value : true);
  const onCancel = () => close(req.kind === 'prompt' ? null : false);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 animate-fadeIn">
        <p className="text-sm text-ink mb-3 whitespace-pre-line">{req.message}</p>
        {req.kind === 'prompt' && (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); }}
            className="w-full border border-brand/30 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-brand"
          />
        )}
        <div className={`flex gap-2 justify-end ${req.kind === 'confirm' ? 'mt-4' : ''}`}>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-brand/20 text-ink/70 text-sm">Huỷ</button>
          <button onClick={onOk} className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${req.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-dark'}`}>
            {req.okLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

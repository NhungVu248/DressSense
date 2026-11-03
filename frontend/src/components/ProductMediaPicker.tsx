import { useEffect, useRef, useState } from 'react';
import { listMediaImages, uploadMediaImages, deleteMediaImage, uploadProductVideos, mediaUrl, type MediaAsset } from '../lib/media';
import { getErrorMessage } from '../lib/api';

// Ảnh đã chọn cho sản phẩm (thứ tự = sortOrder, isPrimary = ảnh bìa).
export interface SelImage { url: string; isPrimary?: boolean }

const MIN_IMAGES = 5;
const MAX_IMAGES = 10;
const MAX_VIDEOS = 5;

export default function ProductMediaPicker({
  images, onImages, videos, onVideos,
}: {
  images: SelImage[]; onImages: (v: SelImage[]) => void;
  videos: string[]; onVideos: (v: string[]) => void;
}) {
  const [libOpen, setLibOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const selectedUrls = new Set(images.map((i) => i.url));

  function toggle(url: string) {
    if (selectedUrls.has(url)) onImages(images.filter((i) => i.url !== url));
    else { if (images.length >= MAX_IMAGES) { setErr(`Tối đa ${MAX_IMAGES} ảnh.`); return; } onImages([...images, { url }]); }
  }
  function setCover(url: string) { onImages(images.map((i) => ({ ...i, isPrimary: i.url === url }))); }
  function remove(url: string) { onImages(images.filter((i) => i.url !== url)); }
  function move(url: string, dir: -1 | 1) {
    const idx = images.findIndex((i) => i.url === url);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= images.length) return;
    const next = [...images];
    [next[idx], next[j]] = [next[j], next[idx]];
    onImages(next);
  }

  const coverUrl = images.find((i) => i.isPrimary)?.url ?? images[0]?.url;

  async function onUploadFiles(files: FileList | null, into: 'select' | 'libonly') {
    if (!files || !files.length) return;
    setErr(''); setBusy(true);
    try {
      const assets = await uploadMediaImages(Array.from(files));
      if (into === 'select') {
        const room = MAX_IMAGES - images.length;
        const add = assets.slice(0, Math.max(0, room)).map((a) => ({ url: a.url }));
        onImages([...images, ...add]);
      }
    } catch (e) { setErr(getErrorMessage(e)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function onUploadVideos(files: FileList | null) {
    if (!files || !files.length) return;
    if (videos.length + files.length > MAX_VIDEOS) { setErr(`Tối đa ${MAX_VIDEOS} video.`); return; }
    setErr(''); setBusy(true);
    try { const urls = await uploadProductVideos(Array.from(files)); onVideos([...videos, ...urls]); }
    catch (e) { setErr(getErrorMessage(e)); } finally { setBusy(false); if (videoRef.current) videoRef.current.value = ''; }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Ảnh sản phẩm <span className="text-red-400">*</span> (tối thiểu {MIN_IMAGES}, tối đa {MAX_IMAGES})</span>
          <span className={`text-xs ${images.length < MIN_IMAGES ? 'text-red-500' : 'text-green-600'}`}>Đã chọn {images.length}/{MIN_IMAGES}</span>
        </div>
        {err && <p className="text-xs text-red-500 mb-2">{err}</p>}

        {images.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
            {images.map((im) => (
              <div key={im.url} className={`relative group rounded-lg overflow-hidden border ${im.url === coverUrl ? 'border-brand ring-2 ring-brand/40' : 'border-black/10'}`}>
                <img src={mediaUrl(im.url)} alt="" className="w-full aspect-square object-cover bg-brand-light" />
                {im.url === coverUrl && <span className="absolute top-1 left-1 bg-brand text-white text-[10px] px-1.5 py-0.5 rounded">Bìa</span>}
                <div className="absolute inset-x-0 bottom-0 bg-black/55 flex items-center justify-center gap-1 py-1 opacity-0 group-hover:opacity-100 transition">
                  <button type="button" title="Lùi" onClick={() => move(im.url, -1)} className="text-white text-xs px-1">◀</button>
                  {im.url !== coverUrl && <button type="button" onClick={() => setCover(im.url)} className="text-white text-[10px] px-1">Đặt bìa</button>}
                  <button type="button" title="Tiến" onClick={() => move(im.url, 1)} className="text-white text-xs px-1">▶</button>
                  <button type="button" title="Xóa" onClick={() => remove(im.url)} className="text-white text-xs px-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-sm border border-brand/30 text-brand rounded-lg px-3 py-1.5 disabled:opacity-50">+ Tải ảnh lên</button>
          <button type="button" onClick={() => setLibOpen(true)} className="text-sm border border-black/10 text-gray-600 rounded-lg px-3 py-1.5">Chọn từ kho ảnh</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onUploadFiles(e.target.files, 'select')} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Video sản phẩm (tối đa {MAX_VIDEOS}, mỗi video ≤ 50MB)</span>
          <span className="text-xs text-gray-400">{videos.length}/{MAX_VIDEOS}</span>
        </div>
        {videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
            {videos.map((v) => (
              <div key={v} className="relative rounded-lg overflow-hidden border border-black/10">
                <video src={mediaUrl(v)} className="w-full aspect-video object-cover bg-black/5" />
                <button type="button" onClick={() => onVideos(videos.filter((x) => x !== v))} className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded px-1.5">✕</button>
              </div>
            ))}
          </div>
        )}
        {videos.length < MAX_VIDEOS && (
          <>
            <button type="button" onClick={() => videoRef.current?.click()} disabled={busy} className="text-sm border border-brand/30 text-brand rounded-lg px-3 py-1.5 disabled:opacity-50">+ Tải video</button>
            <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple hidden onChange={(e) => onUploadVideos(e.target.files)} />
          </>
        )}
      </div>

      {libOpen && <LibraryModal selected={selectedUrls} onToggle={toggle} onUpload={(f) => onUploadFiles(f, 'libonly')} onClose={() => setLibOpen(false)} />}
    </div>
  );
}

function LibraryModal({ selected, onToggle, onUpload, onClose }: {
  selected: Set<string>; onToggle: (url: string) => void; onUpload: (files: FileList | null) => Promise<void>; onClose: () => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => listMediaImages().then(setAssets).catch((e) => setErr(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  async function del(id: number) {
    if (!confirm('Xóa ảnh này khỏi kho? (Sản phẩm đang dùng vẫn giữ ảnh)')) return;
    try { await deleteMediaImage(id); load(); } catch (e) { alert(getErrorMessage(e)); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold">Kho ảnh gian hàng</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>
        <div className="mb-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="text-sm border border-brand/30 text-brand rounded-lg px-3 py-1.5">+ Tải ảnh lên kho</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={async (e) => { await onUpload(e.target.files); load(); if (fileRef.current) fileRef.current.value = ''; }} />
        </div>
        {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
        {assets == null ? <p className="text-sm text-ink/40">Đang tải…</p>
          : assets.length === 0 ? <p className="text-sm text-ink/40 text-center py-8">Kho ảnh trống. Tải ảnh lên để dùng lại cho nhiều sản phẩm.</p>
            : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {assets.map((a) => {
                  const on = selected.has(a.url);
                  return (
                    <div key={a.id} className={`relative rounded-lg overflow-hidden border cursor-pointer ${on ? 'border-brand ring-2 ring-brand/40' : 'border-black/10'}`} onClick={() => onToggle(a.url)}>
                      <img src={mediaUrl(a.url)} alt="" className="w-full aspect-square object-cover bg-brand-light" />
                      {on && <span className="absolute top-1 left-1 bg-brand text-white text-[10px] px-1.5 py-0.5 rounded">✓</span>}
                      <button type="button" title="Xóa khỏi kho" onClick={(e) => { e.stopPropagation(); del(a.id); }} className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded px-1.5">🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
        <div className="text-right mt-4"><button onClick={onClose} className="bg-brand text-white rounded-lg px-5 py-2 text-sm">Xong</button></div>
      </div>
    </div>
  );
}

import fs from 'fs';
import { env } from '../config/env';

// ============================================================
//  GĐ7 - Client gọi sang AI Service (Python/FastAPI).
//  Bật khi AI_SERVICE_URL được đặt; mọi lỗi/timeout -> trả null để backend
//  TỰ ĐỘNG fallback về luật tính tại Node (không làm hỏng luồng phân tích).
// ============================================================

const BASE = env.aiServiceUrl.replace(/\/$/, '');

export const aiEnabled = () => !!BASE;

async function fetchJson(path: string, init: RequestInit, timeoutMs = 6000): Promise<any | null> {
  if (!BASE) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // AI service không sẵn sàng -> fallback
  } finally {
    clearTimeout(t);
  }
}

// /body-shape (ưu tiên mô hình ML) - trả {bodyShape, confidence, method} hoặc null
export async function aiClassify(m: { bust: number; waist: number; hip: number; shoulder?: number | null }) {
  const d = await fetchJson('/body-shape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ measurements: m, method: 'ml' }),
  });
  if (!d || !d.bodyShape) return null;
  return { bodyShape: d.bodyShape as string, confidence: d.confidence as number | null, method: d.method as string };
}

// /extract-color - UC4.1: màu chủ đạo của ảnh sản phẩm -> {code, conf} hoặc null.
export async function aiColorFromImage(filePath: string, filename: string): Promise<{ code: string; conf: number } | null> {
  if (!BASE) return null;
  let buf: Buffer;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(buf)]), filename);
  const d = await fetchJson('/extract-color', { method: 'POST', body: form }, 15000);
  if (!d || d.status !== 'OK' || !d.code) return null;
  return { code: d.code as string, conf: (d.confidence ?? 0.6) as number };
}

// /extract-color từ BUFFER (ảnh trong RAM, UC5.3 - không lưu đĩa). Trả {code, conf} hoặc null.
export async function aiColorFromBuffer(buf: Buffer, filename: string): Promise<{ code: string; conf: number } | null> {
  if (!BASE) return null;
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(buf)]), filename);
  const d = await fetchJson('/extract-color', { method: 'POST', body: form }, 15000);
  if (!d || d.status !== 'OK' || !d.code) return null;
  return { code: d.code as string, conf: (d.confidence ?? 0.6) as number };
}

// /pose - phát hiện người + 33 landmarks từ ảnh đã lưu (multer). Trả tóm tắt hoặc null.
export async function aiPose(filePath: string, filename: string) {
  if (!BASE) return null;
  let buf: Buffer;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(buf)]), filename);
  // pose có thể chậm ở lần đầu (nạp model MediaPipe ~vài giây) -> timeout rộng hơn
  const d = await fetchJson('/pose', { method: 'POST', body: form }, 20000);
  if (!d) return null;
  return {
    status: d.status as string,
    confidence: (d.confidence ?? null) as number | null,
    numLandmarks: Array.isArray(d.landmarks) ? d.landmarks.length : 0,
  };
}

import api from './api';

// Prefix host cho đường dẫn /uploads (đồng bộ ProductDetailPage).
const MEDIA_ORIGIN = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');
export const mediaUrl = (u: string) => (u.startsWith('http') ? u : MEDIA_ORIGIN + u);

export interface MediaAsset { id: number; url: string; createdAt: string }

// Kho ảnh gian hàng (tái sử dụng)
export const listMediaImages = () => api.get<{ assets: MediaAsset[] }>('/seller/media/images').then((r) => r.data.assets);
export const uploadMediaImages = (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  return api.post<{ assets: MediaAsset[] }>('/seller/media/images', fd).then((r) => r.data.assets);
};
export const deleteMediaImage = (id: number) => api.delete(`/seller/media/images/${id}`).then((r) => r.data);

// Video sản phẩm (trả URL, không lưu kho)
export const uploadProductVideos = (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  return api.post<{ urls: string[] }>('/seller/media/videos', fd).then((r) => r.data.urls);
};

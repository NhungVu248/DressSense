import api from './api';

// Tải lên tệp ảnh chung (Ảnh bìa shop, Logo, Banner quảng cáo, v.v.)
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload', fd);
  return res.data.url;
}


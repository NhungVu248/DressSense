import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Lấy thông báo lỗi thân thiện từ phản hồi API
export function getErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors[0].message;
  if (data?.message) return data.message;
  return 'Có lỗi xảy ra, vui lòng thử lại.';
}

export default api;

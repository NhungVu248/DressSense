// Phiên đăng nhập lưu theo TAB (sessionStorage) thay vì localStorage, để mở nhiều vai trò
// (Khách / Người bán / Quản trị viên) ĐỒNG THỜI trong các tab khác nhau của cùng trình duyệt
// mà không đè token lẫn nhau. Mỗi tab giữ phiên riêng; đóng tab là hết phiên.
const KEY = 'token';

export function getToken(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}
export function setToken(t: string): void {
  try { sessionStorage.setItem(KEY, t); } catch { /* chế độ riêng tư/chặn storage */ }
}
export function clearToken(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* bỏ qua */ }
}

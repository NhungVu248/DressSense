import type { NavigateFunction } from 'react-router-dom';

// Điều hướng sau khi đăng nhập thành công: hết hạn -> buộc đổi; sắp hết hạn -> lưu cảnh báo.
interface LoginLike {
  redirect?: string;
  mustChangePassword?: boolean;
  passwordExpiresInDays?: number | null;
}

export function routeAfterLogin(r: LoginLike, nav: NavigateFunction) {
  try {
    if (r.passwordExpiresInDays != null) sessionStorage.setItem('pwWarnDays', String(r.passwordExpiresInDays));
    else sessionStorage.removeItem('pwWarnDays');
  } catch { /* bỏ qua */ }
  nav(r.mustChangePassword ? '/change-password' : r.redirect || '/');
}

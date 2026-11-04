import api from './api';

// Hồ sơ cá nhân + đổi mật khẩu + tự quản tài khoản/gian hàng (Cài đặt người bán).
export interface MeProfile {
  id: number; email: string | null; phone: string | null; fullName: string;
  gender: string | null; dateOfBirth: string | null; bio: string | null;
  idNumber: string | null; address: string | null; avatarUrl: string | null; role: string; status: string;
}

export async function getMe(): Promise<MeProfile> {
  return (await api.get('/users/me')).data.user;
}
export async function updateMe(data: Partial<Pick<MeProfile, 'fullName' | 'phone' | 'gender' | 'dateOfBirth' | 'bio' | 'idNumber' | 'address'>>) {
  return (await api.patch('/users/me', data)).data;
}
export async function changePassword(body: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  return (await api.post('/auth/password/change', body)).data;
}

// Cài đặt người bán - trạng thái gian hàng & tài khoản
export async function setMyShopStatus(action: 'suspend' | 'reopen') {
  return (await api.patch('/seller/account/shop-status', { action })).data;
}
export async function lockMyAccount(mode: 'temporary' | 'permanent') {
  return (await api.patch('/seller/account/lock', { mode })).data;
}

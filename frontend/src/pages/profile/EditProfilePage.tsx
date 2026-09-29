import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Field, PrimaryButton, SecondaryButton, ErrorBox, SuccessBox } from '../../components/ui';
import { DEFAULT_AVATAR } from '../../lib/placeholder';

// UC1.5 - Cập nhật hồ sơ
export default function EditProfilePage() {
  const { user, setSession } = useAuth();
  const nav = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Đổi email/SĐT (đã có sẵn) -> luồng OTP riêng (3b)
  const [showContactForm, setShowContactForm] = useState(false);
  const [newIdentifier, setNewIdentifier] = useState('');
  const [contactStep, setContactStep] = useState<'input' | 'otp'>('input');
  const [contactTarget, setContactTarget] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [contactLoading, setContactLoading] = useState(false);

  useEffect(() => {
    if (user) { setFullName(user.fullName); setPhone(user.phone || ''); }
  }, [user]);

  if (!user) return null;

  async function saveBasicInfo() {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const body: Record<string, string> = { fullName };
      if (!user!.phone && phone) body.phone = phone; // chỉ gửi phone nếu đang khai báo lần đầu
      const res = await api.patch('/users/me', body);
      setSession(localStorage.getItem('token')!, res.data.user);
      setSuccess('Cập nhật hồ sơ thành công');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  // 3a: tải ảnh đại diện mới
  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setError(''); setSuccess('');
    const form = new FormData();
    form.append('avatar', file);
    try {
      const res = await api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSession(localStorage.getItem('token')!, res.data.user);
      setSuccess('Cập nhật ảnh đại diện thành công');
    } catch (err) { setError(getErrorMessage(err)); }
  }

  // 3b bước 1: gửi OTP tới email/SĐT mới
  async function sendContactOtp() {
    setError(''); setContactLoading(true);
    try {
      const res = await api.post('/users/me/contact/request', { newIdentifier });
      setContactTarget(res.data.target);
      setContactStep('otp');
      if (res.data.devOtp) setOtpCode(''); // để trống, dev thấy mã trong console/network
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setContactLoading(false); }
  }

  // 3b bước 2: xác thực OTP -> áp dụng thay đổi
  async function confirmContactOtp() {
    setError(''); setContactLoading(true);
    try {
      const res = await api.post('/users/me/contact/verify', { newIdentifier, code: otpCode });
      setSession(localStorage.getItem('token')!, res.data.user);
      setSuccess('Cập nhật email/số điện thoại thành công');
      setShowContactForm(false); setContactStep('input'); setNewIdentifier(''); setOtpCode('');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setContactLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/profile" className="text-sm text-gray-400 hover:text-gray-600">← Hồ sơ cá nhân</Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Chỉnh sửa hồ sơ</h1>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="bg-white rounded-xl border p-6 mb-5">
        <h3 className="font-medium mb-4">Thông tin cơ bản</h3>

        <div className="flex items-center gap-4 mb-5">
          <img
            src={avatarPreview || (user.avatarUrl ? (import.meta.env.VITE_API_URL?.replace('/api', '') + user.avatarUrl) : DEFAULT_AVATAR)}
            alt="avatar" className="w-16 h-16 rounded-full object-cover bg-gray-100"
          />
          <div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onAvatarChange} />
            <SecondaryButton onClick={() => fileInput.current?.click()}>Đổi ảnh đại diện</SecondaryButton>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG hoặc WEBP, tối đa 3MB</p>
          </div>
        </div>

        <Field label="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Field
          label="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)}
          disabled={!!user.phone} placeholder="Chưa khai báo"
          hint={user.phone ? 'Để đổi số điện thoại, dùng mục "Email / SĐT" bên dưới' : undefined}
        />
        <PrimaryButton onClick={saveBasicInfo} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </PrimaryButton>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Email / Số điện thoại</h3>
            <p className="text-sm text-gray-500 mt-0.5">Hiện tại: {user.email || user.phone || 'chưa có'}</p>
          </div>
          {!showContactForm && (
            <SecondaryButton onClick={() => setShowContactForm(true)}>Đổi</SecondaryButton>
          )}
        </div>

        {showContactForm && contactStep === 'input' && (
          <div className="mt-4 pt-4 border-t">
            <Field label="Email hoặc số điện thoại mới" placeholder="new@example.com"
              value={newIdentifier} onChange={(e) => setNewIdentifier(e.target.value)} />
            <div className="flex gap-2">
              <PrimaryButton onClick={sendContactOtp} disabled={contactLoading}>
                {contactLoading ? 'Đang gửi...' : 'Gửi mã xác thực'}
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowContactForm(false)}>Hủy</SecondaryButton>
            </div>
          </div>
        )}

        {showContactForm && contactStep === 'otp' && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500 mb-3">Mã xác thực đã gửi tới <b>{contactTarget}</b></p>
            <Field label="Mã OTP" placeholder="000000" maxLength={6}
              value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} />
            <div className="flex gap-2">
              <PrimaryButton onClick={confirmContactOtp} disabled={contactLoading}>
                {contactLoading ? 'Đang xác nhận...' : 'Xác nhận'}
              </PrimaryButton>
              <SecondaryButton onClick={() => setContactStep('input')}>Quay lại</SecondaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { Router } from 'express';
import {
  registerRequest,
  registerVerify,
  resendOtp,
  login,
  me,
  googleAuth,
  forgotPassword,
  resetPassword,
  verifyLoginOtp,
  changePassword,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// UC1.1 - Đăng ký (2 bước: gửi OTP -> xác thực tạo tài khoản)
router.post('/register/request', registerRequest);
router.post('/register/verify', registerVerify);
router.post('/otp/resend', resendOtp);

// UC1.2 - Đăng nhập
router.post('/login', login);
router.post('/login/verify-otp', verifyLoginOtp); // OTP đăng nhập lần đầu
router.post('/password/change', authenticate, changePassword); // đổi mật khẩu (hết hạn/buộc đổi)
router.get('/me', authenticate, me);
router.post('/google', googleAuth); // UC1.1/1.2 - đăng nhập/đăng ký Google

// UC1.3 - Khôi phục mật khẩu
router.post('/password/forgot', forgotPassword);
router.post('/password/reset', resetPassword);

export default router;

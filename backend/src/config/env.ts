import dotenv from 'dotenv';
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  // GĐ7 - AI service (Python/FastAPI). Trống -> tắt tích hợp, backend tự tính bằng luật Node.
  aiServiceUrl: process.env.AI_SERVICE_URL || '',
};

export const isDev = env.nodeEnv !== 'production';

// Quy tắc nghiệp vụ UC1
export const AUTH_RULES = {
  OTP_TTL_MINUTES: 5,       // OTP hiệu lực 5 phút (UC1.1, UC1.3)
  OTP_MAX_ATTEMPTS: 5,      // số lần nhập sai OTP tối đa
  LOGIN_MAX_ATTEMPTS: 5,    // số lần đăng nhập sai liên tiếp
  LOCK_MINUTES: 15,         // thời gian tạm khóa sau khi vượt ngưỡng
  PASSWORD_MIN_LENGTH: 8,
};

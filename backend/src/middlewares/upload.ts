import multer from 'multer';
import path from 'path';
import fs from 'fs';

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 3 * 1024 * 1024; // 3MB (UC1.5 - 3E)

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `u${req.user?.userId}-${Date.now()}${ext}`);
  },
});

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      // 3E: sai định dạng ảnh đại diện
      return cb(new Error('INVALID_IMAGE_TYPE'));
    }
    cb(null, true);
  },
}).single('avatar');

// ---------- UC3.1 - Ảnh toàn thân dùng cho phân tích dáng người ----------
const BODY_PHOTO_DIR = path.join(process.cwd(), 'uploads', 'body');
fs.mkdirSync(BODY_PHOTO_DIR, { recursive: true });

const BODY_PHOTO_MAX_SIZE = 5 * 1024 * 1024; // 5MB - 5E (ảnh không hợp lệ)

const bodyPhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BODY_PHOTO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `body-u${req.user?.userId}-${Date.now()}${ext}`);
  },
});

export const uploadBodyPhoto = multer({
  storage: bodyPhotoStorage,
  limits: { fileSize: BODY_PHOTO_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('INVALID_IMAGE_TYPE')); // 5E
    }
    cb(null, true);
  },
}).single('photo');

// ---------- UC6.7 - Tệp CSV nhập sản phẩm: giữ trong bộ nhớ ----------
export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

// ---------- UC5.3 - Ảnh tìm kiếm: giữ trong BỘ NHỚ, KHÔNG lưu đĩa (tối thiểu hóa dữ liệu) ----------
export const uploadSearchImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) return cb(new Error('INVALID_IMAGE_TYPE')); // 4E
    cb(null, true);
  },
}).single('image');

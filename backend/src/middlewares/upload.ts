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

// ---------- UC12.1 - Ảnh đánh giá sản phẩm (nhiều ảnh) ----------
const REVIEW_DIR = path.join(process.cwd(), 'uploads', 'reviews');
fs.mkdirSync(REVIEW_DIR, { recursive: true });

const reviewStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, REVIEW_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `rv-u${req.user?.userId}-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`);
  },
});

export const uploadReviewImages = multer({
  storage: reviewStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB mỗi ảnh - 6E
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) return cb(new Error('INVALID_IMAGE_TYPE')); // 6E
    cb(null, true);
  },
}).array('images', 5); // tối đa 5 ảnh

// ---------- UC11 - Ảnh/video bằng chứng đổi/trả & khiếu nại ----------
const EVIDENCE_DIR = path.join(process.cwd(), 'uploads', 'evidence');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
const EVIDENCE_MIME = [...ALLOWED_MIME, 'video/mp4', 'video/webm', 'video/quicktime'];

const evidenceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, EVIDENCE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `ev-u${req.user?.userId}-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`);
  },
});

export const uploadEvidence = multer({
  storage: evidenceStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB/tệp (cho phép video ngắn) - 7E
  fileFilter: (_req, file, cb) => {
    if (!EVIDENCE_MIME.includes(file.mimetype)) return cb(new Error('INVALID_EVIDENCE_TYPE'));
    cb(null, true);
  },
}).array('files', 5);

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

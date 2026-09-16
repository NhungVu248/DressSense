# DressSense — Hệ thống TMĐT thời trang cá nhân hóa ứng dụng AI

Dự án full-stack theo kiến trúc **client – server tách biệt**, giao tiếp qua REST API.

| Tầng | Công nghệ |
|------|-----------|
| Frontend | React + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query + Axios |
| Backend | Node.js + Express.js + Prisma + JWT + bcryptjs |
| Database | MySQL |

## Cấu trúc thư mục

```
DressSense/
├── backend/            # API server (Express + Prisma + JWT)
│   ├── prisma/
│   │   ├── schema.prisma   # Mô hình dữ liệu (User, Product, Order, BodyProfile...)
│   │   └── seed.ts         # Dữ liệu mẫu
│   └── src/
│       ├── config/         # Đọc biến môi trường
│       ├── lib/            # PrismaClient
│       ├── utils/          # JWT helper
│       ├── middlewares/    # Xác thực, phân quyền, xử lý lỗi
│       ├── controllers/    # Logic nghiệp vụ
│       ├── routes/         # Định tuyến API
│       ├── app.ts          # Cấu hình Express
│       └── server.ts       # Điểm khởi động
└── frontend/           # Ứng dụng React (SPA)
    └── src/
        ├── lib/            # Axios instance
        ├── context/        # AuthContext (đăng nhập/đăng ký)
        ├── components/      # Navbar...
        └── pages/          # Sản phẩm, Đăng nhập, Đăng ký
```

---

## 1. Yêu cầu môi trường

- **Node.js** >= 18 (khuyến nghị 20 LTS)  →  https://nodejs.org
- **MySQL** >= 8.0  →  https://dev.mysql.com/downloads/  (hoặc dùng XAMPP/Laragon)
- Trình soạn thảo: **VS Code**

Kiểm tra:
```bash
node --version
npm --version
mysql --version
```

---

## 2. Chuẩn bị cơ sở dữ liệu MySQL

Mở MySQL và tạo database rỗng:
```sql
CREATE DATABASE dresssense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 3. Cài đặt & chạy Backend

```bash
cd backend

# Cài thư viện
npm install

# Tạo file .env từ mẫu, rồi sửa DATABASE_URL cho đúng máy bạn
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux

# Sinh Prisma Client + tạo bảng trong DB
npm run prisma:generate
npm run prisma:migrate        # đặt tên migration, ví dụ: init

# (Tùy chọn) nạp dữ liệu mẫu
npm run db:seed

# Chạy server phát triển (http://localhost:4000)
npm run dev
```

Kiểm tra API sống: mở http://localhost:4000/api/health

**Tài khoản mẫu sau khi seed:**
- Người bán: `seller@dresssense.vn` / `123456`
- Khách hàng: `customer@dresssense.vn` / `123456`

---

## 4. Cài đặt & chạy Frontend

Mở **terminal thứ hai**:
```bash
cd frontend

npm install

copy .env.example .env        # Windows  (mặc định trỏ tới http://localhost:4000/api)

npm run dev                   # http://localhost:5173
```

Mở trình duyệt tại **http://localhost:5173**.

> Frontend đã cấu hình proxy `/api` → backend, nên khi dev không lo lỗi CORS.

---

## 5. Các lệnh hữu ích

**Backend**
| Lệnh | Tác dụng |
|------|----------|
| `npm run dev` | Chạy API kèm auto-reload |
| `npm run prisma:studio` | Mở giao diện xem/sửa dữ liệu trực quan |
| `npm run prisma:migrate` | Tạo migration khi đổi schema |
| `npm run build` | Biên dịch TypeScript sang `dist/` |

**Frontend**
| Lệnh | Tác dụng |
|------|----------|
| `npm run dev` | Chạy dev server |
| `npm run build` | Đóng gói production |
| `npm run preview` | Xem thử bản build |

---

## 6. API hiện có (khởi đầu)

| Method | Endpoint | Mô tả | Quyền |
|--------|----------|-------|-------|
| GET | `/api/health` | Kiểm tra server | Công khai |
| POST | `/api/auth/register` | Đăng ký | Công khai |
| POST | `/api/auth/login` | Đăng nhập | Công khai |
| GET | `/api/auth/me` | Thông tin tài khoản | Cần token |
| GET | `/api/products` | Danh sách sản phẩm (phân trang) | Công khai |
| GET | `/api/products/:id` | Chi tiết sản phẩm | Công khai |
| POST | `/api/products` | Tạo sản phẩm | SELLER/ADMIN |

---

## 7. Lộ trình phát triển tiếp theo

- [ ] Module giỏ hàng & đặt hàng (CartItem, Order)
- [ ] Module AI Body Analysis (tích hợp MediaPipe/OpenCV qua microservice Python)
- [ ] Recommendation Engine (kết hợp Body Profile + hành vi người dùng)
- [ ] Business Intelligence Dashboard (Customer/Behavior/Body Shape Analytics)
- [ ] Upload ảnh sản phẩm (Multer đã cài sẵn)

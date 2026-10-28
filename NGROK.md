# Công khai DressSense ra Internet qua ngrok (chạy trực tiếp, không Docker)

Chạy các service trực tiếp trên máy rồi dùng **một** tunnel ngrok (tên miền cố định) trỏ vào
frontend (cổng 5173). Vite reverse-proxy `/api` và `/uploads` sang backend nên **cùng origin,
không CORS**, và chỉ cần **một tên miền**. **HTTPS được bảo đảm ở biên ngrok.**

```
Trình duyệt ──HTTPS──> ngrok ──> Vite :5173 ──/api, /uploads──> Backend :4000
                                                                  ├── MySQL
                                                                  └── AI service :8000 (tùy chọn)
```
Chỉ cổng **5173** được công khai; backend/MySQL/AI chạy nội bộ.

## 0. Yêu cầu
- Node.js, MySQL đang chạy; (tùy chọn) Python cho AI service.
- ngrok: `winget install ngrok` (hoặc tải ở https://ngrok.com/download).

## 1. Backend (cổng 4000)
```bash
cd backend
# .env: DATABASE_URL, JWT_SECRET... (xem .env.example)
npx prisma generate
npx prisma migrate deploy      # hoặc: npx prisma migrate dev
npm run db:seed && npm run db:seed:voucher && npm run db:seed:promotion && npm run db:seed:banner
npm run dev
```

## 2. AI service — cổng 8000 (tùy chọn, cho phân tích dáng người)
```bash
cd ai-service
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Rồi đặt trong `backend/.env`: `AI_SERVICE_URL=http://localhost:8000`.
Bỏ qua bước này thì backend tự tính dáng bằng luật (rule-based).

## 3. Frontend (cổng 5173)
> **QUAN TRỌNG:** trong `frontend/.env`, đặt API về đường dẫn tương đối để đi qua tunnel:
> ```
> VITE_API_URL=/api
> ```
> (hoặc xóa hẳn dòng `VITE_API_URL` — mặc định đã là `/api`). **Đừng** để
> `http://localhost:4000/api`, vì trình duyệt ở xa không gọi được `localhost` của bạn.

```bash
cd frontend
npm run dev        # Vite chạy ở 5173, đã cấu hình proxy /api + /uploads + allowedHosts
```

## 4. ngrok — công khai với tên miền cố định
1. Đăng nhập https://dashboard.ngrok.com
2. **Your Authtoken** → copy, rồi chạy một lần:
   ```bash
   ngrok config add-authtoken <AUTHTOKEN_CUA_BAN>
   ```
3. **Domains → New Domain** (gói miễn phí cho 1 static domain, dạng `ten-cua-ban.ngrok-free.app`).
4. Mở tunnel trỏ vào frontend:
   ```bash
   ngrok http --domain=ten-cua-ban.ngrok-free.app 5173
   ```
5. Truy cập **https://ten-cua-ban.ngrok-free.app** từ bất kỳ đâu.
   Bảng điều khiển ngrok (xem request): http://localhost:4040

> Lần đầu mở domain `*.ngrok-free.app`, ngrok hiện trang cảnh báo — bấm **Visit Site**.

## Ghi chú
- **Đăng nhập Google** (nếu dùng): thêm `https://ten-cua-ban.ngrok-free.app` vào
  *Authorized JavaScript origins* ở Google Cloud Console.
- **VNPAY** (nếu bật): trong `backend/.env` đặt
  `VNP_RETURN_URL=https://ten-cua-ban.ngrok-free.app/api/payments/vnpay/return`.
- **Ổn định hơn cho demo**: có thể `npm run build && npm run preview` (preview cũng đã
  cấu hình proxy + allowedHosts) thay cho `npm run dev`.
- Tài khoản mẫu (khi đã seed): quản trị viên `admin@dresssense.vn` / `Admin@123`.

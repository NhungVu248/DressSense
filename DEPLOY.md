# Triển khai DressSense bằng Docker + ngrok

Toàn bộ hệ thống chạy bằng Docker Compose và công khai ra Internet qua **ngrok** với
**tên miền cố định** (static domain miễn phí). HTTPS được bảo đảm ở **biên ngrok**;
bên trong các container giao tiếp bằng HTTP.

```
Trình duyệt ──HTTPS──> ngrok ──HTTP──> Nginx (web) ──> React SPA
                                         ├── /api      ──> api (Node/Express/Prisma)
                                         └── /uploads  ──> api
                                                            ├── MySQL
                                                            └── ai-service (FastAPI)
```

Chỉ **web (Nginx)** được công khai; `api`, `mysql`, `ai-service` nằm trong mạng nội bộ của Docker.
Nhờ Nginx reverse-proxy, frontend gọi API theo đường dẫn tương đối `/api` nên **cùng origin,
không dính CORS**.

## 1. Yêu cầu
- Docker Desktop (đã bật, dùng Linux containers).
- Tài khoản ngrok miễn phí (để lấy authtoken + static domain).

## 2. Cấu hình
```bash
cp .env.docker.example .env
```
Mở `.env` và điền:
- `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`: đổi sang giá trị của bạn.
- `SEED_ON_START=true`: tạo dữ liệu mẫu (tài khoản admin, sản phẩm, khuyến mãi) ở lần chạy đầu.
  Sau khi đã có dữ liệu, có thể đặt lại `false`.

## 3. Chạy ứng dụng (local, chưa công khai)
```bash
docker compose up -d --build
```
Mở http://localhost:8080 (đổi `WEB_PORT` trong `.env` nếu cổng 8080 bận).
Lần đầu sẽ build ảnh (ai-service cài mediapipe/opencv nên mất vài phút).

Kiểm tra nhanh:
```bash
curl http://localhost:8080/api/health
docker compose ps
docker compose logs -f api
```

Tài khoản mẫu (khi `SEED_ON_START=true`): quản trị viên `admin@dresssense.vn` / `Admin@123`.

## 4. Công khai ra Internet qua ngrok (tên miền cố định)
1. Đăng nhập https://dashboard.ngrok.com
2. **Your Authtoken** → copy, dán vào `.env`: `NGROK_AUTHTOKEN=...`
3. **Domains** → *New Domain* (gói miễn phí cho 1 static domain, dạng
   `ten-cua-ban.ngrok-free.app`) → dán vào `.env`: `NGROK_DOMAIN=ten-cua-ban.ngrok-free.app`
4. Đặt `PUBLIC_URL=https://ten-cua-ban.ngrok-free.app` trong `.env`.
5. Chạy kèm ngrok:
```bash
docker compose --profile tunnel up -d --build
```
Giờ truy cập đượct tại **https://ten-cua-ban.ngrok-free.app** từ bất kỳ đâu.
Bảng điều khiển ngrok (xem request): http://localhost:4040

> Lần đầu mở domain `*.ngrok-free.app`, ngrok hiện một trang cảnh báo — bấm *Visit Site* để vào.

## 5. Lệnh thường dùng
```bash
docker compose ps                 # trạng thái container
docker compose logs -f api        # log backend
docker compose down               # dừng (giữ dữ liệu trong volume)
docker compose down -v            # dừng + XÓA dữ liệu (MySQL, uploads)
docker compose up -d --build api  # build lại 1 service
```

## 6. Ghi chú
- **Dữ liệu**: MySQL lưu ở volume `mysql-data`, ảnh tải lên ở volume `uploads` — còn khi `down`,
  mất khi `down -v`.
- **Migration**: container `api` tự chạy `prisma migrate deploy` mỗi lần khởi động (idempotent).
- **Đăng nhập Google** (tùy chọn): điền `GOOGLE_CLIENT_ID` trong `.env` và thêm
  `https://<NGROK_DOMAIN>` vào *Authorized JavaScript origins* ở Google Cloud Console.
- **Thanh toán online (VNPAY)**: để trống `VNP_*` thì chỉ còn COD. Nếu bật, `VNP_RETURN_URL`
  tự trỏ về `PUBLIC_URL/api/payments/vnpay/return`.

# DressSense — Backlog cập nhật & chỉnh sửa

> Ghi lại các yêu cầu/chỉnh sửa cần làm thêm (theo mô tả của chủ dự án). **Chưa triển khai** — dùng làm danh sách việc. Mỗi mục là một checkbox; nhóm theo vai trò, phần bảo mật dùng chung để ở đầu.
>
> Ngày ghi: 2026-10-30.

---

## A. Chung — Bảo mật & mật khẩu (áp dụng cho Khách hàng, Người bán, Admin)

- [x] **Băm mật khẩu** khi lưu (bcrypt — đã có).
- [x] **Độ mạnh mật khẩu**: **≥1 chữ hoa, ≥1 chữ thường, ≥1 chữ số, ≥1 ký tự đặc biệt** (áp dụng khi đăng ký + đặt lại). *(commit 16b772d)*
- [x] **Nút "xem mật khẩu"** (ẩn/hiện) ở mọi ô nhập mật khẩu + checklist tiêu chí trực tiếp. *(commit 16b772d)*
- [x] **Hạn mật khẩu 30 ngày** + cảnh báo khi còn ≤7 ngày + buộc đổi khi hết hạn (trang /change-password). *(commit ce206f5)*
- [x] **Đăng nhập lần đầu**: bắt buộc **OTP** (trang /verify-login-otp). *(commit ce206f5)*
- [ ] **Quên mật khẩu**:
  - [x] Khách hàng / Người bán: xác nhận email → nhận **OTP qua email** → đặt mật khẩu mới. *(đã có: /forgot-password → /reset-password)*
  - [ ] Admin: xác nhận email → **chờ một Admin khác gửi mật khẩu mới** qua email đã đăng ký (có **nút sinh mật khẩu ngẫu nhiên**) + kèm **OTP** → đổi mật khẩu. *(còn lại)*

---

## B. Người bán (Seller)

- [ ] **Hỗ trợ sau bán — tách riêng phần Hoàn trả hàng**, có khu vực **phản hồi trực tiếp với khách hàng**.
- [ ] **Quản lý doanh thu** hiển thị đủ: **doanh thu tổng + doanh thu thực nhận + phí trả cho sàn TMĐT + thuế**. Phần phí sàn được **trừ/chuyển thẳng cho sàn** (không nằm trong thực nhận của người bán).
- [ ] **Đăng ký chạy banner quảng cáo**: thanh toán bằng **VNPAY hoặc thẻ**.
- [ ] **Đăng ký mua voucher giảm giá**: người bán **tự chịu phần tiền giảm giá** đó.
- [ ] **Quản lý tin nhắn với khách hàng**: chia **Chưa đọc / Đã đọc**, **nút sao (quan trọng)**, **đánh dấu chưa đọc**, có **thông báo tin nhắn mới**.
- [ ] **Hồ sơ cá nhân người bán** thiết kế đầy đủ hơn; **mở rộng trường dữ liệu cho sản phẩm**.
- [ ] **Phương thức giao hàng**: người bán **tự chọn** — (a) **tự giao** (tự chịu rủi ro) hoặc (b) chọn **phương thức được hệ thống cấu hình sẵn**.
- [ ] **Thiết lập giá**: **giá cuối = giá chưa thuế + tiền thuế (nếu có)**. **Thuế KHÔNG hiển thị ở trang khách** — khách chỉ thấy **giá cuối**.

---

## C. Quản trị viên (Admin)

- [ ] **Quản lý phương thức thanh toán** + **chính sách đổi/trả & hoàn tiền**: setup sẵn **danh sách lý do hoàn hàng** cho khách chọn; **hoàn 100% tiền hàng** nếu người bán duyệt sản phẩm đủ điều kiện.
- [ ] **Quản lý tin nhắn với khách hàng**: chia **Chưa đọc / Đã đọc**, **sao quan trọng**, **đánh dấu chưa đọc**, có **thông báo tin nhắn trong mục Thông báo**.
- [ ] **Thông báo**: bổ sung **thông báo đơn hàng mới**.
- [ ] **Bỏ "Quản lý sản phẩm" ở Admin** (admin không CRUD sản phẩm trực tiếp nữa).
- [ ] **Banner quảng cáo**: thêm **duyệt đăng ký chạy banner của các gian hàng**, có **bảng timeline theo tuần/tháng** để quản lý lịch chạy.
- [ ] **Quản lý doanh thu của SÀN**: dashboard báo cáo doanh thu sàn, gồm các **khoản phí** (phí thu từ người bán, phí chạy banner quảng cáo, …). *(cần nghiên cứu thêm mô hình phí)*
- [ ] **Quản lý đánh giá**: thiết lập **danh sách từ bị cấm** — vi phạm thì **tự động chặn & ẩn** đánh giá.
- [ ] **Hồ sơ cá nhân** đầy đủ hơn; **mở rộng trường dữ liệu cho sản phẩm** (đồng bộ với Người bán).
- [ ] **Quản lý khuyến mãi — mở rộng**: quản lý các **đơn mua voucher** với **mức chiết khấu** (combo theo tháng hoặc mua lẻ) và **đơn chạy quảng cáo**.
- [ ] **Cấu hình phí vận chuyển**: đơn **quốc tế**; **trong nước** phân theo **khu vực** (theo giá bưu điện / các đơn vị chuyển phát hiện hành) và **hỏa tốc nội thành**.
- [ ] **Cấu hình thuế**.
- [ ] **Cấu hình xuất hóa đơn**: khách muốn xuất & đã để lại thông tin → **xuất (lần 2) do hệ thống tự động** (xử lý trường hợp lỗi ở lần 1).

---

## D. Khách hàng (Client)

- [ ] **Đánh giá sản phẩm**: chấm **sao** + **ảnh** (tối đa 5, tối thiểu 0) + **video** (giới hạn dung lượng).
- [ ] **Hoàn trả hàng**: chọn **lý do do sàn setup sẵn** + **ảnh** (tối thiểu 3) + **video** (giới hạn dung lượng) + **mô tả**.
- [ ] **Hai kênh hỗ trợ**: (1) **liên hệ Người bán**, (2) **liên hệ Admin** qua mục **Chăm sóc khách hàng**.
  - Vào trang **shop** có **nút nhắn tin**.
  - **Đơn hàng** có **nút liên hệ**.
  - Mục **Hỗ trợ/CSKH** → nhắn cho **Admin**.
- [ ] **Xuất hóa đơn VAT**.

---

## Ghi chú liên hệ với phần đã làm
- Phần **đổi/trả, hoàn tiền, khiếu nại** thuộc UC11 (đã có) — các mục trên là **mở rộng** (lý do setup sẵn, ảnh/video bắt buộc, phản hồi trực tiếp).
- **Cấu hình thuế / phí ship / chính sách hoàn** gắn với UC16.5 (Cấu hình hệ thống, đã có khung).
- **Doanh thu người bán** gắn UC14.4 / UC15.4; **doanh thu sàn** là phần mới cho Admin.
- **Tin nhắn/CSKH** là tính năng chat mới (chưa có) — cần thiết kế model hội thoại.
- **OTP đăng nhập lần đầu + hạn mật khẩu 30 ngày** là phần mở rộng UC1 (bảo mật tài khoản).

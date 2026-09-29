# Dữ liệu AI — 3 tầng (Giai đoạn 1)

Tách bạch dữ liệu nghiên cứu, dữ liệu dáng người và dữ liệu sản phẩm của hệ thống.

| Tầng | Nguồn | Mục đích | Trạng thái |
|------|-------|----------|-----------|
| **A — Nghiên cứu** | DeepFashion, DeepFashion2, Fashion Takes Shape | Tham khảo schema thuộc tính & cách tổ chức bài toán; transfer learning khi phù hợp | Không nhúng vào repo; chỉ học cách tổ chức. Lược đồ thuộc tính đã phản ánh trong `Product` (Prisma) |
| **B — Dáng người** | Ảnh tự thu thập → landmarks → tỷ lệ → nhãn dáng | Huấn luyện & đánh giá bộ phân loại dáng (GĐ3) | ✅ Có bản **bootstrap** `body_shape/body_shapes.csv` (600 mẫu, cân bằng 5 dáng) sinh từ luật baseline. Xem `body_shape/schema.md` |
| **C — Sản phẩm** | Kho sản phẩm của shop (bảng `Product`) | Nguồn matching & gợi ý | 🟡 Schema đủ; seed hiện chỉ vài SP có thuộc tính. Cần làm giàu dữ liệu + thêm `bodyShapeScore` (GĐ4) — xem `products/README.md` |

## Vì sao dùng dataset bootstrap cho Tầng B

Đồ án không thu thập ảnh người thật ở bước này (quyền riêng tư + chưa có pipeline pose).
Tài liệu thiết kế nêu rõ: **giữ baseline rule-based làm nguồn nhãn ban đầu**. Vì vậy Tầng B
được sinh từ chính bộ luật `classifyBodyShape` (đã có ở backend, port sang Python trong
`scripts/`). Dataset này:

- Dùng ngay cho GĐ3 để huấn luyện/so sánh Decision Tree / Random Forest / XGBoost / MLP và
  đối chiếu với baseline luật (accuracy/F1/confusion matrix).
- Khi có ảnh thật: pipeline `ảnh → MediaPipe landmarks → số đo → tỷ lệ` chỉ thay **nguồn số
  đo**, giữ nguyên schema đặc trưng và nhãn ở `body_shape/schema.md`, rồi trộn/thay dần dữ
  liệu synthetic bằng dữ liệu thật.

## Quyền riêng tư

Không commit ảnh người thật hay dữ liệu cơ thể của người dùng vào repo. Dataset Tầng B ở
đây là dữ liệu tổng hợp (synthetic), không gắn với cá nhân nào.

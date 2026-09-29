# Tầng C — Kho sản phẩm

Nguồn matching & gợi ý là bảng `Product` trong Prisma (backend), **không** tạo kho riêng ở
đây để tránh trùng nguồn sự thật.

## Hiện trạng

`Product` đã có đủ thuộc tính thời trang: `category, color, pattern, material, fit, length,
neckline, sleeve, style, season` (lược đồ tham khảo DeepFashion). Seed hiện tại chỉ có vài
sản phẩm mẫu và chưa điền đủ mọi thuộc tính.

## Cần làm

1. **Làm giàu dữ liệu sản phẩm mẫu**: bổ sung `backend/prisma/seed.ts` (hoặc seed riêng) một
   số sản phẩm/danh mục có đầy đủ thuộc tính, cân bằng để chấm điểm gợi ý có ý nghĩa.
2. **Điểm tương thích dáng người `bodyShapeScore`** (GĐ4): mỗi sản phẩm có điểm theo từng
   dáng (HOURGLASS/PEAR/RECTANGLE/APPLE/INVERTED_TRIANGLE), sinh từ luật Fashion Knowledge
   Base áp lên thuộc tính sản phẩm. Lưu ở bảng `ProductBodyFit` riêng hoặc trường JSON trên
   `Product` — quyết định ở GĐ4.

Tiêu chí hoàn thành Tầng C (GĐ1): kho sản phẩm mẫu đủ thuộc tính để chấm điểm gợi ý ở các
giai đoạn sau.

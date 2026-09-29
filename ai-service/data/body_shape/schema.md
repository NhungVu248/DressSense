# Tầng B — Dataset dáng người có nhãn (`body_shapes.csv`)

Đóng góp lõi của đồ án: dữ liệu để huấn luyện/đánh giá bộ phân loại dáng người (GĐ3).

## Cột dữ liệu

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | int | Mã mẫu |
| `height_cm` | float | Chiều cao (cm) |
| `weight_kg` | float | Cân nặng (kg) |
| `shoulder_cm` | float | Rộng vai (cm) — từ landmark, hoặc ước lượng khi chỉ có số đo |
| `bust_cm` | float | Vòng ngực (cm) |
| `waist_cm` | float | Vòng eo (cm) |
| `hip_cm` | float | Vòng hông (cm) |
| `waist_hip` | float | **Đặc trưng chuẩn hóa** eo/hông (WHR) |
| `waist_bust` | float | **Đặc trưng chuẩn hóa** eo/ngực |
| `bust_hip` | float | **Đặc trưng chuẩn hóa** ngực/hông |
| `shoulder_hip` | float | **Đặc trưng chuẩn hóa** vai/hông |
| `body_shape` | enum | Nhãn: `HOURGLASS`, `RECTANGLE`, `PEAR`, `APPLE`, `INVERTED_TRIANGLE` |
| `confidence` | float | Độ tin cậy của nhãn (theo biên so với ngưỡng) |
| `source` | str | `synthetic_rule` (bootstrap) hoặc `real` (ảnh thật, bổ sung sau) |

**Đặc trưng dùng để huấn luyện** = 4 tỷ lệ chuẩn hóa (`waist_hip`, `waist_bust`, `bust_hip`,
`shoulder_hip`) — chuẩn hóa theo tỷ lệ để không phụ thuộc khoảng cách chụp/chiều cao. Các cột
`*_cm` giữ lại để truy vết và thử nghiệm đặc trưng khác.

## Quy ước phân loại (nguồn nhãn, đồng bộ backend `classifyBodyShape`)

Đơn vị cm. Ngưỡng: cân đối `|bust-hip| ≤ 5`; eo thu nhỏ rõ `gap ≥ 9`; trội `≥ 9`.

- **APPLE** — `waist ≥ bust-2` hoặc `waist ≥ hip-2` (eo là điểm rộng nhất).
- **HOURGLASS** — `|bust-hip| ≤ 5` và `bust-waist ≥ 9` và `hip-waist ≥ 9`.
- **RECTANGLE** — `|bust-hip| ≤ 5` nhưng eo không thu nhỏ đủ rõ.
- **PEAR** — `hip-bust ≥ 9`.
- **INVERTED_TRIANGLE** — `bust-hip ≥ 9`.

## Sinh lại dataset

```bash
cd ai-service/scripts
python generate_body_shape_dataset.py --per-class 120 --seed 42
# -> ../data/body_shape/body_shapes.csv (600 mẫu, cân bằng 5 dáng)
```

## Bổ sung dữ liệu thật (giai đoạn sau)

Khi pipeline pose (GĐ2) sẵn sàng: với mỗi ảnh, chạy MediaPipe lấy landmarks → suy ra
`shoulder/bust/waist/hip` → tính 4 tỷ lệ → gán nhãn (chuyên gia hoặc luật) → thêm dòng với
`source=real`. Giữ nguyên tên cột để trộn trực tiếp với dữ liệu bootstrap; ưu tiên đánh giá
mô hình trên tập `real`.

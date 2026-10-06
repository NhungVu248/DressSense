# Tầng B — Dataset dáng người có nhãn

Đóng góp lõi của đồ án: dữ liệu để huấn luyện/đánh giá bộ phân loại dáng người (GĐ3).

- `body_shapes_ansur.csv` — **số đo NGƯỜI THẬT** (ANSUR II), là tập chính. Có cột `sex`.

**Nhãn dáng là suy luận công thức** (quy tắc bên dưới), không phải người gán.

## Cột dữ liệu

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | int | Mã mẫu |
| `sex` | str | Giới tính — **chỉ có ở** `body_shapes_ansur.csv` (`F`) |
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
| `source` | str | `ansur2` (số đo thật ANSUR II) · `real` (nhóm tự gán, bổ sung sau) |

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

## Nguồn & phương pháp — `body_shapes_ansur.csv` (dữ liệu thật)

- **Nguồn số đo:** ANSUR II — *2012 U.S. Army Anthropometric Survey* (Natick Soldier RD&E
  Center), bản công khai. Dùng file NỮ: 1986 người thật.
- **Đơn vị gốc → chuẩn hóa:** số đo ANSUR ở mm → chia 10 ra cm; `weightkg` là phần mười kg
  → chia 10. Ánh xạ cột: `bust = chestcircumference`, `waist = waistcircumference`,
  `hip = buttockcircumference`, `shoulder = biacromialbreadth` (rộng vai — là *breadth*),
  `height = stature`.
- **Gán nhãn:** áp quy tắc tỷ lệ ngực–eo–hông bên dưới (đồng bộ `classifyBodyShape` của hệ
  thống, theo tinh thần **FFIT — Female Figure Identification Technique**) lên số đo thật.
- **Phân bố nhãn tự nhiên (mất cân bằng thật, cần nêu trong báo cáo & xử lý ở GĐ3):**
  Rectangle ~34.6% · Pear ~34.0% · Hourglass ~18.7% · Apple ~12.3% · Inverted Triangle ~0.4%
  (chỉ 7 mẫu). → đánh giá bằng **F1/confusion matrix** thay vì chỉ accuracy; cân nhắc
  class-weight/oversampling hoặc bổ sung mẫu cho lớp hiếm.
- **Trung thực:** số đo là thật, nhưng nhãn do **công thức** sinh (không phải người gán);
  dân số là **nữ quân nhân Mỹ**, không phải khách hàng mục tiêu.

Tái lập:

```bash
cd ai-service/scripts
python download_ansur.py                 # tải ANSUR II vào ../data/body_shape/raw/ (gitignore)
python build_ansur_dataset.py            # -> ../data/body_shape/body_shapes_ansur.csv (1986 mẫu)
```

## Bổ sung dữ liệu thật (giai đoạn sau)

Khi pipeline pose (GĐ2) sẵn sàng: với mỗi ảnh, chạy MediaPipe lấy landmarks → suy ra
`shoulder/bust/waist/hip` → tính 4 tỷ lệ → gán nhãn (chuyên gia hoặc luật) → thêm dòng với
`source=real`. Giữ nguyên tên cột để trộn trực tiếp với dữ liệu bootstrap; ưu tiên đánh giá
mô hình trên tập `real`.

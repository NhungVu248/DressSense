# Dữ liệu AI — 3 tầng (Giai đoạn 1)

Tách bạch dữ liệu nghiên cứu, dữ liệu dáng người và dữ liệu sản phẩm của hệ thống.

| Tầng | Nguồn | Mục đích | Trạng thái |
|------|-------|----------|-----------|
| **A — Nghiên cứu** | DeepFashion, DeepFashion2, Fashion Takes Shape | Tham khảo schema thuộc tính & cách tổ chức bài toán; transfer learning khi phù hợp | Không nhúng vào repo; chỉ học cách tổ chức. Lược đồ thuộc tính đã phản ánh trong `Product` (Prisma) |
| **B — Dáng người** | **Số đo thật ANSUR II** → tỷ lệ → nhãn dáng | Huấn luyện & đánh giá bộ phân loại dáng (GĐ3) | ✅ `body_shape/body_shapes_ansur.csv` — **1986 số đo NỮ THẬT** (ANSUR II), nhãn suy bằng luật. Xem `body_shape/schema.md` |
| **C — Sản phẩm** | Kho sản phẩm của shop (bảng `Product`) | Nguồn matching & gợi ý | 🟡 Schema đủ; seed hiện chỉ vài SP có thuộc tính. Cần làm giàu dữ liệu + thêm `bodyShapeScore` (GĐ4) — xem `products/README.md` |

## Dataset Tầng B

| File | Bản chất | Số đo | Nhãn | Vai trò |
|------|----------|-------|------|---------|
| `body_shapes_ansur.csv` | **Số đo người THẬT** (ANSUR II) | Thật, 1986 nữ | Suy bằng luật (công thức) | **Chính** — huấn luyện/đánh giá GĐ3 |

**Điểm mấu chốt để trung thực trong báo cáo:** **nhãn 5 dáng là suy luận công thức** (quy tắc
tỷ lệ ngực–eo–hông, đồng bộ `classifyBodyShape` của hệ thống, tinh thần FFIT), KHÔNG phải người
gán; chỉ **số đo** là của người thật:

- ANSUR II: số đo của người thật → phân bố & tương quan cơ thể tự nhiên → phân bố dáng
  **mất cân bằng thật** (xem `schema.md`).

Hạn chế ANSUR II (phải nêu trong báo cáo): dân số là **nữ quân nhân Mỹ** (không phải khách
hàng Việt Nam), và nhãn do công thức sinh nên mô hình học trên đó về bản chất học lại luật.
Muốn nhãn do **người thật gán** đúng dân số mục tiêu thì cần nhóm tự thu thập & gán nhãn
(pipeline schema đã chừa sẵn ở `schema.md`, cột `source=real`).

## Nguồn ảnh nghiệm thu pose (GĐ2)

Để nghiệm thu đường "có người" của `/pose` trên ảnh THẬT, dùng mẫu **Body Measurements Image
Dataset** (unidpro) trên Kaggle — 6 đối tượng có `front_img`/`side_img` + số đo (ngực/eo/hông,
chiều cao, cân nặng). Kết quả: 6/6 phát hiện, đủ 33 landmarks, tin cậy TB 0.953
(`scripts/validate_pose.py`).

⚠️ **Giấy phép:** đây là dữ liệu của nhà bán thương mại; bản Kaggle có thể là mẫu. Thư mục
tải về **không kèm file LICENSE** — cần kiểm tra điều khoản trên trang Kaggle trước khi trích
số liệu cụ thể vào báo cáo. Vì vậy **không commit ảnh/dữ liệu gốc của bộ này** vào repo (dùng
cục bộ để nghiệm thu). Quy mô 6 mẫu quá nhỏ để huấn luyện — chỉ dùng kiểm thử pipeline.

## Quyền riêng tư & nguồn

Không commit ảnh người thật hay dữ liệu người dùng vào repo. Dữ liệu gốc ANSUR II để trong
`body_shape/raw/` (đã .gitignore); chỉ commit dataset đã xử lý (số đo tổng hợp theo tỷ lệ,
không định danh cá nhân). Nguồn: ANSUR II — 2012 U.S. Army Anthropometric Survey (Natick
Soldier RD&E Center), bản công khai. Tải bằng `scripts/download_ansur.py`.

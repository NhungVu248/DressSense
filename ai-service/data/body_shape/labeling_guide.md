# Hướng dẫn gán nhãn dáng người THẬT (human-annotated)

Mục tiêu: tạo nhãn do **con người gán** cho dữ liệu dáng người, thay cho nhãn suy bằng luật.
Đây là điều kiện để tuyên bố đóng góp khoa học về độ chính xác (mô hình học từ nhãn thật, rồi
so sánh với baseline luật).

## 1. Nguồn dữ liệu thật — chọn 1 (hoặc kết hợp)

| Cách | Mô tả | Ưu / Nhược |
|------|-------|-----------|
| **A. Gán nhãn số đo có sẵn** | Lấy mẫu từ `body_shapes_ansur.csv` (1986 số đo NGƯỜI THẬT), ẩn nhãn luật, cho người gán dựa trên **hình bóng dựng từ số đo** | Có ngay, không cần thu thập; nhưng dân số là nữ quân nhân Mỹ |
| **B. Nhóm tự thu thập** | Ảnh chính diện + số đo (vòng ngực/eo/hông) của tình nguyện viên **đồng ý** | Đúng dân số mục tiêu (VN); nhưng cần công sức + xử lý riêng tư |
| **C. Kết hợp** | A để có số lượng + B để kiểm định trên dân số mục tiêu | Cân bằng tốt nhất |

Khuyến nghị bắt đầu bằng **A** (làm được ngay với công cụ kèm theo), rồi bổ sung **B**.

## 2. Định nghĩa 5 dáng (gán theo HÌNH, không áp công thức)

Người gán nhìn **hình bóng** (và số đo tham khảo) rồi chọn, KHÔNG tính theo ngưỡng — để nhãn
độc lập với luật:

- **Đồng hồ cát (Hourglass):** vai/ngực và hông cân đối, eo hóp rõ.
- **Chữ nhật (Rectangle):** vai–eo–hông gần thẳng, eo không hóp rõ.
- **Quả lê (Pear/Triangle):** hông rộng hơn hẳn vai/ngực.
- **Tam giác ngược (Inverted Triangle):** vai/ngực rộng hơn hẳn hông.
- **Quả táo (Apple/Round):** eo là phần rộng nhất (bụng đầy), vai–hông không hóp eo.
- **Không chắc (unsure):** cho phép bỏ qua; không ép gán.

## 3. Quy trình gán nhãn

1. Mỗi mẫu được **≥ 2 người** gán độc lập (không thấy nhãn của nhau, không thấy nhãn luật).
2. Dùng công cụ `labeling_tool.html` (Artifact): hiện hình bóng + số đo/tỷ lệ, chọn 1 trong 5
   dáng hoặc "không chắc"; công cụ tự lưu tiến độ và **xuất CSV** nhãn.
3. **Hợp nhất:** nhãn cuối = khi các người gán trùng nhau; nếu lệch → người thứ 3 quyết định
   hoặc loại mẫu. Báo cáo **độ đồng thuận (Cohen's/Fleiss' kappa)** giữa các người gán.
4. Loại các mẫu "không chắc" hoặc bất đồng khỏi tập huấn luyện chính (giữ lại để phân tích).

## 4. Định dạng CSV nhãn người (xuất từ công cụ)

Cùng schema đặc trưng như `schema.md`, thêm:

| Cột | Ý nghĩa |
|-----|---------|
| `body_shape` | Nhãn người gán (HOURGLASS/RECTANGLE/PEAR/APPLE/INVERTED_TRIANGLE) |
| `annotator` | Mã người gán (vd A1, A2) |
| `source` | `human` |

Gộp nhiều lượt gán vào dataset bằng `scripts/build_human_labeled.py` → `body_shapes_human.csv`.

## 5. Quyền riêng tư (bắt buộc nếu thu thập ảnh — cách B)

- **Đồng ý có hiểu biết** bằng văn bản trước khi chụp/đo; nêu rõ mục đích (đồ án), lưu trữ,
  quyền rút lại.
- **Ẩn danh:** không lưu tên/khuôn mặt gắn với số đo; dùng mã số. Có thể che mặt ảnh.
- **Tối thiểu hóa:** chỉ giữ số đo + hình bóng cần cho gán nhãn; **không commit ảnh/PII** vào
  repo (đã .gitignore `data/**/real/` và ảnh).
- Nhất quán với UC3 (consent `bodyDataConsentAt`, quyền xóa UC3.4).

## 6. Dùng dữ liệu đã gán

- Huấn luyện lại: `python train_body_shape.py --data ../data/body_shape/body_shapes_human.csv`
- **Đánh giá thật:** so mô hình (huấn luyện trên nhãn người) với **baseline luật** trên cùng
  tập test nhãn người — đây mới là con số accuracy/F1 có ý nghĩa khoa học để đưa vào báo cáo.

# DressSense AI Service

Thành phần Trí tuệ nhân tạo của DressSense, tách thành service riêng theo tài liệu
*ThietKe_QuyTrinh_AI_DressSense*. Kiến trúc 3 tầng:

```
Frontend (React) ──REST(JWT)──> Backend (Express/Prisma/MySQL) ──REST nội bộ──> AI Service (Python/FastAPI)
```

Backend điều phối nghiệp vụ + lưu trữ; AI service chỉ tính toán (pose, phân loại, chấm điểm)
và trả JSON. Ảnh gốc có thể xóa ngay sau khi trích số đo (tối thiểu hóa dữ liệu — nhất quán UC3.4).

## Trạng thái theo giai đoạn

| GĐ | Nội dung | Trạng thái |
|----|----------|------------|
| 1 | Thu thập & chuẩn bị dữ liệu (3 tầng A/B/C) | ✅ Tầng B: 1986 số đo NỮ THẬT (ANSUR II) + 600 synthetic; Tầng C: 14 SP đủ thuộc tính |
| 2 | Pose Estimation (MediaPipe) | ⬜ Chưa |
| 3 | Trích đặc trưng + phân loại dáng (rule → ML) | ⬜ Chưa (baseline rule-based đã có ở backend) |
| 4 | Fashion Knowledge Base + điểm tương thích dáng–SP | ⬜ Chưa |
| 5 | Recommendation engine (hybrid) + giải thích | ⬜ Chưa |
| 6 | Ghi nhận hành vi & cá nhân hóa | ⬜ Chưa |
| 7 | Tích hợp, triển khai & đánh giá | ⬜ Chưa |

## Hợp đồng API (đề xuất, GĐ7)

| Endpoint | Đầu vào | Đầu ra |
|----------|---------|--------|
| `POST /pose` | Ảnh toàn thân | `landmarks[33]` + confidence |
| `POST /body-shape` | landmarks hoặc số đo | `bodyShape` + confidence + đặc trưng |
| `POST /recommend` | bodyShape + sở thích + hành vi + bộ lọc | Danh sách SP đã xếp hạng + lý do |

Các endpoint này sẽ thay dần phần đang tính tại Node (`classifyBodyShape`,
`suggestSizesByCategory`) khi từng giai đoạn hoàn tất.

## Thư mục

```
ai-service/
├── data/               # 3 tầng dữ liệu (xem data/README.md)
│   ├── body_shape/     # Tầng B - dataset dáng người có nhãn (đóng góp lõi)
│   └── products/       # Tầng C - kho sản phẩm (dùng bảng Product của Prisma)
└── scripts/            # tiện ích sinh/chuẩn bị dữ liệu
    └── generate_body_shape_dataset.py
```

Chưa dựng runtime FastAPI ở giai đoạn này (đó là mốc M1 của GĐ2). Giai đoạn 1 chỉ tập
trung vào **dữ liệu**.

## Quyền riêng tư

Dữ liệu cơ thể là dữ liệu nhạy cảm: informed consent (UC3.1), quyền được xóa (UC3.4),
tối thiểu hóa dữ liệu, kiểm soát truy cập theo chủ tài khoản. Không commit ảnh người thật
vào repo.

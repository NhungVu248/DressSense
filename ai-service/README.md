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
| 2 | Pose Estimation (MediaPipe) | ✅ M1 xong — FastAPI + `/pose` + `/body-shape`; nghiệm thu trên ảnh người thật (6/6 phát hiện, tin cậy ~0.95) |
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
├── app/                # FastAPI service (GĐ2)
│   ├── main.py         #   endpoints: /health, /pose, /body-shape
│   ├── pose.py         #   MediaPipe Pose Landmarker (tải model lúc chạy)
│   ├── body_shape.py   #   luật phân loại dáng (port từ backend)
│   └── schemas.py
├── data/               # 3 tầng dữ liệu (xem data/README.md)
│   ├── body_shape/     # Tầng B - dataset dáng người có nhãn (đóng góp lõi)
│   └── products/       # Tầng C - kho sản phẩm (dùng bảng Product của Prisma)
├── scripts/            # tiện ích sinh/chuẩn bị dữ liệu
├── models/             # model MediaPipe .task (tải lúc chạy, .gitignore)
└── requirements.txt
```

## Chạy AI service (GĐ2)

```bash
cd ai-service
python -m venv .venv && .venv\Scripts\activate      # Windows (hoặc: source .venv/bin/activate)
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Endpoints (đã test):

```bash
# Kiểm tra sống
curl http://127.0.0.1:8000/health

# Phân loại dáng từ số đo (đường chắc chắn)
curl -X POST http://127.0.0.1:8000/body-shape -H "Content-Type: application/json" \
  -d '{"measurements":{"bust":90,"waist":66,"hip":92}}'
# -> {"bodyShape":"HOURGLASS","confidence":0.95,...}

# Pose từ ảnh toàn thân -> 33 landmarks + confidence (tải model lần đầu ~vài giây)
curl -X POST http://127.0.0.1:8000/pose -F "image=@fullbody.jpg"
# ảnh không có người -> {"status":"NO_PERSON",...}
```

**Đã kiểm chứng:**
- `/health`, `/body-shape` (số đo → dáng người, HOURGLASS 0.95 đúng), `/pose` trả `NO_PERSON`
  đúng cho ảnh không người.
- **Đường "có người"**: nghiệm thu trên **6 ảnh người THẬT** (mẫu Kaggle *Body Measurements
  Image Dataset*, front_img) → **6/6 phát hiện, đủ 33 landmarks, tin cậy TB 0.953**. Công cụ:
  `scripts/validate_pose.py --dir <thư mục ảnh> --pattern front_img.jpg`.

Lưu ý: MediaPipe cho landmark 2D, KHÔNG cho chu vi ngực/eo/hông — ước lượng số đo từ ảnh là
bài toán Giai đoạn 3. Backend Express sẽ gọi các endpoint này thay dần phần đang tính tại Node
ở các giai đoạn sau.

Ảnh dùng để nghiệm thu là dữ liệu bên thứ ba (nhà bán unidpro), **không commit vào repo** và
cần kiểm tra giấy phép trước khi trích số liệu cụ thể vào báo cáo — xem `data/README.md`.

## Quyền riêng tư

Dữ liệu cơ thể là dữ liệu nhạy cảm: informed consent (UC3.1), quyền được xóa (UC3.4),
tối thiểu hóa dữ liệu, kiểm soát truy cập theo chủ tài khoản. Không commit ảnh người thật
vào repo.

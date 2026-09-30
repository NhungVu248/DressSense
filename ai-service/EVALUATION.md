# Đánh giá & tích hợp AI (Giai đoạn 7)

Tổng hợp kết quả tích hợp đầu-cuối và đánh giá thành phần AI của DressSense.

## 1. Kiến trúc tích hợp backend ↔ AI service

```
Frontend ──REST(JWT)──> Backend (Express) ──REST──> AI Service (FastAPI)
                              │                         /pose, /body-shape
                              └─ fallback: luật Node khi AI tắt/timeout
```

- Bật bằng biến môi trường `AI_SERVICE_URL` (backend `.env`). Trống → backend tự tính bằng
  luật Node (`classifyBodyShape`) — hệ thống vẫn chạy khi không có AI service.
- Client: `backend/src/services/ai-client.ts` (timeout + fallback, **mọi lỗi → null → dùng Node**).
- Trong luồng UC3.1: có ảnh → gọi `/pose` (MediaPipe thật) lưu `analysisResult.pose`; phân loại
  gọi `/body-shape?method=ml`, ghi `analysisResult.engine = ai-ml` (hoặc `node-rule` khi fallback).

## 2. Nghiệm thu đầu-cuối (đã chạy thật)

| Kiểm thử | Kết quả |
|----------|---------|
| `/pose` trên 6 ảnh người thật (mẫu Kaggle) | 6/6 phát hiện, 33 landmarks, tin cậy 0.93–0.98 |
| Phân tích **ảnh thật** qua backend (source=PHOTO) | `analysisResult` = `{engine: "ai-ml", pose: {status OK, confidence 0.955, numLandmarks 33}}`, dáng PEAR conf 0.994 |
| Phân tích **số đo** qua backend | dáng đúng luật/ML, lưu Body Profile có phiên bản |
| Gợi ý (`/recommendations`) | Xếp hạng + giải thích "Vì sao hợp với bạn"; hành vi (WISHLIST/ADD_TO_CART) làm điểm thay đổi đúng hướng |

Luồng khép kín: **ảnh/số đo → pose → phân loại dáng → Body Profile → đồng bộ hồ sơ → gợi ý có giải thích → hành vi → gợi ý vòng sau.**

## 3. Đánh giá phân loại dáng người

Từ `data/body_shape/ml_report.md` (1986 số đo thật ANSUR, đặc trưng tỷ lệ):

| Model | accuracy | macro-F1 | CV macro-F1 |
|-------|----------|----------|-------------|
| **DecisionTree** (chọn) | 0.935 | 0.956 | 0.884±0.065 |
| RandomForest | 0.922 | 0.947 | 0.873±0.067 |
| MLP | 0.930 | 0.953 | 0.898±0.067 |
| XGBoost | 0.922 | 0.946 | 0.880±0.063 |

Confusion chủ yếu ở ranh giới Rectangle↔Pear↔Hourglass; đặc trưng quan trọng nhất `bust_hip`.

> ⚠️ **Giới hạn (bắt buộc nêu):** nhãn do LUẬT sinh nên các số trên = mô hình học lại luật với
> độ trung thành cao, KHÔNG phải độ chính xác trên nhãn do người thật gán. Bộ công cụ gán nhãn
> thật (`labeling_guide.md` + `labeling_tool`) là đường để có con số có ý nghĩa khoa học.

## 4. Hiệu năng (máy dev, uvicorn 1 worker — chưa tối ưu)

Đo bằng `scripts/eval_latency.py` (10 lần, sau warm-up, model đã nạp):

| Endpoint | median | mean | max |
|----------|--------|------|-----|
| `/body-shape` (ml) | ~2040 ms | ~2055 ms | ~2200 ms |
| `/pose` (ảnh thật) | ~2185 ms | ~2264 ms | ~2800 ms |

Con số đo trên máy dev đang chạy nhiều tiến trình (backend, vite, MySQL) và uvicorn 1 worker;
là mốc tham khảo, không phải hiệu năng tối ưu hóa. Lần gọi `/pose` đầu tiên còn tốn thêm ~8s
nạp model MediaPipe (đã xử lý bằng timeout rộng + tải model lúc khởi động khi triển khai thật).

## 5. Đánh giá định tính gợi ý (ví dụ)

Khách dáng **Đồng hồ cát**: top gợi ý *Áo sơ mi cổ V* (0.88 → 0.90 sau khi tương tác nhóm Áo)
với lý do *"Hợp dáng đồng hồ cát: phom ôm tôn eo; Bạn hay quan tâm nhóm Áo."* — lý do bám đúng
thành phần điểm cao nhất, đúng định hướng explainable của tài liệu.

## 6. Giới hạn & hướng phát triển

- Nhãn dáng hiện là suy luận công thức → cần dữ liệu **người thật gán** để đánh giá khoa học.
- MediaPipe cho landmark 2D, **chưa** ước lượng chu vi ngực/eo/hông từ ảnh → số đo vẫn nhập tay;
  ảnh→số đo là hướng mở (dataset ảnh+số đo, hồi quy landmark→chu vi).
- Trọng số công thức gợi ý (0.40/0.25/0.15/0.10/0.10) là điểm khởi đầu — tinh chỉnh khi có dữ
  liệu tương tác thật.
- Ngoài phạm vi phiên bản đầu: 3D body (SMPL), virtual try-on, generative, deep recommendation.

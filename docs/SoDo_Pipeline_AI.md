# Sơ đồ pipeline AI — DressSense

Luồng xử lý từ ảnh/số đo đến gợi ý có giải thích. Màu: **xanh dương = kế thừa**
(MediaPipe), **xanh lá = tự phát triển**, **xám = dữ liệu/nguồn**.

```mermaid
flowchart TD
    IN["Ảnh toàn thân / Số đo thủ công"]:::data
    POSE["Thị giác máy tính (kế thừa)<br/>MediaPipe Pose + Segmentation"]:::inherit
    FEAT["Trích đặc trưng hình thể<br/>(tỷ lệ ngực–eo–hông; bề rộng/sâu)"]:::data
    SHAPE["Phân loại dáng người<br/>luật → ML · macro-F1 0.956"]:::dev
    MEAS["Ước lượng số đo từ ảnh<br/>hồi quy silhouette · MAE ~1.5cm*"]:::dev
    BP["Body Profile<br/>dáng + số đo + độ tin cậy (có phiên bản)"]:::dev
    KB["Tri thức & tín hiệu<br/>Fashion KB · Sở thích (UC2) · Hành vi"]:::data
    REC["Recommendation hybrid<br/>0.40 dáng · 0.25 style · 0.15 màu · 0.10 sở thích · 0.10 hành vi"]:::dev
    OUT["Gợi ý sản phẩm + giải thích<br/>&quot;Vì sao hợp với bạn&quot;"]:::dev

    IN --> POSE --> FEAT
    FEAT --> SHAPE
    FEAT --> MEAS
    SHAPE --> BP
    MEAS --> BP
    BP --> REC
    KB --> REC
    REC --> OUT

    classDef inherit fill:#E6F1FB,stroke:#185FA5,color:#0C447C;
    classDef dev fill:#E1F5EE,stroke:#0F6E56,color:#085041;
    classDef data fill:#F1EFE8,stroke:#5F5E5A,color:#2C2C2A;
```

\* MAE ~1.5cm đo trên **ảnh synthetic (CALVIS)** — điều kiện sạch (cận trên lạc quan); trên
ảnh người thật cần bổ sung dữ liệu + đo domain gap.

## Chú giải các bước
1. **Đầu vào**: ảnh toàn thân hoặc số đo thủ công (UC3.1).
2. **Thị giác (kế thừa)**: MediaPipe Pose Landmarker (33 điểm mốc) + segmentation mask.
3. **Trích đặc trưng**: tỷ lệ ngực–eo–hông (phân loại dáng); bề rộng/sâu hoặc silhouette (số đo).
4. **Phân loại dáng** (luật + ML) và **ước lượng số đo** (hình học/hồi quy) — tự phát triển.
5. **Body Profile**: tổng hợp dáng + số đo + độ tin cậy, lưu kèm phiên bản; đồng bộ hồ sơ (UC2.3).
6. **Recommendation hybrid**: kết hợp điểm hợp dáng (Fashion KB), sở thích (UC2), hành vi →
   xếp hạng + sinh câu **"Vì sao hợp với bạn"** (UC5).

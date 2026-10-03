# Báo cáo thành phần AI — DressSense
### Kế thừa · Tự phát triển & thuật toán · Dữ liệu

Tài liệu tổng hợp theo *Thiết kế quy trình phát triển AI* và hiện trạng mã nguồn
(repo `NhungVu248/DressSense`).

---

## PHẦN 1 — DỰ ÁN KẾ THỪA GÌ, TỪ SẢN PHẨM/MÔ HÌNH NÀO

Nguyên tắc: **kế thừa phần khó đã được giải tốt; tự phát triển phần lõi tạo giá trị riêng.**

| Thành phần | Kế thừa từ | Dạng kế thừa |
|---|---|---|
| **Phát hiện tư thế / điểm mốc cơ thể** | **MediaPipe Pose Landmarker (Google)** | Mô hình **pretrained** (BlazePose, 33 landmarks + độ tin cậy). Dùng nguyên, **không huấn luyện lại** |
| **Thuật toán học máy** phân loại dáng | **scikit-learn, XGBoost** | Thư viện: Decision Tree, Random Forest, MLP, XGBoost |
| **Lược đồ thuộc tính trang phục** | **DeepFashion / DeepFashion2** | Tham khảo *cách tổ chức* thuộc tính (category, color, pattern, sleeve, length, neckline, fit, style…) → phản ánh vào bảng `Product` |
| **Tri thức quan hệ dáng ↔ trang phục** | Tri thức thời trang phổ quát + ý tưởng *Fashion Takes Shape* | Tham khảo ý tưởng, tự viết luật |
| **Ước lượng số đo từ ảnh** (hướng SOTA) | **SHAPY (SMPL‑X, Max Planck)** | Tham khảo phương pháp (ảnh → mesh 3D → đo chu vi); để *future‑work* |
| **Sinh nhãn số đo "ground truth"** | **CALVIS** | Kế thừa *phương pháp* đo chu vi (cắt lát mesh) + dùng **dataset ảnh+nhãn** của họ |
| **Ý tưởng gợi ý phụ thuộc dáng** | *ViBE (body‑aware recommendation)* | Tham khảo ý tưởng; tự đơn giản hóa thành công thức hybrid |
| Nền tảng kỹ thuật | FastAPI/uvicorn, Express/Prisma/MySQL, React | Framework |

**Tóm lại phần kế thừa cốt lõi là 1 mô hình pretrained duy nhất** — MediaPipe Pose (thị giác,
phát hiện cơ thể) — cùng các **thư viện ML** và **lược đồ/ý tưởng** tham khảo. Toàn bộ "trí tuệ
nghiệp vụ" (phân loại dáng, chấm điểm trang phục, công thức gợi ý, ước lượng số đo) là **tự phát
triển**.

---

## PHẦN 2 — TỰ PHÁT TRIỂN GÌ, THUẬT TOÁN HOẠT ĐỘNG & TÍNH TOÁN RA SAO

### 2.1. Phân loại dáng người theo tỷ lệ (rule‑based — baseline)

**Đầu vào:** vòng ngực `B`, eo `W`, hông `H` (cm). **Đầu ra:** 1 trong 5 dáng + độ tin cậy.

**Cách tính (ngưỡng nhân trắc):**
```
d = B − H            (chênh ngực–hông)
gB = B − W           (eo thu so với ngực)
gH = H − W           (eo thu so với hông)
Ngưỡng: cân đối |d| ≤ 5cm; eo thu rõ ≥ 9cm; trội ≥ 9cm
```
Luật quyết định (ưu tiên trên xuống):
- **APPLE** nếu `W ≥ B−2` hoặc `W ≥ H−2` (eo là vòng rộng nhất).
- **HOURGLASS** nếu `|d| ≤ 5` và `gB ≥ 9` và `gH ≥ 9` (ngực–hông cân, eo hóp rõ).
- **RECTANGLE** nếu `|d| ≤ 5` nhưng eo không hóp đủ.
- **PEAR** nếu `H − B ≥ 9` (hông trội). **INVERTED_TRIANGLE** nếu `B − H ≥ 9` (ngực/vai trội).

**Độ tin cậy** theo biên cách ngưỡng:
```
conf = min(0.95, base + |giá_trị − ngưỡng| / 40)
```
→ càng xa ngưỡng càng chắc chắn; dưới `0.6` ⇒ đánh dấu "ước lượng sơ bộ" (`isPreliminary`).

### 2.2. Phân loại dáng người bằng Machine Learning

**Đặc trưng (chuẩn hóa tỷ lệ, không phụ thuộc kích thước tuyệt đối):**
`waist_hip = W/H`, `waist_bust = W/B`, `bust_hip = B/H`.

**Thuật toán:** so sánh **Decision Tree, Random Forest, MLP, XGBoost** (scikit‑learn/XGBoost),
chọn mô hình macro‑F1 cao nhất. Huấn luyện trên dữ liệu số đo thật (ANSUR), đánh giá
train/test + 5‑fold CV.

**Cách hoạt động:** mỗi mô hình học ranh giới trong không gian 3 tỷ lệ → dự đoán dáng. Ví dụ
Decision Tree học các "nếu tỷ lệ … thì dáng …", xấp xỉ và tổng quát hóa luật ở 2.1.

**Kết quả:** DecisionTree tốt nhất — **accuracy 0.935, macro‑F1 0.956, CV‑F1 0.884**. Đặc
trưng quan trọng nhất: `bust_hip`.

> *Lưu ý khoa học:* nhãn huấn luyện do **luật** sinh ⇒ mô hình "học lại luật" với độ trung
> thành cao, không phải độ chính xác trên nhãn do người gán. (Đã chuẩn bị công cụ gán nhãn
> người để nâng cấp.)

### 2.3. Ước lượng số đo cơ thể từ ẢNH (module thị giác lõi)

**(a) Phương pháp hình học** (ảnh trước + ảnh nghiêng + chiều cao):
1. MediaPipe cho **pose + segmentation mask**.
2. Quy tỷ lệ cm/pixel = `chiều_cao / chiều_cao_pixel_của_mask`.
3. Tại mức ngực/eo/hông (suy từ mốc vai–hông): đo **bề rộng** (ảnh trước) và **bề sâu** (ảnh
   nghiêng). Lấy **run liền mạch quanh trục giữa thân + chặn theo mốc vai/hông** để **loại
   cánh tay** (cải tiến giảm sai số eo 40→9cm).
4. Chu vi ≈ **chu vi hình elip** với bán trục `a=rộng/2`, `b=sâu/2` (xấp xỉ Ramanujan):
```
C ≈ π · [ 3(a+b) − √((3a+b)(a+3b)) ]
```
Kết quả (6 mẫu thật): MAE eo ~9cm, hông ~13cm — baseline nhẹ, chạy **Windows/CPU**.

**(b) Hồi quy từ silhouette** (trên CALVIS):
- Trích đặc trưng silhouette: **bề rộng pixel tại 16 mức dọc + diện tích + bbox** (ảnh render
  tỉ lệ camera cố định ⇒ pixel mang thông tin kích thước).
- **Hồi quy Ridge / Random Forest** (đa đầu ra) → `(ngực, eo, hông)` cm.
- Kết quả: 100 mẫu → ~2.5cm; **bản FULL 3.803 mẫu → RandomForest MAE TB ~1.5cm** (ngực 1.5 ·
  eo 1.9 · hông 1.1; CV 1.5cm). Tăng dữ liệu cải thiện rõ ⇒ chứng minh pipeline ảnh→số đo khả thi.

> *Lưu ý:* ~1.5cm là trên **ảnh synthetic 1 góc, camera cố định** (điều kiện sạch, cận trên lạc
> quan). **Domain gap đã đo**: chạy model này trên **ảnh người thật** (tách silhouette bằng
> MediaPipe segmentation) cho **MAE ~46–55cm** (over‑estimate mạnh) ⇒ mô hình synthetic **không
> chuyển giao** sang ảnh thật; cần huấn luyện trên **dữ liệu ảnh thật** (hoặc domain adaptation).
> Đã bọc thành endpoint thực nghiệm `/estimate-measurements` (kèm cảnh báo "ước lượng, cho chỉnh
> tay"). Khung `estimators.py` để cắm bản SOTA (SHAPY/SMPL‑X) khi có Linux+GPU.

### 2.4. Điểm tương thích dáng ↔ sản phẩm (Fashion Knowledge Base)

**Cách tính:** mỗi dáng có tập luật `prefer/avoid` trên thuộc tính SP (phom, cổ, tay, độ dài)
kèm trọng số. Điểm 1 sản phẩm với 1 dáng:
```
score = 0.5 + Σ(trọng_số_khớp_prefer) − Σ(trọng_số_khớp_avoid),   kẹp về [0.05, 0.98]
```
kèm **lý do** (vd "cổ V kéo dài thân trên"). Lưu sẵn vào bảng `ProductBodyFit` (điểm 0..1/dáng).
Ví dụ: Áo vai bồng cổ thuyền → PEAR 0.94; Đầm chữ A cổ V → APPLE 0.98.

### 2.5. Recommendation Engine (hybrid có trọng số) + giải thích

**Công thức điểm gợi ý mỗi sản phẩm:**
```
Score = 0.40·BodyShapeMatch + 0.25·StyleMatch + 0.15·ColorMatch
      + 0.10·PreferenceMatch + 0.10·BehaviorScore
```
Cách tính từng thành phần:
- **BodyShapeMatch** = `ProductBodyFit.score` của dáng khách (từ Body Profile).
- **StyleMatch**: `Product.style` ∈ sở thích → 1, ngược lại 0.4.
- **ColorMatch**: màu ∈ ưa thích → 1; ∈ tránh → 0; còn lại 0.5.
- **PreferenceMatch**: trung bình các tín hiệu có dữ liệu (chất liệu, ngân sách theo danh mục,
  thương hiệu, dịp).
- **BehaviorScore** (xem 2.6).

**Xử lý thiếu dữ liệu (cold start):** thành phần nào thiếu dữ liệu thì **bỏ khỏi tổng và chuẩn
hóa lại trọng số** → người mới (chưa có Body Profile/sở thích) vẫn được xếp hạng hợp lý.

**Giải thích "Vì sao hợp với bạn":** sinh câu từ (các) thành phần đóng góp cao nhất + lý do của
`ProductBodyFit` (vd *"Hợp dáng đồng hồ cát: phom ôm tôn eo; Bạn hay quan tâm nhóm Áo."*).

### 2.6. Ghi nhận hành vi & cá nhân hóa (BehaviorScore)

Ghi sự kiện `VIEW / WISHLIST / ADD_TO_CART / PURCHASE`, trọng số theo mức cam kết **1/2/3/4**.
Tổng hợp thành **ái lực theo danh mục & phong cách** (chuẩn hóa 0..1); điểm hành vi của 1 SP =
trung bình ái lực danh mục + phong cách của nó → nạp vào thành phần 0.10 của công thức gợi ý.
*(Minh chứng: sau khi khách tương tác nhóm "Áo", điểm các áo tăng rõ.)*

### 2.7. Thành phần nghiệp vụ hỗ trợ (tự phát triển)
- **Sinh Body Profile có phiên bản** (mỗi lần phân tích tạo bản mới, truy vết).
- **Đồng bộ Body Profile → hồ sơ cá nhân hóa** (UC2.3), tự hủy liên kết khi xóa dữ liệu (UC3.4).
- **Tích hợp backend ↔ AI service** có **fallback về luật Node** khi AI tắt/timeout.

---

## PHẦN 3 — CÁC BỘ DATASET SỬ DỤNG

| Dataset | Vai trò trong dự án | Loại | Giấy phép / lưu ý |
|---|---|---|---|
| **ANSUR II** (US Army 2012) | Huấn luyện **phân loại dáng** (1.986 số đo nữ thật) | Số đo thật | Công khai |
| **Bootstrap synthetic** (tự sinh) | Tập cân bằng 5 dáng để kiểm thử (600 mẫu) | Số đo synthetic | Tự tạo bằng luật |
| **CALVIS** (neoglez) | Huấn luyện **ảnh → số đo** (ảnh silhouette + chu vi) | Ảnh synthetic + nhãn | **Phi thương mại** (kiểm license) |
| **Body Measurements (unidpro, Kaggle)** | Nghiệm thu pose + POC ảnh→số đo (6 mẫu: ảnh trước/nghiêng + số đo thật) | Ảnh thật + số đo | Nhà bán TM; bản 6 là mẫu |
| **DeepFashion2** | **Tham khảo lược đồ thuộc tính** SP (không tải/không train) | — | Phi thương mại |
| **SHAPY / HBW** | *Future‑work*: bản nâng cấp SOTA ảnh→số đo + tập đánh giá | Ảnh thật + số đo 3D | Phi thương mại; cần Linux+GPU |
| **Kho sản phẩm DressSense** | Matching & gợi ý (18 SP đủ thuộc tính + điểm tương thích) | Dữ liệu dự án | Tự tạo |

**Trạng thái dữ liệu cho module thị giác:**
- *Phát hiện pose*: không cần dữ liệu huấn luyện (pretrained) → đủ.
- *Ảnh → số đo*: đã chạy trên **synthetic (CALVIS, MAE ~2.5cm)**; **trên ảnh thật chỉ có 6 mẫu**
  → chưa đủ để huấn luyện/đánh giá chính thức. Điểm nghẽn là **dữ liệu ảnh người thật có nhãn
  số đo** (cần vài trăm mẫu — nhóm tự thu thập hoặc HBW/bản full).

---

## KẾT LUẬN
Dự án **kế thừa đúng phần khó đã được giải** (MediaPipe pose, thư viện ML, lược đồ DeepFashion,
phương pháp SHAPY/CALVIS) và **tự phát triển toàn bộ phần lõi nghiệp vụ**: luật + ML phân loại
dáng, ước lượng số đo từ ảnh (hình học + hồi quy silhouette), cơ sở luật thời trang, công thức
gợi ý hybrid có giải thích, và cá nhân hóa theo hành vi. Hướng phát triển chính còn lại là **bổ
sung dữ liệu ảnh người thật có số đo** để nâng module thị giác từ mức *khả thi (synthetic)* lên
*đáng tin trên ảnh thật*.

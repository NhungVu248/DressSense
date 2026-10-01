# Nghiên cứu: Ước lượng số đo vòng từ ảnh (image → measurements)

Hướng mở của dự án: từ ảnh toàn thân tự ước lượng **vòng ngực/eo/hông (cm)** để không bắt
người dùng nhập số đo tay. Thư mục này là **điểm khởi đầu nghiên cứu (POC)**, không phải
tính năng production.

## Phương pháp (baseline hình học)

`estimate_measurements.py`:
1. MediaPipe Pose (+ segmentation mask) trên **ảnh trước** và **ảnh nghiêng**.
2. Tỉ lệ cm/pixel từ **chiều cao đã biết** (chiều cao người ÷ chiều cao pixel của mask).
3. Tại mức ngực/eo/hông (suy từ mốc vai–hông): đo **bề rộng** (ảnh trước) và **bề sâu**
   (ảnh nghiêng) của thân từ mask.
4. Chu vi ≈ **chu vi hình elip** (xấp xỉ Ramanujan) với bán trục = rộng/2, sâu/2.

Chạy (cần bộ ảnh+số đo cục bộ, KHÔNG commit vào repo):
```bash
python estimate_measurements.py --dataset "C:/path/to/dataset"
```

## Kết quả trên 6 mẫu thật (bộ Kaggle Body Measurements) — MAE (cm)

| Phương pháp | Ngực | Eo | Hông |
|-------------|------|----|------|
| Baseline (span toàn hàng, **gộp cánh tay**) | ~13 | ~40 | ~32 |
| **(a)** Loại cánh tay (run giữa + chặn theo mốc vai/hông, hệ số theo mức) | ~14 | **~9** | **~13** |
| **(b)** Hồi quy (RandomForest, LOO) trên đặc trưng rộng/sâu+cao/nặng | **~6** | **~7** | **~7** |

**Phát hiện & tiến triển:**
- Baseline **ước lượng vượt** nặng ở eo/hông vì bề rộng span cả hàng **gộp cánh tay buông**.
- **(a)** Lấy run foreground liền mạch quanh trục giữa thân + **chặn** theo bề rộng suy từ mốc
  vai/hông (hệ số theo mức: ngực 1.3, eo 1.45, hông 1.95 — khớp hông nằm sâu nên hông cần hệ
  số lớn). Eo giảm 40→9, hông 32→13. `estimate_measurements.py`.
- **(b)** Thay công thức elip cứng bằng **hồi quy học máy** (`train_measurement_regressor.py`,
  Ridge/RandomForest, đánh giá Leave-One-Out): MAE ~6–7cm đều cả 3 vòng.
  ⚠️ **n=6 là CỰC NHỎ** → số liệu chỉ để kiểm thử khung, phương sai LOO cao; KHÔNG dùng làm
  kết luận độ chính xác. Khung đã sẵn sàng: có dataset lớn chỉ cần `--dump-features` rồi train.

## Hướng phát triển (next steps)

1. **Loại chi khỏi bề rộng**: chỉ đo bề rộng *thân* — dùng mask phân đoạn theo bộ phận
   (limb-excluded), hoặc chụp tư thế dang nhẹ tay (A-pose) để tách tay khỏi thân, hoặc giới
   hạn width quanh trục giữa theo mốc vai/hông.
2. **Hiệu chỉnh học máy**: thay công thức elip cứng bằng **hồi quy** (đặc trưng hình học +
   chiều cao/cân nặng → chu vi), huấn luyện trên dữ liệu ảnh+số đo đủ lớn. 6 mẫu chỉ đủ đo
   baseline, **không đủ** để huấn luyện — cần bộ đầy đủ (bản trả phí unidpro, hoặc nhóm tự
   thu thập có đồng ý) + kiểm tra giấy phép.
3. **Chuẩn hóa tư thế & hiệu chuẩn tỉ lệ**: yêu cầu ảnh đứng thẳng, đủ toàn thân; cân nhắc
   vật tham chiếu thay cho chỉ dùng chiều cao.
4. **Đánh giá**: MAE/°% theo từng vòng trên tập test có nhãn số đo thật.

## Khung pluggable (estimators.py)

Interface chung `MeasurementEstimator.estimate(front, side, height_cm) -> {bust, waist, hip}`
để thay phương pháp mà không đổi phần gọi:
- `GeometricEstimator` ("geometric") — baseline hình học, chạy **Windows/CPU**, cần ảnh
  trước + nghiêng + chiều cao.
- `ShapyEstimator` ("shapy") — **điểm cắm sẵn** cho bản SOTA (chưa hiện thực; cần Linux+GPU).

```python
from estimators import get_estimator
get_estimator("geometric").estimate("front.jpg", "side.jpg", height_cm=165)
```

## Bộ dữ liệu bổ sung: CALVIS (synthetic, miễn phí — ưu tiên)

[CALVIS](https://github.com/neoglez/calvis): ~3.803 mẫu **ảnh người synthetic** (xám 200×200,
sinh từ mesh SMPL) + nhãn **chu vi chest/waist/pelvis** (JSON). Ưu điểm cho đồ án: **miễn phí,
không vướng riêng tư** (người tổng hợp), có nhãn số đo thật trên mesh → đủ lượng để
train/đánh giá, thay cho bộ 6 mẫu.

**Lưu ý:** `calvis-master` (clone từ GitHub) chỉ là **code**; **dataset** nằm ở các link
`.tar.gz` riêng (SharePoint + mật khẩu) trong README của repo.

Cách dùng (bản tải sẵn **không cần SMPL**; chỉ cần SMPL nếu tự sinh lại):
1. Tải dataset — nên lấy bản nhỏ **100 mẫu** trước để thử nhanh (`calvis-100-instances.tar.gz`,
   mật khẩu `calvis-100-i`), rồi mới tải full (`CALVIS.tar.gz`, `calvisdataset`). Giải nén được
   `CALVIS/dataset/cmu/` với `annotations/{female,male}/*_anno.json` và
   `synthetic_images/200x200/{female,male}/*.png`.
2. Xem cấu trúc JSON/đơn vị (xác nhận trước khi nạp):
   ```bash
   python load_calvis.py --root ".../CALVIS/dataset/cmu" --inspect
   ```
3. Nạp về schema chung (`id, sex, bust_cm, waist_cm, hip_cm, image`):
   ```bash
   python load_calvis.py --root ".../CALVIS/dataset/cmu" --out calvis_labels.csv
   ```
(Định dạng đã khớp code repo: nhãn `human_dimensions.{chest,waist,pelvis}_circumference` theo
**mét** → script tự ×100 ra cm; ảnh `X_mesh_Y.png` ↔ `X_mesh_Y_anno.json`.)

Lưu ý: `bust=chest, waist=waist, hip=pelvis` (pelvis ở mức chậu, hơi khác "hông rộng nhất");
ảnh là **silhouette xám synthetic** (MediaPipe pose có thể kém tin cậy — cân nhắc đo bề rộng
trực tiếp từ silhouette, hoặc dùng để huấn luyện CNN kiểu *Neural Anthropometer*). Dữ liệu tải
về **không commit** vào repo. Kiểm giấy phép CALVIS trước khi dùng trong báo cáo.

## Benchmark & hướng phát triển: SHAPY + HBW

**SHAPY** (CVPR 2022, Max Planck) hồi quy dáng 3D **SMPL-X** từ 1 ảnh và xuất **chiều cao,
cân nặng, chu vi ngực/eo/hông** — đúng bài toán ảnh→số đo, là bản nâng cấp SOTA của baseline
hình học ở đây. Kèm **HBW (Human Bodies in the Wild)**: ảnh người thật + số đo thật (suy từ
quét 3D) để **đánh giá**.

Định vị:
- *Baseline (repo này)*: nhẹ, chạy CPU, cần ảnh trước+nghiêng tư thế chuẩn; MAE hiện ~6–14cm
  trên 6 mẫu (chỉ kiểm thử khung).
- *SHAPY/SMPL-X*: chính xác hơn, ảnh đơn "in the wild"; nhưng nặng.

Yêu cầu để dùng SHAPY+HBW (**ngoài phạm vi v1**, theo Mục 6 tài liệu thiết kế):
1. **Đăng ký + chấp nhận license phi thương mại** tại https://shapy.is.tue.mpg.de (SMPL-X +
   HBW). Phải ghi rõ "non-commercial research" trong báo cáo; DressSense TMĐT nếu thương mại
   hóa phải xin license riêng.
2. Môi trường **Linux + GPU + PyTorch + SMPL-X** (CPU/Windows gần như không chạy nổi).
3. Cắm vào khung: hiện thực `ShapyEstimator.estimate()` (image → SMPL-X betas → đo chu vi
   trên mesh), giữ nguyên interface → phần còn lại của hệ thống không đổi.

Đánh giá đề xuất: so `GeometricEstimator` vs `ShapyEstimator` trên HBW (MAE theo từng vòng)
để định lượng mức cải thiện — số liệu cho báo cáo.

## Trạng thái

Chưa nối vào luồng sản phẩm. Giao diện UC3.1 vẫn yêu cầu nhập số đo tay; ảnh hiện chỉ dùng để
chạy pose (lưu landmarks + độ tin cậy). Khi phương pháp đạt sai số chấp nhận được, mới thay
bước "nhập số đo" bằng "tự điền từ ảnh (cho phép chỉnh tay)".

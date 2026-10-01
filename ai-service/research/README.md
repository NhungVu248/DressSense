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

## Trạng thái

Chưa nối vào luồng sản phẩm. Giao diện UC3.1 vẫn yêu cầu nhập số đo tay; ảnh hiện chỉ dùng để
chạy pose (lưu landmarks + độ tin cậy). Khi phương pháp đạt sai số chấp nhận được, mới thay
bước "nhập số đo" bằng "tự điền từ ảnh (cho phép chỉnh tay)".

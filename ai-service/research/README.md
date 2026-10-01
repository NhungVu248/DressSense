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

## Kết quả baseline (6 mẫu thật, bộ Kaggle Body Measurements)

| Vòng | MAE (sai số tuyệt đối TB) |
|------|---------------------------|
| Ngực | ~13 cm |
| Eo   | ~40 cm |
| Hông | ~32 cm |

**Phát hiện chính (quan trọng cho báo cáo):** baseline **ước lượng vượt** có hệ thống, nặng
nhất ở eo/hông. Nguyên nhân: bề rộng lấy theo *span foreground* của mask tại mỗi hàng **bao
gồm cả cánh tay buông hai bên thân** → rộng giả tạo, đặc biệt ở eo nơi tay sát người. Đây là
khó khăn lõi của bài toán single-view anthropometry.

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

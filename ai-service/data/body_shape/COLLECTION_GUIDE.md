# Hướng dẫn thu thập ảnh gán nhãn DÁNG NGƯỜI (cải thiện phần thị giác)

Mục tiêu: gom ảnh người thật, **bỏ vào đúng thư mục theo dáng**, rồi train để mô hình học từ
ảnh thật thay vì chỉ synthetic CALVIS.

## 1. Bỏ ảnh vào đâu

```
ai-service/data/body_shape/real/
    INVERTED_TRIANGLE/   <- vai/ngực RỘNG hơn hông (tam giác ngược, chữ V)
    PEAR/                <- hông RỘNG hơn vai (quả lê / tam giác)
    HOURGLASS/           <- vai ~ hông, EO THON rõ (đồng hồ cát)
    RECTANGLE/           <- vai ~ eo ~ hông, ít chênh (chữ nhật / thẳng)
    APPLE/               <- eo đầy, ~ hoặc > ngực/hông (tròn / quả táo)
```

Tên thư mục **chính là nhãn** — mô hình học "ảnh trong thư mục này = dáng đó". Đặt tên file tùy ý.

> ⚠️ Ảnh **không** được commit lên git (đã chặn trong `.gitignore`: `data/**/real/` + `*.jpg/png`).
> Chỉ dùng cho nghiên cứu/đồ án. Ảnh lấy từ web: tôn trọng bản quyền, không tái phân phối.

## 2. Từ khóa tìm (Google Images)

| Dáng | Từ khóa tiếng Anh (ra nhiều ảnh minh họa nhất) | Tiếng Việt |
|------|-----------------------------------------------|-----------|
| INVERTED_TRIANGLE | `inverted triangle body shape female`, `V-shape athletic body women` | `dáng tam giác ngược` |
| PEAR | `pear body shape`, `triangle body shape women`, `wide hips body` | `dáng quả lê`, `dáng tam giác` |
| HOURGLASS | `hourglass body shape`, `defined waist body figure` | `dáng đồng hồ cát` |
| RECTANGLE | `rectangle body shape`, `straight athletic body women` | `dáng chữ nhật`, `dáng thẳng` |
| APPLE | `apple body shape`, `round body shape midsection` | `dáng quả táo`, `dáng tròn` |

Mẹo: trang blog thời trang "5 body shapes" thường có ảnh minh họa đủ 5 nhóm, dễ cắt.

## 3. Ảnh thế nào thì DÙNG ĐƯỢC (rất quan trọng — ảnh xấu làm hỏng mô hình)

✅ Nên:
- **Toàn thân**, đứng thẳng, **chính diện** (nhìn trực diện camera).
- Quần áo **ôm / vừa** (váy body, legging, đồ bơi, đồ thể thao) — thấy rõ đường cơ thể.
- **1 người** trong ảnh.
- **Tay hơi tách khỏi thân** (chống hông, hoặc dang nhẹ) — để không che eo/hông.

❌ Tránh:
- Áo khoác rộng, váy xòe (giấu dáng).
- Ngồi, nghiêng, chụp nửa người, nhiều người.
- Tay buông sát ép vào eo (làm eo/hông đo sai).

## 4. Số lượng nên có

- Tối thiểu **~30 ảnh/lớp** mới nên train; **~80–150/lớp** thì kết quả mới đáng tin.
- `INVERTED_TRIANGLE` và `APPLE` khó kiếm hơn — cứ gom được bao nhiêu hay bấy nhiêu, phần
  thiếu có thể bù tạm bằng dữ liệu CALVIS (xem dưới).

## 5. Train

```bash
cd ai-service/research
# chỉ ảnh thật:
python train_shape_real.py
# trộn thêm CALVIS để bù lớp còn ít (cần đã chạy train_shape_from_image.py 1 lần để có shape_features.csv):
python train_shape_real.py --with-calvis
```

Script tự: tách silhouette bằng MediaPipe segmentation (chịu nền thật) → tỷ lệ 2D → RandomForest,
báo accuracy + ma trận nhầm lẫn theo lớp, lưu model `models/shape_from_image_real.joblib`.

## 6. Lưu ý trung thực (ghi báo cáo)

- Nhãn gán **bằng mắt** nên chủ quan, nhất là RECTANGLE ↔ HOURGLASS. Nếu phân vân, bỏ ảnh đó.
- Ảnh chính diện không thấy độ dày trước–sau → một số ca vẫn khó. Mô hình này là **gợi ý**,
  đối chiếu với số đo nhập tay (đường chính), không thay thế.
- Khi có đủ ảnh thật, so accuracy với bản CALVIS-only (64%) để thấy mức cải thiện thực tế.

# Báo cáo tiến độ — Script trình bày (UC3 → UC5)
### DressSense · Phân tích dáng người · Trí tuệ thời trang · Gợi ý & tư vấn phong cách

> Tài liệu này viết dưới dạng **script nói** để trình bày/bảo vệ: mỗi phần nêu rõ **(1) đã làm được gì · (2) làm thế nào · (3) kế thừa mô hình/thư viện nào · (4) tự phát triển thêm phần nào · (5) nguyên lý hoạt động & cách tính**. Phần đọc thẳng được in thường; chú thích kỹ thuật để trong ngoặc.

---

## Mở đầu (nói ~30 giây)

"Em xin trình bày tiến độ ba nhóm chức năng lõi về AI của hệ thống DressSense: **UC3 — Phân tích dáng người**, **UC4 — Trí tuệ thời trang (gán nhãn sản phẩm + tri thức phối đồ)**, và **UC5 — Gợi ý sản phẩm và tư vấn phong cách**. Tinh thần xuyên suốt của em là: **kế thừa đúng những mô hình khó đã được giải sẵn, còn toàn bộ phần nghiệp vụ thời trang thì nhóm tự phát triển**, và mọi gợi ý đều **minh bạch — có lý do**, **AI chỉ tư vấn, người dùng quyết định cuối cùng**."

**Nền tảng kế thừa (nói chung 1 lần):** backend **Express + Prisma + MySQL**, frontend **React + Vite + TypeScript**, dịch vụ AI **Python + FastAPI**. Mô hình thị giác kế thừa **MediaPipe Pose Landmarker** (pretrained của Google). Học máy kế thừa **scikit-learn / XGBoost**. Dữ liệu tham khảo: **ANSUR II** (số đo người thật), **CALVIS** (ảnh synthetic + số đo), lược đồ thuộc tính **DeepFashion2**.

---

## UC3 — Phân tích dáng người

### Đã làm được gì
- **UC3.1** nhập liệu có **đồng ý xử lý dữ liệu cơ thể** (informed consent) — không đồng ý thì không thu thập.
- **UC3.2** xử lý: từ **số đo** hoặc **ảnh toàn thân** → tỷ lệ cơ thể → **phân loại 1 trong 5 dáng** (đồng hồ cát, chữ nhật, quả lê, quả táo, tam giác ngược) kèm **độ tin cậy**.
- **UC3.3** sinh **Body Profile** có phiên bản: dáng người + **khuyến nghị trang phục** (nên mặc/nên tránh) + **gợi ý size** theo danh mục.
- **UC3.4** **xóa dữ liệu cơ thể** (chỉ ảnh / toàn bộ) — quyền được xóa; xóa xong gợi ý quay về mặc định.
- Đồng bộ Body Profile vào hồ sơ cá nhân hóa (UC2.3) để các phần sau dùng.

### Làm thế nào & kế thừa gì
- **Phát hiện người + tư thế từ ảnh:** kế thừa **MediaPipe Pose Landmarker** (33 điểm mốc + mặt nạ phân vùng người). Em **không tự huấn luyện** nhận diện cơ thể — đây là phần khó đã có sẵn, chất lượng cao, chạy được trên **Windows/CPU**.
- **Phân loại dáng:** nhóm **tự phát triển** hai đường: (a) **luật theo tỷ lệ** ngực–eo–hông (theo tinh thần **FFIT – Female Figure Identification Technique**); (b) **mô hình học máy** (Decision Tree / Random Forest / MLP của scikit-learn) huấn luyện trên **số đo thật ANSUR II** (1.986 nữ), nhãn suy bằng công thức.
- **Ảnh → số đo (module nghiên cứu):** tự phát triển, kế thừa kỹ thuật từ **CALVIS**. Hai hướng: hình học (chu vi ellipse Ramanujan từ bề rộng + bề sâu) và hồi quy silhouette (Random Forest trên 3.803 ảnh synthetic).

### Tự phát triển thêm
- Toàn bộ **luật phân loại dáng + ngưỡng**, bộ **đặc trưng tỷ lệ**, pipeline tiền xử lý, chọn người trung tâm khi ảnh nhiều người, và cơ chế **consent/xóa dữ liệu** theo quyền riêng tư.
- Cơ chế **fallback**: AI service lỗi/tắt → backend tự tính bằng **luật Node** — luồng không gãy.

### Nguyên lý hoạt động & cách tính
- Tỷ lệ: `|ngực−hông| ≤ 5` coi là cân đối; `ngực−eo ≥ 9` và `hông−eo ≥ 9` → **đồng hồ cát**; `hông−ngực ≥ 9` → **quả lê**; `ngực−hông ≥ 9` → **tam giác ngược**; eo ≈ rộng nhất → **quả táo**; còn lại → **chữ nhật**. **Độ tin cậy** tính theo biên độ so với ngưỡng.
- **Kết luận trung thực về phần ảnh (quan trọng để bảo vệ):** ước lượng số đo từ ảnh đạt ~1.5cm trên **ảnh synthetic sạch**, nhưng **domain gap ~50cm** khi áp lên **ảnh người thật** → mô hình synthetic *chưa* chuyển giao. Hướng phân loại **dáng từ ảnh** đạt **64%** trên synthetic nhưng chỉ **~35%** trên ảnh web thật. ⇒ **Quyết định thiết kế: số đo nhập tay là đường chính**; các mô hình ảnh để ở mức **thực nghiệm / hướng phát triển** (cần dữ liệu ảnh người thật đã gán nhãn, ví dụ bộ **BodyM** phi thương mại). Đây là giới hạn đã **định lượng**, không giấu.

---

## UC4 — Trí tuệ thời trang

### UC4.1 — Phân tích sản phẩm

**Đã làm:** mỗi sản phẩm trong kho được **gán tập thuộc tính đa chiều chuẩn hóa** (loại, màu, chất liệu, phom, cổ, tay, độ dài, phong cách, dịp, họa tiết) **kèm độ tin cậy từng nhãn**, trạng thái **chờ xác nhận/đã xác nhận**, và **điểm hợp dáng** cho 5 dáng người. Tự chạy khi thêm/sửa sản phẩm, có nút **phân tích lại** và **phân tích hàng loạt**; Người bán/Admin **xác nhận hoặc chỉnh** nhãn.

**Làm thế nào & kế thừa:** kế thừa **lược đồ thuộc tính DeepFashion2** để thiết kế trường dữ liệu; kế thừa **MediaPipe** để **trích màu chủ đạo từ ảnh**. Phần còn lại tự phát triển.

**Tự phát triển — điểm cốt lõi:** **bộ chuẩn hóa bằng alias**. Dữ liệu sản phẩm thật trong kho là **tiếng Việt tự do** ("Xanh navy", "Office", "Kaki") không khớp danh mục chuẩn. Em xây **từ điển ánh xạ**: mỗi mã chuẩn (navy, classic, cotton…) gắn danh sách biến thể; khi phân tích, đối chiếu giá trị tự do → **mã chuẩn** + độ tin cậy. Nếu trường trống thì **suy từ tên/mô tả**.

**Nguyên lý & cách tính:**
- Chuẩn hóa: khớp **mã** (tin cậy 0.95) > **nhãn** (0.85) > **alias** (0.9) > **suy từ văn bản** (0.6). Nhãn dưới ngưỡng 0.7 bị gắn cờ "**độ tin cậy thấp — ưu tiên người xem lại**".
- Màu từ ảnh: lấy **màu trung vị vùng giữa ảnh** → tìm **màu chuẩn gần nhất** trong bảng RGB (ước lượng, chỉ bật khi có ảnh local).
- Điểm hợp dáng (ProductBodyFit): bắt đầu **0.5**, cộng/trừ **trọng số** mỗi luật khớp → kẹp [0.05, 0.98].

### UC4.2 — Quản lý tri thức thời trang

**Đã làm:** trang quản trị cho **Admin** quản lý **(a) danh mục thuộc tính chuẩn dùng chung** và **(b) tập luật** — gồm **luật hợp dáng** (dáng ↔ phom/cổ/tay/độ dài) và **luật phối đồ** (hòa sắc, tương thích phong cách). Có **thêm/sửa/xóa**, **nhật ký + phiên bản** để truy vết.

**Tự phát triển:** chuyển **cơ sở tri thức từ hard-code vào DB** để Admin sửa được; **kiểm tra nhất quán** (chặn luật **trùng** và **mâu thuẫn** hai chiều); **không xóa cứng** mục đang được tham chiếu → **vô hiệu hóa** thay thế (tránh tham chiếu mồ côi); mọi thay đổi ghi **KnowledgeAudit**.

**Nguyên lý:** tri thức là **nguồn dùng chung** — UC4.1 đọc để chuẩn hóa & chấm điểm, UC5 đọc để gợi ý & phối đồ. Sửa luật là gợi ý thay đổi theo ngay (có đánh dấu sản phẩm cần phân tích lại).

---

## UC5 — Gợi ý sản phẩm & tư vấn phong cách

### UC5.1 — Gợi ý sản phẩm

**Đã làm:** xếp hạng **từng sản phẩm** phù hợp cho khách, **kèm lý do "Vì sao hợp với bạn"**; xử lý **cold-start** (chưa có hồ sơ → gợi ý phổ biến + mời hoàn thiện); **tiêu chí tạm** (chọn dịp / khoảng giá không đổi hồ sơ); **sản phẩm liên quan** khi đang xem một sản phẩm; **ẩn "không quan tâm"** → loại khỏi gợi ý.

**Tự phát triển (không kế thừa mô hình ngoài):** **công cụ gợi ý lai có trọng số**.

**Nguyên lý & cách tính:**
```
Điểm = 0.40·HợpDáng + 0.25·PhongCách + 0.15·Màu + 0.10·SởThích + 0.10·HànhVi
```
- Thành phần **thiếu dữ liệu** bị loại khỏi tổng và **chuẩn hóa lại trọng số** → người mới vẫn xếp hạng được.
- Matching chạy trên **nhãn đã chuẩn hóa (UC4.1)** nên sở thích mã chuẩn của khách ("minimalist", "navy") khớp đúng sản phẩm dù dữ liệu gốc là tiếng Việt tự do — **đây là mắt xích nối UC4.1 → UC5**.
- Ngân sách là **lọc mềm** (không chặn quyền mua); khi quá ít kết quả thì **nới + ghi chú**, không trả rỗng (quy tắc 3E).

### UC5.2 — Gợi ý outfit (phối bộ)

**Đã làm:** ghép **bộ đồ hoàn chỉnh** từ kho — (Đầm) hoặc (Áo + Quần/Váy) + Khoác/Giày/Phụ kiện — **mỗi bộ kèm lý do phối và tổng giá**.

**Tự phát triển:** **engine phối đồ**: xếp sản phẩm vào **slot** theo loại trang phục đã chuẩn hóa; sinh tổ hợp; chấm điểm theo luật phối (UC4.2).

**Nguyên lý & cách tính:**
```
Điểm bộ = 0.40·HợpDáng + 0.25·HòaSắc + 0.20·ĐồngNhấtPhongCách + 0.15·HợpDịp
```
- **Hòa sắc** từ **luật phối màu** trong DB (vd navy+be +0.25; đỏ+xanh lá −0.3) + ưu tiên màu trung tính.
- **Giày/phụ kiện** chọn theo hòa sắc tốt nhất với phần lõi; khử trùng lặp rồi xếp hạng.

### UC5.3 — Tìm kiếm bằng ảnh *(kế hoạch)*
Hướng đã chốt: đối sánh **màu (dùng chung năng lực trích xuất với UC4.1) + thuộc tính** — trung thực với giới hạn thị giác đã nêu ở UC3 (không dựng nhận dạng sâu).

### Điểm nhấn trải nghiệm
Ngay **sau khi phân tích dáng**, màn hình **hiện luôn** khối "Gợi ý cho dáng của bạn": **bộ đồ phối sẵn** + **sản phẩm hợp dáng** — lấy từ kho thật theo dáng + luật phối + sở thích. Đúng tinh thần "phân tích xong là thấy gợi ý ngay".

---

## Kết luận (nói ~30 giây)

"Tóm lại: em **kế thừa MediaPipe và các thư viện học máy** cho phần khó về thị giác/ML, **tự phát triển toàn bộ nghiệp vụ thời trang** — phân loại dáng, chuẩn hóa thuộc tính bằng alias, cơ sở tri thức + luật phối do Admin quản lý, công cụ gợi ý lai và engine phối bộ. Mọi thứ **bám vào kho hàng thật**, **có lý do minh bạch**, và **tôn trọng quyết định của người dùng**. Em cũng **định lượng trung thực giới hạn** của phần ước lượng từ ảnh và nêu rõ hướng phát triển là thu thập dữ liệu ảnh người thật."

---

### Phụ lục — bản đồ mã nguồn (để demo khi hỏi)
| Phần | Vị trí |
|------|--------|
| Phân loại dáng (luật) | `backend/src/constants/body-analysis.ts`, `ai-service/app/body_shape.py` |
| Phân tích cơ thể / Body Profile | `backend/src/services/body-analysis.service.ts`, `body-profile.service.ts` |
| Thị giác (pose/màu/đo) | `ai-service/app/pose.py`, `color.py`, `measure.py`, `research/` |
| UC4.1 phân tích SP | `backend/src/services/product-analysis.service.ts` |
| UC4.2 tri thức + luật | `backend/src/controllers/fashion-knowledge.controller.ts`, `src/constants/fashion-kb.ts` |
| UC5.1 gợi ý SP | `backend/src/services/recommendation.service.ts` |
| UC5.2 phối bộ | `backend/src/services/outfit.service.ts` |
| Tri thức seed | `backend/prisma/seed-knowledge.ts` |

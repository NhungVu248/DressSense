"""
Trích ĐẶC TRƯNG TỶ LỆ 2D cho phân loại dáng người — DÙNG CHUNG cho:
  - train trên ảnh CALVIS (silhouette từ ngưỡng nền trắng),
  - train trên ẢNH THẬT (silhouette từ MediaPipe segmentation),
  - endpoint /shape-from-image sau này.

Đầu vào: silhouette nhị phân `fg` (HxW bool) + landmarks MediaPipe (chuẩn hóa 0..1).
Đầu ra: dict đặc trưng theo FEATURE_COLS (bất biến thang đo -> ít rớt khi đổi domain).

Nguyên tắc chống "tay": đo bề rộng tại các mức ĐỀU DƯỚI đường vai, và lấy ĐOẠN LIỀN MẠCH
chứa trục thân (loại khối tay rời ở ảnh dang tay; với ảnh buông tay vẫn nên chụp hở nách).

Ghi chú (nghiên cứu): đã thử biến thể "loại cánh tay" bằng mặt nạ xương + đo vai/hông bằng
landmark (xem research/README.md) nhưng KHÔNG cải thiện accuracy trên ảnh thật -> giữ v1.
"""
import numpy as np

L_SH, R_SH, L_HIP, R_HIP = 11, 12, 23, 24

FEATURE_COLS = ["w_bust", "w_waist", "w_hip", "w_shoulder",
                "r_bust_waist", "r_hip_waist", "r_bust_hip", "r_shoulder_hip", "r_waist_hip"]


def _run_width(fg_row, cx):
    """Bề rộng = đoạn liền mạch chứa trục thân cx (bỏ khối rời như bàn tay)."""
    n = len(fg_row)
    if cx < 0 or cx >= n or not fg_row[cx]:
        on = np.where(fg_row)[0]
        if len(on) == 0:
            return 0
        cx = int(on[np.argmin(np.abs(on - cx))])
    left = cx
    while left > 0 and fg_row[left - 1]:
        left -= 1
    right = cx
    while right < n - 1 and fg_row[right + 1]:
        right += 1
    return right - left + 1


def ratio_features(fg, lm):
    """fg: HxW bool silhouette; lm: landmarks MediaPipe (lm[i].x/.y chuẩn hóa). None nếu đo hỏng."""
    H, W = fg.shape
    sh_y = (lm[L_SH].y + lm[R_SH].y) / 2 * H
    hp_y = (lm[L_HIP].y + lm[R_HIP].y) / 2 * H
    cx = int(round((lm[L_HIP].x + lm[R_HIP].x) / 2 * W))
    torso = hp_y - sh_y
    if torso < 10:
        return None
    bust_y = min(max(int(sh_y + 0.30 * torso), 0), H - 1)
    hip_level = min(max(int(hp_y + 0.15 * torso), 0), H - 1)

    w_bust = _run_width(fg[bust_y], cx)
    w_hip = _run_width(fg[hip_level], cx)
    lo, hi = int(sh_y + 0.45 * torso), int(hp_y)
    widths = [w for w in (_run_width(fg[y], cx) for y in range(max(lo, 0), min(hi, H))) if w > 0]
    if not widths:
        return None
    w_waist = min(widths)
    w_shoulder = abs(lm[L_SH].x - lm[R_SH].x) * W
    if min(w_bust, w_waist, w_hip) <= 0:
        return None
    return {
        "w_bust": w_bust, "w_waist": w_waist, "w_hip": w_hip, "w_shoulder": round(w_shoulder, 1),
        "r_bust_waist": round(w_bust / w_waist, 3), "r_hip_waist": round(w_hip / w_waist, 3),
        "r_bust_hip": round(w_bust / w_hip, 3),
        "r_shoulder_hip": round(w_shoulder / w_hip, 3) if w_hip else 0.0,
        "r_waist_hip": round(w_waist / w_hip, 3),
    }

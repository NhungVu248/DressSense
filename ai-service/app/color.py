"""
UC4.1 (màu từ ảnh) - trích MÀU CHỦ ĐẠO của ảnh sản phẩm và ánh xạ về bảng màu chuẩn.

Phương pháp đơn giản & trung thực (không CNN): lấy vùng GIỮA ảnh (nơi thường là trang phục,
tránh nền), tính màu trung vị, rồi tìm màu chuẩn GẦN NHẤT trong bảng tham chiếu RGB.
Kết quả là ƯỚC LƯỢNG -> trả kèm độ tin cậy theo khoảng cách màu.
"""
import numpy as np

# Bảng màu chuẩn (đồng bộ COLOR_OPTIONS backend) -> RGB tham chiếu xấp xỉ
PALETTE = {
    'black': (30, 30, 30), 'white': (240, 240, 240), 'beige': (225, 210, 180),
    'gray': (128, 128, 128), 'navy': (30, 40, 80), 'blue': (40, 90, 200),
    'green': (40, 140, 70), 'brown': (120, 80, 50), 'red': (200, 40, 50),
    'pink': (240, 170, 190), 'yellow': (230, 210, 70), 'purple': (120, 70, 160),
    'orange': (230, 140, 50),
}
_NAMES = list(PALETTE.keys())
_REF = np.array([PALETTE[n] for n in _NAMES], dtype=np.float32)


def dominant_color(rgb: np.ndarray):
    """rgb: ảnh HxWx3 (RGB, uint8). Trả {code, confidence, rgb} hoặc None."""
    if rgb is None or rgb.ndim != 3 or rgb.shape[2] < 3:
        return None
    h, w = rgb.shape[:2]
    # vùng giữa 60% (giảm ảnh hưởng của nền ở viền)
    y0, y1 = int(h * 0.2), int(h * 0.8)
    x0, x1 = int(w * 0.2), int(w * 0.8)
    crop = rgb[y0:y1, x0:x1, :3].reshape(-1, 3).astype(np.float32)
    if len(crop) < 10:
        crop = rgb[:, :, :3].reshape(-1, 3).astype(np.float32)
    med = np.median(crop, axis=0)  # màu trung vị (bền với nhiễu hơn trung bình)
    dists = np.linalg.norm(_REF - med, axis=1)
    i = int(np.argmin(dists))
    # độ tin cậy: gần (<60) -> cao; xa (>160) -> thấp
    conf = float(max(0.3, min(0.85, 1.0 - dists[i] / 200.0)))
    return {'code': _NAMES[i], 'confidence': round(conf, 2), 'rgb': [int(v) for v in med]}

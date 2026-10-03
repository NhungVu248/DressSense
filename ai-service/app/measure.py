"""
Ước lượng số đo từ ẢNH bằng model CALVIS (hồi quy silhouette) — dùng chung cho
endpoint /estimate-measurements và script đo domain gap.

Pipeline: MediaPipe (pose + segmentation mask) -> silhouette người thật -> đưa về
KHUNG CHUẨN giống ảnh CALVIS (thân cao ~138px, đỉnh ~35, tâm x~99 trong canvas 200x200)
-> trích ĐẶC TRƯNG GIỐNG train_calvis -> model -> (bust, waist, hip).

Lưu ý: model huấn luyện trên ảnh SYNTHETIC CALVIS; áp lên ảnh thật là ước lượng THỰC NGHIỆM,
kết quả có thể lệch (domain gap) -> luôn cho người dùng chỉnh tay.
"""
import os
import threading

import numpy as np

# Khung chuẩn CALVIS (đo từ dataset, canvas 200x200)
CANVAS = 200
BODY_H = 138
BODY_TOP = 35
BODY_CX = 99
K = 16  # số mức đo bề rộng (phải khớp train_calvis)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "calvis_regressor.joblib")
POSE_MODEL = os.path.join(os.path.dirname(__file__), "..", "models", "pose_landmarker_lite.task")

_lock = threading.Lock()
_seg = None
_bundle = None
_loaded = False


def model_available() -> bool:
    return os.path.exists(MODEL_PATH)


def _get_model():
    global _bundle, _loaded
    if not _loaded:
        with _lock:
            if not _loaded:
                _loaded = True
                if os.path.exists(MODEL_PATH):
                    import joblib
                    _bundle = joblib.load(MODEL_PATH)
    return _bundle


def _get_seg():
    global _seg
    if _seg is None:
        with _lock:
            if _seg is None:
                import mediapipe as mp
                from mediapipe.tasks import python as mp_python
                from mediapipe.tasks.python import vision
                _seg = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
                    base_options=mp_python.BaseOptions(model_asset_path=POSE_MODEL),
                    num_poses=1, output_segmentation_masks=True))
    return _seg


def _features_from_binary(fg: np.ndarray):
    """Trích đặc trưng silhouette GIỐNG train_calvis: bề rộng tại K mức + area + bbox."""
    rows = np.where(fg.any(axis=1))[0]
    cols = np.where(fg.any(axis=0))[0]
    if len(rows) < 5 or len(cols) < 2:
        return None
    y0, y1 = rows.min(), rows.max()
    feats = []
    for f in np.linspace(0.05, 0.95, K):
        y = int(y0 + f * (y1 - y0))
        xs = np.where(fg[y])[0]
        feats.append(float(xs.max() - xs.min() + 1) if len(xs) else 0.0)
    feats += [float(fg.sum()), float(y1 - y0 + 1), float(cols.max() - cols.min() + 1)]
    return feats


def _real_to_canonical(image_bgr: np.ndarray):
    """Ảnh người thật -> mask người (MediaPipe seg) -> đặt vào khung chuẩn CALVIS 200x200."""
    import cv2
    import mediapipe as mp
    rgb = np.ascontiguousarray(image_bgr[:, :, ::-1])
    res = _get_seg().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.pose_landmarks or not res.segmentation_masks:
        return None
    mask = np.squeeze(np.array(res.segmentation_masks[0].numpy_view(), copy=True)) > 0.5
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) < 5 or len(cols) < 2:
        return None
    crop = mask[rows.min():rows.max() + 1, cols.min():cols.max() + 1].astype(np.uint8) * 255
    # scale theo CHIỀU CAO về khung chuẩn, giữ tỉ lệ
    h, w = crop.shape
    scale = BODY_H / h
    new_w = max(1, int(round(w * scale)))
    resized = cv2.resize(crop, (new_w, BODY_H), interpolation=cv2.INTER_NEAREST)
    canvas = np.zeros((CANVAS, CANVAS), np.uint8)
    x0 = int(BODY_CX - new_w / 2)
    x0 = max(0, min(x0, CANVAS - new_w)) if new_w <= CANVAS else 0
    xs0 = max(0, x0)
    rw = min(new_w, CANVAS - xs0)
    canvas[BODY_TOP:BODY_TOP + BODY_H, xs0:xs0 + rw] = resized[:, :rw]
    return canvas > 127


def estimate_from_image(image_bgr: np.ndarray):
    """Trả {'bust','waist','hip'} (cm) hoặc None. Dùng khung chuẩn CALVIS + model hồi quy."""
    bundle = _get_model()
    if bundle is None:
        return None
    fg = _real_to_canonical(image_bgr)
    if fg is None:
        return None
    feats = _features_from_binary(fg)
    if feats is None:
        return None
    pred = bundle["model"].predict([feats])[0]
    return {t.replace("_cm", ""): round(float(v), 1) for t, v in zip(bundle["targets"], pred)}

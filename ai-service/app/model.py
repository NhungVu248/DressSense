"""
Giai đoạn 3 - Nạp mô hình ML phân loại dáng người (đã huấn luyện bằng
scripts/train_body_shape.py) và dự đoán. Nếu chưa có file model thì trả None để
service tự fallback về luật rule-based (baseline).

Model là bundle joblib: {pipeline, labels, features, model_name}. File nằm ở models/
(đã .gitignore) - cần chạy train_body_shape.py để sinh ra.
"""
import os
import threading

from .body_shape import compute_ratios

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "body_shape_model.joblib")

_lock = threading.Lock()
_bundle = None
_loaded = False


def _load():
    global _bundle, _loaded
    if not _loaded:
        with _lock:
            if not _loaded:
                _loaded = True
                if os.path.exists(MODEL_PATH):
                    import joblib
                    _bundle = joblib.load(MODEL_PATH)
    return _bundle


def available() -> bool:
    return _load() is not None


def predict_shape(bust: float, waist: float, hip: float):
    """Trả dict {bodyShape, confidence, model} hoặc None nếu chưa có model."""
    bundle = _load()
    if bundle is None:
        return None
    r = compute_ratios(bust, waist, hip)
    feats = [[r[f] for f in bundle["features"]]]
    pipe = bundle["pipeline"]
    idx = int(pipe.predict(feats)[0])
    shape = bundle["labels"][idx]
    confidence = None
    if hasattr(pipe, "predict_proba"):
        proba = pipe.predict_proba(feats)[0]
        confidence = round(float(max(proba)), 3)
    return {"bodyShape": shape, "confidence": confidence, "model": bundle["model_name"]}

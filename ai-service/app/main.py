"""
DressSense AI Service — FastAPI (Giai đoạn 2, mốc M1).

Endpoints:
  GET  /health       - kiểm tra sống
  POST /pose         - ảnh toàn thân -> 33 landmarks + confidence (MediaPipe)
  POST /body-shape   - số đo hoặc landmarks -> dáng người + confidence + đặc trưng

Service chỉ TÍNH TOÁN và trả JSON; backend Express chịu trách nhiệm lưu Body Profile,
ghi hành vi và áp quyền riêng tư.
"""
import io

import numpy as np
from fastapi import FastAPI, File, UploadFile
from PIL import Image

from . import model as ml_model
from .body_shape import CONFIDENCE_THRESHOLD, classify_body_shape, compute_ratios
from .schemas import BodyShapeRequest

app = FastAPI(title="DressSense AI Service", version="0.1.0")

L_SHOULDER, R_SHOULDER = 11, 12
L_HIP, R_HIP = 23, 24


@app.get("/health")
def health():
    return {"status": "ok", "service": "DressSense AI Service", "version": app.version}


@app.post("/pose")
async def pose(image: UploadFile = File(...)):
    """UC3.2 bước 2 — phát hiện người + 33 landmarks. Trả status OK / NO_PERSON /
    INSUFFICIENT_KEYPOINTS để backend ánh xạ ngoại lệ 6E của UC3.1."""
    raw = await image.read()
    try:
        pil = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        return {"status": "INVALID_IMAGE", "message": "Không đọc được ảnh"}
    bgr = np.array(pil)[:, :, ::-1]  # RGB -> BGR cho detect_pose

    from .pose import detect_pose  # import trễ: chỉ nạp MediaPipe khi thực sự cần

    return detect_pose(bgr)


@app.post("/body-shape")
def body_shape(req: BodyShapeRequest):
    """UC3.2 bước 4-6 — phân loại dáng người + độ tin cậy.
    Ưu tiên số đo (đường chắc chắn); nếu chỉ có landmarks thì trả ước lượng hạn chế."""
    m = req.measurements
    if m is not None:
        ratios = compute_ratios(m.bust, m.waist, m.hip, m.shoulder)
        # GĐ3 - dùng mô hình ML nếu được yêu cầu và đã có model; nếu không, fallback luật
        if req.method == "ml" and ml_model.available():
            r = ml_model.predict_shape(m.bust, m.waist, m.hip)
            conf = r["confidence"] if r["confidence"] is not None else 1.0
            return {
                "status": "LOW_CONFIDENCE" if conf < CONFIDENCE_THRESHOLD else "OK",
                "bodyShape": r["bodyShape"],
                "confidence": r["confidence"],
                "isPreliminary": conf < CONFIDENCE_THRESHOLD,
                "ratios": ratios,
                "method": "ml",
                "model": r["model"],
                "note": "Phân loại bằng mô hình ML (GĐ3).",
                "measurementSource": "MANUAL",
            }
        # Baseline rule-based (mặc định, hoặc fallback khi chưa có model)
        shape, conf, note = classify_body_shape(m.bust, m.waist, m.hip)
        return {
            "status": "LOW_CONFIDENCE" if conf < CONFIDENCE_THRESHOLD else "OK",
            "bodyShape": shape,
            "confidence": conf,
            "isPreliminary": conf < CONFIDENCE_THRESHOLD,
            "ratios": ratios,
            "method": "rule",
            "note": note if req.method != "ml" else note + " (chưa có model ML, dùng luật).",
            "measurementSource": "MANUAL",
        }

    if req.landmarks:
        # Chỉ có landmarks: suy được bề rộng vai/hông 2D, KHÔNG có vòng eo -> không đủ
        # để phân loại chắc chắn. Trả trạng thái yêu cầu số đo (nhất quán fallback 6E/manual).
        lm = req.landmarks
        try:
            def d(a, b):
                return ((lm[a]["x"] - lm[b]["x"]) ** 2 + (lm[a]["y"] - lm[b]["y"]) ** 2) ** 0.5
            sh = d(L_SHOULDER, R_SHOULDER)
            hp = d(L_HIP, R_HIP)
        except (IndexError, KeyError, TypeError):
            return {"status": "INSUFFICIENT_KEYPOINTS", "message": "Landmarks không hợp lệ"}
        return {
            "status": "NEEDS_MEASUREMENTS",
            "bodyShape": None,
            "shoulderHipRatio2d": round(sh / hp, 4) if hp > 0 else None,
            "note": "Chỉ có landmarks 2D (thiếu vòng eo). Cần nhập số đo để phân loại chắc chắn "
                    "(ước lượng chu vi từ ảnh là bài toán Giai đoạn 3).",
        }

    return {"status": "BAD_REQUEST", "message": "Cần cung cấp 'measurements' hoặc 'landmarks'"}

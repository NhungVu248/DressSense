"""
Giai đoạn 2 — Pose Estimation (kế thừa MediaPipe Pose Landmarker).
Từ ảnh toàn thân -> 33 landmarks + confidence. KHÔNG tự huấn luyện nhận diện cơ thể.

Phần nhóm tự phát triển: tiền xử lý, chọn đối tượng trung tâm khi ảnh nhiều người (2a
của UC3.2), suy ra bề rộng vai/hông trên ảnh 2D.

Lưu ý trung thực: MediaPipe cho landmark 2D (+ z tương đối), KHÔNG cho chu vi cơ thể.
Bề rộng vai/hông ở đây là khoảng cách chuẩn hóa trên ảnh, KHÔNG phải vòng ngực/eo/hông.
Ước lượng số đo/chu vi thực là bài toán của Giai đoạn 3.
"""
import math
import os
import threading
import urllib.request

import numpy as np

# Model MediaPipe Pose Landmarker (lite) - tải lúc chạy vào models/ (đã .gitignore)
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "pose_landmarker_lite.task")

# Chỉ số landmark MediaPipe Pose (BlazePose 33 điểm)
L_SHOULDER, R_SHOULDER = 11, 12
L_HIP, R_HIP = 23, 24

_lock = threading.Lock()
_landmarker = None


def _ensure_model():
    if not os.path.exists(MODEL_PATH):
        os.makedirs(MODEL_DIR, exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def _get_landmarker():
    global _landmarker
    if _landmarker is None:
        with _lock:
            if _landmarker is None:
                _ensure_model()
                import mediapipe as mp
                from mediapipe.tasks import python as mp_python
                from mediapipe.tasks.python import vision

                opts = vision.PoseLandmarkerOptions(
                    base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
                    num_poses=3,  # phát hiện tối đa 3 người để xử lý ảnh nhiều người (2a)
                    min_pose_detection_confidence=0.5,
                )
                _landmarker = vision.PoseLandmarker.create_from_options(opts)
    return _landmarker


def detect_pose(image_bgr: np.ndarray) -> dict:
    """image_bgr: mảng HxWx3 (BGR từ cv2). Trả dict landmarks + confidence + trạng thái."""
    import mediapipe as mp

    landmarker = _get_landmarker()
    rgb = np.ascontiguousarray(image_bgr[:, :, ::-1])  # BGR -> RGB
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = landmarker.detect(mp_image)
    poses = result.pose_landmarks or []

    if not poses:
        # 2E của UC3.2 - không phát hiện được người
        return {"status": "NO_PERSON", "num_poses": 0, "confidence": 0.0, "landmarks": []}

    # 2a - chọn đối tượng gần trung tâm ảnh nhất
    def center_dist(pl):
        cx = sum(p.x for p in pl) / len(pl)
        cy = sum(p.y for p in pl) / len(pl)
        return (cx - 0.5) ** 2 + (cy - 0.5) ** 2

    best = min(poses, key=center_dist)
    landmarks = [
        {"x": round(p.x, 4), "y": round(p.y, 4), "z": round(p.z, 4), "visibility": round(p.visibility, 4)}
        for p in best
    ]
    confidence = round(sum(p.visibility for p in best) / len(best), 4)

    def dist(a: int, b: int) -> float:
        return math.hypot(best[a].x - best[b].x, best[a].y - best[b].y)

    shoulder_w = round(dist(L_SHOULDER, R_SHOULDER), 4)
    hip_w = round(dist(L_HIP, R_HIP), 4)

    # 3E của UC3.2 - thiếu điểm mốc thân dưới (vai/hông không đủ tin cậy)
    key_vis = min(best[i].visibility for i in (L_SHOULDER, R_SHOULDER, L_HIP, R_HIP))
    if key_vis < 0.5:
        return {
            "status": "INSUFFICIENT_KEYPOINTS",
            "num_poses": len(poses),
            "confidence": confidence,
            "landmarks": landmarks,
        }

    return {
        "status": "OK",
        "num_poses": len(poses),
        "confidence": confidence,
        "landmarks": landmarks,
        # Bề rộng CHUẨN HÓA trên ảnh 2D (KHÔNG phải chu vi cơ thể)
        "breadths_2d": {
            "shoulder_norm": shoulder_w,
            "hip_norm": hip_w,
            "shoulder_hip_ratio": round(shoulder_w / hip_w, 4) if hip_w > 0 else None,
        },
        "note": "breadths_2d là bề rộng vai/hông chuẩn hóa trên ảnh, không phải vòng đo cơ thể.",
    }

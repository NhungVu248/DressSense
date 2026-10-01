#!/usr/bin/env python3
"""
NGHIÊN CỨU (POC) - Ước lượng SỐ ĐO VÒNG (ngực/eo/hông) từ ẢNH.

Ý tưởng: MediaPipe Pose (kèm segmentation mask) trên ẢNH TRƯỚC và ẢNH NGHIÊNG
-> đo bề RỘNG (ảnh trước) và bề SÂU (ảnh nghiêng) của thân tại mức ngực/eo/hông
-> quy pixel sang cm bằng CHIỀU CAO đã biết (tỉ lệ cm/pixel)
-> chu vi ≈ chu vi hình ELIP với bán trục = rộng/2 và sâu/2 (xấp xỉ Ramanujan).

Đây là baseline HÌNH HỌC (chưa huấn luyện). Mục tiêu: dựng pipeline + ĐO SAI SỐ trên dữ
liệu thật (bộ ảnh+số đo), làm mốc cho bước huấn luyện hồi quy khi có đủ dữ liệu.

Chạy:  python estimate_measurements.py --dataset "C:/Users/admin/Downloads/datasetdaln"
Yêu cầu: mediapipe, opencv-python, numpy; model pose_landmarker ở ../models (tự tải ở app.pose).
"""
import argparse
import csv
import math
import os

import cv2
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "pose_landmarker_lite.task")
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task")

L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 11, 12, 23, 24


def ensure_model():
    if not os.path.exists(MODEL_PATH):
        import urllib.request
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def make_landmarker():
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision
    ensure_model()
    opts = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        num_poses=1,
        output_segmentation_masks=True,
    )
    return vision.PoseLandmarker.create_from_options(opts)


def run(landmarker, image_path):
    import mediapipe as mp
    bgr = cv2.imread(image_path)
    if bgr is None:
        return None
    rgb = np.ascontiguousarray(bgr[:, :, ::-1])
    res = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.pose_landmarks:
        return None
    lm = res.pose_landmarks[0]
    # QUAN TRỌNG: numpy_view() là view vào bộ nhớ C++ bị giải phóng ở lần detect sau
    # -> phải copy ngay (nếu không sẽ segfault khi dùng lại). Squeeze bỏ chiều thừa (H,W,1).
    mask = None
    if res.segmentation_masks:
        mask = np.array(res.segmentation_masks[0].numpy_view(), copy=True)
        mask = np.squeeze(mask)
    H, W = rgb.shape[:2]
    return {"lm": lm, "mask": mask, "H": H, "W": W}


def body_px_height(mask):
    """Chiều cao người theo pixel = khoảng dọc có foreground trong mask."""
    rows = np.where(mask.max(axis=1) > 0.5)[0]
    return (rows.max() - rows.min() + 1) if len(rows) else None


def width_at(mask, y_norm):
    """Bề rộng (px) của thân tại hàng y_norm (0..1): span trái-phải của foreground."""
    H = mask.shape[0]
    y = int(min(max(y_norm, 0), 0.999) * H)
    cols = np.where(mask[y] > 0.5)[0]
    return (cols.max() - cols.min() + 1) if len(cols) else 0


def level_ys(lm):
    sh = (lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2
    hp = (lm[L_HIP].y + lm[R_HIP].y) / 2
    torso = hp - sh
    return {
        "bust": sh + 0.15 * torso,   # ngực: dưới vai một chút
        "waist": sh + 0.72 * torso,  # eo: gần điểm hẹp phía trên hông
        "hip": hp + 0.05 * torso,    # hông: hơi dưới mốc hông
    }


def ellipse_perimeter(a, b):
    """Xấp xỉ Ramanujan cho chu vi elip bán trục a,b."""
    return math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b)))


def estimate(front, side, height_cm):
    # tỉ lệ cm/px theo chiều cao (ảnh trước)
    ph = body_px_height(front["mask"])
    if not ph:
        return None
    cm_per_px_f = height_cm / ph
    ys = level_ys(front["lm"])
    out = {}
    # bề sâu lấy từ ảnh nghiêng (nếu có), quy theo chiều cao ảnh nghiêng
    side_scale = None
    if side is not None:
        ph_s = body_px_height(side["mask"])
        if ph_s:
            side_scale = height_cm / ph_s
            ys_s = level_ys(side["lm"])
    for key, yn in ys.items():
        width_cm = width_at(front["mask"], yn) * cm_per_px_f
        if side is not None and side_scale:
            depth_cm = width_at(side["mask"], ys_s[key]) * side_scale
        else:
            depth_cm = width_cm * 0.7  # fallback nếu thiếu ảnh nghiêng
        circ = ellipse_perimeter(width_cm / 2, depth_cm / 2)
        out[key] = round(circ, 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, help="thư mục chứa các set 1..N + CSV số đo")
    ap.add_argument("--csv", default="Body Measurements Image Dataset.csv")
    args = ap.parse_args()

    def num(v):
        try:
            return float(str(v).replace("_tbr", ""))
        except ValueError:
            return None

    truth = {}
    with open(os.path.join(args.dataset, args.csv), encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            truth[str(r["set_id"])] = r

    lmk = make_landmarker()
    print(f"{'set':4} {'đo':6} {'ước lượng':>10} {'thật':>7} {'|sai số|':>9}")
    errs = {"bust": [], "waist": [], "hip": []}
    for sid in sorted(truth, key=lambda x: int(x) if x.isdigit() else 0):
        d = os.path.join(args.dataset, sid)
        fp, sp = os.path.join(d, "front_img.jpg"), os.path.join(d, "side_img.jpg")
        if not os.path.exists(fp):
            continue
        front = run(lmk, fp)
        side = run(lmk, sp) if os.path.exists(sp) else None
        if not front:
            print(f"{sid:4} (không phát hiện được người ở ảnh trước)")
            continue
        est = estimate(front, side, num(truth[sid]["height"]))
        if not est:
            continue
        gt = {"bust": num(truth[sid]["chest_circumference_cm"]),
              "waist": num(truth[sid]["waist_circumference_cm"]),
              "hip": num(truth[sid]["hips_circumference_cm"])}
        for k in ("bust", "waist", "hip"):
            e = abs(est[k] - gt[k])
            errs[k].append(e)
            print(f"{sid:4} {k:6} {est[k]:10.1f} {gt[k]:7.1f} {e:9.1f}")
    print("\n=== MAE (sai số tuyệt đối trung bình, cm) ===")
    for k in ("bust", "waist", "hip"):
        if errs[k]:
            print(f"  {k:6}: {sum(errs[k]) / len(errs[k]):.1f} cm  (n={len(errs[k])})")


if __name__ == "__main__":
    main()

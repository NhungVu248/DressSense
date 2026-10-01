#!/usr/bin/env python3
"""
NGHIÊN CỨU (POC) - Ước lượng SỐ ĐO VÒNG (ngực/eo/hông) từ ẢNH.

Pipeline: MediaPipe Pose (+segmentation mask) trên ẢNH TRƯỚC & ẢNH NGHIÊNG
-> bề RỘNG (ảnh trước) + bề SÂU (ảnh nghiêng) của THÂN tại mức ngực/eo/hông
-> quy cm bằng CHIỀU CAO đã biết -> chu vi ≈ chu vi ELIP (Ramanujan).

Cải tiến (a) LOẠI CÁNH TAY: thay vì span foreground cả hàng (gộp tay hai bên), lấy
run liền mạch chứa TRỤC GIỮA thân rồi CHẶN theo bề rộng suy từ mốc vai/hông (landmark)
-> cắt phần tay buông.

--dump-features: xuất bảng đặc trưng hình học + target (chu vi thật) phục vụ huấn luyện
hồi quy (xem train_measurement_regressor.py).

Chạy:  python estimate_measurements.py --dataset "C:/path/to/dataset"
       python estimate_measurements.py --dataset ... --dump-features features.csv
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
# Hệ số chặn theo từng mức: mốc khớp vai/hông nằm trong thân nên bề rộng thực rộng hơn.
# Hông rộng hơn khoảng cách khớp hông nhiều nhất (khớp hông nằm sâu/giữa).
CAP_K = {"bust": 1.3, "waist": 1.45, "hip": 1.95}


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
    return vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        num_poses=1, output_segmentation_masks=True))


def run(landmarker, image_path):
    import mediapipe as mp
    bgr = cv2.imread(image_path)
    if bgr is None:
        return None
    rgb = np.ascontiguousarray(bgr[:, :, ::-1])
    res = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.pose_landmarks:
        return None
    mask = None
    if res.segmentation_masks:  # copy ngay (numpy_view là view C++ -> segfault nếu dùng lại)
        mask = np.squeeze(np.array(res.segmentation_masks[0].numpy_view(), copy=True))
    H, W = rgb.shape[:2]
    return {"lm": res.pose_landmarks[0], "mask": mask, "H": H, "W": W}


def body_px_height(mask):
    rows = np.where(mask.max(axis=1) > 0.5)[0]
    return (rows.max() - rows.min() + 1) if len(rows) else None


def level_ys(lm):
    sh = (lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2
    hp = (lm[L_HIP].y + lm[R_HIP].y) / 2
    t = hp - sh
    return {"bust": sh + 0.15 * t, "waist": sh + 0.72 * t, "hip": hp + 0.05 * t}


def _central_run(row, mid_x):
    """Độ dài run foreground liền mạch chứa cột mid_x (loại blob tay tách rời)."""
    fg = row > 0.5
    if mid_x < 0 or mid_x >= len(fg) or not fg[mid_x]:
        idx = np.where(fg)[0]
        if not len(idx):
            return 0, 0, 0
        mid_x = idx[np.argmin(np.abs(idx - mid_x))]
    l = mid_x
    while l > 0 and fg[l - 1]:
        l -= 1
    r = mid_x
    while r < len(fg) - 1 and fg[r + 1]:
        r += 1
    return l, r, r - l + 1


def torso_width_px(info, y_norm, cap_half_px):
    """Bề rộng thân (px) tại y_norm: run giữa, chặn ±cap_half quanh trục giữa (cắt tay)."""
    mask, lm, H, W = info["mask"], info["lm"], info["H"], info["W"]
    y = int(min(max(y_norm, 0), 0.999) * H)
    mid_x = int((lm[L_HIP].x + lm[R_HIP].x) / 2 * W)
    l, r, _ = _central_run(mask[y], mid_x)
    if r <= l:
        return 0
    l = max(l, mid_x - int(cap_half_px))   # chặn tay trái/phải theo bề rộng mốc
    r = min(r, mid_x + int(cap_half_px))
    return max(0, r - l + 1)


def landmark_torso_half_px(info, level):
    lm, W = info["lm"], info["W"]
    sh = abs(lm[L_SHOULDER].x - lm[R_SHOULDER].x) * W
    hp = abs(lm[L_HIP].x - lm[R_HIP].x) * W
    base = {"bust": sh, "waist": (sh + hp) / 2, "hip": hp}[level]
    return base / 2 * CAP_K[level]


def ellipse_perimeter(a, b):
    return math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b)))


def extract(front, side, height_cm):
    """Trả dict đặc trưng cm theo từng mức + ước lượng chu vi."""
    ph = body_px_height(front["mask"])
    if not ph:
        return None
    cmpp_f = height_cm / ph
    ys = level_ys(front["lm"])
    feats, circ = {}, {}
    side_ok = side is not None and body_px_height(side["mask"])
    if side_ok:
        cmpp_s = height_cm / body_px_height(side["mask"])
        ys_s = level_ys(side["lm"])
    for k, yn in ys.items():
        w = torso_width_px(front, yn, landmark_torso_half_px(front, k)) * cmpp_f
        if side_ok:
            d = torso_width_px(side, ys_s[k], landmark_torso_half_px(side, k)) * cmpp_s
        else:
            d = w * 0.7
        feats[f"{k}_width_cm"] = round(w, 1)
        feats[f"{k}_depth_cm"] = round(d, 1)
        circ[k] = round(ellipse_perimeter(w / 2, d / 2), 1)
    return {"feats": feats, "circ": circ}


def load_truth(dataset, csvname):
    def num(v):
        try:
            return float(str(v).replace("_tbr", ""))
        except (ValueError, TypeError):
            return None
    truth = {}
    with open(os.path.join(dataset, csvname), encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            truth[str(r["set_id"])] = {
                "height": num(r["height"]), "weight": num(r["weight"]),
                "bust": num(r["chest_circumference_cm"]), "waist": num(r["waist_circumference_cm"]),
                "hip": num(r["hips_circumference_cm"]),
            }
    return truth


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--csv", default="Body Measurements Image Dataset.csv")
    ap.add_argument("--dump-features", help="xuất CSV đặc trưng+target để huấn luyện hồi quy")
    args = ap.parse_args()

    truth = load_truth(args.dataset, args.csv)
    lmk = make_landmarker()
    rows_out = []
    errs = {"bust": [], "waist": [], "hip": []}
    print(f"{'set':4} {'đo':6} {'ước lượng':>10} {'thật':>7} {'|sai số|':>9}")
    for sid in sorted(truth, key=lambda x: int(x) if x.isdigit() else 0):
        d = os.path.join(args.dataset, sid)
        fp, sp = os.path.join(d, "front_img.jpg"), os.path.join(d, "side_img.jpg")
        if not os.path.exists(fp) or truth[sid]["height"] is None:
            continue
        front = run(lmk, fp)
        side = run(lmk, sp) if os.path.exists(sp) else None
        if not front:
            continue
        ex = extract(front, side, truth[sid]["height"])
        if not ex:
            continue
        for k in ("bust", "waist", "hip"):
            e = abs(ex["circ"][k] - truth[sid][k])
            errs[k].append(e)
            print(f"{sid:4} {k:6} {ex['circ'][k]:10.1f} {truth[sid][k]:7.1f} {e:9.1f}")
        rows_out.append({"set_id": sid, "height_cm": truth[sid]["height"], "weight_kg": truth[sid]["weight"],
                         **ex["feats"], "bust": truth[sid]["bust"], "waist": truth[sid]["waist"], "hip": truth[sid]["hip"]})

    print("\n=== MAE (cm) - sau cải tiến loại cánh tay ===")
    for k in ("bust", "waist", "hip"):
        if errs[k]:
            print(f"  {k:6}: {sum(errs[k]) / len(errs[k]):.1f} cm  (n={len(errs[k])})")

    if args.dump_features and rows_out:
        cols = list(rows_out[0].keys())
        with open(args.dump_features, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(rows_out)
        print(f"\nĐã xuất đặc trưng -> {os.path.abspath(args.dump_features)} ({len(rows_out)} dòng)")


if __name__ == "__main__":
    main()

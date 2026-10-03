#!/usr/bin/env python3
"""
NGHIÊN CỨU - Phân loại DÁNG NGƯỜI trực tiếp từ ẢNH (không đi qua đo cm).

Ý tưởng (đơn giản hơn hồi quy số đo): dáng người là bài toán TỶ LỆ (vai:eo:hông),
mà tỷ lệ thì BẤT BIẾN VỚI THANG ĐO -> không dính domain gap ~50cm của hướng đo cm.

Pipeline:
  ảnh CALVIS -> MediaPipe (landmark vai/hông) + silhouette (nền trắng) ->
  đo bề rộng thân tại mức NGỰC/EO/HÔNG (đều dưới đường tay, nên không dính tay dang) ->
  tỷ lệ 2D -> phân loại dáng.
Nhãn dáng: TỰ GÁN từ số đo thật CALVIS bằng classify_body_shape (khách quan, khỏi nhãn tay).

Đánh giá: train/test split + 5-fold CV + ma trận nhầm lẫn theo lớp.
Chạy:  python train_shape_from_image.py --labels calvis_full_labels.csv
Đặc trưng được cache ra shape_features.csv để chạy lại nhanh.
"""
import argparse
import os
import sys

import cv2
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, train_test_split

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.body_shape import classify_body_shape  # noqa: E402

H = W = 200  # ảnh CALVIS 200x200
L_SH, R_SH, L_HIP, R_HIP = 11, 12, 23, 24
MODEL_OUT = os.path.join(os.path.dirname(__file__), "..", "models", "shape_from_image.joblib")
FEAT_CACHE = os.path.join(os.path.dirname(__file__), "shape_features.csv")
FEATURE_COLS = ["w_bust", "w_waist", "w_hip", "w_shoulder",
                "r_bust_waist", "r_hip_waist", "r_bust_hip", "r_shoulder_hip", "r_waist_hip"]

_landmarker = None


def _get_landmarker():
    global _landmarker
    if _landmarker is None:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
        model = os.path.join(os.path.dirname(__file__), "..", "models", "pose_landmarker_lite.task")
        _landmarker = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model), num_poses=1))
    return _landmarker


def _run_width(fg_row, cx):
    """Bề rộng = đoạn liền mạch chứa trục thân cx (loại khối tay/ bàn tay rời)."""
    if cx < 0 or cx >= len(fg_row) or not fg_row[cx]:
        # trục rỗng -> tìm pixel thân gần cx nhất
        on = np.where(fg_row)[0]
        if len(on) == 0:
            return 0, cx
        cx = int(on[np.argmin(np.abs(on - cx))])
    left = cx
    while left > 0 and fg_row[left - 1]:
        left -= 1
    right = cx
    while right < len(fg_row) - 1 and fg_row[right + 1]:
        right += 1
    return right - left + 1, cx


def extract_features(img_path):
    """Ảnh -> đặc trưng tỷ lệ 2D. None nếu không phát hiện người/đo được."""
    import mediapipe as mp
    im = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if im is None:
        return None
    fg = im < 250  # nền trắng CALVIS -> thân = pixel tối
    bgr = cv2.cvtColor(im, cv2.COLOR_GRAY2RGB)
    res = _get_landmarker().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=bgr))
    if not res.pose_landmarks:
        return None
    lm = res.pose_landmarks[0]
    sh_y = (lm[L_SH].y + lm[R_SH].y) / 2 * H
    hp_y = (lm[L_HIP].y + lm[R_HIP].y) / 2 * H
    cx = int(round((lm[L_HIP].x + lm[R_HIP].x) / 2 * W))
    torso = hp_y - sh_y
    if torso < 10:
        return None
    # các mức ĐỀU nằm dưới đường tay dang (tay ngang ở sh_y)
    bust_y = int(sh_y + 0.30 * torso)
    hip_level = int(hp_y + 0.15 * torso)  # hông rộng nhất thường dưới landmark hông
    bust_y = min(max(bust_y, 0), H - 1)
    hip_level = min(max(hip_level, 0), H - 1)

    w_bust, _ = _run_width(fg[bust_y], cx)
    w_hip, _ = _run_width(fg[hip_level], cx)
    # eo = chỗ HẸP NHẤT của thân giữa ngực và hông
    lo, hi = int(sh_y + 0.45 * torso), int(hp_y)
    widths = [(_run_width(fg[y], cx)[0], y) for y in range(max(lo, 0), min(hi, H))]
    widths = [w for w in widths if w[0] > 0]
    if not widths:
        return None
    w_waist = min(widths, key=lambda t: t[0])[0]
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


def build_features(labels_path):
    if os.path.exists(FEAT_CACHE):
        print(f"Dùng cache đặc trưng: {FEAT_CACHE} (xoá file này để trích lại)")
        return pd.read_csv(FEAT_CACHE)
    df = pd.read_csv(labels_path)
    rows, n_ok, n_img = [], 0, 0
    for _, r in df.iterrows():
        img = str(r.get("image", ""))
        if not img or not os.path.exists(img):
            continue
        n_img += 1
        feat = extract_features(img)
        if feat is None:
            continue
        shape, conf, _ = classify_body_shape(float(r["bust_cm"]), float(r["waist_cm"]), float(r["hip_cm"]))
        feat.update({"id": r["id"], "shape": shape, "label_conf": conf})
        rows.append(feat)
        n_ok += 1
        if n_ok % 300 == 0:
            print(f"  ...đã trích {n_ok}/{n_img} ảnh")
    out = pd.DataFrame(rows)
    out.to_csv(FEAT_CACHE, index=False, encoding="utf-8")
    print(f"Trích đặc trưng: {n_ok}/{n_img} ảnh thành công -> {FEAT_CACHE}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", default=os.path.join(os.path.dirname(__file__), "calvis_full_labels.csv"))
    a = ap.parse_args()

    df = build_features(a.labels)
    print(f"\nDữ liệu: {len(df)} mẫu | phân bố nhãn dáng (tự gán từ số đo CALVIS):")
    print(df["shape"].value_counts().to_string())

    X = df[FEATURE_COLS].values
    y = df["shape"].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    clf = RandomForestClassifier(n_estimators=300, random_state=42, class_weight="balanced")
    clf.fit(Xtr, ytr)
    acc = clf.score(Xte, yte)
    print(f"\n=== Phân loại ảnh->dáng (RandomForest trên tỷ lệ 2D) ===")
    print(f"Độ chính xác test: {acc:.1%}")
    print("\nBáo cáo theo lớp:")
    print(classification_report(yte, clf.predict(Xte), zero_division=0))
    print("Ma trận nhầm lẫn (hàng=thật, cột=dự đoán):", list(clf.classes_))
    print(confusion_matrix(yte, clf.predict(Xte)))

    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    scores = []
    for tr, te in cv.split(X, y):
        clf.fit(X[tr], y[tr])
        scores.append(clf.score(X[te], y[te]))
    print(f"\n5-fold CV accuracy: {np.mean(scores):.1%} (±{np.std(scores):.1%})")

    clf.fit(X, y)
    os.makedirs(os.path.dirname(os.path.abspath(MODEL_OUT)), exist_ok=True)
    joblib.dump({"model": clf, "features": FEATURE_COLS, "classes": list(clf.classes_)}, MODEL_OUT)
    print(f"\nĐã lưu model -> {os.path.abspath(MODEL_OUT)}")
    print("Lưu ý: ảnh synthetic 1 góc + nhãn suy từ số đo 3D -> chứng minh PHƯƠNG PHÁP; "
          "chuyển giao sang ảnh thật cần tập ảnh thật nhỏ để kiểm chứng (tỷ lệ 2D ít rớt hơn đo cm).")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Huấn luyện phân loại DÁNG NGƯỜI từ ẢNH THẬT bạn tự gom + gán nhãn theo THƯ MỤC.

Bố cục dữ liệu (ImageFolder — tên thư mục = nhãn dáng):
    ai-service/data/body_shape/real/
        INVERTED_TRIANGLE/  *.jpg   (vai rộng hơn hông)
        PEAR/               *.jpg   (hông rộng hơn vai)
        HOURGLASS/          *.jpg   (ngực~hông, eo thon rõ)
        RECTANGLE/          *.jpg   (ngực~eo~hông)
        APPLE/              *.jpg   (eo ~ hoặc > ngực/hông)

Khác CALVIS: ảnh thật nền bất kỳ -> silhouette lấy bằng MediaPipe SEGMENTATION (không dùng
ngưỡng nền trắng). Đặc trưng tỷ lệ 2D DÙNG CHUNG với CALVIS (app/shape_features.py) nên có thể
TRỘN thêm dữ liệu CALVIS (--with-calvis) để bù lớp hiếm.

Chạy:
    python train_shape_real.py                 # chỉ ảnh thật
    python train_shape_real.py --with-calvis   # trộn thêm đặc trưng CALVIS (shape_features.csv)
Yêu cầu tối thiểu ~30 ảnh/lớp mới nên train; dưới mức đó script chỉ báo thống kê.
"""
import argparse
import glob
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
from app import measure  # noqa: E402  - tái dùng _get_seg (pose + segmentation)
from app.shape_features import FEATURE_COLS, ratio_features  # noqa: E402

CLASSES = ["INVERTED_TRIANGLE", "PEAR", "HOURGLASS", "RECTANGLE", "APPLE"]
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "body_shape", "real")
CALVIS_FEATS = os.path.join(os.path.dirname(__file__), "shape_features.csv")
MODEL_OUT = os.path.join(os.path.dirname(__file__), "..", "models", "shape_from_image_real.joblib")
EXTS = ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.JPG", "*.JPEG", "*.PNG")

import mediapipe as mp  # noqa: E402


def real_features(img_path):
    """Ảnh thật -> silhouette (seg mask) + landmarks -> đặc trưng tỷ lệ. None nếu hỏng."""
    bgr = cv2.imread(img_path)
    if bgr is None:
        return None
    rgb = np.ascontiguousarray(bgr[:, :, ::-1])
    res = measure._get_seg().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.pose_landmarks or not res.segmentation_masks:
        return None
    mask = np.squeeze(np.array(res.segmentation_masks[0].numpy_view(), copy=True)) > 0.5
    return ratio_features(mask, res.pose_landmarks[0])


def collect_real():
    rows, stats, bad = [], {}, 0
    for cls in CLASSES:
        d = os.path.join(DATA_DIR, cls)
        files = []
        for e in EXTS:
            files += glob.glob(os.path.join(d, e))
        files = sorted(set(files))
        ok = 0
        for fp in files:
            feat = real_features(fp)
            if feat is None:
                bad += 1
                continue
            feat.update({"shape": cls, "src": "real", "file": os.path.basename(fp)})
            rows.append(feat)
            ok += 1
        stats[cls] = (ok, len(files))
    return pd.DataFrame(rows), stats, bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-calvis", action="store_true", help="trộn thêm đặc trưng CALVIS")
    ap.add_argument("--min-per-class", type=int, default=30)
    a = ap.parse_args()

    for cls in CLASSES:
        os.makedirs(os.path.join(DATA_DIR, cls), exist_ok=True)

    print("Đang trích đặc trưng ảnh thật (MediaPipe segmentation)...")
    df, stats, bad = collect_real()
    print("\nSố ảnh ĐỌC ĐƯỢC / tổng theo lớp:")
    for cls in CLASSES:
        ok, tot = stats[cls]
        print(f"  {cls:18} {ok:4d} / {tot}")
    print(f"  (bỏ {bad} ảnh không phát hiện được người/đo hỏng)")

    if a.with_calvis and os.path.exists(CALVIS_FEATS):
        cal = pd.read_csv(CALVIS_FEATS)
        cal = cal[FEATURE_COLS + ["shape"]].copy()
        cal["src"] = "calvis"
        df = pd.concat([df, cal], ignore_index=True)
        print(f"\nĐã trộn {len(cal)} mẫu CALVIS.")

    if df.empty:
        print("\nChưa có ảnh nào. Bỏ ảnh vào các thư mục rồi chạy lại. Xem data/body_shape/COLLECTION_GUIDE.md")
        return
    counts = df["shape"].value_counts()
    print("\nTổng mẫu dùng train:", len(df))
    print(counts.to_string())

    thin = [c for c in counts.index if counts[c] < a.min_per_class]
    if thin and not a.with_calvis:
        print(f"\nCác lớp còn ít (<{a.min_per_class}): {thin} -> gom thêm ảnh, hoặc chạy --with-calvis để bù.")
    if len(df) < a.min_per_class * 2 or df["shape"].nunique() < 2:
        print("Chưa đủ dữ liệu để huấn luyện có nghĩa. Dừng ở thống kê.")
        return

    X = df[FEATURE_COLS].values
    y = df["shape"].values
    strat = y if min(counts) >= 2 else None
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=strat)
    clf = RandomForestClassifier(n_estimators=400, random_state=42, class_weight="balanced")
    clf.fit(Xtr, ytr)
    print(f"\n=== Phân loại ảnh->dáng (ảnh thật{' + CALVIS' if a.with_calvis else ''}) ===")
    print(f"Accuracy test: {clf.score(Xte, yte):.1%}")
    print(classification_report(yte, clf.predict(Xte), zero_division=0))
    print("Ma trận nhầm lẫn:", list(clf.classes_))
    print(confusion_matrix(yte, clf.predict(Xte)))
    if min(counts) >= 5:
        cv = StratifiedKFold(min(5, int(min(counts))), shuffle=True, random_state=42)
        sc = [clf.fit(X[tr], y[tr]).score(X[te], y[te]) for tr, te in cv.split(X, y)]
        print(f"CV accuracy: {np.mean(sc):.1%} (±{np.std(sc):.1%})")

    clf.fit(X, y)
    os.makedirs(os.path.dirname(os.path.abspath(MODEL_OUT)), exist_ok=True)
    joblib.dump({"model": clf, "features": FEATURE_COLS, "classes": list(clf.classes_),
                 "trained_on": "real+calvis" if a.with_calvis else "real"}, MODEL_OUT)
    print(f"\nĐã lưu -> {os.path.abspath(MODEL_OUT)}")


if __name__ == "__main__":
    main()

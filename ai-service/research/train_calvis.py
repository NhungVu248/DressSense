#!/usr/bin/env python3
"""
NGHIÊN CỨU - Hồi quy số đo từ ảnh silhouette CALVIS.

CALVIS: ảnh synthetic 200x200 (nền trắng 255, thân tối), render ở tỉ lệ camera cố định
-> bề rộng PIXEL mang thông tin kích thước. Trích đặc trưng silhouette (bề rộng tại K mức
dọc theo thân + diện tích + bbox) rồi hồi quy -> chu vi ngực/eo/hông (cm).

Đầu vào: calvis_labels.csv (từ load_calvis.py). Đánh giá: train/test split + 5-fold CV.
Chạy:  python train_calvis.py --labels calvis_labels.csv
"""
import argparse
import os

import cv2
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import KFold, train_test_split
from sklearn.multioutput import MultiOutputRegressor

TARGETS = ["bust_cm", "waist_cm", "hip_cm"]
K = 16  # số mức dọc đo bề rộng
MODEL_OUT = os.path.join(os.path.dirname(__file__), "..", "models", "calvis_regressor.joblib")


def silhouette_features(img_path):
    im = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if im is None:
        return None
    fg = im < 250  # thân = pixel tối hơn nền trắng
    rows = np.where(fg.any(axis=1))[0]
    cols = np.where(fg.any(axis=0))[0]
    if len(rows) < 5 or len(cols) < 2:
        return None
    y0, y1 = rows.min(), rows.max()
    feats = []
    for f in np.linspace(0.05, 0.95, K):  # bề rộng (px) tại K mức dọc theo thân
        y = int(y0 + f * (y1 - y0))
        xs = np.where(fg[y])[0]
        feats.append(float(xs.max() - xs.min() + 1) if len(xs) else 0.0)
    feats += [float(fg.sum()), float(y1 - y0 + 1), float(cols.max() - cols.min() + 1)]  # area, bbox h, w
    return feats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", default=os.path.join(os.path.dirname(__file__), "calvis_labels.csv"))
    args = ap.parse_args()

    df = pd.read_csv(args.labels)
    X, Y, ids = [], [], []
    for _, r in df.iterrows():
        if not r.get("image") or not os.path.exists(str(r["image"])):
            continue
        f = silhouette_features(str(r["image"]))
        if f is None:
            continue
        X.append(f)
        Y.append([float(r[t]) for t in TARGETS])
        ids.append(r["id"])
    X, Y = np.array(X), np.array(Y)
    print(f"Dữ liệu: {len(X)} ảnh | {X.shape[1]} đặc trưng silhouette (K={K} mức + area + bbox)")

    Xtr, Xte, Ytr, Yte = train_test_split(X, Y, test_size=0.2, random_state=42)
    models = {
        "Ridge": MultiOutputRegressor(Ridge(alpha=10.0)),
        "RandomForest": MultiOutputRegressor(RandomForestRegressor(n_estimators=300, random_state=42)),
    }
    best, best_mae, best_name = None, 1e9, None
    for name, m in models.items():
        m.fit(Xtr, Ytr)
        pred = m.predict(Xte)
        mae = [mean_absolute_error(Yte[:, i], pred[:, i]) for i in range(3)]
        # 5-fold CV trên toàn bộ
        cv = KFold(5, shuffle=True, random_state=42)
        cvmae = []
        for tr, te in cv.split(X):
            m.fit(X[tr], Y[tr])
            p = m.predict(X[te])
            cvmae.append(np.abs(p - Y[te]).mean())
        overall = float(np.mean(mae))
        print(f"{name:14} test-MAE(cm): bust {mae[0]:.1f} · waist {mae[1]:.1f} · hip {mae[2]:.1f} "
              f"| TB {overall:.1f} | CV-MAE {np.mean(cvmae):.1f}")
        if overall < best_mae:
            best, best_mae, best_name = m, overall, name

    best.fit(X, Y)
    os.makedirs(os.path.dirname(os.path.abspath(MODEL_OUT)), exist_ok=True)
    joblib.dump({"model": best, "K": K, "targets": TARGETS, "name": best_name}, MODEL_OUT)
    print(f"\nMô hình tốt nhất: {best_name} (TB {best_mae:.1f}cm) -> {os.path.abspath(MODEL_OUT)}")
    print("Lưu ý: 100 mẫu + ảnh synthetic 1 góc -> mốc tham khảo; bản full (~3803) sẽ tốt hơn.")


if __name__ == "__main__":
    main()

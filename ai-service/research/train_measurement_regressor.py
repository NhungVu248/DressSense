#!/usr/bin/env python3
"""
NGHIÊN CỨU (b) - Khung HỒI QUY ước lượng chu vi từ đặc trưng hình học.

Thay công thức elip cứng bằng mô hình học: đặc trưng (rộng/sâu tại 3 mức + chiều cao/
cân nặng) -> chu vi ngực/eo/hông. Đây là KHUNG sẵn sàng cho dataset lớn; với vài mẫu chỉ
chạy được để kiểm thử pipeline (đánh giá bằng Leave-One-Out vì n nhỏ).

Đầu vào: features.csv do estimate_measurements.py --dump-features sinh ra.
Chạy:  python train_measurement_regressor.py --features features.csv
"""
import argparse
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import LeaveOneOut
from sklearn.multioutput import MultiOutputRegressor

TARGETS = ["bust", "waist", "hip"]
MODEL_OUT = os.path.join(os.path.dirname(__file__), "..", "models", "measurement_regressor.joblib")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default=os.path.join(os.path.dirname(__file__), "features.csv"))
    args = ap.parse_args()

    df = pd.read_csv(args.features)
    feat_cols = [c for c in df.columns if c.endswith(("_width_cm", "_depth_cm")) or c in ("height_cm", "weight_kg")]
    X = df[feat_cols].fillna(0).values
    Y = df[TARGETS].values
    n = len(df)
    print(f"Dữ liệu: {n} mẫu | {len(feat_cols)} đặc trưng: {feat_cols}")

    if n < 4:
        print("Quá ít mẫu để huấn luyện có nghĩa — chỉ minh họa khung.")

    models = {
        "Ridge": MultiOutputRegressor(Ridge(alpha=1.0)),
        "RandomForest": MultiOutputRegressor(RandomForestRegressor(n_estimators=200, random_state=42)),
    }
    loo = LeaveOneOut()
    best, best_mae = None, 1e9
    for name, model in models.items():
        preds = np.zeros_like(Y, dtype=float)
        for tr, te in loo.split(X):
            model.fit(X[tr], Y[tr])
            preds[te] = model.predict(X[te])
        mae = np.abs(preds - Y).mean(axis=0)
        overall = mae.mean()
        print(f"{name:14} LOO-MAE (cm): " + " · ".join(f"{t} {m:.1f}" for t, m in zip(TARGETS, mae)) + f"  | TB {overall:.1f}")
        if overall < best_mae:
            best, best_mae, best_name = model, overall, name

    # Huấn luyện lại mô hình tốt nhất trên toàn bộ dữ liệu + lưu
    best.fit(X, Y)
    os.makedirs(os.path.dirname(os.path.abspath(MODEL_OUT)), exist_ok=True)
    joblib.dump({"model": best, "features": feat_cols, "targets": TARGETS, "name": best_name}, MODEL_OUT)
    print(f"\nMô hình tốt nhất: {best_name} (TB {best_mae:.1f}cm) -> {os.path.abspath(MODEL_OUT)}")
    print("Lưu ý: n nhỏ -> số liệu chỉ để kiểm thử khung; cần dataset lớn để có mô hình đáng tin.")


if __name__ == "__main__":
    main()

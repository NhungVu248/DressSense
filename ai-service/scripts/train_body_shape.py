#!/usr/bin/env python3
"""
Giai đoạn 3 (M4) - Huấn luyện & so sánh mô hình phân loại dáng người.

Đặc trưng (chuẩn hóa theo tỷ lệ): waist_hip, waist_bust, bust_hip.
Nhãn: body_shape (5 lớp). Dữ liệu mặc định: body_shapes_ansur.csv (số đo NGƯỜI THẬT).

So sánh: Decision Tree, Random Forest, MLP, XGBoost — theo accuracy, macro-F1 (quan trọng
vì lớp mất cân bằng), weighted-F1, confusion matrix; chọn mô hình macro-F1 cao nhất, lưu lại.

⚠️ TRUNG THỰC: nhãn ở dataset là do LUẬT sinh (không phải người gán). Vì vậy điểm cao ở đây
nghĩa là mô hình "học lại luật" với độ trung thành cao — KHÔNG phải bằng chứng khoa học về độ
chính xác trên nhãn thật. Giá trị: dựng pipeline huấn luyện/đánh giá + phân tích feature
importance; khi có nhãn do người thật gán, chỉ thay dữ liệu, giữ nguyên pipeline.

Chạy:  python train_body_shape.py            # dùng body_shapes_ansur.csv
"""
import argparse
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             f1_score)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

HERE = os.path.dirname(__file__)
DEFAULT_DATA = os.path.join(HERE, "..", "data", "body_shape", "body_shapes_ansur.csv")
DEFAULT_MODEL = os.path.join(HERE, "..", "models", "body_shape_model.joblib")
DEFAULT_REPORT = os.path.join(HERE, "..", "data", "body_shape", "ml_report.md")
FEATURES = ["waist_hip", "waist_bust", "bust_hip"]
SHAPES = ["HOURGLASS", "RECTANGLE", "PEAR", "APPLE", "INVERTED_TRIANGLE"]


def build_models():
    return {
        "DecisionTree": Pipeline([("sc", StandardScaler()),
                                  ("clf", DecisionTreeClassifier(max_depth=6, class_weight="balanced", random_state=42))]),
        "RandomForest": Pipeline([("sc", StandardScaler()),
                                  ("clf", RandomForestClassifier(n_estimators=200, class_weight="balanced", random_state=42))]),
        "MLP": Pipeline([("sc", StandardScaler()),
                         ("clf", MLPClassifier(hidden_layer_sizes=(32, 16), max_iter=1000, random_state=42))]),
        "XGBoost": Pipeline([("sc", StandardScaler()),
                             ("clf", XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.1,
                                                   subsample=0.9, eval_metric="mlogloss", random_state=42))]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=DEFAULT_DATA)
    ap.add_argument("--out-model", default=DEFAULT_MODEL)
    ap.add_argument("--report", default=DEFAULT_REPORT)
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    X = df[FEATURES].values
    le = LabelEncoder().fit(df["body_shape"])
    y = le.transform(df["body_shape"])

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    results = {}
    trained = {}
    for name, model in build_models().items():
        model.fit(Xtr, ytr)
        pred = model.predict(Xte)
        cv_f1 = cross_val_score(model, X, y, cv=cv, scoring="f1_macro")
        results[name] = {
            "accuracy": accuracy_score(yte, pred),
            "macro_f1": f1_score(yte, pred, average="macro"),
            "weighted_f1": f1_score(yte, pred, average="weighted"),
            "cv_macro_f1_mean": cv_f1.mean(),
            "cv_macro_f1_std": cv_f1.std(),
            "pred": pred,
        }
        trained[name] = model

    best = max(results, key=lambda k: results[k]["macro_f1"])

    # ---- In bảng so sánh ----
    print(f"Dữ liệu: {os.path.basename(args.data)} | {len(df)} mẫu | đặc trưng: {FEATURES}")
    print(f"{'Model':14} {'accuracy':>9} {'macroF1':>9} {'weightF1':>9} {'cvF1(mean±std)':>18}")
    for name, r in results.items():
        star = " *" if name == best else ""
        print(f"{name:14} {r['accuracy']:9.3f} {r['macro_f1']:9.3f} {r['weighted_f1']:9.3f} "
              f"{r['cv_macro_f1_mean']:9.3f}±{r['cv_macro_f1_std']:.3f}{star}")
    print(f"\nMô hình tốt nhất (macro-F1): {best}")

    # ---- Lưu mô hình tốt nhất ----
    os.makedirs(os.path.dirname(os.path.abspath(args.out_model)), exist_ok=True)
    joblib.dump({"pipeline": trained[best], "labels": list(le.classes_), "features": FEATURES,
                 "model_name": best}, args.out_model)
    print(f"Đã lưu -> {os.path.abspath(args.out_model)}")

    # ---- Ghi báo cáo ----
    write_report(args.report, args.data, df, results, best, trained, le, yte)
    print(f"Báo cáo -> {os.path.abspath(args.report)}")


def write_report(path, data_path, df, results, best, trained, le, yte):
    lines = []
    lines.append("# Báo cáo huấn luyện phân loại dáng người (GĐ3)\n")
    lines.append(f"- Dữ liệu: `{os.path.basename(data_path)}` — {len(df)} mẫu (số đo người thật ANSUR II)")
    lines.append(f"- Đặc trưng: {', '.join(FEATURES)} (tỷ lệ chuẩn hóa)")
    lines.append("- Phân bố nhãn: " + ", ".join(f"{s} {int((df['body_shape']==s).sum())}" for s in SHAPES))
    lines.append("")
    lines.append("> ⚠️ Nhãn do LUẬT sinh (không phải người gán). Điểm cao = mô hình học lại luật với "
                 "độ trung thành cao, KHÔNG phải bằng chứng độ chính xác trên nhãn thật.\n")
    lines.append("## So sánh mô hình\n")
    lines.append("| Model | accuracy | macro-F1 | weighted-F1 | CV macro-F1 (mean±std) |")
    lines.append("|-------|----------|----------|-------------|------------------------|")
    for name, r in results.items():
        mark = " **(chọn)**" if name == best else ""
        lines.append(f"| {name}{mark} | {r['accuracy']:.3f} | {r['macro_f1']:.3f} | {r['weighted_f1']:.3f} | "
                     f"{r['cv_macro_f1_mean']:.3f}±{r['cv_macro_f1_std']:.3f} |")
    lines.append("")
    # Confusion matrix của mô hình tốt nhất
    cm = confusion_matrix(yte, results[best]["pred"], labels=list(range(len(le.classes_))))
    lines.append(f"## Confusion matrix — {best} (tập test)\n")
    header = "| thực\\dự đoán | " + " | ".join(le.classes_) + " |"
    lines.append(header)
    lines.append("|" + "---|" * (len(le.classes_) + 1))
    for i, s in enumerate(le.classes_):
        lines.append(f"| {s} | " + " | ".join(str(int(x)) for x in cm[i]) + " |")
    lines.append("")
    lines.append("## classification_report — " + best + "\n```")
    lines.append(classification_report(yte, results[best]["pred"], labels=list(range(len(le.classes_))),
                                        target_names=le.classes_, zero_division=0))
    lines.append("```")
    # Feature importance (nếu có)
    clf = trained[best].named_steps["clf"]
    if hasattr(clf, "feature_importances_"):
        lines.append("\n## Feature importance — " + best + "\n")
        for f, imp in sorted(zip(FEATURES, clf.feature_importances_), key=lambda t: -t[1]):
            lines.append(f"- {f}: {imp:.3f}")
    lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()

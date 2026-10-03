#!/usr/bin/env python3
"""
Đo DOMAIN GAP: chạy model CALVIS (huấn luyện trên ảnh synthetic) lên ẢNH NGƯỜI THẬT
(bộ Kaggle Body Measurements: front_img + số đo thật) và so sai số.

Dùng app.measure (MediaPipe seg -> khung chuẩn CALVIS -> model) để tách silhouette trên
NỀN THẬT (không còn phụ thuộc 'pixel<250'). So với số đo thật -> MAE + độ lệch (bias).

Chạy:  python domain_gap.py --dataset "C:/.../datasetdaln" --csv "Body Measurements Image Dataset.csv"
"""
import argparse
import csv
import os
import sys

import cv2

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import measure  # noqa: E402


def num(v):
    try:
        return float(str(v).replace("_tbr", ""))
    except (ValueError, TypeError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--csv", default="Body Measurements Image Dataset.csv")
    a = ap.parse_args()

    if not measure.model_available():
        raise SystemExit("Chưa có model CALVIS (chạy research/train_calvis.py trước).")

    rows = list(csv.DictReader(open(os.path.join(a.dataset, a.csv), encoding="utf-8-sig")))
    errs = {"bust": [], "waist": [], "hip": []}
    signed = {"bust": [], "waist": [], "hip": []}
    print(f"{'set':4} {'vòng':6} {'ước lượng':>10} {'thật':>7} {'sai số':>8}")
    for r in rows:
        sid = str(r["set_id"])
        fp = os.path.join(a.dataset, sid, "front_img.jpg")
        if not os.path.exists(fp):
            continue
        bgr = cv2.imread(fp)
        if bgr is None:
            continue
        est = measure.estimate_from_image(bgr)
        if est is None:
            print(f"{sid:4} (không ước lượng được)")
            continue
        gt = {"bust": num(r["chest_circumference_cm"]), "waist": num(r["waist_circumference_cm"]),
              "hip": num(r["hips_circumference_cm"])}
        for k in ("bust", "waist", "hip"):
            e = est[k] - gt[k]
            errs[k].append(abs(e))
            signed[k].append(e)
            print(f"{sid:4} {k:6} {est[k]:10.1f} {gt[k]:7.1f} {e:+8.1f}")

    print("\n=== DOMAIN GAP: model CALVIS (synthetic) trên ẢNH THẬT ===")
    for k in ("bust", "waist", "hip"):
        if errs[k]:
            mae = sum(errs[k]) / len(errs[k])
            bias = sum(signed[k]) / len(signed[k])
            print(f"  {k:6}: MAE {mae:5.1f} cm · độ lệch TB {bias:+5.1f} cm (n={len(errs[k])})")
    print("So sánh: trên ảnh synthetic CALVIS, MAE ~1.5cm. Chênh lệch = domain gap.")


if __name__ == "__main__":
    main()

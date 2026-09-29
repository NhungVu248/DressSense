#!/usr/bin/env python3
"""
Tạo LÔ DỮ LIỆU để con người gán nhãn (cách A trong labeling_guide.md).

Lấy mẫu từ body_shapes_ansur.csv (số đo NGƯỜI THẬT), ẨN nhãn luật, để người gán độc lập.
Để đảm bảo cả 5 dáng đều xuất hiện (kể cả lớp hiếm Inverted Triangle), lấy mẫu phân tầng
theo nhãn-luật NHƯNG KHÔNG ghi nhãn vào file xuất (chỉ dùng để cân đối lô).

Xuất: id, sex, height_cm, weight_kg, bust_cm, waist_cm, hip_cm, waist_hip, waist_bust,
bust_hip  (KHÔNG có body_shape).

Chạy:  python make_labeling_batch.py --per-class 40
"""
import argparse
import csv
import os
import random

HERE = os.path.dirname(__file__)
DEFAULT_SRC = os.path.join(HERE, "..", "data", "body_shape", "body_shapes_ansur.csv")
DEFAULT_OUT = os.path.join(HERE, "..", "data", "body_shape", "labeling_batch.csv")
OUT_COLS = ["id", "sex", "height_cm", "weight_kg", "bust_cm", "waist_cm", "hip_cm",
            "waist_hip", "waist_bust", "bust_hip"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--per-class", type=int, default=40, help="số mẫu mỗi dáng (theo nhãn-luật để cân đối)")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rows = list(csv.DictReader(open(args.src, encoding="utf-8")))
    by_shape = {}
    for r in rows:
        by_shape.setdefault(r["body_shape"], []).append(r)

    rnd = random.Random(args.seed)
    picked = []
    for shape, items in by_shape.items():
        rnd.shuffle(items)
        picked.extend(items[: args.per_class])  # lấy tối đa per-class (lớp hiếm lấy hết)
    rnd.shuffle(picked)  # trộn để người gán không đoán theo thứ tự

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUT_COLS)
        w.writeheader()
        for r in picked:
            w.writerow({k: r[k] for k in OUT_COLS})

    print(f"Đã tạo lô {len(picked)} mẫu (ẩn nhãn) -> {os.path.abspath(args.out)}")
    print("Mở labeling_tool.html, nạp file này để bắt đầu gán nhãn.")


if __name__ == "__main__":
    main()

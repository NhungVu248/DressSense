#!/usr/bin/env python3
"""
Gộp các lượt gán nhãn của con người (xuất từ labeling_tool.html) thành dataset nhãn thật.

Đầu vào: nhiều CSV, mỗi CSV là 1 lượt gán, có cột: id, body_shape, annotator, và các cột đặc
trưng (bust_cm..bust_hip). Nhãn cuối theo ĐA SỐ giữa các người gán; báo độ đồng thuận
(Cohen's kappa khi có đúng 2 người gán). Bỏ mẫu "unsure"/rỗng và mẫu bất đồng hoàn toàn.

Xuất: body_shapes_human.csv (source=human) — dùng để huấn luyện/đánh giá với nhãn thật.

Chạy:  python build_human_labeled.py a1.csv a2.csv [a3.csv ...]
"""
import argparse
import csv
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(__file__)
DEFAULT_OUT = os.path.join(HERE, "..", "data", "body_shape", "body_shapes_human.csv")
FEATURE_COLS = ["sex", "height_cm", "weight_kg", "bust_cm", "waist_cm", "hip_cm",
                "waist_hip", "waist_bust", "bust_hip"]
VALID = {"HOURGLASS", "RECTANGLE", "PEAR", "APPLE", "INVERTED_TRIANGLE"}


def cohen_kappa(a, b):
    """Kappa cho 2 người gán trên các mẫu chung."""
    ids = [k for k in a if k in b]
    if not ids:
        return None
    labels = sorted(VALID)
    n = len(ids)
    po = sum(1 for k in ids if a[k] == b[k]) / n
    pe = 0.0
    for lb in labels:
        pa = sum(1 for k in ids if a[k] == lb) / n
        pb = sum(1 for k in ids if b[k] == lb) / n
        pe += pa * pb
    return (po - pe) / (1 - pe) if pe < 1 else 1.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="các CSV nhãn (mỗi file 1 người gán)")
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    per_annotator = {}   # annotator -> {id -> label}
    features = {}        # id -> feature dict
    votes = defaultdict(list)  # id -> [labels]

    for path in args.inputs:
        rows = list(csv.DictReader(open(path, encoding="utf-8")))
        ann = rows[0].get("annotator") if rows else os.path.basename(path)
        per_annotator.setdefault(ann, {})
        for r in rows:
            label = (r.get("body_shape") or "").strip().upper()
            _id = r["id"]
            if _id not in features:
                features[_id] = {k: r.get(k, "") for k in FEATURE_COLS}
            if label in VALID:
                per_annotator[ann][_id] = label
                votes[_id].append(label)

    # Nhãn cuối theo đa số; giữ khi có đa số rõ (>50%)
    final = []
    agreed = disputed = 0
    for _id, labs in votes.items():
        c = Counter(labs)
        top, n = c.most_common(1)[0]
        if n > len(labs) / 2:
            agreed += 1
            row = {"id": _id, **features[_id], "body_shape": top,
                   "n_annotators": len(labs), "source": "human"}
            final.append(row)
        else:
            disputed += 1

    cols = ["id"] + FEATURE_COLS + ["body_shape", "n_annotators", "source"]
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(final)

    print(f"Nhãn thống nhất: {agreed} | bất đồng (loại): {disputed} -> {os.path.abspath(args.out)}")
    anns = list(per_annotator)
    if len(anns) == 2:
        k = cohen_kappa(per_annotator[anns[0]], per_annotator[anns[1]])
        if k is not None:
            print(f"Cohen's kappa ({anns[0]} vs {anns[1]}): {k:.3f}")


if __name__ == "__main__":
    main()

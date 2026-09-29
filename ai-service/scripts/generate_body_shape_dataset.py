#!/usr/bin/env python3
"""
Giai đoạn 1 (Tầng B) - Sinh dataset dáng người có nhãn phục vụ huấn luyện/so sánh
mô hình phân loại ở Giai đoạn 3.

Nguồn nhãn: bộ luật rule-based ĐÃ CÓ trong dự án (backend classifyBodyShape) được
port sang Python dưới đây, giữ nguyên ngưỡng. Đây là dataset "bootstrap": khi có ảnh
người thật (ảnh -> MediaPipe landmarks -> số đo), chỉ cần thay nguồn số đo, giữ nguyên
schema đặc trưng và nhãn.

Đặc trưng chuẩn hóa theo tỷ lệ (không phụ thuộc khoảng cách chụp): waist/hip, waist/bust,
bust/hip, shoulder/hip.

Chạy:  python generate_body_shape_dataset.py --per-class 120 --out ../data/body_shape/body_shapes.csv
"""
import argparse
import csv
import os
import random

# --- Ngưỡng phân loại (đồng bộ với backend/src/constants/body-analysis.ts) ---
BALANCE_THRESHOLD = 5      # |bust-hip| <= 5 -> coi là cân đối
DEFINED_WAIST_THRESHOLD = 9  # eo thu nhỏ rõ rệt
DOMINANT_THRESHOLD = 9       # ngực/hông lớn hơn rõ rệt
SHAPES = ["HOURGLASS", "RECTANGLE", "PEAR", "APPLE", "INVERTED_TRIANGLE"]


def margin_confidence(value, threshold, base=0.65):
    return min(0.95, base + abs(value - threshold) / 40.0)


def classify(bust, waist, hip):
    """Port của classifyBodyShape() (Node) -> (shape, confidence)."""
    bust_hip = bust - hip
    waist_bust_gap = bust - waist
    waist_hip_gap = hip - waist

    # APPLE: eo gần bằng hoặc lớn hơn ngực/hông
    if waist >= bust - 2 or waist >= hip - 2:
        return "APPLE", round(margin_confidence(waist, min(bust, hip), 0.6), 3)

    # Ngực và hông xấp xỉ nhau
    if abs(bust_hip) <= BALANCE_THRESHOLD:
        if waist_bust_gap >= DEFINED_WAIST_THRESHOLD and waist_hip_gap >= DEFINED_WAIST_THRESHOLD:
            return "HOURGLASS", round(
                margin_confidence(min(waist_bust_gap, waist_hip_gap), DEFINED_WAIST_THRESHOLD), 3
            )
        return "RECTANGLE", round(margin_confidence(BALANCE_THRESHOLD, abs(bust_hip), 0.6), 3)

    if bust_hip <= -DOMINANT_THRESHOLD:
        return "PEAR", round(margin_confidence(-bust_hip, DOMINANT_THRESHOLD), 3)
    if bust_hip >= DOMINANT_THRESHOLD:
        return "INVERTED_TRIANGLE", round(margin_confidence(bust_hip, DOMINANT_THRESHOLD), 3)

    return "RECTANGLE", 0.5


def draft_for(shape, rnd):
    """Sinh bộ số đo (bust, waist, hip) thiên về dáng mục tiêu, kèm nhiễu."""
    if shape == "HOURGLASS":
        hip = rnd.uniform(86, 106)
        bust = hip + rnd.uniform(-4, 4)                 # cân đối
        waist = min(bust, hip) - rnd.uniform(10, 20)    # eo thu nhỏ rõ
    elif shape == "RECTANGLE":
        hip = rnd.uniform(82, 104)
        bust = hip + rnd.uniform(-4, 4)                 # cân đối
        waist = min(bust, hip) - rnd.uniform(3, 8)      # eo thu nhỏ nhẹ (< ngưỡng 9)
    elif shape == "PEAR":
        hip = rnd.uniform(96, 116)
        bust = hip - rnd.uniform(9, 20)                 # hông trội
        waist = bust - rnd.uniform(3, 12)
    elif shape == "INVERTED_TRIANGLE":
        bust = rnd.uniform(96, 114)
        hip = bust - rnd.uniform(9, 20)                 # ngực/vai trội
        waist = min(bust, hip) - rnd.uniform(3, 12)
    else:  # APPLE
        hip = rnd.uniform(84, 108)
        bust = hip + rnd.uniform(-5, 5)
        waist = min(bust, hip) - rnd.uniform(-3, 1)     # eo gần/vượt ngực-hông
    return round(bust, 1), round(waist, 1), round(hip, 1)


def make_sample(shape, rnd, idx):
    """Sinh 1 mẫu đã được luật xác nhận đúng nhãn mục tiêu."""
    for _ in range(200):  # rejection sampling để nhãn sạch
        bust, waist, hip = draft_for(shape, rnd)
        if waist < 45 or bust < 70 or hip < 75:
            continue
        label, conf = classify(bust, waist, hip)
        if label != shape:
            continue
        height = round(rnd.uniform(150, 180), 1)
        bmi = rnd.uniform(18, 26)
        weight = round(bmi * (height / 100.0) ** 2, 1)
        shoulder = round(bust * rnd.uniform(0.98, 1.07), 1)
        return {
            "id": idx,
            "height_cm": height,
            "weight_kg": weight,
            "shoulder_cm": shoulder,
            "bust_cm": bust,
            "waist_cm": waist,
            "hip_cm": hip,
            "waist_hip": round(waist / hip, 3),
            "waist_bust": round(waist / bust, 3),
            "bust_hip": round(bust / hip, 3),
            "shoulder_hip": round(shoulder / hip, 3),
            "body_shape": label,
            "confidence": conf,
            "source": "synthetic_rule",
        }
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=120, help="số mẫu mỗi dáng")
    ap.add_argument("--seed", type=int, default=42)
    default_out = os.path.join(os.path.dirname(__file__), "..", "data", "body_shape", "body_shapes.csv")
    ap.add_argument("--out", default=default_out)
    args = ap.parse_args()

    rnd = random.Random(args.seed)
    rows = []
    idx = 1
    for shape in SHAPES:
        made = 0
        while made < args.per_class:
            s = make_sample(shape, rnd, idx)
            if s is None:
                continue
            rows.append(s)
            idx += 1
            made += 1

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    fields = [
        "id", "height_cm", "weight_kg", "shoulder_cm", "bust_cm", "waist_cm", "hip_cm",
        "waist_hip", "waist_bust", "bust_hip", "shoulder_hip", "body_shape", "confidence", "source",
    ]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    # Thống kê cân bằng nhãn
    counts = {s: 0 for s in SHAPES}
    for r in rows:
        counts[r["body_shape"]] += 1
    print(f"Đã ghi {len(rows)} mẫu -> {os.path.abspath(args.out)}")
    print("Phân bố nhãn:", counts)


if __name__ == "__main__":
    main()

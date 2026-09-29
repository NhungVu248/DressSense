#!/usr/bin/env python3
"""
Giai đoạn 1 (Tầng B) - Xây dataset dáng người từ SỐ ĐO NGƯỜI THẬT (ANSUR II).

Nguồn: ANSUR II (2012 US Army Anthropometric Survey), bản công khai — số đo THẬT của
1986 nữ (và 4082 nam). Nhãn 5 dáng được SUY RA bằng quy tắc tỷ lệ ngực–eo–hông (đồng bộ
classifyBodyShape của hệ thống, tinh thần FFIT - Female Figure Identification Technique).

Trung thực: đây KHÔNG phải nhãn do con người gán; số đo là thật, nhãn là suy luận công thức.
Khác biệt cốt lõi so với dataset synthetic: phân bố số đo và tương quan ngực–eo–hông là của
người thật (không sinh ngẫu nhiên) -> phân bố dáng người TỰ NHIÊN (mất cân bằng), phản ánh
đúng dân số nguồn (nữ quân nhân Mỹ).

Đơn vị ANSUR: mm cho số đo (chia 10 -> cm), weightkg là phần mười kg (chia 10 -> kg).
Quy ước: bust = chestcircumference (đo ngang ngực), waist = waistcircumference,
hip = buttockcircumference, shoulder = biacromialbreadth (rộng vai - đây là BREADTH, khác
với shoulder ước lượng ở dataset synthetic; không trộn cột shoulder giữa hai nguồn).

Chạy:  python build_ansur_dataset.py            # cần raw/ANSUR_II_FEMALE_Public.csv (download_ansur.py)
"""
import argparse
import csv
import os

from generate_body_shape_dataset import classify  # dùng lại luật đã port

HERE = os.path.dirname(__file__)
DEFAULT_RAW = os.path.join(HERE, "..", "data", "body_shape", "raw", "ANSUR_II_FEMALE_Public.csv")
DEFAULT_OUT = os.path.join(HERE, "..", "data", "body_shape", "body_shapes_ansur.csv")
SHAPES = ["HOURGLASS", "RECTANGLE", "PEAR", "APPLE", "INVERTED_TRIANGLE"]


def mm2cm(v):
    return round(float(v) / 10.0, 1)


def build(raw_path, out_path, sex):
    rows = []
    with open(raw_path, encoding="latin-1", newline="") as f:
        for i, r in enumerate(csv.DictReader(f), 1):
            try:
                bust = mm2cm(r["chestcircumference"])
                waist = mm2cm(r["waistcircumference"])
                hip = mm2cm(r["buttockcircumference"])
                shoulder = mm2cm(r["biacromialbreadth"])
                height = mm2cm(r["stature"])
                weight = round(float(r["weightkg"]) / 10.0, 1)
            except (KeyError, ValueError):
                continue
            if bust <= 0 or waist <= 0 or hip <= 0:
                continue
            label, conf = classify(bust, waist, hip)
            rows.append({
                "id": i,
                "sex": sex,
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
                "source": "ansur2",
            })

    fields = [
        "id", "sex", "height_cm", "weight_kg", "shoulder_cm", "bust_cm", "waist_cm", "hip_cm",
        "waist_hip", "waist_bust", "bust_hip", "shoulder_hip", "body_shape", "confidence", "source",
    ]
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    counts = {s: 0 for s in SHAPES}
    for r in rows:
        counts[r["body_shape"]] += 1
    print(f"Đã ghi {len(rows)} mẫu (số đo thật) -> {os.path.abspath(out_path)}")
    print("Phân bố nhãn (tự nhiên, có thể mất cân bằng):")
    for s in SHAPES:
        pct = 100.0 * counts[s] / len(rows) if rows else 0
        print(f"  {s:18} {counts[s]:5}  ({pct:.1f}%)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=DEFAULT_RAW, help="đường dẫn ANSUR II CSV")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--sex", default="F", choices=["F", "M"], help="nhãn giới tính ghi vào cột sex")
    args = ap.parse_args()
    if not os.path.exists(args.raw):
        raise SystemExit(f"Không thấy {args.raw}. Chạy download_ansur.py trước.")
    build(args.raw, args.out, args.sex)


if __name__ == "__main__":
    main()

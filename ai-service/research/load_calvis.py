#!/usr/bin/env python3
"""
Nạp bộ CALVIS (neoglez/calvis) về ĐỊNH DẠNG CHUNG của pipeline DressSense.

CALVIS: ảnh người synthetic (xám 200x200, sinh từ mesh SMPL) + nhãn chu vi
chest/waist/pelvis (JSON). Bố cục tải sẵn (xác nhận theo code repo neoglez/calvis):
    CALVIS/dataset/cmu/
        annotations/{female,male}/*_anno.json          # nhãn
        synthetic_images/200x200/{female,male}/*.png    # ảnh
Nhãn JSON: {"betas":[...], "human_dimensions": {"chest_circumference",
"waist_circumference","pelvis_circumference"}} — đơn vị MÉT (x100 -> cm).
Ảnh X_mesh_Y.png  <->  nhãn X_mesh_Y_anno.json.
(không cần SMPL để DÙNG dữ liệu đã tải; chỉ cần nếu tự sinh lại.)

Ánh xạ sang schema của mình: bust = chest, waist = waist, hip = pelvis (lưu ý: pelvis
≈ vòng hông nhưng đo ở mức chậu, hơi khác "hông rộng nhất").

Vì định dạng JSON/đơn vị có thể khác theo phiên bản, CHẠY --inspect TRƯỚC để xem cấu trúc:
    python load_calvis.py --root "C:/.../CALVIS/dataset/cmu" --inspect
Rồi nạp:
    python load_calvis.py --root "C:/.../CALVIS/dataset/cmu" --out calvis_labels.csv
"""
import argparse
import csv
import glob
import json
import os
import re

CM_KEYS = {  # tên khóa ứng với từng vòng (dò không phân biệt hoa thường/động từ)
    "bust": ["chest", "bust"],
    "waist": ["waist"],
    "hip": ["pelvis", "hip"],
}


def find_measure(obj, keywords):
    """Dò đệ quy giá trị số có khóa chứa 1 trong keywords."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (int, float)) and any(kw in k.lower() for kw in keywords):
                return float(v)
        for v in obj.values():  # đệ quy vào nhánh con
            r = find_measure(v, keywords)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = find_measure(v, keywords)
            if r is not None:
                return r
    return None


def to_cm(v):
    """Chuẩn hóa về cm: SMPL theo mét -> <5 coi là mét (x100); 5..~400 coi là cm; lớn hơn là mm."""
    if v is None:
        return None
    if v < 5:
        return round(v * 100, 1)
    if v > 400:
        return round(v / 10, 1)
    return round(v, 1)


def ann_dir(root, sex):
    return os.path.join(root, "annotations", sex)


def img_dir(root, images, sex):
    return os.path.join(images or os.path.join(root, "synthetic_images", "200x200"), sex)


def inspect(root, images):
    for sex in ("female", "male"):
        anns = sorted(glob.glob(os.path.join(ann_dir(root, sex), "*.json")))
        imgs = sorted(glob.glob(os.path.join(img_dir(root, images, sex), "*")))
        print(f"[{sex}] annotations={len(anns)} images={len(imgs)}")
        if anns:
            print(f"  JSON đầu tiên: {os.path.basename(anns[0])}")
            print("  Nội dung:", json.dumps(json.load(open(anns[0], encoding="utf-8")), indent=2, ensure_ascii=False)[:800])
        if imgs:
            print("  Ảnh mẫu:", [os.path.basename(p) for p in imgs[:3]])


def build(root, images, out):
    rows = []
    for sex in ("female", "male"):
        label = "F" if sex == "female" else "M"
        for ann_path in sorted(glob.glob(os.path.join(ann_dir(root, sex), "*.json"))):
            data = json.load(open(ann_path, encoding="utf-8"))
            vals = {k: to_cm(find_measure(data, kws)) for k, kws in CM_KEYS.items()}
            if vals["bust"] is None or vals["waist"] is None or vals["hip"] is None:
                continue  # thiếu khóa -> bỏ (xem --inspect để chỉnh CM_KEYS)
            # anno "X_mesh_Y_anno.json" -> ảnh "X_mesh_Y.png"
            imgstem = re.sub(r"_anno\.json$", "", os.path.basename(ann_path))
            imgpath = os.path.join(img_dir(root, images, sex), imgstem + ".png")
            rows.append({
                "id": f"{label}_{imgstem}", "sex": label,
                "bust_cm": vals["bust"], "waist_cm": vals["waist"], "hip_cm": vals["hip"],
                "image": imgpath if os.path.exists(imgpath) else "",
                "source": "calvis",
            })
    cols = ["id", "sex", "bust_cm", "waist_cm", "hip_cm", "image", "source"]
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"Đã nạp {len(rows)} mẫu CALVIS -> {os.path.abspath(out)}")
    if rows:
        r = rows[0]
        print(f"Ví dụ: {r['id']} bust={r['bust_cm']} waist={r['waist_cm']} hip(pelvis)={r['hip_cm']} img={r['image']}")
    print("Lưu ý: kiểm tra đơn vị (--inspect) nếu số đo bất thường; hip ở đây là pelvis-level.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="đường dẫn tới CALVIS/dataset/cmu")
    ap.add_argument("--images", help="thư mục ảnh (mặc định <root>/synthetic_images/200x200)")
    ap.add_argument("--out", default="calvis_labels.csv")
    ap.add_argument("--inspect", action="store_true", help="xem cấu trúc JSON/ảnh trước khi nạp")
    a = ap.parse_args()
    if not os.path.isdir(a.root):
        raise SystemExit(f"Không thấy thư mục {a.root}")
    if a.inspect:
        inspect(a.root, a.images)
    else:
        build(a.root, a.images, a.out)


if __name__ == "__main__":
    main()

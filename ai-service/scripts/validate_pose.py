#!/usr/bin/env python3
"""
Giai đoạn 2 — Công cụ nghiệm thu Pose Estimation.
Chạy /pose của AI service trên tất cả ảnh trong một thư mục và báo cáo tỷ lệ phát hiện
người + độ tin cậy trung bình. Dùng để nghiệm thu đường "có người" trên ảnh thật.

KHÔNG chứa dữ liệu bên thứ ba — chỉ trỏ tới thư mục ảnh cục bộ (vd. bộ ảnh thật của nhóm
hoặc mẫu Kaggle Body Measurements). Thư mục ảnh KHÔNG được commit vào repo.

Chạy (service phải đang chạy ở --url):
  python validate_pose.py --dir "C:/path/to/images" --pattern front_img.jpg
  python validate_pose.py --dir ./samples            # mọi .jpg/.png
"""
import argparse
import glob
import json
import os
import urllib.request

IMG_EXT = (".jpg", ".jpeg", ".png")


def post_pose(url: str, path: str) -> dict:
    with open(path, "rb") as f:
        data = f.read()
    boundary = "----daln-pose-boundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{os.path.basename(path)}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        url.rstrip("/") + "/pose", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    return json.load(urllib.request.urlopen(req, timeout=60))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="thư mục chứa ảnh")
    ap.add_argument("--pattern", default=None, help="tên file cụ thể (vd front_img.jpg); mặc định: mọi ảnh")
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    args = ap.parse_args()

    if args.pattern:
        paths = sorted(glob.glob(os.path.join(args.dir, "**", args.pattern), recursive=True))
    else:
        paths = sorted(
            p for p in glob.glob(os.path.join(args.dir, "**", "*"), recursive=True)
            if p.lower().endswith(IMG_EXT)
        )
    if not paths:
        raise SystemExit(f"Không thấy ảnh trong {args.dir}")

    ok = 0
    confs = []
    for p in paths:
        try:
            d = post_pose(args.url, p)
        except Exception as e:  # noqa
            print(f"  [LỖI] {p}: {e}")
            continue
        status = d.get("status")
        if status == "OK":
            ok += 1
            confs.append(d.get("confidence", 0))
        print(f"  {os.path.relpath(p, args.dir):40} {status:22} "
              f"n_landmarks={len(d.get('landmarks', []))} conf={d.get('confidence')}")

    n = len(paths)
    mean_conf = sum(confs) / len(confs) if confs else 0
    print(f"\nTổng: {n} ảnh | phát hiện người: {ok}/{n} ({100*ok/n:.0f}%) | "
          f"độ tin cậy trung bình (OK): {mean_conf:.3f}")


if __name__ == "__main__":
    main()

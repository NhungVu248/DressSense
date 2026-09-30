#!/usr/bin/env python3
"""
Giai đoạn 7 - Đo độ trễ các endpoint AI service (/body-shape, /pose).
Chạy khi service đang chạy. Ảnh thử truyền qua --image (không commit ảnh vào repo).

Chạy:  python eval_latency.py --image "C:/path/front_img.jpg" --n 10
"""
import argparse
import json
import time
import urllib.request


def timeit(fn, n):
    ts = []
    for _ in range(n):
        t = time.perf_counter()
        fn()
        ts.append((time.perf_counter() - t) * 1000)
    ts.sort()
    return {"mean": sum(ts) / len(ts), "median": ts[len(ts) // 2], "max": ts[-1]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--image", help="ảnh toàn thân để đo /pose (tùy chọn)")
    ap.add_argument("--n", type=int, default=10)
    args = ap.parse_args()

    def bodyshape():
        d = json.dumps({"measurements": {"bust": 90, "waist": 66, "hip": 92}, "method": "ml"}).encode()
        urllib.request.urlopen(urllib.request.Request(
            args.url + "/body-shape", data=d, headers={"Content-Type": "application/json"})).read()

    print("Warm-up...")
    bodyshape()
    r = timeit(bodyshape, args.n)
    print(f"/body-shape (ml): mean {r['mean']:.1f}ms · median {r['median']:.1f}ms · max {r['max']:.1f}ms")

    if args.image:
        img = open(args.image, "rb").read()

        def pose():
            b = "----b"
            body = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="f.jpg"\r\n'
                    f'Content-Type: application/octet-stream\r\n\r\n').encode() + img + f"\r\n--{b}--\r\n".encode()
            urllib.request.urlopen(urllib.request.Request(
                args.url + "/pose", data=body,
                headers={"Content-Type": f"multipart/form-data; boundary={b}"})).read()

        pose()  # warm-up (nạp model)
        r = timeit(pose, args.n)
        print(f"/pose: mean {r['mean']:.1f}ms · median {r['median']:.1f}ms · max {r['max']:.1f}ms")


if __name__ == "__main__":
    main()

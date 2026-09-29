#!/usr/bin/env python3
"""
Tải bản công khai ANSUR II (2012 US Army Anthropometric Survey) về thư mục raw/
(được .gitignore - KHÔNG commit dữ liệu gốc của bên thứ ba).

Nguồn: bản redistribute công khai trên GitHub. ANSUR II là dữ liệu công khai của
US Army Natick Soldier RD&E Center, dùng được cho mục đích nghiên cứu/học thuật.

Chạy:  python download_ansur.py
"""
import os
import urllib.request

BASE = "https://raw.githubusercontent.com/senihberkay/US-Army-ANSUR-II/master"
FILES = {
    "ANSUR_II_FEMALE_Public.csv": f"{BASE}/ANSUR%20II%20FEMALE%20Public.csv",
    "ANSUR_II_MALE_Public.csv": f"{BASE}/ANSUR%20II%20MALE%20Public.csv",
}
RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "body_shape", "raw")


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    for name, url in FILES.items():
        dest = os.path.join(RAW_DIR, name)
        print(f"Tải {name} ...")
        urllib.request.urlretrieve(url, dest)
        print(f"  -> {os.path.abspath(dest)} ({os.path.getsize(dest)} bytes)")


if __name__ == "__main__":
    main()

# DressSense AI Service - FastAPI (MediaPipe + OpenCV + scikit-learn)
FROM python:3.11-slim

WORKDIR /app

# Thư viện hệ thống cho OpenCV / MediaPipe (libGL, glib)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Cài phụ thuộc Python trước (tận dụng cache layer)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Mã nguồn service (model joblib tùy chọn: thiếu thì tự fallback rule-based)
COPY app ./app

EXPOSE 8000

# Lắng nghe mọi interface để các container khác gọi được
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

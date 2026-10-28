#!/bin/sh
set -e

# Áp migration lên MySQL (idempotent - chỉ chạy migration chưa áp)
echo "[entrypoint] Áp Prisma migration (migrate deploy)..."
npx prisma migrate deploy

# Seed dữ liệu mẫu lần đầu: đặt SEED_ON_START=true trong .env.
# Các seed là upsert nên chạy lại không nhân đôi; lỗi 1 seed không chặn server.
if [ "${SEED_ON_START}" = "true" ]; then
  echo "[entrypoint] Seed dữ liệu mẫu..."
  npm run db:seed || true
  npm run db:seed:knowledge || true
  npm run db:seed:voucher || true
  npm run db:seed:seller2 || true
  npm run db:seed:promotion || true
  npm run db:seed:banner || true
fi

echo "[entrypoint] Khởi động API..."
exec "$@"

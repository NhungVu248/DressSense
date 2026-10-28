# DressSense API - Node/Express/Prisma (MySQL)
FROM node:20-slim

WORKDIR /app

# Prisma cần openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Cài phụ thuộc (gồm devDeps: prisma CLI + tsx để migrate deploy & seed)
COPY package*.json ./
RUN npm ci

# Sinh Prisma Client từ schema
COPY prisma ./prisma
RUN npx prisma generate

# Biên dịch TypeScript -> dist
COPY . .
RUN npm run build

# Entrypoint: chờ DB, áp migration (+ seed tùy chọn) rồi chạy server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]

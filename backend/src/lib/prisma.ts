import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient — tránh tạo nhiều kết nối khi hot-reload
export const prisma = new PrismaClient();

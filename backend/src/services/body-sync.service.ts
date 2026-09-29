import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC2.3 - ĐỒNG BỘ BODY PROFILE vào hồ sơ cá nhân hóa
//  Liên kết Body Profile mới nhất (UC3) vào CustomerProfile, kèm phiên
//  bản + thời điểm; lan truyền gợi ý size theo danh mục (UC2.2). Body
//  Profile là NGUỒN đề xuất size, quyết định cuối vẫn thuộc khách hàng:
//  không ghi đè các size khách hàng đã tự nhập (source = MANUAL).
// ============================================================

interface SuggestedSize {
  categoryId: number;
  sizeValue: string;
}

// Lỗi có mã để controller ánh xạ HTTP (2F)
export class NoBodyProfileError extends Error {
  code = 'NO_BODY_PROFILE';
  constructor() {
    super('NO_BODY_PROFILE');
  }
}

// Bước 2-4 - Trạng thái/xem trước đồng bộ
export async function getBodySyncStatus(userId: number) {
  const [profile, latest] = await Promise.all([
    prisma.customerProfile.findUnique({
      where: { userId },
      select: { bodyProfileId: true, bodyProfileSyncedAt: true, bodyProfileAutoSync: true },
    }),
    prisma.bodyProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    hasBodyProfile: !!latest, // 2F nếu false
    autoSync: profile?.bodyProfileAutoSync ?? false,
    synced: profile?.bodyProfileId
      ? { bodyProfileId: profile.bodyProfileId, syncedAt: profile.bodyProfileSyncedAt }
      : null,
    // cần đồng bộ nếu bản mới nhất khác bản đã đồng bộ
    needsSync: !!latest && latest.id !== profile?.bodyProfileId,
    latest: latest
      ? {
          id: latest.id,
          version: latest.version,
          bodyShape: latest.bodyShape,
          suggestedSizes: (latest.suggestedSizes as SuggestedSize[] | null) ?? [],
          createdAt: latest.createdAt,
        }
      : null,
  };
}

// Bước 5-8 - Thực hiện đồng bộ (được KH xác nhận, hoặc tự động khi bật autoSync - 2a)
export async function syncBodyProfile(userId: number) {
  // 2F - chưa tồn tại Body Profile
  const latest = await prisma.bodyProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (!latest) throw new NoBodyProfileError();

  // 6E - bọc transaction: ghi lỗi thì rollback, giữ nguyên bản đồng bộ trước
  return prisma.$transaction(async (tx) => {
    const profile = await tx.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    // Bước 6 - liên kết bản mới nhất + thời điểm đồng bộ (version lấy qua bodyProfile.version)
    await tx.customerProfile.update({
      where: { id: profile.id },
      data: { bodyProfileId: latest.id, bodyProfileSyncedAt: new Date() },
    });

    // Bước 7 - lan truyền sang UC2.2: đề xuất size theo danh mục từ Body Profile,
    // KHÔNG ghi đè size khách hàng đã tự nhập (source = MANUAL)
    const suggested = (latest.suggestedSizes as SuggestedSize[] | null) ?? [];
    let appliedSizes = 0;
    for (const s of suggested) {
      const existing = await tx.customerSize.findUnique({
        where: { profileId_categoryId: { profileId: profile.id, categoryId: s.categoryId } },
      });
      if (existing && existing.source === 'MANUAL') continue; // tôn trọng quyết định của KH
      await tx.customerSize.upsert({
        where: { profileId_categoryId: { profileId: profile.id, categoryId: s.categoryId } },
        update: { sizeSystem: 'STANDARD', sizeValue: s.sizeValue, measurements: Prisma.JsonNull, source: 'BODY_PROFILE' },
        create: { profileId: profile.id, categoryId: s.categoryId, sizeSystem: 'STANDARD', sizeValue: s.sizeValue, source: 'BODY_PROFILE' },
      });
      appliedSizes++;
    }

    return { bodyProfileId: latest.id, version: latest.version, syncedAt: new Date(), appliedSizes };
  });
}

// Khách hàng bật/tắt chế độ tự đồng bộ (2a)
export async function setBodyAutoSync(userId: number, enabled: boolean) {
  const profile = await prisma.customerProfile.upsert({
    where: { userId },
    update: { bodyProfileAutoSync: enabled },
    create: { userId, bodyProfileAutoSync: enabled },
  });
  return { autoSync: profile.bodyProfileAutoSync };
}

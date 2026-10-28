import { prisma } from '../lib/prisma';

// UC12.4 - tạo thông báo cho khách (fire-and-forget: lỗi không ảnh hưởng nghiệp vụ chính - 3E)
type NotifType = 'ORDER' | 'PAYMENT' | 'RETURN' | 'COMPLAINT' | 'REVIEW' | 'QA' | 'PROMO' | 'SUGGEST' | 'SHOP';

export async function notify(userId: number, type: NotifType, title: string, content: string, link?: string) {
  try {
    await prisma.notification.create({ data: { userId, type, title, content, link: link ?? null } });
  } catch {
    /* ghi nhận thất bại nhưng không chặn luồng chính */
  }
}

// Seed HOẠT ĐỘNG mẫu: phân tích nhãn dáng SP, đơn hàng đủ trạng thái/PT thanh toán/nhiều shop,
// đánh giá (+phản hồi người bán), hỏi đáp, hội thoại chat, thông báo.
// Idempotent: đơn mẫu có mã DSSEEDxxxx; đã tồn tại thì bỏ qua phần tạo đơn/đánh giá. Chạy: npm run db:seed:activity
import { PrismaClient, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { analyzeMany } from '../src/services/product-analysis.service';
import { generateOrderCommissions } from '../src/services/commission.service';
import { prisma as libPrisma } from '../src/lib/prisma';

const prisma = new PrismaClient();
const DAY = 86400000;
const ago = (d: number, h = 0) => new Date(Date.now() - d * DAY + h * 3600000);

const ADDR = [
  { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Phường Tân Phú', addressDetail: '12 Nguyễn Lương Bằng' },
  { province: 'Hà Nội', district: 'Quận Thanh Xuân', ward: 'Phường Nhân Chính', addressDetail: '88 Lê Văn Lương' },
  { province: 'Đà Nẵng', district: 'Quận Sơn Trà', ward: 'Phường An Hải Bắc', addressDetail: '5 Võ Nguyên Giáp' },
  { province: 'Cần Thơ', district: 'Quận Cái Răng', ward: 'Phường Lê Bình', addressDetail: '21 Nguyễn Văn Linh' },
  { province: 'Hải Phòng', district: 'Quận Lê Chân', ward: 'Phường An Dương', addressDetail: '9 Nguyễn Văn Linh' },
];

const COMMENTS: Record<number, string[]> = {
  5: ['Sản phẩm rất đẹp, đúng mô tả, giao nhanh. Sẽ ủng hộ shop tiếp!', 'Chất vải mát, form chuẩn, mặc lên rất tôn dáng.', 'Đóng gói cẩn thận, shop tư vấn nhiệt tình. 10 điểm!'],
  4: ['Đẹp, màu hơi khác ảnh một chút nhưng vẫn ưng.', 'Chất lượng ổn so với giá, giao hơi chậm.'],
  3: ['Tạm ổn, form hơi rộng so với bảng size.'],
  2: ['Vải mỏng hơn mong đợi, đường chỉ chưa gọn.'],
  1: ['Hàng không giống mô tả, rất thất vọng.'],
};
const REPLIES = ['Cảm ơn bạn đã ủng hộ shop ạ ❤️ Hẹn gặp lại bạn ở đơn sau!', 'Shop xin ghi nhận góp ý và sẽ cải thiện thêm. Cảm ơn bạn!', 'Cảm ơn bạn đã tin tưởng, chúc bạn mặc đẹp nhé!'];

// kịch bản đơn: trạng thái + thanh toán
type Scn = { status: OrderStatus; pm: PaymentMethod; pay: PaymentStatus; daysAgo: number };
const SCENARIOS: Scn[] = [
  { status: 'COMPLETED', pm: 'COD', pay: 'PAID', daysAgo: 40 },
  { status: 'COMPLETED', pm: 'VNPAY', pay: 'PAID', daysAgo: 35 },
  { status: 'COMPLETED', pm: 'VISA', pay: 'PAID', daysAgo: 28 },
  { status: 'COMPLETED', pm: 'COD', pay: 'PAID', daysAgo: 22 },
  { status: 'COMPLETED', pm: 'VNPAY', pay: 'PAID', daysAgo: 15 },
  { status: 'DELIVERED', pm: 'COD', pay: 'UNPAID', daysAgo: 4 },
  { status: 'SHIPPING', pm: 'VNPAY', pay: 'PAID', daysAgo: 3 },
  { status: 'SHIPPING', pm: 'COD', pay: 'UNPAID', daysAgo: 2 },
  { status: 'PREPARING', pm: 'VISA', pay: 'PAID', daysAgo: 2 },
  { status: 'CONFIRMED', pm: 'COD', pay: 'UNPAID', daysAgo: 1 },
  { status: 'PENDING', pm: 'COD', pay: 'UNPAID', daysAgo: 0 },
  { status: 'PENDING', pm: 'VNPAY', pay: 'PAID', daysAgo: 0 },
  { status: 'AWAITING_PAYMENT', pm: 'VNPAY', pay: 'PENDING', daysAgo: 0 },
  { status: 'CANCELLED', pm: 'COD', pay: 'CANCELLED', daysAgo: 10 },
  { status: 'CANCELLED', pm: 'VNPAY', pay: 'REFUNDED', daysAgo: 8 },
];

async function main() {
  // 1) Phân tích nhãn dáng cho toàn bộ SP (UC4.1) - SP đã phân tích sẽ được cập nhật lại, an toàn.
  const r = await analyzeMany();
  console.log(`[activity] Phân tích nhãn dáng: ${r.analyzed}/${r.total} sản phẩm.`);

  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER', status: 'ACTIVE' }, orderBy: { id: 'asc' }, take: 8 });
  const shops = await prisma.shop.findMany({ where: { status: 'ACTIVE' }, select: { ownerId: true, name: true } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!customers.length || !shops.length) { console.log('[activity] Thiếu khách hàng/gian hàng - chạy seed-sellers trước.'); return; }

  // Sản phẩm ACTIVE theo shop (có biến thể)
  const prodsBy = new Map<number, any[]>();
  for (const sh of shops) {
    const ps = await prisma.product.findMany({ where: { sellerId: sh.ownerId, status: 'ACTIVE', deletedAt: null }, include: { variants: true }, take: 12 });
    if (ps.length) prodsBy.set(sh.ownerId, ps);
  }
  const sellerIds = [...prodsBy.keys()];

  // 2) Đơn hàng
  let orders = 0, reviews = 0, notifs = 0;
  const completed: { orderId: number; customerId: number; sellerId: number; items: any[] }[] = [];
  let seq = 0;
  for (const cust of customers) {
    for (let k = 0; k < 3; k++) {
      const scn = SCENARIOS[seq % SCENARIOS.length];
      const code = `DSSEED${String(++seq).padStart(4, '0')}`;
      const existing = await prisma.order.findUnique({ where: { code }, include: { items: true } });
      const sellerId = sellerIds[(seq + k) % sellerIds.length];
      if (existing) {
        if (existing.status === 'COMPLETED') completed.push({ orderId: existing.id, customerId: cust.id, sellerId: existing.sellerId ?? sellerId, items: existing.items });
        continue;
      }
      const pool = prodsBy.get(sellerId)!;
      const n = 1 + (seq % 3);
      const picks = Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(seq + i * 2) % pool.length]);
      const uniq = [...new Map(picks.map((p) => [p.id, p])).values()];
      const lines = uniq.map((p, i) => { const v = p.variants[(seq + i) % Math.max(1, p.variants.length)]; return { p, v, qty: 1 + ((seq + i) % 2) }; });
      const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
      const discount = seq % 4 === 0 ? Math.round(subtotal * 0.1) : 0;
      const shippingFee = subtotal >= 500000 ? 0 : 25000;
      const total = subtotal - discount + shippingFee;
      const addr = ADDR[seq % ADDR.length];
      const created = ago(scn.daysAgo, -(seq % 5));
      const t = (d: number) => new Date(created.getTime() + d * DAY);
      const st = scn.status;
      const order = await prisma.order.create({
        data: {
          code, userId: cust.id, sellerId, status: st, recipientName: cust.fullName, phone: cust.phone ?? '0912000000', ...addr,
          subtotal, discount, voucherCode: discount ? 'WELCOME10' : null, shippingFee, total,
          paymentMethod: scn.pm, paymentStatus: scn.pay, paidAt: scn.pay === 'PAID' || scn.pay === 'REFUNDED' ? created : null,
          carrier: ['SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st) ? ['GHN', 'GHTK', 'Viettel Post'][seq % 3] : null,
          trackingNumber: ['SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st) ? `VN${100000 + seq * 7919}` : null,
          estimatedDelivery: ['SHIPPING', 'PREPARING'].includes(st) ? t(3) : null,
          confirmedAt: ['CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st) ? t(0.2) : null,
          shippedAt: ['SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st) ? t(1) : null,
          deliveredAt: ['DELIVERED', 'COMPLETED'].includes(st) ? t(3) : null,
          completedAt: st === 'COMPLETED' ? t(5) : null,
          cancelledAt: st === 'CANCELLED' ? t(0.5) : null,
          cancelledBy: st === 'CANCELLED' ? 'CUSTOMER' : null,
          cancelReason: st === 'CANCELLED' ? 'Tôi muốn đổi sản phẩm khác' : null,
          refundStatus: scn.pay === 'REFUNDED' ? 'DONE' : null,
          createdAt: created,
          items: { create: lines.map((l) => ({ productId: l.p.id, variantId: l.v?.id ?? null, name: l.p.name, size: l.v?.size ?? null, quantity: l.qty, price: l.p.price })) },
          ...(scn.pm !== 'COD' && scn.pay !== 'UNPAID'
            ? { payments: { create: [{ code: `${code}-P`, method: scn.pm, amount: total, status: scn.pay === 'REFUNDED' ? 'PAID' : scn.pay, providerRef: scn.pay === 'PENDING' ? null : `${14000000 + seq}`, bankCode: scn.pm === 'VISA' ? 'INTCARD' : 'NCB', cardLast4: scn.pm === 'VISA' ? '1111' : null, responseCode: scn.pay === 'PENDING' ? null : '00', createdAt: created, paidAt: scn.pay === 'PENDING' ? null : created }] } }
            : {}),
        },
        include: { items: true },
      });
      orders++;
      if (st === 'COMPLETED') {
        await generateOrderCommissions(prisma, order.id);
        completed.push({ orderId: order.id, customerId: cust.id, sellerId, items: order.items });
      }
      await prisma.notification.create({ data: { userId: cust.id, type: 'ORDER', title: `Đơn ${code}`, content: `Đơn hàng ${code} hiện ở trạng thái ${st}.`, link: `/orders/${order.id}`, read: st === 'COMPLETED', createdAt: created } });
      await prisma.notification.create({ data: { userId: sellerId, type: 'ORDER', title: 'Đơn hàng mới', content: `Bạn có đơn hàng mới ${code} (${total.toLocaleString('vi-VN')}₫).`, link: `/manage/orders`, read: st !== 'PENDING', createdAt: created } });
      notifs += 2;
    }
  }

  // 3) Đánh giá cho đơn COMPLETED (đa dạng sao, có phản hồi người bán, 1 đánh giá bị ẩn)
  let ri = 0;
  for (const c of completed) {
    for (const it of c.items) {
      if (await prisma.review.findFirst({ where: { orderId: c.orderId, productId: it.productId } })) continue;
      ri++;
      const rating = [5, 5, 4, 5, 3, 4, 5, 2, 5, 1][ri % 10];
      const list = COMMENTS[rating];
      const replied = rating <= 3 || ri % 2 === 0;
      await prisma.review.create({
        data: {
          productId: it.productId, userId: c.customerId, orderId: c.orderId, rating, comment: list[ri % list.length],
          images: ri % 3 === 0 ? ['https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80&auto=format&fit=crop'] : undefined,
          sellerReply: replied ? REPLIES[ri % REPLIES.length] : null, sellerReplyAt: replied ? ago(2) : null,
          status: rating === 1 ? 'HIDDEN' : 'VISIBLE', createdAt: ago(5 + (ri % 10)),
        },
      });
      reviews++;
    }
  }

  // 4) Hỏi đáp sản phẩm (một số đã trả lời)
  let qas = 0;
  if ((await prisma.productQuestion.count({ where: { question: { startsWith: '[seed]' } } })) === 0) {
    const QS = [['Shop ơi sản phẩm này có size nào cho người 55kg, cao 1m60 ạ?', 'Chào bạn, với 55kg/1m60 bạn nên chọn size M nhé!'], ['Chất vải có bị nhăn khi giặt máy không shop?', 'Vải có độ co giãn tốt, giặt máy chế độ nhẹ là ổn ạ.'], ['Còn hàng màu khác không ạ?', null], ['Bao lâu thì nhận được hàng ở Cần Thơ vậy shop?', 'Dạ khoảng 2–3 ngày làm việc ạ.']];
    for (let i = 0; i < QS.length * 2; i++) {
      const [q, a] = QS[i % QS.length];
      const sid = sellerIds[i % sellerIds.length];
      const p = prodsBy.get(sid)![i % prodsBy.get(sid)!.length];
      await prisma.productQuestion.create({ data: { productId: p.id, userId: customers[i % customers.length].id, question: `[seed] ${q}`, answer: a, answeredBy: a ? sid : null, answeredAt: a ? ago(1) : null, createdAt: ago(3 + i) } });
      qas++;
    }
  }

  // 5) Hội thoại chat (khách↔người bán, khách↔CSKH)
  let convs = 0;
  if ((await prisma.message.count({ where: { content: { startsWith: 'Shop ơi mẫu này còn size M' } } })) === 0) {
    const mk = async (type: 'SELLER' | 'ADMIN', customerId: number, sellerId: number | null, msgs: [boolean, string][], unread: boolean) => {
      const cv = await prisma.conversation.create({ data: { type, customerId, sellerId, createdAt: ago(2), lastMessageAt: ago(0, -1), customerReadAt: unread ? null : new Date(), partnerReadAt: new Date() } });
      for (let i = 0; i < msgs.length; i++) await prisma.message.create({ data: { conversationId: cv.id, senderId: msgs[i][0] ? customerId : (sellerId ?? admin?.id ?? customerId), content: msgs[i][1], createdAt: ago(2, i) } });
      convs++;
    };
    for (let i = 0; i < Math.min(customers.length, 4); i++) {
      const sid = sellerIds[i % sellerIds.length];
      await mk('SELLER', customers[i].id, sid, [[true, 'Shop ơi mẫu này còn size M không ạ?'], [false, 'Dạ còn bạn nhé, bạn đặt luôn để shop giữ hàng ạ.'], [true, 'Mình có thể đổi size nếu không vừa không shop?']], i % 2 === 0);
    }
    await mk('ADMIN', customers[0].id, null, [[true, 'Cho mình hỏi đơn hàng của mình bị chậm giao ạ.'], [false, 'DressSense xin lỗi vì sự bất tiện, bộ phận CSKH đang kiểm tra với đơn vị vận chuyển và sẽ phản hồi bạn sớm.']], false);
    if (customers[1]) await mk('ADMIN', customers[1].id, null, [[true, 'Làm sao để xuất hóa đơn VAT cho đơn hàng ạ?']], true);
  }

  console.log(`[activity] ${orders} đơn mới (đủ trạng thái, COD/VNPAY/VISA, ${sellerIds.length} gian hàng), ${reviews} đánh giá, ${qas} hỏi đáp, ${convs} hội thoại, ${notifs} thông báo.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); await libPrisma.$disconnect(); });

// Seed ĐỔI/TRẢ, KHIẾU NẠI, SỰ CỐ GIAO HÀNG, HOÀN TIỀN mẫu (UC11) trên các đơn DSSEED (chạy sau seed-activity).
// Idempotent: mã yêu cầu dạng RTSEEDxx / CPSEEDxx; đã có thì bỏ qua. Chạy: npm run db:seed:returns
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 86400000;
const ago = (d: number) => new Date(Date.now() - d * DAY);

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  const byStatus = async (status: any, take: number) =>
    prisma.order.findMany({ where: { code: { startsWith: 'DSSEED' }, status }, include: { items: true }, orderBy: { id: 'asc' }, take });
  const done = await byStatus('COMPLETED', 12);
  const delivered = await byStatus('DELIVERED', 3);
  const shipping = await byStatus('SHIPPING', 4);
  if (done.length < 5) { console.log('[returns] Thiếu đơn DSSEED - chạy db:seed:activity trước.'); return; }

  const notify = (userId: number, type: 'RETURN' | 'COMPLAINT' | 'PAYMENT' | 'ORDER', title: string, content: string, link: string) =>
    prisma.notification.create({ data: { userId, type, title, content, link, createdAt: ago(1) } });

  // ---------- Đổi/Trả (UC11.1) ----------
  type R = { type: 'RETURN' | 'EXCHANGE'; status: any; reason: string; desc: string; size?: string; note?: string; reply?: string };
  const RET: R[] = [
    { type: 'RETURN', status: 'PENDING', reason: 'Sản phẩm không đúng mô tả', desc: 'Màu thực tế đậm hơn nhiều so với ảnh trên shop.' },
    { type: 'EXCHANGE', status: 'APPROVED', reason: 'Không vừa size', desc: 'Mình mặc size M hơi chật, muốn đổi sang size L.', size: 'L', reply: 'Shop đồng ý đổi, bạn gửi hàng về địa chỉ lấy hàng giúp shop nhé.' },
    { type: 'RETURN', status: 'REJECTED', reason: 'Đổi ý không muốn mua', desc: 'Mình không thích nữa.', note: 'Sản phẩm đã qua sử dụng/giặt, không đủ điều kiện đổi trả.' },
    { type: 'RETURN', status: 'COMPLETED', reason: 'Sản phẩm bị lỗi', desc: 'Đường chỉ bung ở nách áo, có ảnh đính kèm.', reply: 'Shop xin lỗi bạn, đã nhận hàng hoàn và tiến hành hoàn tiền.' },
    { type: 'EXCHANGE', status: 'COMPLETED', reason: 'Giao sai màu', desc: 'Mình đặt màu be nhưng nhận được màu kem.', size: 'M', reply: 'Shop đã gửi lại đúng màu cho bạn.' },
    { type: 'RETURN', status: 'CANCELLED', reason: 'Không vừa size', desc: 'Khách tự hủy yêu cầu sau khi thử lại.' },
  ];
  let rets = 0, refunds = 0;
  for (let i = 0; i < RET.length; i++) {
    const code = `RTSEED${String(i + 1).padStart(2, '0')}`;
    if (await prisma.returnRequest.findUnique({ where: { code } })) continue;
    const o = done[i], r = RET[i], it = o.items[0];
    const refundAmount = r.type === 'RETURN' ? it.price * it.quantity : null;
    const resolved = ['APPROVED', 'REJECTED', 'COMPLETED'].includes(r.status);
    const req = await prisma.returnRequest.create({
      data: {
        code, orderId: o.id, userId: o.userId, type: r.type, reason: r.reason, description: r.desc, exchangeSize: r.size ?? null,
        evidence: r.status === 'PENDING' || r.status === 'COMPLETED' ? 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80&auto=format&fit=crop' : null,
        status: r.status, sellerNote: r.note ?? null, sellerReply: r.reply ?? null, refundAmount,
        createdAt: ago(8 - i), resolvedAt: resolved ? ago(5 - i * 0.5) : null,
        items: { create: [{ orderItemId: it.id, quantity: it.quantity }] },
      },
    });
    rets++;
    // Hoàn tiền mô phỏng (UC11.4) cho yêu cầu TRẢ đã hoàn tất
    if (r.type === 'RETURN' && r.status === 'COMPLETED' && refundAmount) {
      const orig = await prisma.paymentTransaction.findFirst({ where: { orderId: o.id, kind: 'PAYMENT' } });
      await prisma.paymentTransaction.create({
        data: { code: `${code}-RF`, orderId: o.id, kind: 'REFUND', method: o.paymentMethod, amount: refundAmount, status: 'PAID', refundOfId: orig?.id ?? null, message: 'Hoàn tiền mô phỏng cho yêu cầu trả hàng', createdAt: ago(4), paidAt: ago(4) },
      });
      refunds++;
    }
    const link = `/orders/${o.id}`;
    await notify(o.userId, 'RETURN', `Yêu cầu ${r.type === 'RETURN' ? 'trả hàng' : 'đổi hàng'} ${code}`, `Yêu cầu của bạn đang ở trạng thái ${r.status}.`, link);
    if (o.sellerId) await notify(o.sellerId, 'RETURN', 'Yêu cầu đổi/trả mới', `Đơn ${o.code} có yêu cầu ${r.type === 'RETURN' ? 'trả' : 'đổi'} hàng (${code}).`, '/manage/orders');
  }

  // ---------- Khiếu nại (UC11.2): khách → người bán → admin ----------
  type C = { type: string; content: string; status: any; proposal?: string; decision?: string; escalated?: boolean };
  const CMP: C[] = [
    { type: 'Chất lượng sản phẩm', content: 'Vải bị xù lông sau 1 lần giặt, không đúng chất lượng cam kết.', status: 'PENDING' },
    { type: 'Giao hàng', content: 'Đơn giao thiếu 1 sản phẩm so với đơn đặt.', status: 'SELLER_RESPONDED', proposal: 'Shop sẽ gửi bù sản phẩm còn thiếu trong 2 ngày hoặc hoàn tiền phần thiếu.' },
    { type: 'Sai mô tả', content: 'Sản phẩm khác hoàn toàn ảnh quảng cáo.', status: 'RESOLVED', proposal: 'Shop hoàn 50% giá trị đơn để khách giữ sản phẩm.' },
    { type: 'Thái độ phục vụ', content: 'Shop không trả lời tin nhắn và không hỗ trợ đổi size.', status: 'ESCALATED', proposal: 'Shop cho rằng đã hướng dẫn đúng chính sách.', escalated: true },
    { type: 'Hàng giả/nhái', content: 'Nghi ngờ sản phẩm không phải hàng chính hãng như shop quảng cáo.', status: 'ADMIN_RESOLVED', proposal: 'Shop khẳng định hàng chính hãng.', decision: 'Admin xác minh chứng từ: yêu cầu shop hoàn tiền 100% và nhắc nhở vi phạm lần 1.', escalated: true },
    { type: 'Khác', content: 'Yêu cầu không đủ căn cứ.', status: 'REJECTED' },
  ];
  let cps = 0;
  const pool = [...done.slice(6), ...delivered];
  for (let i = 0; i < CMP.length; i++) {
    const code = `CPSEED${String(i + 1).padStart(2, '0')}`;
    if (await prisma.complaint.findUnique({ where: { code } })) continue;
    const o = pool[i % pool.length] ?? done[i], c = CMP[i];
    const resolved = ['RESOLVED', 'ADMIN_RESOLVED', 'REJECTED'].includes(c.status);
    await prisma.complaint.create({
      data: {
        code, orderId: o.id, userId: o.userId, type: c.type, content: c.content, status: c.status,
        evidence: i % 2 === 0 ? 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80&auto=format&fit=crop' : null,
        sellerProposal: c.proposal ?? null, adminDecision: c.decision ?? null, handledBy: c.decision ? admin?.id ?? null : null,
        createdAt: ago(9 - i), escalatedAt: c.escalated ? ago(5) : null, resolvedAt: resolved ? ago(2) : null,
      },
    });
    cps++;
    await notify(o.userId, 'COMPLAINT', `Khiếu nại ${code}`, `Khiếu nại của bạn đang ở trạng thái ${c.status}.`, `/orders/${o.id}`);
    if (o.sellerId) await notify(o.sellerId, 'COMPLAINT', 'Khiếu nại mới', `Đơn ${o.code} có khiếu nại (${code}) cần phản hồi.`, '/manage/orders');
    if (c.escalated && admin) await notify(admin.id, 'COMPLAINT', 'Khiếu nại chuyển Admin', `Khiếu nại ${code} cần phân xử.`, '/admin');
  }

  // ---------- Sự cố giao hàng (UC11.3) ----------
  type I = { type: 'LATE' | 'FAILED' | 'LOST'; note: string; resolution?: string };
  const INC: I[] = [
    { type: 'LATE', note: 'Đơn vị vận chuyển báo trễ do thời tiết xấu.', resolution: 'UPDATE_ETA' },
    { type: 'FAILED', note: 'Giao thất bại lần 1: khách không nghe máy.', resolution: 'REDELIVER' },
    { type: 'LOST', note: 'Bưu kiện thất lạc tại kho trung chuyển.', resolution: 'LOST_REFUND' },
    { type: 'LATE', note: 'Quá thời gian giao dự kiến 3 ngày, chưa xử lý.' },
  ];
  let incs = 0;
  for (let i = 0; i < Math.min(INC.length, shipping.length); i++) {
    const o = shipping[i], n = INC[i];
    if (await prisma.deliveryIncident.findFirst({ where: { orderId: o.id, type: n.type } })) continue;
    await prisma.deliveryIncident.create({ data: { orderId: o.id, type: n.type, note: n.note, resolution: n.resolution ?? null, createdAt: ago(2), resolvedAt: n.resolution ? ago(1) : null } });
    incs++;
    await notify(o.userId, 'ORDER', `Sự cố giao hàng đơn ${o.code}`, n.note, `/orders/${o.id}`);
  }

  console.log(`[returns] ${rets} yêu cầu đổi/trả, ${refunds} giao dịch hoàn tiền, ${cps} khiếu nại, ${incs} sự cố giao hàng.`);
}

main().catch((e: Prisma.PrismaClientKnownRequestError | Error) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

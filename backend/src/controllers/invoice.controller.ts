import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getStringSetting } from '../services/settings.service';
import { sendMail, MailNotConfiguredError } from '../services/mail.service';
import { renderInvoiceHtml } from '../services/invoice-html';

// ============================================================
//  Backlog (Khách hàng) - Xuất hóa đơn VAT cho đơn đã nhận.
//  Giá bán là giá CUỐI (đã gồm thuế); hóa đơn tách phần chưa thuế + VAT.
// ============================================================

const issueSchema = z.object({
  buyerName: z.string().trim().min(1, 'Vui lòng nhập tên người/đơn vị mua.'),
  buyerAddress: z.string().trim().min(1, 'Vui lòng nhập địa chỉ xuất hóa đơn.'),
  buyerTaxCode: z.string().trim().optional(),
  buyerEmail: z.string().trim().email('Email không hợp lệ.').optional().or(z.literal('')),
  note: z.string().trim().optional(),
  sendEmail: z.boolean().optional(), // true = gửi thẳng hóa đơn về email người mua
});

// Gửi hóa đơn (HTML đính kèm + nội dung thư) tới email người mua.
// Trả { sent, message } thay vì ném lỗi, để không chặn việc xuất hóa đơn.
async function trySendInvoiceEmail(order: any, invoice: any): Promise<{ sent: boolean; message: string }> {
  const to = invoice.buyerEmail as string | null;
  if (!to) return { sent: false, message: 'Hóa đơn chưa có email người mua để gửi.' };
  try {
    const company = await loadCompany();
    const html = renderInvoiceHtml(company, invoice, breakdownOf(order), {
      code: order.code, createdAt: order.createdAt, recipientName: order.recipientName, phone: order.phone,
      items: order.items.map((it: any) => ({ name: it.name, size: it.size, quantity: it.quantity, price: it.price })),
    });
    await sendMail({
      to,
      subject: `Hóa đơn điện tử đơn hàng ${order.code} - ${company.name}`,
      html,
      attachments: [{ filename: `HoaDon-${order.code}.html`, content: html, contentType: 'text/html; charset=utf-8' }],
    });
    return { sent: true, message: `Đã gửi hóa đơn tới ${to}.` };
  } catch (err) {
    if (err instanceof MailNotConfiguredError) {
      return { sent: false, message: 'Máy chủ chưa cấu hình gửi email (SMTP). Vui lòng cấu hình SMTP_* trong .env.' };
    }
    return { sent: false, message: 'Gửi email thất bại. Vui lòng thử lại sau.' };
  }
}

async function loadCompany() {
  return {
    name: await getStringSetting('invoiceCompanyName', 'DressSense'),
    taxCode: await getStringSetting('invoiceTaxCode', ''),
    address: await getStringSetting('invoiceAddress', ''),
  };
}

function breakdownOf(o: { subtotal: number; discount: number; shippingFee: number; total: number; taxRate: number; taxAmount: number }) {
  return {
    goodsBeforeTax: o.subtotal - o.taxAmount, // tiền hàng chưa thuế
    taxRate: o.taxRate,
    taxAmount: o.taxAmount, // thuế VAT (đã nằm trong subtotal)
    subtotal: o.subtotal, // tiền hàng đã gồm thuế
    discount: o.discount,
    shippingFee: o.shippingFee,
    total: o.total,
  };
}

// Đơn phải thuộc khách + đã giao/đã nhận mới được xuất hóa đơn.
async function loadOwnedOrder(id: number, userId: number) {
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: true, invoice: true },
  });
  if (!order) return { ok: false as const, code: 404, message: 'Không tìm thấy đơn hàng.' };
  if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
    return { ok: false as const, code: 400, message: 'Chỉ xuất hóa đơn cho đơn đã giao/đã nhận.' };
  }
  return { ok: true as const, order };
}

// POST /api/orders/:id/invoice - xuất (hoặc xuất lại) hóa đơn VAT
export async function issueInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dữ liệu hóa đơn không hợp lệ.' });
    const r = await loadOwnedOrder(Number(req.params.id), req.user!.userId);
    if (!r.ok) return res.status(r.code).json({ message: r.message });

    const data = {
      buyerName: parsed.data.buyerName,
      buyerAddress: parsed.data.buyerAddress,
      buyerTaxCode: parsed.data.buyerTaxCode || null,
      buyerEmail: parsed.data.buyerEmail || null,
      note: parsed.data.note || null,
    };
    // Xuất lần 2: cập nhật thông tin + tăng số lần (xử lý trường hợp lần 1 lỗi)
    const invoice = r.order.invoice
      ? await prisma.invoice.update({ where: { orderId: r.order.id }, data: { ...data, issueCount: { increment: 1 } } })
      : await prisma.invoice.create({ data: { orderId: r.order.id, ...data } });

    // Gửi thẳng hóa đơn về email nếu khách chọn (không chặn việc xuất)
    const email = parsed.data.sendEmail ? await trySendInvoiceEmail(r.order, invoice) : null;

    res.status(201).json({ invoice, company: await loadCompany(), breakdown: breakdownOf(r.order), email });
  } catch (err) { next(err); }
}

// POST /api/orders/:id/invoice/email - gửi lại hóa đơn đã xuất về email người mua
export async function emailInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await loadOwnedOrder(Number(req.params.id), req.user!.userId);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    if (!r.order.invoice) return res.status(404).json({ message: 'Chưa xuất hóa đơn cho đơn này.', code: 'NO_INVOICE' });
    const result = await trySendInvoiceEmail(r.order, r.order.invoice);
    if (!result.sent) return res.status(400).json({ message: result.message });
    res.json({ ok: true, message: result.message });
  } catch (err) { next(err); }
}

// GET /api/orders/:id/invoice - dữ liệu hóa đơn để hiển thị/in
export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await loadOwnedOrder(Number(req.params.id), req.user!.userId);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    if (!r.order.invoice) return res.status(404).json({ message: 'Chưa xuất hóa đơn cho đơn này.', code: 'NO_INVOICE' });

    const { invoice, items, code, createdAt, recipientName, phone, voucherCode } = r.order;
    res.json({
      invoice,
      company: await loadCompany(),
      breakdown: breakdownOf(r.order),
      order: {
        code, createdAt, recipientName, phone, voucherCode,
        items: items.map((it) => ({ name: it.name, size: it.size, quantity: it.quantity, price: it.price })),
      },
    });
  } catch (err) { next(err); }
}

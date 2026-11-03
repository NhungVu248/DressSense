// Dựng HTML hóa đơn VAT tự chứa (dùng cho email đính kèm + nội dung thư).
// Khách mở bằng trình duyệt rồi in/lưu PDF; tránh phụ thuộc thư viện PDF + lỗi font tiếng Việt.

export interface InvoiceCompany { name: string; taxCode: string; address: string }
export interface InvoiceData {
  buyerName: string; buyerTaxCode: string | null; buyerAddress: string; buyerEmail: string | null;
  note: string | null; issueCount: number; issuedAt: Date | string;
}
export interface InvoiceBreakdown {
  goodsBeforeTax: number; taxRate: number; taxAmount: number; subtotal: number; discount: number; shippingFee: number; total: number;
}
export interface InvoiceOrder {
  code: string; createdAt: Date | string; recipientName: string; phone: string;
  items: { name: string | null; size: string | null; quantity: number; price: number }[];
}

const vnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dmy = (d: Date | string) => new Date(d).toLocaleDateString('vi-VN');

export function renderInvoiceHtml(company: InvoiceCompany, invoice: InvoiceData, b: InvoiceBreakdown, order: InvoiceOrder): string {
  const rows = order.items.map((it, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(it.name)}${it.size ? ` <span style="color:#888">(Size ${esc(it.size)})</span>` : ''}</td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">${vnd(it.price)}</td>
        <td style="text-align:right">${vnd(it.price * it.quantity)}</td>
      </tr>`).join('');

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn ${esc(order.code)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#222;max-width:720px;margin:24px auto;padding:0 16px;font-size:14px}
  h1{font-size:22px;margin:0 0 4px;color:#5c6b3c}
  .muted{color:#777}
  .row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .box{border:1px solid #e5e5e5;border-radius:10px;padding:12px 14px;margin:10px 0}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border-bottom:1px solid #eee;padding:8px 6px}
  th{background:#f7f7f2;text-align:left;font-size:13px}
  .totals{margin-left:auto;max-width:320px}
  .totals div{display:flex;justify-content:space-between;padding:3px 0}
  .grand{font-weight:bold;font-size:16px;border-top:2px solid #333;margin-top:6px;padding-top:6px}
</style></head>
<body>
  <div class="row">
    <div>
      <h1>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</h1>
      <div class="muted">Số đơn: <b>${esc(order.code)}</b> · Ngày xuất: ${dmy(invoice.issuedAt)}${invoice.issueCount > 1 ? ` · Lần ${invoice.issueCount}` : ''}</div>
    </div>
  </div>

  <div class="box">
    <div><b>Đơn vị bán hàng:</b> ${esc(company.name)}</div>
    ${company.taxCode ? `<div class="muted">Mã số thuế: ${esc(company.taxCode)}</div>` : ''}
    ${company.address ? `<div class="muted">Địa chỉ: ${esc(company.address)}</div>` : ''}
  </div>

  <div class="box">
    <div><b>Người mua:</b> ${esc(invoice.buyerName)}</div>
    ${invoice.buyerTaxCode ? `<div class="muted">Mã số thuế: ${esc(invoice.buyerTaxCode)}</div>` : ''}
    <div class="muted">Địa chỉ: ${esc(invoice.buyerAddress)}</div>
    ${invoice.buyerEmail ? `<div class="muted">Email: ${esc(invoice.buyerEmail)}</div>` : ''}
  </div>

  <table>
    <thead><tr><th style="width:36px;text-align:center">#</th><th>Sản phẩm</th><th style="width:48px;text-align:center">SL</th><th style="width:110px;text-align:right">Đơn giá</th><th style="width:120px;text-align:right">Thành tiền</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Tiền hàng (chưa thuế)</span><span>${vnd(b.goodsBeforeTax)}</span></div>
    <div><span>Thuế VAT (${b.taxRate}%)</span><span>${vnd(b.taxAmount)}</span></div>
    <div><span>Tiền hàng (gồm thuế)</span><span>${vnd(b.subtotal)}</span></div>
    ${b.discount > 0 ? `<div><span>Giảm giá</span><span>−${vnd(b.discount)}</span></div>` : ''}
    <div><span>Phí vận chuyển</span><span>${b.shippingFee === 0 ? 'Miễn phí' : vnd(b.shippingFee)}</span></div>
    <div class="grand"><span>Tổng thanh toán</span><span>${vnd(b.total)}</span></div>
  </div>

  ${invoice.note ? `<div class="box muted">Ghi chú: ${esc(invoice.note)}</div>` : ''}
  <p class="muted" style="margin-top:20px;font-size:12px">Hóa đơn được xuất từ hệ thống DressSense theo yêu cầu của khách hàng.</p>
</body></html>`;
}

// Ảnh mặc định dạng inline SVG (data URI) - không phụ thuộc dịch vụ ngoài.
// Thay cho via.placeholder.com (đã ngừng hoạt động, gây lỗi ERR_CONNECTION_CLOSED).
function svg(markup: string): string {
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

// Avatar mặc định (nguồn 96x96, tự co giãn theo kích thước hiển thị của <img>)
export const DEFAULT_AVATAR = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
    '<rect width="96" height="96" fill="#e5e7eb"/>' +
    '<circle cx="48" cy="38" r="18" fill="#9ca3af"/>' +
    '<path d="M18 86c0-16 13-26 30-26s30 10 30 26z" fill="#9ca3af"/>' +
    '</svg>'
);

// Ảnh sản phẩm mặc định khi chưa có/không tải được ảnh (tỷ lệ 4:5)
export const PRODUCT_PLACEHOLDER = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">' +
    '<rect width="400" height="500" fill="#f3f4f6"/>' +
    '<g fill="#d1d5db"><circle cx="175" cy="215" r="14"/>' +
    '<path d="M120 300l55-65 40 46 30-26 55 45v40H120z"/></g>' +
    '<text x="200" y="360" font-family="sans-serif" font-size="20" fill="#9ca3af" text-anchor="middle">Chưa có ảnh</text>' +
    '</svg>'
);

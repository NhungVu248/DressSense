import type { Request, Response, NextFunction } from 'express';

// ============================================================
//  Proxy geocode qua OpenStreetMap Nominatim (miễn phí) để chọn địa chỉ trên bản đồ
//  kiểu Grab/Be. Proxy ở backend để đặt User-Agent đúng chính sách + tránh CORS.
//  - GET /api/geo/reverse?lat=&lng=  : toạ độ -> địa chỉ (tỉnh/quận/phường)
//  - GET /api/geo/search?q=          : từ khoá -> danh sách địa điểm gợi ý
// ============================================================

const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Nominatim yêu cầu User-Agent định danh ứng dụng (kèm liên hệ).
const UA = 'DressSense/1.0 (https://github.com/NhungVu248/DressSense)';

// Tách các trường hành chính VN từ 'address' của Nominatim về tỉnh/quận/phường.
function mapAddress(a: Record<string, string> | undefined) {
  const addr = a ?? {};
  const province = addr.city || addr.state || addr.province || addr.town || '';
  const district = addr.county || addr.city_district || addr.district || addr.suburb || '';
  const ward = addr.ward || addr.quarter || addr.neighbourhood || addr.village || addr.suburb || '';
  // Chi tiết: số nhà + đường (nếu có)
  const detailParts = [addr.house_number, addr.road].filter(Boolean);
  return { province, district, ward, detail: detailParts.join(' ') };
}

// GET /api/geo/reverse?lat=&lng=
export async function reverseGeocode(req: Request, res: Response, next: NextFunction) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ message: 'Toạ độ không hợp lệ.' });

    const url = `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi' } });
    if (!r.ok) return res.status(502).json({ message: 'Không lấy được địa chỉ từ bản đồ.' });
    const data = (await r.json()) as { display_name?: string; address?: Record<string, string> };

    res.json({ lat, lng, displayName: data.display_name ?? '', ...mapAddress(data.address) });
  } catch (err) {
    next(err);
  }
}

// GET /api/geo/search?q=
export async function searchGeocode(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
    if (q.length < 3) return res.json({ results: [] });

    const url = `${NOMINATIM}/search?format=json&addressdetails=1&limit=6&countrycodes=vn&accept-language=vi&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi' } });
    if (!r.ok) return res.status(502).json({ message: 'Không tìm được địa chỉ.' });
    const rows = (await r.json()) as { lat: string; lon: string; display_name: string; address?: Record<string, string> }[];

    res.json({
      results: rows.map((row) => ({
        lat: Number(row.lat), lng: Number(row.lon), displayName: row.display_name, ...mapAddress(row.address),
      })),
    });
  } catch (err) {
    next(err);
  }
}

import { Router } from 'express';
import { reverseGeocode, searchGeocode } from '../controllers/geo.controller';

const router = Router();

// Proxy geocode (OpenStreetMap Nominatim) cho chọn địa chỉ trên bản đồ
router.get('/reverse', reverseGeocode);
router.get('/search', searchGeocode);

export default router;

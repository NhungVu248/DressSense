// Geocode qua proxy backend (OpenStreetMap Nominatim) cho bản đồ chọn địa chỉ
import api from './api';

export interface GeoAddress {
  lat: number;
  lng: number;
  displayName: string;
  province: string;
  district: string;
  ward: string;
  detail: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoAddress> {
  return (await api.get('/geo/reverse', { params: { lat, lng } })).data;
}

export async function searchGeocode(q: string): Promise<GeoAddress[]> {
  return (await api.get('/geo/search', { params: { q } })).data.results;
}

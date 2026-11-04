import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode, searchGeocode, type GeoAddress } from '../lib/geo';

// Icon mặc định của Leaflet hỏng khi bundle -> trỏ icon qua CDN (cố định phiên bản).
const markerIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const VN_CENTER: [number, number] = [16.047, 108.206]; // Đà Nẵng - giữa VN làm mặc định

// Cập nhật tâm bản đồ khi toạ độ đổi (tìm kiếm / định vị)
function Recenter({ pos }: { pos: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(pos, Math.max(map.getZoom(), 15)); }, [pos[0], pos[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Bắt sự kiện click trên bản đồ để đặt ghim
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function AddressMapPicker({
  value, onPick,
}: {
  value?: { lat?: number | null; lng?: number | null };
  onPick: (a: GeoAddress) => void;
}) {
  const hasValue = value?.lat != null && value?.lng != null;
  const [pos, setPos] = useState<[number, number]>(hasValue ? [value!.lat!, value!.lng!] : VN_CENTER);
  const [placed, setPlaced] = useState(hasValue);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoAddress[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đặt ghim ở toạ độ + reverse geocode điền địa chỉ
  async function placeAt(lat: number, lng: number) {
    setPos([lat, lng]); setPlaced(true); setLoading(true); setNote('');
    try { onPick(await reverseGeocode(lat, lng)); }
    catch { setNote('Không lấy được địa chỉ từ bản đồ, bạn có thể nhập tay bên dưới.'); }
    finally { setLoading(false); }
  }

  // Thử lấy vị trí hiện tại (như Grab/Be) khi mở lần đầu nếu chưa có ghim
  useEffect(() => {
    if (hasValue || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => placeAt(p.coords.latitude, p.coords.longitude),
      () => setNote('Chưa bật định vị — hãy tìm kiếm hoặc chạm lên bản đồ để chọn vị trí.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tìm kiếm địa chỉ (debounce)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 3) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchGeocode(q.trim())); } catch { setResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q]);

  function useCurrentLocation() {
    if (!('geolocation' in navigator)) { setNote('Thiết bị không hỗ trợ định vị.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => placeAt(p.coords.latitude, p.coords.longitude),
      () => setNote('Không truy cập được vị trí. Hãy cho phép định vị hoặc tìm kiếm địa chỉ.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function selectResult(r: GeoAddress) {
    setQ(''); setResults([]);
    setPos([r.lat, r.lng]); setPlaced(true); setNote('');
    onPick(r); // dùng luôn địa chỉ từ kết quả tìm kiếm
  }

  return (
    <div className="border border-black/10 rounded-lg overflow-hidden">
      <div className="p-2.5 flex gap-2 border-b border-black/5 relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm địa chỉ (đường, phường, thành phố…)"
          className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm" />
        <button type="button" onClick={useCurrentLocation} title="Dùng vị trí hiện tại"
          className="shrink-0 border border-brand/40 text-brand rounded-lg px-3 text-sm hover:bg-brand/5">📍 Vị trí của tôi</button>
        {(searching || results.length > 0) && (
          <ul className="absolute left-2.5 right-2.5 top-full z-[1000] mt-1 bg-white border border-black/10 rounded-lg shadow-lg max-h-56 overflow-auto">
            {searching && <li className="px-3 py-2 text-xs text-gray-400">Đang tìm…</li>}
            {results.map((r, i) => (
              <li key={i}>
                <button type="button" onClick={() => selectResult(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-light/50">{r.displayName}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="h-64 relative">
        <MapContainer center={pos} zoom={hasValue ? 16 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {placed && <Marker position={pos} draggable icon={markerIcon} eventHandlers={{ dragend: (e) => { const m = e.target.getLatLng(); placeAt(m.lat, m.lng); } }} />}
          <Recenter pos={pos} />
          <ClickHandler onClick={placeAt} />
        </MapContainer>
        {loading && <div className="absolute inset-x-0 bottom-0 bg-brand text-white text-xs text-center py-1 z-[1000]">Đang lấy địa chỉ…</div>}
      </div>

      <p className="text-[11px] text-gray-500 px-3 py-2">
        Chạm lên bản đồ hoặc kéo ghim để chọn vị trí. Địa chỉ sẽ tự điền vào các ô bên dưới — bạn có thể chỉnh lại.
      </p>
      {note && <p className="text-[11px] text-amber-600 px-3 pb-2">{note}</p>}
    </div>
  );
}

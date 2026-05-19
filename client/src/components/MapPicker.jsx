import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

function ClickHandler({ onLocationSelect }) {
  useMapEvents({ click(e) { onLocationSelect(e.latlng); } });
  return null;
}

export default function MapPicker({ value, onChange }) {
  const [marker, setMarker] = useState(value?.lat ? { lat: value.lat, lng: value.lng } : null);

  const handleClick = async (latlng) => {
    setMarker(latlng);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`);
      const data = await res.json();
      const address = data.display_name || '';
      const city = data.address?.city || data.address?.town || data.address?.village || '';
      onChange({ lat: latlng.lat, lng: latlng.lng, address, city });
    } catch {
      onChange({ lat: latlng.lat, lng: latlng.lng, address: '', city: '' });
    }
  };

  return (
    <div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
        Click pe hartă pentru a selecta locația
      </p>
      <MapContainer
        center={marker ? [marker.lat, marker.lng] : [44.4268, 26.1025]}
        zoom={7}
        style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>' />
        <ClickHandler onLocationSelect={handleClick} />
        {marker && <Marker position={[marker.lat, marker.lng]} />}
      </MapContainer>
      {marker && (
        <div style={{ marginTop: '10px', fontSize: '0.8125rem', color: 'var(--text-body)', background: 'var(--soft-aqua)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
          <strong style={{ color: 'var(--primary-navy)' }}>Locație selectată:</strong><br />
          {value?.address || `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`}
        </div>
      )}
    </div>
  );
}
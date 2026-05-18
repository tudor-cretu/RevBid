import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import L from 'leaflet';

// Fix icon-uri Leaflet (bug cunoscut cu Vite)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

function ClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
}

export default function MapPicker({ value, onChange }) {
  const [marker, setMarker] = useState(
    value?.lat ? { lat: value.lat, lng: value.lng } : null
  );

  const handleClick = async (latlng) => {
    setMarker(latlng);

    // Geocoding invers — obtine adresa din coordonate (Nominatim, gratuit)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`
      );
      const data = await res.json();
      const address = data.display_name || '';
      const city    = data.address?.city || data.address?.town || data.address?.village || '';

      onChange({ lat: latlng.lat, lng: latlng.lng, address, city });
    } catch {
      onChange({ lat: latlng.lat, lng: latlng.lng, address: '', city: '' });
    }
  };

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
        Click pe hartă pentru a selecta locația
      </p>

      <MapContainer
        center={marker ? [marker.lat, marker.lng] : [44.4268, 26.1025]}
        zoom={7}
        style={{ height: '300px', width: '100%', borderRadius: '8px', border: '1px solid #ddd' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        />
        <ClickHandler onLocationSelect={handleClick} />
        {marker && <Marker position={[marker.lat, marker.lng]} />}
      </MapContainer>

      {marker && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#444', background: '#f5f5f5', padding: '8px', borderRadius: '6px' }}>
          <strong>Locație selectată:</strong><br />
          {value?.address || `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`}
        </div>
      )}
    </div>
  );
}
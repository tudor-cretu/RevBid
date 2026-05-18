import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

export default function MapView({ location }) {
  if (!location?.lat || !location?.lng) return null;

  return (
    <div>
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={13}
        style={{ height: '200px', width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        />
        <Marker position={[location.lat, location.lng]}>
          {location.address && (
            <Popup>{location.address}</Popup>
          )}
        </Marker>
      </MapContainer>
    </div>
  );
}
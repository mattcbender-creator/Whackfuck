import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { HOLES } from '@/lib/holes';
import { Crosshair } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Create a custom icon for holes
const holeIcon = L.divIcon({
  className: 'custom-hole-icon',
  html: `<div style="background-color: var(--primary); color: black; font-weight: bold; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 0 10px rgba(57,255,20,0.5);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Approximate coordinates for a 18 hole loop around Dundee CC center
const CENTER: [number, number] = [43.35146, -80.52140];

const HOLE_COORDS: [number, number][] = [
  [43.352, -80.522], [43.353, -80.523], [43.354, -80.521],
  [43.355, -80.519], [43.354, -80.517], [43.352, -80.516],
  [43.350, -80.517], [43.349, -80.519], [43.350, -80.521],
  [43.349, -80.523], [43.348, -80.525], [43.347, -80.527],
  [43.349, -80.528], [43.351, -80.527], [43.353, -80.526],
  [43.355, -80.525], [43.356, -80.524], [43.354, -80.523],
];

function LocationButton({ onLocationFound }: { onLocationFound: (loc: [number, number]) => void }) {
  const map = useMap();
  
  return (
    <button
      onClick={() => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
            const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
            onLocationFound(coords);
            map.flyTo(coords, 17);
          });
        }
      }}
      className="absolute top-4 right-4 z-[400] bg-background border border-primary text-primary p-3 rounded-full shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:bg-primary/20 transition-colors"
    >
      <Crosshair className="w-5 h-5" />
    </button>
  );
}

export default function LeafletMap() {
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  return (
    <div className="h-full w-full relative">
      {/* We inject some style for the marker icons */}
      <style>{`
        .custom-hole-icon { background: transparent; border: none; }
        .custom-hole-icon div { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; }
      `}</style>
      
      <MapContainer 
        center={CENTER} 
        zoom={15} 
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
        
        {/* Dark mode filter applied to map tiles via CSS in a real app, but for Leaflet it's tricky.
            We can rely on CSS filters on the map container in global styles if needed, or use a dark tile provider.
            For now, standard OSM tiles. */}
            
        {HOLES.map((hole, i) => {
          const coords = HOLE_COORDS[i];
          return (
            <Marker 
              key={hole.hole} 
              position={coords}
              icon={L.divIcon({
                className: 'custom-hole-icon',
                html: `<div style="background-color: var(--card); color: var(--primary); font-weight: bold; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--primary); box-shadow: 0 0 10px rgba(57,255,20,0.4);">${hole.hole}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              })}
            >
              <Popup className="custom-popup">
                <div className="font-sans">
                  <h3 className="font-condensed text-xl font-bold uppercase m-0">Hole {hole.hole}</h3>
                  <p className="text-xs font-bold text-gray-500 m-0 mt-1 uppercase tracking-wider">Par {hole.par} • {hole.tips} YDS</p>
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <strong className="block text-sm text-black">{hole.ruleName}</strong>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {userLoc && (
          <CircleMarker
            center={userLoc}
            radius={8}
            pathOptions={{ color: '#39FF14', fillColor: '#39FF14', fillOpacity: 0.5, weight: 2 }}
          />
        )}

        <LocationButton onLocationFound={setUserLoc} />
      </MapContainer>
    </div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { X, Check, MapPin, MousePointer2, Loader2 } from 'lucide-react';

interface LocationDetails {
  lat: number;
  lng: number;
  country?: string;
  city?: string;
  district?: string;
  address?: string;
}

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (coords: string, area: string, location?: LocationDetails) => void;
  initialCoords?: string; 
  t?: any;
}

declare global {
  interface Window {
    L: any; 
  }
}

function calculateArea(locations: { lat: number; lng: number }[]) {
  if (!locations.length || locations.length < 3) return 0;
  
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6378137; 
  
  let area = 0;
  for (let i = 0; i < locations.length; i++) {
    const j = (i + 1) % locations.length;
    const p1 = locations[i];
    const p2 = locations[j];
    
    area += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  
  area = (area * R * R) / 2;
  return Math.abs(area);
}

function calculateCentroid(locations: { lat: number; lng: number }[]) {
  if (!locations.length) return null;
  let lat = 0;
  let lng = 0;
  for (const p of locations) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / locations.length, lng: lng / locations.length };
}

const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, onSave, initialCoords, t }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const [currentArea, setCurrentArea] = useState<string>("0.00");
  const [currentCoords, setCurrentCoords] = useState<any[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const tr = (key: string, fallback: string) => {
    return t && t[key] ? t[key] : fallback;
  };

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      initMap();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const initMap = () => {
    if (!mapContainerRef.current || !window.L) return;
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    let center: [number, number] = [24.47, 39.61]; 
    let zoom = 13;

    if (initialCoords) {
      const parts = initialCoords.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        center = [parts[0], parts[1]];
        zoom = 18;
      }
    }

    const map = window.L.map(mapContainerRef.current).setView(center, zoom);
    mapInstanceRef.current = map;

    const osmLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    const satelliteLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });

    osmLayer.addTo(map);

    const baseMaps = {
      [tr('streetView', 'Street Map')]: osmLayer,
      [tr('satelliteView', 'Satellite (Earth)')]: satelliteLayer
    };
    window.L.control.layers(baseMaps).addTo(map);

    const drawnItems = new window.L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const drawControl = new window.L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: '#0f172a', 
            fillOpacity: 0.2
          }
        },
        polyline: false,
        circle: false,
        rectangle: true, 
        marker: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems
      }
    });
    map.addControl(drawControl);

    map.on(window.L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      drawnItems.clearLayers(); 
      drawnItems.addLayer(layer);
      updateMetrics(layer);
    });

    map.on(window.L.Draw.Event.EDITED, (e: any) => {
      e.layers.eachLayer((layer: any) => {
        updateMetrics(layer);
      });
    });
  };

  const updateMetrics = (layer: any) => {
    let latLngs = layer.getLatLngs();
    if (Array.isArray(latLngs[0])) {
        latLngs = latLngs[0]; 
    }
    const coords = latLngs.map((ll: any) => ({ lat: ll.lat, lng: ll.lng }));
    setCurrentCoords(coords);
    const area = calculateArea(coords);
    setCurrentArea(area.toFixed(2));
  };

  const fetchLocationData = async (lat: number, lng: number): Promise<LocationDetails> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
          }
        }
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      const addr = data.address || {};

      return {
        lat,
        lng,
        country: addr.country || '',
        city: addr.city || addr.town || addr.village || addr.county || '',
        district: addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || '',
        address: addr.road ? `${addr.house_number ? addr.house_number + ' ' : ''}${addr.road}` : ''
      };
    } catch (e) {
      console.error("Failed to reverse geocode:", e);
      return { lat, lng };
    }
  };

  const handleSave = async () => {
    if (currentCoords.length > 0) {
      setIsGeocoding(true);
      const center = calculateCentroid(currentCoords);
      let locData: LocationDetails | undefined = undefined;

      if (center) {
        locData = await fetchLocationData(center.lat, center.lng);
      }

      onSave(JSON.stringify(currentCoords), currentArea, locData);
      setIsGeocoding(false);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white z-10">
          <div className="flex items-center gap-4">
            {/* Modern Icon Container */}
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
                <MousePointer2 className="w-6 h-6 text-slate-700" strokeWidth={1.5} />
            </div>
            <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                {tr('drawBoundary', 'Draw Plot Boundary')}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                {tr('drawHint', 'Use the toolbar on the left to draw your site polygon. Switch layers top-right.')}
                </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition p-2 hover:bg-slate-100 rounded-full">
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative w-full h-full bg-slate-50">
           <div ref={mapContainerRef} className="w-full h-full z-0" />
           
           {/* Area Badge Overlay */}
           <div className="absolute top-5 left-[50px] bg-white/95 backdrop-blur-md border border-slate-200 px-5 py-3 rounded-xl shadow-lg z-[400] min-w-[140px]">
             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">{tr('plotArea', 'Plot Area')}</span>
             <span className="text-2xl font-mono font-bold text-slate-900 block">{currentArea} <span className="text-sm text-slate-400 font-sans font-medium">m²</span></span>
           </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-white flex justify-between items-center z-10">
          <div className="flex items-center gap-2.5 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
             <MapPin className="w-3.5 h-3.5" />
             {initialCoords ? tr('centeredOnGPS', 'Centered on GPS location') : tr('defaultView', 'Default view (Region)')}
          </div>
          <div className="flex gap-4 ml-auto">
            <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl text-sm transition">
              {tr('cancel', 'Cancel')}
            </button>
            <button 
              onClick={handleSave}
              disabled={isGeocoding}
              className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex items-center gap-2.5 text-sm shadow-md transition disabled:opacity-70 disabled:cursor-wait active:scale-95"
            >
              {isGeocoding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {tr('identifying', 'Identifying Location...')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {tr('saveBoundary', 'Save Boundary & Location')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapModal;
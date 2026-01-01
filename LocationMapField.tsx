import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, AlertCircle } from "lucide-react";
import { geocodeAddress } from "@/lib/geoUtils";

// Fix per als icones per defecte de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationMapFieldProps {
  address?: string;
  streetNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  /** Coordenades directes (p.ex. del cadastre). */
  value?: { latitude: number; longitude: number } | null;
  onChange?: (coords: { latitude: number; longitude: number } | null) => void;
  /** Si és true, NO es farà geocoding; el mapa només es renderitza quan hi hagi coordenades. */
  disableGeocoding?: boolean;
  /** Text de la font (p.ex. "Cadastre"). */
  sourceLabel?: string;
  /** Mostrar el text de coordenades sota el mapa. */
  showCoordinates?: boolean;
}

export const LocationMapField = ({
  address,
  streetNumber,
  city,
  province,
  postalCode,
  value,
  onChange,
  disableGeocoding = false,
  sourceLabel,
  showCoordinates = true,
}: LocationMapFieldProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(value || null);
  const hasGeocodedRef = useRef(false);
  const lastAddressRef = useRef<string>("");

  const fullAddress = [
    address,
    streetNumber,
    postalCode,
    city,
    province
  ].filter(Boolean).join(", ");

  const updateMap = useCallback((lat: number, lon: number) => {
    if (!mapRef.current) return;

    // Inicialitzar el mapa si no existeix
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
      }).setView([lat, lon], 16);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.setView([lat, lon], 16);
    }

    // Actualitzar o crear marcador
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      const customIcon = L.divIcon({
        className: "custom-location-marker",
        html: `
          <div style="
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            width: 40px;
            height: 40px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              transform: rotate(45deg);
              color: white;
              font-size: 18px;
            ">📍</div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      markerRef.current = L.marker([lat, lon], { icon: customIcon })
        .addTo(mapInstanceRef.current);
    }
  }, []);

  const handleGeocode = useCallback(async () => {
    if (!fullAddress || fullAddress.trim().length < 5) {
      return;
    }

    // Si ja hem geocodificat aquesta adreça, no repetir
    if (lastAddressRef.current === fullAddress && coords) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Intentar primer amb adreça completa
      let result = await geocodeAddress(
        `${address || ""} ${streetNumber || ""}`.trim(),
        city || "",
        "Spain"
      );

      // Si no funciona, provar només amb ciutat i codi postal
      if (!result && city) {
        result = await geocodeAddress(postalCode || "", city, "Spain");
      }

      // Si encara no, provar només amb ciutat
      if (!result && city) {
        result = await geocodeAddress("", city, "Spain");
      }

      if (result) {
        setCoords(result);
        lastAddressRef.current = fullAddress;
        onChange?.(result);
        hasGeocodedRef.current = true;
      } else {
        setError("No s'ha pogut localitzar l'adreça exacta. Verifica les dades.");
      }
    } catch (err) {
      console.error("Error geocoding:", err);
      setError("Error cercant la ubicació");
    } finally {
      setLoading(false);
    }
  }, [fullAddress, address, streetNumber, city, postalCode, coords, onChange]);

  // Pintar / actualitzar el mapa quan ja tenim coordenades (important dins de diàlegs/tabs)
  useEffect(() => {
    if (!coords) return;

    updateMap(coords.latitude, coords.longitude);

    const t = window.setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 50);

    return () => window.clearTimeout(t);
  }, [coords, updateMap]);

  // Auto-geocodificar NOMÉS si està permès i no tenim coordenades directes
  useEffect(() => {
    if (disableGeocoding) return;

    // No fer geocoding si ja tenim coordenades del value (cadastre)
    if (value && value.latitude !== 0 && value.longitude !== 0) {
      return;
    }

    if (fullAddress && fullAddress.trim().length >= 5 && !hasGeocodedRef.current && !coords) {
      const timer = setTimeout(() => {
        handleGeocode();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fullAddress, handleGeocode, coords, value, disableGeocoding]);

  // PRIORITAT: Si rebem coordenades directes (del cadastre), les utilitzem sempre
  useEffect(() => {
    if (value && value.latitude !== 0 && value.longitude !== 0) {
      console.log("LocationMapField: Using direct coordinates from cadastre:", value);
      setCoords(value);
      hasGeocodedRef.current = true;
      setError(null);
    }
  }, [value]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Adreça actual */}
      {fullAddress && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                {sourceLabel ? `Ubicació segons ${sourceLabel}` : "Ubicació del projecte"}
              </p>
              <p className="text-sm text-foreground font-medium">
                {fullAddress}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Localitzant adreça...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {error}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Pots editar l'adreça a la secció "Situació" per millorar la precisió.
            </p>
          </div>
        </div>
      )}

      {/* Mapa */}
      {coords && !loading && (
        <div className="rounded-xl overflow-hidden border-2 border-border shadow-lg">
          <div ref={mapRef} className="h-[350px] w-full" />
          {showCoordinates && (
            <div className="p-3 bg-muted/50 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>Coordenades: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}</span>
              <span className="text-primary font-medium">OpenStreetMap</span>
            </div>
          )}
        </div>
      )}

      {/* Estat quan encara no hi ha coordenades */}
      {!coords && !loading && fullAddress && disableGeocoding && (
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Carregant la ubicació exacta del cadastre… Quan estigui disponible, es mostrarà el mapa.
          </p>
        </div>
      )}

      {/* Placeholder quan no hi ha dades */}
      {!coords && !loading && !fullAddress && (
        <div className="h-[200px] rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center bg-muted/20">
          <MapPin className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            El mapa es generarà automàticament quan hi hagi dades d'adreça al projecte.
          </p>
        </div>
      )}
    </div>
  );
};

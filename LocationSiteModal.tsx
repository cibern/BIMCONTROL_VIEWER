import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MapPin, Loader2, AlertCircle, Building, Lock } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCadastreDataByReference, geocodeAddress } from "@/lib/geoUtils";
import { useLanguage } from "@/contexts/LanguageContext";

// Fix per als icones per defecte de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationSiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface LocationData {
  cadastral_reference: string;
  street: string;
  street_number: string;
  postal_code: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
}

export const LocationSiteModal = ({
  open,
  onOpenChange,
  projectId,
}: LocationSiteModalProps) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Carregar dades del projecte
  useEffect(() => {
    if (open && projectId) {
      loadProjectData();
      setMapReady(false);
    }
  }, [open, projectId]);

  // Cleanup del mapa quan es tanca el modal
  useEffect(() => {
    if (!open) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    }
  }, [open]);

  // Inicialitzar mapa quan les dades i el contenidor estan llestos
  useEffect(() => {
    if (!open || !locationData || locationData.latitude === 0 || !mapContainerRef.current) {
      return;
    }

    // Esperar que el DOM estigui llest
    const timer = setTimeout(() => {
      initializeMap();
    }, 300);

    return () => clearTimeout(timer);
  }, [open, locationData, mapReady]);

  const loadProjectData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("cadastral_reference, street, street_number, postal_code, city, province, utm_x, utm_y")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      if (!project?.cadastral_reference) {
        setError(language === "ca" ? "Aquest projecte no té referència cadastral." : "Este proyecto no tiene referencia catastral.");
        setLoading(false);
        return;
      }

      // Obtenir dades del cadastre
      const cadastreData = await getCadastreDataByReference(project.cadastral_reference);

      let finalLatitude = 0;
      let finalLongitude = 0;
      let street = project.street || "";
      let streetNumber = project.street_number || "";
      let postalCode = project.postal_code || "";
      let city = project.city || "";
      let province = project.province || "";

      if (cadastreData) {
        street = cadastreData.street || street;
        streetNumber = cadastreData.streetNumber || streetNumber;
        postalCode = cadastreData.postalCode || postalCode;
        city = cadastreData.municipality || city;
        province = cadastreData.province || province;
        finalLatitude = cadastreData.latitude || 0;
        finalLongitude = cadastreData.longitude || 0;
      }

      // Si no tenim coordenades del cadastre, usar geocodificació amb l'adreça
      if (finalLatitude === 0 || finalLongitude === 0) {
        console.log("Coordenades del cadastre no disponibles, usant geocodificació...");
        
        let geocodeResult = null;
        
        // Intent 1: Adreça completa amb carrer, número, ciutat i província
        if (street && city) {
          const fullAddress = `${street} ${streetNumber}, ${postalCode} ${city}, ${province}`.trim();
          console.log("Intent geocodificació amb adreça completa:", fullAddress);
          geocodeResult = await geocodeAddress(fullAddress, "", "Spain");
        }
        
        // Intent 2: Carrer i ciutat sense codi postal
        if (!geocodeResult && street && city) {
          const simpleAddress = `${street} ${streetNumber}, ${city}`.trim();
          console.log("Intent geocodificació amb adreça simple:", simpleAddress);
          geocodeResult = await geocodeAddress(simpleAddress, "", "Spain");
        }
        
        // Intent 3: Només carrer i ciutat (sense número)
        if (!geocodeResult && street && city) {
          const streetOnly = `${street}, ${city}, ${province}`.trim();
          console.log("Intent geocodificació amb carrer:", streetOnly);
          geocodeResult = await geocodeAddress(streetOnly, "", "Spain");
        }
        
        // Intent 4: Fallback a ciutat i província
        if (!geocodeResult && city) {
          console.log("Intent geocodificació amb ciutat:", city, province);
          geocodeResult = await geocodeAddress(city, province, "Spain");
        }
        
        if (geocodeResult) {
          finalLatitude = geocodeResult.latitude;
          finalLongitude = geocodeResult.longitude;
          console.log("Coordenades obtingudes:", finalLatitude, finalLongitude);
        }
      }

      if (finalLatitude !== 0 && finalLongitude !== 0) {
        setLocationData({
          cadastral_reference: project.cadastral_reference,
          street,
          street_number: streetNumber,
          postal_code: postalCode,
          city,
          province,
          latitude: finalLatitude,
          longitude: finalLongitude,
        });
        setMapReady(true);
      } else {
        setLocationData({
          cadastral_reference: project.cadastral_reference,
          street,
          street_number: streetNumber,
          postal_code: postalCode,
          city,
          province,
          latitude: 0,
          longitude: 0,
        });
        setError(language === "ca" ? "No s'han pogut obtenir les coordenades. Verifica l'adreça del projecte." : "No se han podido obtener las coordenadas. Verifica la dirección del proyecto.");
      }
    } catch (error) {
      console.error("Error loading project data:", error);
      setError(language === "ca" ? "Error carregant les dades del projecte." : "Error cargando los datos del proyecto.");
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!mapContainerRef.current || !locationData || locationData.latitude === 0) {
      return;
    }

    // Si ja existeix el mapa, destruir-lo
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // Crear nou mapa
      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
        zoomControl: true,
      }).setView([locationData.latitude, locationData.longitude], 15);

      mapInstanceRef.current = map;

      // Capa base
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Marcador personalitzat per l'emplaçament
      const customIcon = L.divIcon({
        className: "custom-location-marker",
        html: `
          <div style="
            background: linear-gradient(135deg, #6b7c4c 0%, #4a5a34 100%);
            width: 44px;
            height: 44px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(107, 124, 76, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              transform: rotate(45deg);
              color: white;
              font-size: 20px;
            ">📍</div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 44],
      });

      L.marker([locationData.latitude, locationData.longitude], { icon: customIcon })
        .addTo(map)
        .bindPopup(`<b>${language === "ca" ? "Emplaçament del projecte" : "Emplazamiento del proyecto"}</b><br/>${locationData.street} ${locationData.street_number}<br/>${locationData.city}`)
        .openPopup();

      // Carregar límits del municipi
      await loadMunicipalityBoundary(map, locationData.city, locationData.province);

      // Invalidar el tamany després de renderitzar
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  };

  const loadMunicipalityBoundary = async (map: L.Map, city: string, province: string) => {
    if (!city) return;

    try {
      const query = encodeURIComponent(`${city}, ${province}, Spain`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&polygon_geojson=1&limit=1`,
        {
          headers: {
            'User-Agent': 'BIM-IFC-Viewer/1.0'
          }
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      
      if (data && data.length > 0 && data[0].geojson) {
        const geojson = data[0].geojson;

        // Afegir capa amb el contorn del municipi en VERMELL
        L.geoJSON(geojson, {
          style: {
            color: '#dc2626',
            weight: 3,
            opacity: 0.9,
            fillColor: '#dc2626',
            fillOpacity: 0.05,
            dashArray: '8, 4',
          }
        }).addTo(map);

        // Afegir etiqueta del municipi a la cantonada superior del límit
        const geoLayer = L.geoJSON(geojson);
        const bounds = geoLayer.getBounds();
        
        // Posicionar l'etiqueta a la part superior del límit municipal (no al centre)
        const labelPosition = L.latLng(
          bounds.getNorth(), // Part superior
          bounds.getCenter().lng // Centre horitzontal
        );
        
        L.marker(labelPosition, {
          icon: L.divIcon({
            className: 'municipality-label-container',
            html: `<div style="
              background: rgba(220, 38, 38, 0.9);
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 13px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              border: 2px solid rgba(255,255,255,0.5);
              display: inline-block;
            ">🏘️ ${language === "ca" ? "Terme municipal de" : "Término municipal de"} ${city}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 30],
          })
        }).addTo(map);
      }
    } catch (error) {
      console.error("Error loading municipality boundary:", error);
    }
  };

  const inputClasses =
    "h-12 text-base bg-muted/50 border-2 cursor-not-allowed opacity-70";
  const labelClasses = "text-sm font-semibold text-foreground mb-2 flex items-center gap-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
              <MapPin className="h-6 w-6 text-[#6b7c4c]" />
            </div>
            <div className="flex-1">
              <span className="block text-[#6b7c4c]">
                {language === "ca" ? "Emplaçament i situació" : "Emplazamiento y situación"}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {language === "ca" ? "Ubicació del projecte segons la referència cadastral" : "Ubicación del proyecto según la referencia catastral"}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "ca" ? "Modal per visualitzar l'emplaçament i situació del projecte" : "Modal para visualizar el emplazamiento y situación del proyecto"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
            <p className="text-base text-muted-foreground">
              {language === "ca" ? "Carregant dades del cadastre..." : "Cargando datos del catastro..."}
            </p>
          </div>
        ) : error && !locationData ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-8">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
              <p className="text-base font-medium text-amber-800 dark:text-amber-200">
                  {error}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  {language === "ca" ? "Assegura't que el projecte té una referència cadastral vàlida." : "Asegúrate de que el proyecto tiene una referencia catastral válida."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="p-8 space-y-6">
              {/* Referència cadastral */}
              <div className="bg-gradient-to-br from-[#6b7c4c]/5 to-[#6b7c4c]/10 rounded-xl p-6 border-2 border-[#6b7c4c]/30">
                <div className="flex items-center gap-3 mb-4">
                  <Building className="h-5 w-5 text-[#6b7c4c]" />
                  <span className="font-semibold text-[#6b7c4c]">
                    {language === "ca" ? "Referència Cadastral" : "Referencia Catastral"}
                  </span>
                </div>
                <p className="text-lg font-mono bg-background/80 rounded-lg px-4 py-3 border">
                  {locationData?.cadastral_reference || "—"}
                </p>
              </div>

              {/* Camps d'adreça (bloquejats) */}
              <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-2 text-base font-semibold text-[#6b7c4c] mb-4">
                  <Lock className="h-4 w-4" />
                  {language === "ca" ? "Adreça (obtinguda del cadastre)" : "Dirección (obtenida del catastro)"}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2">
                    <Label className={labelClasses}>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      {language === "ca" ? "Adreça" : "Dirección"}
                    </Label>
                    <Input
                      value={locationData?.street || ""}
                      readOnly
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <Label className={labelClasses}>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      {language === "ca" ? "Número" : "Número"}
                    </Label>
                    <Input
                      value={locationData?.street_number || ""}
                      readOnly
                      className={inputClasses}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <Label className={labelClasses}>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      {language === "ca" ? "Codi Postal" : "Código Postal"}
                    </Label>
                    <Input
                      value={locationData?.postal_code || ""}
                      readOnly
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <Label className={labelClasses}>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      {language === "ca" ? "Població" : "Población"}
                    </Label>
                    <Input
                      value={locationData?.city || ""}
                      readOnly
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <Label className={labelClasses}>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      {language === "ca" ? "Província" : "Provincia"}
                    </Label>
                    <Input
                      value={locationData?.province || ""}
                      readOnly
                      className={inputClasses}
                    />
                  </div>
                </div>
              </div>

              {/* Mapa */}
              <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b bg-[#6b7c4c]/5">
                  <div className="flex items-center gap-2 text-base font-semibold text-[#6b7c4c]">
                    <MapPin className="h-5 w-5" />
                    {language === "ca" ? "Plànol d'emplaçament" : "Plano de emplazamiento"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "ca" 
                      ? <>Ubicació exacta i <span className="text-red-600 font-medium">límits del terme municipal</span></>
                      : <>Ubicación exacta y <span className="text-red-600 font-medium">límites del término municipal</span></>
                    }
                  </p>
                </div>
                
                {locationData && locationData.latitude !== 0 ? (
                  <div 
                    ref={mapContainerRef} 
                    className="w-full" 
                    style={{ height: '400px', minHeight: '400px' }}
                  />
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center bg-muted/20">
                    <MapPin className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                      No s'han pogut obtenir les coordenades per mostrar el mapa.
                    </p>
                  </div>
                )}

                {locationData && locationData.latitude !== 0 && (
                  <div className="p-4 bg-muted/30 border-t flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Coordenades: {locationData.latitude.toFixed(6)}, {locationData.longitude.toFixed(6)}
                    </span>
                    <span className="text-[#6b7c4c] font-medium flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#6b7c4c]/30 border border-[#6b7c4c]" />
                      Límits del municipi
                    </span>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-4 px-8 py-5 border-t bg-muted/30">
          <Button
            size="lg"
            onClick={() => onOpenChange(false)}
            className="min-w-[120px] bg-[#6b7c4c] hover:bg-[#5a6a40]"
          >
            Tancar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { utmToLatLon } from "@/lib/geoUtils";

// Fix per als icones per defecte de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface SupplierLocation {
  id: string;
  name: string;
  company: string;
  categories: string[];
  utm_x: number;
  utm_y: number;
  utm_zone: string;
  total_amount: number;
  distance?: number;
  phone?: string;
  email?: string;
  supplier_id?: string;
}

interface BudgetMapViewProps {
  projectCoords: { x: number; y: number; zone: string; address?: string; city?: string; postal_code?: string } | null;
  suppliers: SupplierLocation[];
  onViewBudget?: (supplierId: string) => void;
}

export const BudgetMapView = ({ projectCoords, suppliers, onViewBudget }: BudgetMapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !projectCoords) return;

    // Add global function for viewing supplier budget
    (window as any).viewSupplierBudget = (supplierId: string) => {
      if (onViewBudget) {
        onViewBudget(supplierId);
      }
    };

    // Convertir coordenades del projecte
    const projectLatLon = utmToLatLon(projectCoords.x, projectCoords.y, projectCoords.zone);

    // Inicialitzar el mapa si no existeix
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(
        [projectLatLon.latitude, projectLatLon.longitude],
        12
      );

      // Afegir capa de mapa OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Netejar marcadors i grups de clústers anteriors
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || (layer as any)._group) {
        map.removeLayer(layer);
      }
    });

    // Icona personalitzada per al projecte
    const projectIcon = L.divIcon({
      className: "custom-project-marker",
      html: `
        <div style="
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          width: 36px;
          height: 36px;
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
            font-weight: bold;
            font-size: 18px;
          ">P</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });

    // Afegir marcador del projecte
    const projectMarker = L.marker([projectLatLon.latitude, projectLatLon.longitude], {
      icon: projectIcon,
    }).addTo(map);

    // Get project info from projectCoords
    const projectAddress = projectCoords.address || "Adreça no disponible";
    const projectCity = projectCoords.city || "";
    const projectPostalCode = projectCoords.postal_code || "";
    
    projectMarker.bindPopup(`
      <div style="padding: 16px; min-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
        <h3 style="margin: 0 0 12px 0; font-weight: 700; color: #3b82f6; font-size: 18px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">📍</span> Projecte
        </h3>
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <div style="margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Adreça</div>
            <div style="font-size: 14px; color: #1e293b; font-weight: 500;">${projectAddress}</div>
          </div>
          ${projectCity ? `
            <div>
              <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Població</div>
              <div style="font-size: 14px; color: #1e293b; font-weight: 500;">${projectCity}${projectPostalCode ? ` (${projectPostalCode})` : ''}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `);

    // Crear grup de clústers per als proveïdors/industrials
    const markerClusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 80,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function(cluster: any) {
        const childCount = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">${childCount}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        });
      }
    });

    // Afegir marcadors dels proveïdors/industrials al grup de clústers
    const bounds = L.latLngBounds([[projectLatLon.latitude, projectLatLon.longitude]]);
    
    suppliers.forEach((supplier) => {
      if (!supplier.utm_x || !supplier.utm_y || !supplier.utm_zone) return;

      const supplierLatLon = utmToLatLon(supplier.utm_x, supplier.utm_y, supplier.utm_zone);
      
      // Icona personalitzada per als proveïdors
      const supplierIcon = L.divIcon({
        className: "custom-supplier-marker",
        html: `
          <div style="
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 3px 8px rgba(16, 185, 129, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              transform: rotate(45deg);
              color: white;
              font-weight: bold;
              font-size: 16px;
              font-family: serif;
            ">I</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([supplierLatLon.latitude, supplierLatLon.longitude], {
        icon: supplierIcon,
      });

      const popupContent = `
        <div style="padding: 16px; min-width: 300px; font-family: system-ui, -apple-system, sans-serif;">
          <h3 style="margin: 0 0 12px 0; font-weight: 700; color: #10b981; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-family: serif;">I</span>
            ${supplier.name}
          </h3>
          
          ${supplier.categories.length > 0 ? `
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #10b981;">
              <div style="font-size: 11px; font-weight: 600; color: #15803d; text-transform: uppercase; margin-bottom: 6px;">Categories</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${supplier.categories.map(cat => `
                  <span style="font-size: 12px; font-weight: 600; color: #15803d; background: white; padding: 4px 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    ${cat}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${supplier.email || supplier.phone ? `
            <div style="background: #f8fafc; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px;">
              ${supplier.email ? `
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: ${supplier.phone ? '8px' : '0'};">
                  <span style="font-size: 16px;">📧</span>
                  <span style="font-size: 13px; color: #334155; font-weight: 500;">${supplier.email}</span>
                </div>
              ` : ''}
              
              ${supplier.phone ? `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">📞</span>
                  <span style="font-size: 13px; color: #334155; font-weight: 500;">${supplier.phone}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          <div style="background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); padding: 12px; border-radius: 8px; border-left: 4px solid #eab308; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${supplier.distance !== undefined ? '10px' : '0'};">
              <span style="font-weight: 600; font-size: 13px; color: #713f12;">Import pressupost</span>
              <span style="color: #10b981; font-weight: 700; font-size: 18px;">
                ${supplier.total_amount.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </span>
            </div>
            ${supplier.distance !== undefined ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #fde047;">
                <span style="font-weight: 600; font-size: 13px; color: #713f12;">Distància</span>
                <span style="color: #3b82f6; font-weight: 700; font-size: 16px;">
                  ${supplier.distance.toFixed(1)} km
                </span>
              </div>
            ` : ''}
          </div>

          ${supplier.supplier_id ? `
            <button 
              onclick="window.viewSupplierBudget('${supplier.supplier_id}')"
              style="
                width: 100%;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                padding: 10px 16px;
                border-radius: 8px;
                border: none;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
              "
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.3)'"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.2)'"
            >
              📊 Veure Pressupost
            </button>
          ` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);

      // Afegir marcador al grup de clústers
      markerClusterGroup.addLayer(marker);

      bounds.extend([supplierLatLon.latitude, supplierLatLon.longitude]);

      // Dibuixar línia entre projecte i proveïdor/industrial amb etiqueta de distància
      const line = L.polyline(
        [
          [projectLatLon.latitude, projectLatLon.longitude],
          [supplierLatLon.latitude, supplierLatLon.longitude],
        ],
        {
          color: "#000000",
          weight: 3,
          opacity: 0.6,
          dashArray: "8, 12",
        }
      ).addTo(map);

      // Afegir etiqueta de distància al centre de la línia
      if (supplier.distance !== undefined) {
        const midLat = (projectLatLon.latitude + supplierLatLon.latitude) / 2;
        const midLng = (projectLatLon.longitude + supplierLatLon.longitude) / 2;
        
        L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: 'distance-label',
            html: `
              <div style="
                background: white;
                padding: 4px 10px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 12px;
                color: #1e293b;
                border: 2px solid #3b82f6;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                white-space: nowrap;
              ">
                ${supplier.distance.toFixed(1)} km
              </div>
            `,
            iconSize: [0, 0],
          })
        }).addTo(map);
      }
    });

    // Afegir el grup de clústers al mapa
    map.addLayer(markerClusterGroup);

    // Ajustar la vista per mostrar tots els marcadors
    if (suppliers.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      // Clean up global function
      delete (window as any).viewSupplierBudget;
    };
  }, [projectCoords, suppliers, onViewBudget]);

  if (!projectCoords) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">
          No hi ha coordenades disponibles per al projecte
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border">
      <div ref={mapRef} className="absolute inset-0" />
      
      {/* Llegenda del mapa */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-[1000] border border-border">
        <h4 className="text-sm font-semibold mb-3 text-foreground">Llegenda</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
              P
            </div>
            <span className="text-xs text-foreground">Projecte</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-green-500 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold font-serif">
              I
            </div>
            <span className="text-xs text-foreground">Industrial</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
              3+
            </div>
            <span className="text-xs text-foreground">Clúster d'industrials</span>
          </div>
          <div className="pt-2 mt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 border-t-[3px] border-dashed border-black"></div>
              <span className="text-xs text-foreground">Distància</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

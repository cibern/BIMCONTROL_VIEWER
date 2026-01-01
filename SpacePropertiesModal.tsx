import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Home } from "lucide-react";

interface SpacePropertiesModalProps {
  open: boolean;
  onClose: () => void;
  metaObject: any;
  entityId: string;
  metaModel?: any;
  projectId?: string;
}

interface SurfaceData {
  useful_areas?: Array<{ id: string; name: string }>;
  built_areas?: Array<{ id: string; name: string }>;
}

// Decodificar seqüències IFC escapades (\X\F3 etc.)
const decodeIfc = (input: unknown): string => {
  const s = typeof input === "string" ? input : String(input ?? "");
  return s.replace(/\\X\\([0-9A-F]{2})/gi, (_m: string, hex: string) => 
    String.fromCharCode(parseInt(hex, 16))
  );
};

// Obtenir PropertySets del model (com al SurfaceAreasModal)
const getPsetsFromModel = (mo: any, metaModel: any): any[] => {
  const result: any[] = [];
  
  // Method 1: Use propertySetIds (the correct way for xeokit)
  if (mo?.propertySetIds && metaModel?.propertySets) {
    for (const propSetId of mo.propertySetIds) {
      const propSet = metaModel.propertySets[propSetId];
      if (propSet) {
        result.push(propSet);
      }
    }
  }
  
  // Fallback: Direct propertySets on metaObject (some IFC exports)
  if (result.length === 0) {
    const ps = mo?.propertySets;
    if (Array.isArray(ps)) return ps;
    if (ps && typeof ps === "object") return Object.values(ps);
  }
  
  return result;
};

// Obtenir propietats d'un PropertySet
const getProps = (pset: any): any[] => {
  const pr = pset?.properties;
  if (!pr) return [];
  if (Array.isArray(pr)) return pr;
  if (typeof pr === "object") return Object.values(pr);
  return [];
};

// Normalitzar clau per comparar
const normalizeKey = (input: unknown): string =>
  decodeIfc(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-\.]/g, "");

// Obtenir una propietat del metaObject (com al SurfaceAreasModal)
const getPropFromMeta = (metaObj: any, keys: string[], metaModel: any): string => {
  const wanted = new Set(keys.map(normalizeKey));
  const psets = getPsetsFromModel(metaObj, metaModel);

  for (const pset of psets) {
    const props = getProps(pset);
    for (const prop of props) {
      const nameKey = normalizeKey(prop?.name ?? prop?.Name);
      if (wanted.has(nameKey)) {
        const raw = prop?.value ?? prop?.Value;
        if (raw !== null && raw !== undefined) return decodeIfc(raw);
      }
    }
  }

  return "";
};

// Obtenir el nom d'usuari (mateix sistema que SurfaceAreasModal)
const getUserName = (metaObj: any, metaModel: any, fallbackId: string): string => {
  // Buscar nom a les propietats
  const nameFromProps = getPropFromMeta(
    metaObj,
    [
      "LongName",
      "Long Name",
      "Nombre",
      "Nom",
      "Name",
      "Description",
      "Descripcion",
      "Descripció",
      "SpaceName",
      "RoomName",
    ],
    metaModel
  );

  if (nameFromProps && nameFromProps.trim() !== "") {
    return nameFromProps.trim();
  }

  // Fallback: use metaObj.name, but if it's just a number, use id
  const rawName = decodeIfc(metaObj?.name ?? "");
  if (rawName && !/^\d+$/.test(rawName.trim())) {
    return rawName.trim();
  }

  return fallbackId;
};

// Obtenir valor numèric
const getNumericProp = (metaObj: any, keys: string[], metaModel: any): number | null => {
  const wanted = new Set(keys.map(normalizeKey));
  const psets = getPsetsFromModel(metaObj, metaModel);

  for (const pset of psets) {
    const props = getProps(pset);
    for (const prop of props) {
      const nameKey = normalizeKey(prop?.name ?? prop?.Name);
      if (wanted.has(nameKey)) {
        const raw = prop?.value ?? prop?.Value;
        if (raw !== null && raw !== undefined) {
          const val = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
          if (!isNaN(val)) return val;
        }
      }
    }
  }

  return null;
};

// Formatejar valors numèrics
const formatValue = (value: number | null, decimals: number = 2): string => {
  if (value === null) return "-";
  return value.toLocaleString("ca-ES", { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

export const SpacePropertiesModal = ({
  open,
  onClose,
  metaObject,
  entityId,
  metaModel,
  projectId,
}: SpacePropertiesModalProps) => {
  const { language } = useLanguage();
  const [customName, setCustomName] = useState<string | null>(null);

  const roomsMode = useMemo(() => {
    if (typeof window === "undefined") return "only";
    return localStorage.getItem("viewer-rooms-visibility-mode") || "only";
  }, [open]);

  useEffect(() => {
    let cancelled = false;

    const loadCustomName = async () => {
      setCustomName(null);
      if (!open || !projectId || !entityId) return;

      const { data, error } = await supabase
        .from("project_surface_areas")
        .select("surface_data")
        .eq("project_id", projectId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data?.surface_data) return;

      const surfaceData = data.surface_data as unknown as SurfaceData;
      const useful = surfaceData?.useful_areas || [];
      const built = surfaceData?.built_areas || [];

      const builtName = built.find((r) => String(r.id) === String(entityId))?.name;
      const usefulName = useful.find((r) => String(r.id) === String(entityId))?.name;

      const name =
        roomsMode === "zones"
          ? (builtName || usefulName || null)
          : roomsMode === "peces"
            ? (usefulName || builtName || null)
            : (usefulName || builtName || null);

      if (name && String(name).trim() !== "") {
        setCustomName(String(name).trim());
      }
    };

    loadCustomName();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, entityId, roomsMode]);

  if (!metaObject) return null;

  // Nom d'usuari / nom d'espai: primer el del quadre de superfícies; si no, IFC
  const userName = customName || getUserName(metaObject, metaModel, entityId);

  // Buscar les 3 propietats clau
  const height = getNumericProp(metaObject, [
    "Height", "CeilingHeight", "FinishCeilingHeight", "UnboundedHeight",
    "Alçada", "Altura", "GrossHeight", "NetHeight"
  ], metaModel);
  
  const netArea = getNumericProp(metaObject, [
    "NetFloorArea", "NetPlannedArea", "NetArea", "Area", "GrossFloorArea",
    "Superfície neta", "Superficie neta", "Àrea"
  ], metaModel);
  
  const netVolume = getNumericProp(metaObject, [
    "NetVolume", "GrossVolume", "Volume", 
    "Volum net", "Volumen neto", "Volum"
  ], metaModel);

  const properties = [
    {
      label: language === "ca" ? "Nom d'usuari" : "Nombre de usuario",
      value: userName,
      unit: ""
    },
    {
      label: language === "ca" ? "Alçada" : "Altura",
      value: formatValue(height),
      unit: height !== null ? "m" : ""
    },
    {
      label: language === "ca" ? "Superfície neta" : "Superficie neta",
      value: formatValue(netArea),
      unit: netArea !== null ? "m²" : ""
    },
    {
      label: language === "ca" ? "Volum net" : "Volumen neto",
      value: formatValue(netVolume),
      unit: netVolume !== null ? "m³" : ""
    }
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-semibold">
              {language === "ca" ? "Propietats de l'espai" : "Propiedades del espacio"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {properties.map((prop, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50 border border-border/50"
            >
              <span className="text-sm font-medium text-muted-foreground">
                {prop.label}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {prop.value}
                </span>
                {prop.unit && (
                  <span className="text-xs text-muted-foreground">{prop.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

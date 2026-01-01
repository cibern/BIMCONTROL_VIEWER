import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, Info, Box, Layers, Grid3x3, Building, BarChart3, Calculator, Hash, Ruler, Square, Weight, CheckCircle, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Viewer } from "@xeokit/xeokit-sdk";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { EditTypeSheet } from "./EditTypeSheet";
import { useParams } from "react-router-dom";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle, NestedDialogDescription } from "@/components/ui/nested-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// Traduccions de categories IFC
const IFC_TRANSLATIONS: Record<string, { ca: string; es: string }> = {
  // Estructura espacial (Spatial)
  "IfcProject": { ca: "Projecte", es: "Proyecto" },
  "IfcSite": { ca: "Emplaçament / Solar", es: "Emplazamiento / Solar" },
  "IfcBuilding": { ca: "Edifici", es: "Edificio" },
  "IfcBuildingStorey": { ca: "Planta d'edifici", es: "Planta de edificio" },
  "IfcSpace": { ca: "Espai / Estança", es: "Espacio / Estancia" },
  "IfcGrid": { ca: "Reixeta / Modulació", es: "Rejilla / Modulación" },
  // Elements arquitectònics
  "IfcWall": { ca: "Mur", es: "Muro" },
  "IfcWallStandardCase": { ca: "Mur (cas estàndard)", es: "Muro (caso estándar)" },
  "IfcSlab": { ca: "Forjat / Losa", es: "Forjado / Losa" },
  "IfcRoof": { ca: "Coberta", es: "Cubierta" },
  "IfcColumn": { ca: "Pilar", es: "Pilar" },
  "IfcBeam": { ca: "Bigueró / Viga", es: "Viga" },
  "IfcPlate": { ca: "Placa", es: "Placa" },
  "IfcMember": { ca: "Element lineal (barra)", es: "Elemento lineal (barra)" },
  "IfcCurtainWall": { ca: "Mur cortina", es: "Muro cortina" },
  "IfcRailing": { ca: "Barana", es: "Barandilla" },
  "IfcStair": { ca: "Escala", es: "Escalera" },
  "IfcRamp": { ca: "Rampa", es: "Rampa" },
  "IfcFooting": { ca: "Sabata (fonament)", es: "Zapata (cimentación)" },
  "IfcCovering": { ca: "Revestiment", es: "Revestimiento" },
  "IfcOpeningElement": { ca: "Obertura (buit)", es: "Abertura (hueco)" },
  "IfcDoor": { ca: "Porta", es: "Puerta" },
  "IfcWindow": { ca: "Finestra", es: "Ventana" },
  // Mobiliari i equipament
  "IfcFurnishingElement": { ca: "Element de mobiliari", es: "Elemento de mobiliario" },
  "IfcFurnitureType": { ca: "Tipus de moble", es: "Tipo de mueble" },
  "IfcTransportElement": { ca: "Element de transport", es: "Elemento de transporte" },
  // Instal·lacions (MEP) – elements base
  "IfcDistributionElement": { ca: "Element d'instal·lacions", es: "Elemento de instalaciones" },
  "IfcDistributionFlowElement": { ca: "Element de flux", es: "Elemento de flujo" },
  "IfcFlowTerminal": { ca: "Terminal de flux", es: "Terminal de flujo" },
  "IfcFlowSegment": { ca: "Tram (conducte/tub/cable)", es: "Tramo (conducto/tubo/cable)" },
  "IfcFlowController": { ca: "Element de control", es: "Elemento de control" },
  "IfcFlowFitting": { ca: "Accessori de connexió", es: "Accesorio de conexión" },
  "IfcFlowMeterType": { ca: "Comptador de cabal (tipus)", es: "Contador de caudal (tipo)" },
  "IfcDistributionPort": { ca: "Port d'instal·lacions", es: "Puerto de instalaciones" },
  "IfcSystem": { ca: "Sistema (instal·lacions)", es: "Sistema (instalaciones)" },
  // Instal·lacions (MEP) – tipologies habituals
  "IfcAirTerminalType": { ca: "Terminal d'aire (difusor/reixa)", es: "Terminal de aire (difusor/rejilla)" },
  "IfcDuctSegmentType": { ca: "Tram de conducte", es: "Tramo de conducto" },
  "IfcPipeSegmentType": { ca: "Tram de canonada", es: "Tramo de tubería" },
  "IfcValveType": { ca: "Vàlvula (tipus)", es: "Válvula (tipo)" },
  "IfcPumpType": { ca: "Bomba (tipus)", es: "Bomba (tipo)" },
  "IfcFanType": { ca: "Ventilador (tipus)", es: "Ventilador (tipo)" },
  "IfcBoilerType": { ca: "Caldera (tipus)", es: "Caldera (tipo)" },
  "IfcChillerType": { ca: "Refredadora (tipus)", es: "Enfriadora (tipo)" },
  "IfcUnitaryEquipmentType": { ca: "Equip unitari HVAC (tipus)", es: "Equipo unitario HVAC (tipo)" },
  "IfcLightFixtureType": { ca: "Lluminaire / Punt de llum (tipus)", es: "Luminaria / Punto de luz (tipo)" },
  "IfcSensorType": { ca: "Sensor (tipus)", es: "Sensor (tipo)" },
  "IfcAlarmType": { ca: "Alarma (tipus)", es: "Alarma (tipo)" },
  "IfcActuatorType": { ca: "Actuador (tipus)", es: "Actuador (tipo)" },
  // Dades, propietats i materials
  "IfcTypeObject": { ca: "Tipus d'objecte", es: "Tipo de objeto" },
  "IfcTypeProduct": { ca: "Tipus de producte", es: "Tipo de producto" },
  "IfcPropertySet": { ca: "Conjunt de propietats", es: "Conjunto de propiedades" },
  "IfcElementQuantity": { ca: "Quantitats d'element", es: "Cantidades de elemento" },
  "IfcMaterial": { ca: "Material", es: "Material" },
  "IfcMaterialLayerSet": { ca: "Conjunt de capes de material", es: "Conjunto de capas de material" },
  "IfcProfileDef": { ca: "Perfil (definició)", es: "Perfil (definición)" },
  "IfcProduct": { ca: "Producte (element geomètric)", es: "Producto (elemento geométrico)" },
  "IfcProductDefinitionShape": { ca: "Definició de forma", es: "Definición de forma" },
  // Documentació i referències
  "IfcDocumentReference": { ca: "Referència documental", es: "Referencia documental" },
  "IfcLibraryReference": { ca: "Referència de biblioteca", es: "Referencia de biblioteca" },
  "IfcProjectLibrary": { ca: "Biblioteca de projecte", es: "Biblioteca de proyecto" },
};

interface ElementGroup {
  type: string;
  marca?: string;
  comentarios?: string;
  ut: number;
  length: number;
  area: number;
  volume: number;
  mass: number;
  total: number;
}

interface WallsListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: Viewer | null;
  onConfigSaved?: () => void;
}

// Funció auxiliar per obtenir el metaModel (seguint measurementsGlobal.js)
function getMetaModel(viewer: Viewer | null) {
  if (!viewer) return null;
  const mm = viewer?.metaScene?.metaModels || {};
  const ids = Object.keys(mm);
  return ids.length ? mm[ids[0]] : null;
}

// Funció per normalitzar strings
function normStr(s: any): string {
  if (s == null) return "";
  const v = (typeof s === "object") ? (s.value ?? s.Value ?? s) : s;
  return (typeof v === "string") ? v.trim() : String(v ?? "").trim();
}

// Funció per convertir a número
function toNum(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  if (typeof v === "object") {
    for (const k of ["value", "Value", "val", "Val", "NominalValue"]) {
      if (k in v) {
        const n = toNum(v[k]);
        if (n != null) return n;
      }
    }
  }
  return null;
}

// Funció per normalitzar claus
function normKey(s: string): string {
  const t = normStr(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-\.]/g, "");
  return t;
}

// Funció per obtenir propietat per claus
function getByKeysFromProps(mo: any, keySet: Set<string>): number | null {
  const psets = mo?.propertySets;
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const arr = ps?.properties;
      if (!Array.isArray(arr)) continue;
      for (const p of arr) {
        const nk = normKey(p?.name ?? p?.Name);
        if (keySet.has(nk)) {
          const n = toNum(p?.value ?? p?.Value ?? p);
          if (n != null && n > 0) return n;
        }
      }
    }
  }
  return null;
}

const AREA_KEYS = new Set([
  "netsidearea", "grosssidearea", "netarea", "grossarea", "area", "footprintarea",
  "grossfootprintarea", "externalsurfacearea", "surfacearea", "glazedarea", "sidearea", "projectedarea"
].map(normKey));

const VOL_KEYS = new Set(["netvolume", "grossvolume", "volume", "volumen", "volum"].map(normKey));
const LEN_KEYS = new Set(["length", "perimeter", "longitud", "perimetre", "perimetro"].map(normKey));
const MASS_KEYS = new Set(["mass", "massa", "peso", "weight"].map(normKey));

// Funció per obtenir el nom del tipus (seguint measurementsGlobal.js)
function getNiceTypeName(mo: any): string {
  if (!mo) return "Desconegut";
  const BAD = new Set(["ifcproduct", "ifcelement", "ifcbuildingelement"]);
  const base = String(mo?.type || "").toLowerCase();
  if (base && !BAD.has(base) && !base.startsWith("ifc")) return mo.type;

  const candidates: { s: string; score: number }[] = [];
  const add = (raw: any, score = 1) => {
    const s = normStr(raw);
    if (!s) return;
    const low = s.toLowerCase();
    if (low.startsWith("ifc")) return;
    if (s.length < 2) return;
    candidates.push({ s, score: score + Math.min(3, Math.floor(s.length / 12)) });
  };

  const p = mo?.props || {};
  add(p?.type?.name, 10); add(p?.type?.Name, 10);
  add(p?.Type?.name, 10); add(p?.Type?.Name, 10);
  add(p.ObjectType, 9);
  add(p.TypeName, 9);
  add(p.Type, 8);
  for (const k of Object.keys(p)) if (k.toLowerCase().includes("type")) add(p[k], 7);

  const psets = mo?.propertySets;
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const arr = ps?.properties;
      if (!Array.isArray(arr)) continue;
      for (const prop of arr) {
        const nk = normKey(prop?.name ?? prop?.Name);
        if (nk.includes("type") || nk === "reference" || nk === "typename" || 
            nk === "familyandtype" || nk === "familytype") {
          add(prop?.value ?? prop?.Value ?? prop, 6);
        }
      }
    }
  }

  const nameMaybe = normStr(p.Name);
  if (nameMaybe && !nameMaybe.toLowerCase().startsWith("ifc")) add(nameMaybe, 5);

  if (candidates.length) {
    candidates.sort((a, b) => (b.score - a.score) || (b.s.length - a.s.length));
    return candidates[0].s;
  }
  return mo.type || "Desconegut";
}

// Funcions per obtenir magnituds
function getVolumeAny(mo: any): number | null {
  return getByKeysFromProps(mo, VOL_KEYS);
}

function getLengthAny(mo: any): number | null {
  return getByKeysFromProps(mo, LEN_KEYS);
}

function getMassAny(mo: any): number | null {
  return getByKeysFromProps(mo, MASS_KEYS);
}

function getAreaAny(mo: any): number | null {
  return getByKeysFromProps(mo, AREA_KEYS);
}

// Funció per obtenir Marca
function getMarca(mo: any): string | undefined {
  if (!mo?.propertySets || !Array.isArray(mo.propertySets)) return undefined;
  
  for (const pset of mo.propertySets) {
    if (pset?.properties && Array.isArray(pset.properties)) {
      for (const prop of pset.properties) {
        const propName = normStr(prop.name ?? prop.Name);
        if (propName === 'Marca') {
          return normStr(prop.value ?? prop.Value ?? prop);
        }
      }
    }
  }
  return undefined;
}

// Funció per obtenir Comentarios
function getComentarios(mo: any): string | undefined {
  if (!mo?.propertySets || !Array.isArray(mo.propertySets)) return undefined;
  
  for (const pset of mo.propertySets) {
    if (pset?.properties && Array.isArray(pset.properties)) {
      for (const prop of pset.properties) {
        const propName = normStr(prop.name ?? prop.Name);
        if (propName === 'Comentarios' || propName === 'Comments' || propName === 'Comment') {
          return normStr(prop.value ?? prop.Value ?? prop);
        }
      }
    }
  }
  return undefined;
}

// Funció per obtenir el valor "total" principal segons el tipus
function getMainValue(mo: any, viewer: any, id: string): number {
  const t = String(mo?.type || "").toLowerCase();
  const preferArea = (
    t.startsWith("ifcwall") || t.startsWith("ifcslab") ||
    t.startsWith("ifcwindow") || t.startsWith("ifcdoor") ||
    t.startsWith("ifcroof")
  );
  
  const A = getAreaAny(mo);
  const V = getVolumeAny(mo);
  const L = getLengthAny(mo);
  const M = getMassAny(mo);
  
  if (preferArea && A && A > 0) return A;
  if (A && A > 0) return A;
  if (V && V > 0) return V;
  if (L && L > 0) return L;
  if (M && M > 0) return M;
  return 1;
}

type SortColumn = 'marca' | 'ut' | 'length' | 'area' | 'volume' | 'mass';
type SortDirection = 'asc' | 'desc' | null;

interface IFCCategory {
  ifcCategory: string;
  typesGroups: TypeGroup[];
}

interface TypeGroup {
  type: string;
  elements: ElementGroup[];
}

export const WallsListModal = ({ open, onOpenChange, viewer, onConfigSaved }: WallsListModalProps) => {
  const { language } = useLanguage();
  const params = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const centerId = params.project || searchParams.get('project');
  
  console.log("[WallsListModal] centerId from params:", params.project);
  console.log("[WallsListModal] centerId from search:", searchParams.get('project'));
  console.log("[WallsListModal] Final centerId:", centerId);
  
  const [ifcCategories, setIfcCategories] = useState<IFCCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [typeConfigs, setTypeConfigs] = useState<Map<string, any>>(new Map());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<{ ifcCategory: string; typeName: string } | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [hasAcceptedBudget, setHasAcceptedBudget] = useState(false);

  // Funció per traduir les categories IFC
  const translateIfcCategory = (ifcType: string): string => {
    const translation = IFC_TRANSLATIONS[ifcType];
    if (translation) {
      return translation[language];
    }
    // Si no hi ha traducció, retornar el tipus original
    return ifcType;
  };

  // Funció per pluralitzar categories
  const pluralizeCategory = (category: string): string => {
    // Regles bàsiques de pluralització en català i espanyol
    if (language === 'ca') {
      if (category.endsWith('a')) return category + 's';
      if (category.endsWith('e')) return category + 's';
      if (category.endsWith('i')) return category + 's';
      if (category.endsWith('o')) return category + 's';
      if (category.endsWith('u')) return category + 's';
      if (category.endsWith('ó')) return category.slice(0, -1) + 'ons';
      return category + 's';
    } else {
      // Espanyol
      if (category.endsWith('a')) return category + 's';
      if (category.endsWith('e')) return category + 's';
      if (category.endsWith('i')) return category + 's';
      if (category.endsWith('o')) return category + 's';
      if (category.endsWith('u')) return category + 's';
      if (category.endsWith('ión')) return category.slice(0, -3) + 'iones';
      return category + 's';
    }
  };

  // Carregar configuracions de tipus des de la base de dades
  const loadTypeConfigs = async () => {
    if (!centerId) return;
    
    try {
      // @ts-ignore - TypeScript inference issue with Supabase queries
      const queryPromise = supabase
        .from("element_type_configs")
        .select("*")
        .eq("project_id", centerId);
      
      const queryResult: any = await queryPromise;
      const data = queryResult.data;
      const error = queryResult.error;

      if (error) {
        console.error("Error loading type configs:", error);
        return;
      }

      const configsMap = new Map();
      data?.forEach((config) => {
        const key = `${config.ifc_category}|${config.type_name}`;
        configsMap.set(key, config);
      });
      setTypeConfigs(configsMap);
    } catch (error) {
      console.error("Error loading type configs:", error);
    }
  };

  // Listen for element-config-updated event to refresh when elements are edited graphically
  useEffect(() => {
    const handleConfigUpdated = () => {
      console.log("[WallsListModal] Element config updated, refreshing...");
      loadTypeConfigs();
    };
    
    window.addEventListener("element-config-updated", handleConfigUpdated);
    return () => {
      window.removeEventListener("element-config-updated", handleConfigUpdated);
    };
  }, [centerId]);

  useEffect(() => {
    if (!open || !viewer) {
      return;
    }

    loadTypeConfigs();
    setLoading(true);
    
    try {
      console.log("[WallsListModal] Iniciant lectura...");
      console.log("[WallsListModal] Viewer:", viewer);
      console.log("[WallsListModal] MetaScene:", viewer?.metaScene);
      console.log("[WallsListModal] MetaModels:", viewer?.metaScene?.metaModels);
      
      // Utilitzar la mateixa funció que measurementsGlobal.js
      const metaModel: any = getMetaModel(viewer);
      console.log("[WallsListModal] MetaModel obtingut:", metaModel);
      
      // CRITICAL: Check like measurementsGlobal.js does (line 852-853)
      if (!metaModel?.metaObjects) {
        console.error("[WallsListModal] No metaObjects available");
        console.error("[WallsListModal] metaModel:", metaModel);
        alert("Cap model carregat o sense metadades.");
        setLoading(false);
        return;
      }

      const metaObjects = metaModel.metaObjects;
      const totalObjects = Object.keys(metaObjects).length;
      
      console.log("[WallsListModal] Total metaObjects:", totalObjects);
      
      if (totalObjects === 0) {
        console.warn("[WallsListModal] metaObjects està buit");
        setIfcCategories([]);
        setLoading(false);
        return;
      }

      // Mapa per agrupar per categoria IFC > tipus > marca
      const ifcMap = new Map<string, Map<string, Map<string, {
        ifcCategory: string;
        type: string;
        marca?: string;
        comentarios?: string;
        ut: number;
        length: number;
        area: number;
        volume: number;
        mass: number;
        total: number;
      }>>>();

      // Processar tots els objectes
      for (const id of Object.keys(metaObjects)) {
        const mo = metaObjects[id];
        if (!mo) continue;

        const ifcCategory = mo.type || "Desconegut"; // IfcWall, IfcSlab, etc.
        const typeName = getNiceTypeName(mo);
        const marca = getMarca(mo);
        const comentarios = getComentarios(mo);
        
        // Obtenir totes les magnituds
        const length = getLengthAny(mo) || 0;
        const area = getAreaAny(mo) || 0;
        const volume = getVolumeAny(mo) || 0;
        const mass = getMassAny(mo) || 0;
        const mainValue = getMainValue(mo, viewer, id);

        // Crear estructura jeràrquica: IFC > Tipus > Marca
        if (!ifcMap.has(ifcCategory)) {
          ifcMap.set(ifcCategory, new Map());
        }
        const typeMap = ifcMap.get(ifcCategory)!;
        
        if (!typeMap.has(typeName)) {
          typeMap.set(typeName, new Map());
        }
        const marcaMap = typeMap.get(typeName)!;
        
        const key = marca || "__no_marca__";
        if (!marcaMap.has(key)) {
          marcaMap.set(key, {
            ifcCategory,
            type: typeName,
            marca,
            comentarios,
            ut: 0,
            length: 0,
            area: 0,
            volume: 0,
            mass: 0,
            total: 0
          });
        }

        const group = marcaMap.get(key)!;
        group.ut += 1;
        group.length += length;
        group.area += area;
        group.volume += volume;
        group.mass += mass;
        group.total += mainValue;
      }

      // Convertir a estructura final
      const ifcCategoriesArray: IFCCategory[] = [];
      
      for (const [ifcCategory, typeMap] of ifcMap.entries()) {
        const typesGroups: TypeGroup[] = [];
        
        for (const [type, marcaMap] of typeMap.entries()) {
          const elements: ElementGroup[] = Array.from(marcaMap.values());
          typesGroups.push({ type, elements });
        }
        
        // Ordenar tipus alfabèticament
        typesGroups.sort((a, b) => a.type.localeCompare(b.type, undefined, { sensitivity: "base" }));
        
        ifcCategoriesArray.push({
          ifcCategory,
          typesGroups
        });
      }

      // Ordenar categories IFC alfabèticament
      ifcCategoriesArray.sort((a, b) => 
        a.ifcCategory.localeCompare(b.ifcCategory, undefined, { sensitivity: "base" })
      );

      console.log("[WallsListModal] Categories IFC detectades:", ifcCategoriesArray.length);
      setIfcCategories(ifcCategoriesArray);
    } catch (error) {
      console.error("[WallsListModal] Error detectant murs:", error);
      alert("Error detectant murs: " + error);
    } finally {
      setLoading(false);
    }
  }, [open, viewer, centerId]);

  const handleEditType = (ifcCategory: string, typeName: string) => {
    if (hasAcceptedBudget) {
      console.log("[WallsListModal] Edit blocked - budget is accepted");
      toast.error("No es pot editar", {
        description: "El pressupost està fixat i no es poden fer modificacions"
      });
      return;
    }
    console.log("[WallsListModal] handleEditType called:", { ifcCategory, typeName, centerId });
    setEditingType({ ifcCategory, typeName });
    setEditModalOpen(true);
    console.log("[WallsListModal] State updated - editModalOpen should be true");
  };

  const handleSaveTypeConfig = () => {
    loadTypeConfigs();
    onConfigSaved?.();
  };

  // Comprovar si hi ha pressupost acceptat
  useEffect(() => {
    const checkAcceptedBudget = async () => {
      if (!centerId) return;
      
      const { data, error } = await supabase
        .from("supplier_budgets")
        .select("id")
        .eq("project_id", centerId)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error("[WallsListModal] Error checking accepted budget:", error);
        return;
      }
      
      setHasAcceptedBudget(!!data);
    };
    
    checkAcceptedBudget();
  }, [centerId]);

  // Funció per obtenir el nom del tipus amb indicació d'origen IFC
  const getDisplayTypeName = (ifcCategory: string, typeName: string): { display: string; isCustom: boolean } => {
    const key = `${ifcCategory}|${typeName}`;
    const config = typeConfigs.get(key);
    if (config?.custom_name) {
      return { 
        display: `${config.custom_name} (IFC: ${typeName})`, 
        isCustom: true 
      };
    }
    return { display: typeName, isCustom: false };
  };

  // Funció per obtenir la descripció
  const getTypeDescription = (ifcCategory: string, typeName: string): string | null => {
    const key = `${ifcCategory}|${typeName}`;
    const config = typeConfigs.get(key);
    return config?.description || null;
  };

  // Funció per obtenir la unitat preferida
  const getPreferredUnit = (ifcCategory: string, typeName: string): string => {
    const key = `${ifcCategory}|${typeName}`;
    const config = typeConfigs.get(key);
    return config?.preferred_unit || 'UT';
  };

  // Funció per verificar si un element està editat (amb qualsevol camp modificat)
  const isTypeEdited = (ifcCategory: string, typeName: string): boolean => {
    const key = `${ifcCategory}|${typeName}`;
    const config = typeConfigs.get(key);
    if (!config) return false;
    
    // Es considera editat si té:
    // - Nom personalitzat
    // - Descripció
    // - Unitat preferida diferent de 'UT'
    // - Capítol assignat
    // - Subcapítol assignat
    return !!(
      config.custom_name ||
      config.description ||
      (config.preferred_unit && config.preferred_unit !== 'UT') ||
      config.chapter_id ||
      config.subchapter_id
    );
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortElements = (elements: ElementGroup[]): ElementGroup[] => {
    if (!sortColumn || !sortDirection) return elements;

    return [...elements].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortColumn === 'marca') {
        aVal = a.marca || '';
        bVal = b.marca || '';
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string, undefined, { sensitivity: "base" })
          : bVal.localeCompare(aVal as string, undefined, { sensitivity: "base" });
      } else {
        aVal = a[sortColumn];
        bVal = b[sortColumn];
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const totalTypes = ifcCategories.reduce((sum, ifc) => 
    sum + ifc.typesGroups.reduce((s, tg) => s + tg.elements.length, 0), 0
  );
  const totalUt = ifcCategories.reduce((sum, ifc) => 
    sum + ifc.typesGroups.reduce((s1, tg) => 
      s1 + tg.elements.reduce((s2, e) => s2 + e.ut, 0), 0
    ), 0
  );
  const totalArea = ifcCategories.reduce((sum, ifc) => 
    sum + ifc.typesGroups.reduce((s1, tg) => 
      s1 + tg.elements.reduce((s2, e) => s2 + e.area, 0), 0
    ), 0
  );
  
  // Comptador d'elements editats vs no editats
  let editedTypesCount = 0;
  let totalTypesCount = 0;
  ifcCategories.forEach(ifc => {
    ifc.typesGroups.forEach(tg => {
      totalTypesCount++;
      if (isTypeEdited(ifc.ifcCategory, tg.type)) {
        editedTypesCount++;
      }
    });
  });
  const notEditedTypesCount = totalTypesCount - editedTypesCount;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] max-h-[95vh] flex flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">Amidaments - Llistat d'elements del model IFC</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Tots els elements del model agrupats per categoria i tipus. Clica <Edit className="inline h-3.5 w-3.5" /> per assignar-los a l'estructura del pressupost.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end mt-2">
          <Button
            variant="outline"
            onClick={() => setTutorialOpen(true)}
            className="gap-2"
            size="sm"
          >
            <Info className="h-4 w-4" />
            Tutorial
          </Button>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Processant elements...</p>
          </div>
        ) : ifcCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 gap-2">
            <p className="text-muted-foreground">No s'han trobat elements al model</p>
            <p className="text-xs text-muted-foreground">Assegura't que el model estigui completament carregat</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 mt-6 overflow-y-auto pr-4 pb-4">
              <Accordion type="multiple" className="w-full">
                {ifcCategories.map((ifcCat) => {
                  const totalIfcElements = ifcCat.typesGroups.reduce((sum, tg) => 
                    sum + tg.elements.length, 0
                  );
                  const totalIfcUt = ifcCat.typesGroups.reduce((sum, tg) => 
                    sum + tg.elements.reduce((s, e) => s + e.ut, 0), 0
                  );
                  
                  return (
                    <AccordionItem key={ifcCat.ifcCategory} value={ifcCat.ifcCategory}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex justify-between items-center w-full pr-4">
                          <span className="font-bold text-base">{pluralizeCategory(translateIfcCategory(ifcCat.ifcCategory))}</span>
                          <span className="text-sm text-muted-foreground">
                            {ifcCat.typesGroups.length} tipus · {totalIfcElements} exemplars · {totalIfcUt} ut
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Accordion type="multiple" className="w-full pl-4">
                          {ifcCat.typesGroups.map((typeGroup) => {
                            const sortedElements = sortElements(typeGroup.elements);
                            const typeUt = typeGroup.elements.reduce((sum, e) => sum + e.ut, 0);
                            const typeLength = typeGroup.elements.reduce((sum, e) => sum + e.length, 0);
                            const typeArea = typeGroup.elements.reduce((sum, e) => sum + e.area, 0);
                            const typeVolume = typeGroup.elements.reduce((sum, e) => sum + e.volume, 0);
                            const typeMass = typeGroup.elements.reduce((sum, e) => sum + e.mass, 0);
                            const typeDescription = getTypeDescription(ifcCat.ifcCategory, typeGroup.type);
                            const typeNameInfo = getDisplayTypeName(ifcCat.ifcCategory, typeGroup.type);
                            const isEdited = isTypeEdited(ifcCat.ifcCategory, typeGroup.type);
                            const preferredUnit = getPreferredUnit(ifcCat.ifcCategory, typeGroup.type);
                            
                            return (
                              <AccordionItem key={`${ifcCat.ifcCategory}-${typeGroup.type}`} value={`${ifcCat.ifcCategory}-${typeGroup.type}`}>
                                <AccordionTrigger className={cn(
                                  "hover:no-underline py-3",
                                  isEdited && "bg-yellow-200/70 dark:bg-yellow-700/30 hover:bg-yellow-200/90 dark:hover:bg-yellow-700/40"
                                 )}>
                                  <div className="flex justify-between items-center w-full pr-4">
                                    <div className="flex flex-col items-start gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">{typeNameInfo.display}</span>
                                        <div
                                          role="button"
                                          tabIndex={hasAcceptedBudget ? -1 : 0}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (hasAcceptedBudget) return;
                                            console.log("[WallsListModal] Edit button click:", ifcCat.ifcCategory, typeGroup.type);
                                            handleEditType(ifcCat.ifcCategory, typeGroup.type);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              if (hasAcceptedBudget) return;
                                              handleEditType(ifcCat.ifcCategory, typeGroup.type);
                                            }
                                          }}
                                          className={cn(
                                            "h-6 w-6 p-0 flex items-center justify-center rounded",
                                            hasAcceptedBudget 
                                              ? "opacity-30 cursor-not-allowed" 
                                              : "hover:bg-accent cursor-pointer"
                                          )}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </div>
                                      </div>
                                      {typeDescription && (
                                        <span className="text-xs text-muted-foreground italic max-w-[600px]">
                                          {typeDescription}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {typeGroup.elements.length} exemplar{typeGroup.elements.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-2 px-4">
                                    {/* Tabla completa amb totes les columnes */}
                                    <div className="grid grid-cols-8 gap-2 pb-2 border-b font-semibold text-xs sticky top-0 bg-background z-10">
                                      <button 
                                        onClick={() => handleSort('marca')}
                                        className="flex items-center hover:text-primary transition-colors col-span-2 text-muted-foreground"
                                      >
                                        Marca
                                        <SortIcon column="marca" />
                                      </button>
                                      <div className="text-xs text-muted-foreground">Comentarios</div>
                                      <button 
                                        onClick={() => handleSort('ut')}
                                        className={cn(
                                          "text-right flex items-center justify-end hover:text-primary transition-colors",
                                          preferredUnit === "UT" ? "text-foreground" : "text-muted-foreground"
                                        )}
                                      >
                                        UT
                                        <SortIcon column="ut" />
                                      </button>
                                      <button 
                                        onClick={() => handleSort('length')}
                                        className={cn(
                                          "text-right flex items-center justify-end hover:text-primary transition-colors",
                                          preferredUnit === "ML" ? "text-foreground" : "text-muted-foreground"
                                        )}
                                      >
                                        ML
                                        <SortIcon column="length" />
                                      </button>
                                      <button 
                                        onClick={() => handleSort('area')}
                                        className={cn(
                                          "text-right flex items-center justify-end hover:text-primary transition-colors",
                                          preferredUnit === "M2" ? "text-foreground" : "text-muted-foreground"
                                        )}
                                      >
                                        M²
                                        <SortIcon column="area" />
                                      </button>
                                      <button 
                                        onClick={() => handleSort('volume')}
                                        className={cn(
                                          "text-right flex items-center justify-end hover:text-primary transition-colors",
                                          preferredUnit === "M3" ? "text-foreground" : "text-muted-foreground"
                                        )}
                                      >
                                        M³
                                        <SortIcon column="volume" />
                                      </button>
                                      <button 
                                        onClick={() => handleSort('mass')}
                                        className={cn(
                                          "text-right flex items-center justify-end hover:text-primary transition-colors",
                                          preferredUnit === "KG" ? "text-foreground" : "text-muted-foreground"
                                        )}
                                      >
                                        KG
                                        <SortIcon column="mass" />
                                      </button>
                                    </div>
                                    {sortedElements.map((elem, idx) => (
                                      <div 
                                        key={`${elem.marca || "no-marca"}-${idx}`}
                                        className="grid grid-cols-8 gap-2 py-2 border-b hover:bg-accent/50 transition-colors text-sm"
                                      >
                                        <div className="truncate text-xs col-span-2 text-muted-foreground">
                                          {elem.marca || '-'}
                                        </div>
                                        <div className="truncate text-xs text-muted-foreground">
                                          {elem.comentarios || '-'}
                                        </div>
                                        <div className={cn(
                                          "text-right font-mono text-xs text-muted-foreground",
                                          isEdited && preferredUnit === "UT" && "bg-yellow-200/70 dark:bg-yellow-700/30 text-foreground font-semibold"
                                        )}>
                                          {elem.ut}
                                        </div>
                                        <div className={cn(
                                          "text-right font-mono text-xs text-muted-foreground",
                                          isEdited && preferredUnit === "ML" && "bg-yellow-200/70 dark:bg-yellow-700/30 text-foreground font-semibold"
                                        )}>
                                          {elem.length > 0 ? elem.length.toFixed(2) : '-'}
                                        </div>
                                        <div className={cn(
                                          "text-right font-mono text-xs text-muted-foreground",
                                          isEdited && preferredUnit === "M2" && "bg-yellow-200/70 dark:bg-yellow-700/30 text-foreground font-semibold"
                                        )}>
                                          {elem.area > 0 ? elem.area.toFixed(2) : '-'}
                                        </div>
                                        <div className={cn(
                                          "text-right font-mono text-xs text-muted-foreground",
                                          isEdited && preferredUnit === "M3" && "bg-yellow-200/70 dark:bg-yellow-700/30 text-foreground font-semibold"
                                        )}>
                                          {elem.volume > 0 ? elem.volume.toFixed(2) : '-'}
                                        </div>
                                        <div className={cn(
                                          "text-right font-mono text-xs text-muted-foreground",
                                          isEdited && preferredUnit === "KG" && "bg-yellow-200/70 dark:bg-yellow-700/30 text-foreground font-semibold"
                                        )}>
                                          {elem.mass > 0 ? elem.mass.toFixed(2) : '-'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                          );
                        })}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
          </div>
        )}
        
        <div className="flex flex-col gap-2 pt-4 border-t flex-shrink-0">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Total: <strong>{ifcCategories.length}</strong> categories IFC · <strong>{totalTypes}</strong> exemplars
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Total Ut: <strong>{totalUt}</strong></span>
              <span>Total Superfície: <strong>{totalArea.toFixed(2)} m²</strong></span>
            </div>
          </div>
          <div className="flex justify-end items-center gap-6 text-sm">
            <span className="text-muted-foreground">
              Elements editats: <strong className="text-yellow-700 dark:text-yellow-500">{editedTypesCount}</strong>
            </span>
            <span className="text-muted-foreground">
              Elements sense editar: <strong className="text-foreground">{notEditedTypesCount}</strong>
            </span>
            <span className="text-muted-foreground">
              Total elements: <strong className="text-primary">{totalTypesCount}</strong>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* EditTypeSheet fora del Dialog principal */}
    {editingType && centerId && (
      <EditTypeSheet
        open={editModalOpen}
        onOpenChange={(open) => {
          console.log("[WallsListModal] Sheet onOpenChange:", open);
          setEditModalOpen(open);
        }}
        projectId={centerId}
        ifcCategory={editingType.ifcCategory}
        typeName={editingType.typeName}
        onSave={handleSaveTypeConfig}
        viewer={viewer}
      />
    )}

    {/* Tutorial Dialog */}
    <NestedDialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
      <NestedDialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0">
        <NestedDialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <NestedDialogTitle className="flex items-center gap-2 text-2xl">
            <Layers className="h-6 w-6 text-primary" />
            Tutorial - Amidaments del model IFC
          </NestedDialogTitle>
          <NestedDialogDescription>
            Guia completa per mesurar i organitzar els elements del model IFC
          </NestedDialogDescription>
        </NestedDialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-6 pt-4">
            {/* Què és el Portal Industrial */}
            <Card className="border-2 border-primary/20 shadow-lg">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building className="h-6 w-6 text-primary" />
                  🏭 Què és el Portal Industrial?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 mt-4">
                <p className="text-muted-foreground leading-relaxed">
                  El Portal Industrial és la teva eina per gestionar projectes i pressupostos de manera professional. 
                  Aquí podràs visualitzar projectes assignats segons les teves especialitats, valorar partides i 
                  enviar pressupostos als clients.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Aquest tutorial t'explicarà com utilitzar les diferents funcionalitats d'amidaments per organitzar 
                  i estructurar els pressupostos dels teus projectes.
                </p>
              </CardContent>
            </Card>

            {/* Què són els amidaments */}
            <Card className="border-2 border-blue-200/50 shadow-lg">
              <CardHeader className="bg-blue-50/50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                  📊 Què són els amidaments?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 mt-4">
                <p className="text-muted-foreground leading-relaxed">
                  Els amidaments són les <strong>quantitats mesurades</strong> de cada element constructiu del teu projecte. 
                  Aquest modal mostra tots els elements que hi ha al model IFC organitzats per categories i tipus.
                </p>
              </CardContent>
            </Card>

            {/* Com s'organitzen els elements */}
            <Card className="border-2 border-purple-200/50 shadow-lg">
              <CardHeader className="bg-purple-50/50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Layers className="h-6 w-6 text-purple-600" />
                  🏗️ Com s'organitzen els elements?
                </CardTitle>
                <CardDescription>
                  Estructura jeràrquica del model IFC en 3 nivells
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 mt-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-white border">
                    <Layers className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-sm mb-1">1. Categoria IFC</h5>
                      <p className="text-xs text-muted-foreground">Ex: IfcWall (Murs), IfcSlab (Forjats), IfcWindow (Finestres)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-white border ml-4">
                    <Box className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-sm mb-1">2. Tipus d'element</h5>
                      <p className="text-xs text-muted-foreground">Ex: "Mur de càrrega 30cm", "Finestra 120x150"</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-white border ml-8">
                    <Grid3x3 className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-sm mb-1">3. Exemplars per marca/comentari</h5>
                      <p className="text-xs text-muted-foreground">Diferents configuracions del mateix tipus</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quines quantitats es calculen */}
            <Card className="border-2 border-green-200/50 shadow-lg">
              <CardHeader className="bg-green-50/50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Calculator className="h-6 w-6 text-green-600" />
                  📏 Quines quantitats es calculen?
                </CardTitle>
                <CardDescription>
                  Mesures automàtiques extretes del model IFC
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 mt-4">
                <p className="text-muted-foreground leading-relaxed">
                  Per a cada element, l'aplicació extreu automàticament aquestes mesures del model:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Hash className="h-5 w-5 text-blue-600" />
                      <h5 className="font-semibold text-blue-900">UT - Unitats</h5>
                    </div>
                    <p className="text-xs text-blue-800">Número d'elements</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-green-200 bg-green-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Ruler className="h-5 w-5 text-green-600" />
                      <h5 className="font-semibold text-green-900">ML - Metres lineals</h5>
                    </div>
                    <p className="text-xs text-green-800">Longitud total</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Square className="h-5 w-5 text-amber-600" />
                      <h5 className="font-semibold text-amber-900">M² - Metres quadrats</h5>
                    </div>
                    <p className="text-xs text-amber-800">Superfície total</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-purple-200 bg-purple-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Box className="h-5 w-5 text-purple-600" />
                      <h5 className="font-semibold text-purple-900">M³ - Metres cúbics</h5>
                    </div>
                    <p className="text-xs text-purple-800">Volum total</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-red-200 bg-red-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Weight className="h-5 w-5 text-red-600" />
                      <h5 className="font-semibold text-red-900">KG - Quilograms</h5>
                    </div>
                    <p className="text-xs text-red-800">Massa total</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <p className="text-xs text-blue-800">
                    💡 Segons el tipus d'element, es mostra automàticament la mesura més rellevant
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Com assignar elements */}
            <Card className="border-2 border-orange-200/50 shadow-lg">
              <CardHeader className="bg-orange-50/50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Edit className="h-6 w-6 text-orange-600" />
                  ✏️ Com assignar elements a l'estructura del pressupost?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 mt-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Passos per assignar elements:
                  </h4>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary flex-shrink-0">1.</span>
                      <p className="text-sm text-muted-foreground">Navega per les categories i troba l'element que vols organitzar</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary flex-shrink-0">2.</span>
                      <p className="text-sm text-muted-foreground">Clica la icona <Edit className="inline h-3.5 w-3.5" /> al costat del nom del tipus</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary flex-shrink-0">3.</span>
                      <div className="text-sm text-muted-foreground">
                        <p className="mb-2">Al formulari que s'obre pots:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Posar un <strong>nom personalitzat</strong> més entenedor</li>
                          <li>Afegir una <strong>descripció</strong> detallada</li>
                          <li>Seleccionar la <strong>unitat preferida</strong> (UT, ML, M², M³, KG)</li>
                          <li>Assignar un <strong>capítol, subcapítol i sub-subcapítol</strong></li>
                        </ul>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary flex-shrink-0">4.</span>
                      <p className="text-sm text-muted-foreground">Clica "Guardar" i les <strong>quantitats es calcularan i guardaran automàticament</strong> segons la unitat seleccionada</p>
                    </li>
                  </ol>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    💡 Important:
                  </h4>
                  <p className="text-xs text-yellow-800">
                    Els elements assignats apareixen amb fons groc per identificar-los fàcilment. 
                    Un cop assignats, els podràs veure organitzats a l'<strong>Estructura del pressupost</strong> (modal 2).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Flux de treball */}
            <Card className="border-2 border-indigo-200/50 shadow-lg">
              <CardHeader className="bg-indigo-50/50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Workflow className="h-6 w-6 text-indigo-600" />
                  🔄 Flux de treball complet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="font-bold text-2xl flex-shrink-0">1️⃣</span>
                    <div>
                      <p className="font-medium">Modal Amidaments (aquí)</p>
                      <p className="text-sm text-muted-foreground">Visualitza tots els elements i assigna'ls a categories del pressupost</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="font-bold text-2xl flex-shrink-0">2️⃣</span>
                    <div>
                      <p className="font-medium">Modal Estructura del pressupost</p>
                      <p className="text-sm text-muted-foreground">Revisa l'organització i afegeix partides manuals</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="font-bold text-2xl flex-shrink-0">3️⃣</span>
                    <div>
                      <p className="font-medium">Assignar industrials</p>
                      <p className="text-sm text-muted-foreground">Sol·licita pressupostos als proveïdors especialitzats</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="font-bold text-2xl flex-shrink-0">4️⃣</span>
                    <div>
                      <p className="font-medium">Comparar ofertes</p>
                      <p className="text-sm text-muted-foreground">Analitza les ofertes rebudes i selecciona les millors opcions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </NestedDialogContent>
    </NestedDialog>
    </>
  );
};

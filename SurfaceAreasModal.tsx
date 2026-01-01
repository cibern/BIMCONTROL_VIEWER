import { useState, useEffect, useRef, useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Building2, Plus, Trash2, Save, Info, ChevronDown, ChevronRight, GripVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SurfaceAreasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface UsefulAreaRow {
  id: string;
  level: string;
  name: string;
  reference: string;
  area: number;
  isFromIFC?: boolean;
  displayOrder?: number;
  linkedToBudget?: boolean; // New field for budget linking
}

interface BuiltAreaRow {
  id: string;
  level: string;
  name: string;
  computation: number; // Now stored as percentage (0-100)
  area: number;
  isFromIFC?: boolean;
  displayOrder?: number;
  linkedToBudget?: boolean; // New field for budget linking
}

interface LevelCustomName {
  ifcLevel: string;
  customName: string;
}

interface SurfaceData {
  useful_areas: UsefulAreaRow[];
  built_areas: BuiltAreaRow[];
  level_custom_names?: LevelCustomName[];
}

interface BudgetLine {
  id: string;
  zona_planta: string;
  superficie: number;
  display_order: number;
}

// Sortable row component for drag and drop (useful areas)
interface SortableRowProps {
  row: UsefulAreaRow;
  isFromIFC: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: keyof UsefulAreaRow, value: string | number | boolean) => void;
  fromIFCLabel: string;
  onBudgetLinkChange: (id: string, linked: boolean, zonaPlanta: string, superficie: number) => void;
  getDisplayName: (level: string) => string;
}

// Sortable row component for built areas
interface SortableBuiltRowProps {
  row: BuiltAreaRow;
  isFromIFC: boolean;
  onUpdate: (id: string, field: keyof BuiltAreaRow, value: string | number | boolean) => void;
  fromIFCLabel: string;
  calculateComputedArea: (area: number, computation: number) => number;
  onBudgetLinkChange: (id: string, linked: boolean, zonaPlanta: string, superficie: number) => void;
  getDisplayName: (level: string) => string;
}

const SortableRow = ({ row, isFromIFC, onDelete, onUpdate, fromIFCLabel, onBudgetLinkChange, getDisplayName }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const zonaPlanta = `${getDisplayName(row.level)} - ${row.name}`;

  const handleCheckboxChange = (checked: boolean) => {
    onUpdate(row.id, "linkedToBudget", checked);
    onBudgetLinkChange(row.id, checked, zonaPlanta, row.area);
  };

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={`${isFromIFC ? "bg-blue-50/30 dark:bg-blue-950/20" : ""} ${isDragging ? "z-50" : ""}`}
    >
      <TableCell className="py-2 w-[30px] cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      <TableCell className="py-2 w-[40px] text-center">
        <Checkbox 
          checked={row.linkedToBudget || false}
          onCheckedChange={handleCheckboxChange}
        />
      </TableCell>
      <TableCell className="py-2">
        {isFromIFC ? (
          <span className="text-sm">{row.name || "-"}</span>
        ) : (
          <Input value={row.name} onChange={(e) => onUpdate(row.id, "name", e.target.value)} className="h-8 text-sm" />
        )}
      </TableCell>
      <TableCell className="py-2 text-right w-[100px]">
        {isFromIFC ? (
          <span className="text-sm font-medium">{row.area.toFixed(2)}</span>
        ) : (
          <Input type="number" step="0.01" min="0" value={row.area || ""} onChange={(e) => onUpdate(row.id, "area", parseFloat(e.target.value) || 0)} className="h-8 text-sm text-right" />
        )}
      </TableCell>
      <TableCell className="py-2 text-center w-[70px]">
        {isFromIFC && <Badge variant="secondary" className="text-xs">{fromIFCLabel}</Badge>}
      </TableCell>
      <TableCell className="py-2 w-[50px]">
        {!isFromIFC && (
          <Button variant="ghost" size="icon" onClick={() => onDelete(row.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

const SortableBuiltRow = ({ row, isFromIFC, onUpdate, fromIFCLabel, calculateComputedArea, onBudgetLinkChange, getDisplayName }: SortableBuiltRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const computedArea = calculateComputedArea(row.area, row.computation);
  const zonaPlanta = `${getDisplayName(row.level)} - ${row.name}`;

  const handleCheckboxChange = (checked: boolean) => {
    onUpdate(row.id, "linkedToBudget", checked);
    // For built areas, use computed area (superficie computable)
    onBudgetLinkChange(row.id, checked, zonaPlanta, computedArea);
  };

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={`${isFromIFC ? "bg-blue-50/30 dark:bg-blue-950/20" : ""} ${isDragging ? "z-50" : ""}`}
    >
      <TableCell className="py-2 w-[30px] cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      <TableCell className="py-2 w-[40px] text-center">
        <Checkbox 
          checked={row.linkedToBudget || false}
          onCheckedChange={handleCheckboxChange}
        />
      </TableCell>
      <TableCell className="py-2">
        {isFromIFC ? (
          <span className="text-sm">{row.name || "-"}</span>
        ) : (
          <Input value={row.name} onChange={(e) => onUpdate(row.id, "name", e.target.value)} className="h-8 text-sm" />
        )}
      </TableCell>
      <TableCell className="py-2 text-right w-[90px]">
        {isFromIFC ? (
          <span className="text-sm font-medium">{row.area.toFixed(2)}</span>
        ) : (
          <Input type="number" step="0.01" min="0" value={row.area || ""} onChange={(e) => onUpdate(row.id, "area", parseFloat(e.target.value) || 0)} className="h-8 text-sm text-right w-20" />
        )}
      </TableCell>
      <TableCell className="py-2 text-center w-[110px]">
        <div className="flex items-center justify-center gap-1">
          <Input 
            type="number" 
            step="1" 
            min="0" 
            max="100"
            value={row.computation || 100} 
            onChange={(e) => onUpdate(row.id, "computation", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} 
            className="h-8 text-sm text-center w-16" 
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell className="py-2 text-right w-[90px]">
        <span className="text-sm font-medium">{computedArea.toFixed(2)}</span>
      </TableCell>
      <TableCell className="py-2 text-center w-[50px]">
        {isFromIFC && <Badge variant="secondary" className="text-xs">{fromIFCLabel}</Badge>}
      </TableCell>
    </TableRow>
  );
};

const getPropertyValue = (metaObject: any, propertyNames: string[]): string => {
  if (!metaObject?.propertySets) return "";
  
  for (const pset of metaObject.propertySets) {
    if (!pset.properties) continue;
    for (const prop of pset.properties) {
      const propNameLower = prop.name?.toLowerCase() || "";
      for (const searchName of propertyNames) {
        if (propNameLower.includes(searchName.toLowerCase())) {
          if (prop.value !== null && prop.value !== undefined) {
            return String(prop.value);
          }
        }
      }
    }
  }
  return "";
};

const getRoomName = (metaObject: any): string => {
  // Priority 1: Look for "Nombre" in "Datos de identidad" property set
  if (metaObject?.propertySets) {
    for (const pset of metaObject.propertySets) {
      const psetName = pset.name?.toLowerCase() || "";
      if (psetName.includes("datos de identidad") || psetName.includes("identity data") || psetName.includes("dades d'identitat")) {
        if (pset.properties) {
          for (const prop of pset.properties) {
            const propName = prop.name?.toLowerCase() || "";
            if (propName === "nombre" || propName === "nom" || propName === "name") {
              if (prop.value && String(prop.value).trim() !== "") {
                return String(prop.value);
              }
            }
          }
        }
      }
    }
  }
  
  // Priority 2: Look for LongName property
  const longName = getPropertyValue(metaObject, ["longname", "long name"]);
  if (longName && longName.trim() !== "") return longName;
  
  // Priority 3: metaObject.name if it's not just a number
  if (metaObject.name) {
    const name = String(metaObject.name);
    // If it's not just a number, use it
    if (!/^\d+$/.test(name.trim())) {
      return name;
    }
  }
  
  // Priority 4: fallback
  return metaObject.id || "-";
};

const getDepartamento = (metaObject: any): string => {
  return getPropertyValue(metaObject, ["departamento", "department", "departament"]);
};

const getAreaValue = (metaObject: any): number => {
  if (!metaObject?.propertySets) return 0;
  
  // Priority 1: Look in Pset_SpaceCommon for NetPlannedArea (IFC standard for useful area)
  for (const pset of metaObject.propertySets) {
    const psetName = pset.name?.toLowerCase() || "";
    if (psetName.includes("pset_spacecommon") || psetName === "spacecommon") {
      if (!pset.properties) continue;
      // First try NetPlannedArea (useful area)
      for (const prop of pset.properties) {
        const propNameLower = prop.name?.toLowerCase() || "";
        if (
          propNameLower === "netplannedarea" ||
          propNameLower.includes("net planned area") ||
          propNameLower.includes("netplanned")
        ) {
          const val = parseFloat(prop.value);
          if (!isNaN(val) && val > 0) {
            console.log("[SurfaceAreasModal] Found NetPlannedArea in Pset_SpaceCommon:", val);
            return val;
          }
        }
      }
      // Then try GrossPlannedArea
      for (const prop of pset.properties) {
        const propNameLower = prop.name?.toLowerCase() || "";
        if (
          propNameLower === "grossplannedarea" ||
          propNameLower.includes("gross planned area") ||
          propNameLower.includes("grossplanned")
        ) {
          const val = parseFloat(prop.value);
          if (!isNaN(val) && val > 0) {
            console.log("[SurfaceAreasModal] Found GrossPlannedArea in Pset_SpaceCommon:", val);
            return val;
          }
        }
      }
    }
  }
  
  // Priority 2: Look in BaseQuantities property set (also reliable source)
  for (const pset of metaObject.propertySets) {
    const psetName = pset.name?.toLowerCase() || "";
    if (psetName.includes("basequantities") || psetName.includes("base quantities") || psetName.includes("quantitats")) {
      if (!pset.properties) continue;
      for (const prop of pset.properties) {
        const propNameLower = prop.name?.toLowerCase() || "";
        // Look for net floor area first (more accurate for useful areas)
        if (
          propNameLower.includes("superfície neta") ||
          propNameLower.includes("superficie neta") ||
          propNameLower.includes("netfloorarea") ||
          propNameLower.includes("net floor area") ||
          propNameLower === "netarea"
        ) {
          const val = parseFloat(prop.value);
          if (!isNaN(val) && val > 0) {
            return val;
          }
        }
      }
      // If no net area, try gross area
      for (const prop of pset.properties) {
        const propNameLower = prop.name?.toLowerCase() || "";
        if (
          propNameLower.includes("superfície bruta") ||
          propNameLower.includes("superficie bruta") ||
          propNameLower.includes("grossfloorarea") ||
          propNameLower.includes("gross floor area") ||
          propNameLower === "grossarea"
        ) {
          const val = parseFloat(prop.value);
          if (!isNaN(val) && val > 0) {
            return val;
          }
        }
      }
    }
  }
  
  // Priority 3: Extended list of area property names in any property set
  const areaNames = [
    "netplannedarea", "grossplannedarea", // IFC standard in Pset_SpaceCommon
    "superfície neta", "superficie neta", "netfloorarea", "net floor area",
    "superfície bruta", "superficie bruta", "grossfloorarea", "gross floor area",
    "area", "àrea", "área", "superficie", "superfície",
    "netarea", "grossarea", "floorarea", "floor area",
  ];
  
  for (const pset of metaObject.propertySets) {
    if (!pset.properties) continue;
    for (const prop of pset.properties) {
      const propNameLower = prop.name?.toLowerCase() || "";
      for (const searchName of areaNames) {
        if (propNameLower.includes(searchName.toLowerCase())) {
          const val = parseFloat(prop.value);
          if (!isNaN(val) && val > 0) {
            // Skip suspicious default value
            if (Math.abs(val - 28.571428571428573) < 0.0001) {
              continue;
            }
            return val;
          }
        }
      }
    }
  }
  
  return 0;
};

const getLevelValue = (metaObject: any): string => {
  // Priority 1: Get the parent IfcBuildingStorey name
  if (metaObject.parent) {
    let parent = metaObject.parent;
    while (parent) {
      const parentType = parent.type?.toLowerCase() || "";
      if (parentType === "ifcbuildingstorey" || parentType === "ifcstorey") {
        // Look for Name in identity data
        if (parent.propertySets) {
          for (const pset of parent.propertySets) {
            const psetName = pset.name?.toLowerCase() || "";
            if (psetName.includes("datos de identidad") || psetName.includes("identity data") || psetName.includes("dades d'identitat")) {
              if (pset.properties) {
                for (const prop of pset.properties) {
                  const propName = prop.name?.toLowerCase() || "";
                  if (propName === "nombre" || propName === "nom" || propName === "name") {
                    if (prop.value && String(prop.value).trim() !== "") {
                      return String(prop.value);
                    }
                  }
                }
              }
            }
          }
        }
        // Fallback to parent.name if it's not just a number with decimals
        if (parent.name) {
          const name = String(parent.name);
          // If it looks like a real name (not just a decimal number), use it
          if (!/^\d+\.\d{5,}/.test(name.trim())) {
            return name;
          }
        }
      }
      parent = parent.parent;
    }
  }
  
  // Priority 2: Look for level in properties but filter out numeric elevation values
  if (metaObject.propertySets) {
    const levelNames = ["level", "nivel", "nivell", "storey", "floor", "planta"];
    for (const pset of metaObject.propertySets) {
      if (!pset.properties) continue;
      for (const prop of pset.properties) {
        const propNameLower = prop.name?.toLowerCase() || "";
        for (const searchName of levelNames) {
          if (propNameLower.includes(searchName)) {
            const val = String(prop.value || "");
            // Only use if it's not a decimal number (elevation)
            if (val && !/^\d+\.\d{5,}/.test(val.trim())) {
              return val;
            }
          }
        }
      }
    }
  }
  
  // Priority 3: metaObject.parent.name as fallback
  if (metaObject.parent?.name) {
    const name = String(metaObject.parent.name);
    if (!/^\d+\.\d{5,}/.test(name.trim())) {
      return name;
    }
  }
  
  return "-";
};

const getComputationValue = (metaObject: any): number => {
  const computationNames = ["computation", "còmput", "computo", "cómputo", "compute", "calc"];
  const value = getPropertyValue(metaObject, computationNames);
  if (!value || value === "-") return 100; // Default to 100%
  const parsed = parseFloat(value.replace("%", "").replace(",", "."));
  if (isNaN(parsed)) return 100;
  // If value is between 0 and 1 (exclusive of 1 unless exactly 1), interpret as decimal and convert to percentage
  // Values > 1 are interpreted as already being percentages
  if (parsed > 0 && parsed <= 1) {
    return parsed * 100;
  }
  return parsed;
};

// Normalize computation value when loading from DB or IFC
const normalizeComputation = (value: number | undefined): number => {
  if (value === undefined || value === null) return 100;
  // If value is between 0 and 1 (exclusive), interpret as decimal and convert to percentage
  if (value > 0 && value <= 1) {
    return value * 100;
  }
  return value;
};

export const SurfaceAreasModal = ({
  open,
  onOpenChange,
  projectId,
}: SurfaceAreasModalProps) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"useful" | "built">("useful");
  const [usefulAreas, setUsefulAreas] = useState<UsefulAreaRow[]>([]);
  const [builtAreas, setBuiltAreas] = useState<BuiltAreaRow[]>([]);
  const [levelCustomNames, setLevelCustomNames] = useState<LevelCustomName[]>([]);
  const [editingLevelName, setEditingLevelName] = useState<string | null>(null);
  const [tempLevelName, setTempLevelName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const openRef = useRef(open);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const t = {
    title: language === "ca" ? "Quadres de superfícies" : "Cuadros de superficies",
    usefulTab: language === "ca" ? "Superfícies útils" : "Superficies útiles",
    builtTab: language === "ca" ? "Superfícies construïdes" : "Superficies construidas",
    level: language === "ca" ? "Nivell" : "Nivel",
    name: language === "ca" ? "Nom" : "Nombre",
    reference: language === "ca" ? "Referència" : "Referencia",
    referenceTooltip: language === "ca" 
      ? "Serveix per definir a què pertany la zona: pis, porta, zones comuns, locals, serveis, etc." 
      : "Sirve para definir a qué pertenece la zona: piso, puerta, zonas comunes, locales, servicios, etc.",
    computation: language === "ca" ? "Còmput" : "Cómputo",
    area: language === "ca" ? "Superfície (m²)" : "Superficie (m²)",
    addRow: language === "ca" ? "Afegir espai" : "Añadir espacio",
    save: language === "ca" ? "Desar" : "Guardar",
    total: language === "ca" ? "Total" : "Total",
    noData: language === "ca" ? "No hi ha espais definits" : "No hay espacios definidos",
    saved: language === "ca" ? "Quadre de superfícies desat correctament" : "Cuadro de superficies guardado correctamente",
    error: language === "ca" ? "Error desant les superfícies" : "Error guardando las superficies",
    fromIFC: language === "ca" ? "IFC" : "IFC",
  };

  useEffect(() => {
    if (!open) {
      retryCountRef.current = 0;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    if (projectId) {
      retryCountRef.current = 0;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      loadDataFromIFCAndDB();
    }
  }, [open, projectId]);

  const loadDataFromIFCAndDB = async () => {
    setLoading(true);

    try {
      // 1. Carregar dades guardades a la BD
      const { data: savedData, error } = await supabase
        .from("project_surface_areas")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      let savedUseful: UsefulAreaRow[] = [];
      let savedBuilt: BuiltAreaRow[] = [];
      let savedLevelNames: LevelCustomName[] = [];

      if (!error && savedData?.surface_data) {
        const surfaceData = savedData.surface_data as unknown as SurfaceData;
        savedUseful = surfaceData.useful_areas || [];
        savedBuilt = surfaceData.built_areas || [];
        savedLevelNames = surfaceData.level_custom_names || [];
      }

      // 2. Carregar dades des del visor IFC (ja carregat al visor)
      // IMPORTANT: re-use viewer metaObjects structure (same one used for "Zones i Peces")
      const viewer = (window as any).xeokitViewer as any;

      const ifcUseful: UsefulAreaRow[] = [];
      const ifcBuilt: BuiltAreaRow[] = [];

      const decodeIfc = (input: unknown): string => {
        const s = typeof input === "string" ? input : String(input ?? "");
        // Decode IFC escaped sequences (\X\F3 etc.)
        return s.replace(/\\X\\([0-9A-F]{2})/gi, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      };

      const normalizeKey = (input: unknown): string =>
        decodeIfc(input)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[\s_\-\.]/g, "");

      const parseNumber = (input: any): number => {
        if (input === null || input === undefined) return NaN;
        if (typeof input === "number") return input;
        if (typeof input === "string") {
          const decoded = decodeIfc(input).replace(/,/g, ".");
          const m = decoded.match(/-?\d+(?:\.\d+)?/);
          return m ? parseFloat(m[0]) : NaN;
        }
        if (typeof input === "object") {
          const o: any = input;
          return parseNumber(o.value ?? o.Value ?? o.nominalValue ?? o.NominalValue ?? o.wrappedValue);
        }
        return NaN;
      };

      // IMPORTANT: Get property sets using propertySetIds + metaModel.propertySets
      // This is how XeokitViewer does it correctly
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

      const getProps = (pset: any): any[] => {
        const pr = pset?.properties;
        if (!pr) return [];
        if (Array.isArray(pr)) return pr;
        if (typeof pr === "object") return Object.values(pr);
        return [];
      };

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

      const getAreaFromMeta = (metaObj: any, metaModel: any): number => {
        const psets = getPsetsFromModel(metaObj, metaModel);

        const readAreaFromProps = (props: any[], names: string[]): number => {
          const wanted = names.map(normalizeKey);
          for (const prop of props) {
            const nameKey = normalizeKey(prop?.name ?? prop?.Name);
            if (wanted.some((w) => nameKey === w)) {
              const val = parseNumber(prop?.value ?? prop?.Value);
              if (!isNaN(val) && val > 0) {
                // Skip suspicious constant value we saw in some exports
                if (Math.abs(val - 28.571428571428573) < 0.0001) continue;
                return val;
              }
            }
          }
          return 0;
        };

        const SPACE_COMMON_KEYS = [
          "NetPlannedArea",
          "NetFloorArea",
          "NetArea",
          "AreaNet",
          "GrossPlannedArea",
          "GrossFloorArea",
          "AreaWithMaximalHeight",
          "Area",
          "Superficie",
          "Superfície",
          "Àrea",
          "Área",
        ];

        // Priority 1: Pset_SpaceCommon
        for (const pset of psets) {
          const psetKey = normalizeKey(pset?.name);
          if (psetKey.includes("psetspacecommon") || psetKey === "spacecommon") {
            const props = getProps(pset);
            const v = readAreaFromProps(props, SPACE_COMMON_KEYS);
            if (v > 0) return v;
          }
        }

        // Priority 2: BaseQuantities
        for (const pset of psets) {
          const psetKey = normalizeKey(pset?.name);
          if (psetKey.includes("basequantities")) {
            const props = getProps(pset);
            const v = readAreaFromProps(props, ["NetFloorArea", "GrossFloorArea", "Area", "Superficie", "Superfície"]);
            if (v > 0) return v;
          }
        }

        // Priority 3: Any property set
        for (const pset of psets) {
          const props = getProps(pset);
          const v = readAreaFromProps(props, SPACE_COMMON_KEYS);
          if (v > 0) return v;
        }

        return 0;
      };

      const getAreaFromAabb = (entity: any): number => {
        const aabb = entity?.aabb;
        if (!Array.isArray(aabb) || aabb.length < 6) return 0;
        const width = Math.abs(aabb[3] - aabb[0]);
        const depth = Math.abs(aabb[5] - aabb[2]);
        const area = width * depth;
        return Number.isFinite(area) && area > 0 ? area : 0;
      };
      
      if (viewer?.metaScene?.metaModels) {
        const metaModels = viewer.metaScene.metaModels;
        const modelIds = Object.keys(metaModels);
        console.log("[SurfaceAreasModal] Found metaModels:", modelIds.length);
        
        for (const modelId of modelIds) {
          const metaModel = metaModels[modelId];
          if (!metaModel) continue;
          
          console.log("[SurfaceAreasModal] Processing model:", modelId);
          
          // Helper: detect storey/space types robustly (some IFC exports vary casing/naming)
          const isStoreyType = (obj: any): boolean => {
            const type = String(obj?.type ?? "").toLowerCase();
            if (type.includes("buildingstorey") || type.includes("storey") || type.includes("level")) return true;

            const name = String(obj?.name ?? "").toLowerCase();
            // Common patterns in ES/CA exports
            if (
              (name.startsWith("planta") || name.startsWith("nivel") || name.startsWith("piso") || name.startsWith("paviment") || name.startsWith("forjat")) &&
              Array.isArray(obj?.children) &&
              obj.children.length > 0
            ) {
              return true;
            }
            return false;
          };

          const isSpaceType = (obj: any): boolean => {
            const type = String(obj?.type ?? "").toLowerCase();
            return type === "ifcspace" || type.includes("space");
          };

          // Debug: list all detected storeys in the hierarchy
          const findAllStoreys = (obj: any, depth = 0): any[] => {
            if (!obj) return [];
            let storeys: any[] = [];
            if (isStoreyType(obj)) {
              storeys.push({ id: obj.id, type: obj.type, name: obj.name, depth, childrenCount: obj.children?.length || 0 });
            }
            if (obj.children) {
              for (const child of obj.children) {
                storeys = storeys.concat(findAllStoreys(child, depth + 1));
              }
            }
            return storeys;
          };

          const allStoreys = findAllStoreys(metaModel.rootMetaObject);
          console.log("[SurfaceAreasModal] All storeys-like nodes found:", allStoreys);

          // Funció recursiva per processar metaObjects (com al XeokitViewer)
          const processMetaObject = (metaObj: any, parentStorey?: string) => {
            if (!metaObj) return;

            // Check if this is a storey (IfcBuildingStorey or variations)
            let currentStorey = parentStorey;
            if (isStoreyType(metaObj)) {
              currentStorey = metaObj.name || metaObj.id;
              const childTypes = metaObj.children?.map((c: any) => ({ type: c.type, name: c.name })) || [];
              console.log("[SurfaceAreasModal] Processing storey:", currentStorey, "type:", metaObj.type, "children:", metaObj.children?.length || 0, "childTypes:", childTypes);
            }

            // Check if this is a space (room)
            if (isSpaceType(metaObj)) {
              // IMPORTANT: Use metaObj from the tree (has propertySetIds), not sceneMetaObj
              // This is how XeokitViewer.extractRoomsWithGeometry does it
              
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

              // Fallback: use metaObj.name, but if it's just a number, try to get a better name
              let roomName = "";
              if (nameFromProps && nameFromProps.trim() !== "") {
                roomName = nameFromProps.trim();
              } else {
                const rawName = decodeIfc(metaObj?.name ?? "");
                if (rawName && !/^\d+$/.test(rawName.trim())) {
                  roomName = rawName.trim();
                } else {
                  const typeLabel = decodeIfc(metaObj?.type ?? "");
                  roomName = rawName.trim() || typeLabel || metaObj.id || "Unknown";
                }
              }

              const reference = getPropFromMeta(
                metaObj,
                [
                  "Reference",
                  "Referencia",
                  "Referència",
                  "Ref",
                  "Departamento",
                  "Department",
                  "Departament",
                ],
                metaModel
              );
              const category = getPropFromMeta(metaObj, ["Category", "Categoria", "Categoría"], metaModel);
              const levelFromProps = getPropFromMeta(
                metaObj,
                ["Level", "Storey", "Story", "Planta", "Paviment", "Nivel", "Nivell", "Floor"],
                metaModel
              );
              const resolvedLevel = (levelFromProps && levelFromProps.trim() !== "")
                ? levelFromProps.trim()
                : (currentStorey || "-");

              let area = getAreaFromMeta(metaObj, metaModel);
              if (area <= 0 && viewer?.scene?.objects?.[metaObj.id]) {
                area = getAreaFromAabb(viewer.scene.objects[metaObj.id]);
              }

              // Skip if no area found (but still process children)
              if (area <= 0) {
                if (metaObj.children) {
                  metaObj.children.forEach((child: any) => processMetaObject(child, currentStorey));
                }
                return;
              }

              const level = resolvedLevel;

              // Classificació + nom final (tal com vols veure-ho al modal):
              // - "Àrea" → pestanya Construïdes, amb nom "Área PB", "Área P1", ...
              // - "Habitación" → pestanya Útils, amb nom "Habitación pb", "Habitación p1", ...
              const normalizeAlphaNum = (v: unknown) =>
                decodeIfc(v)
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]/g, "");

              const stripTrailingNumericToken = (s: string) => {
                const t = s.trim();
                const parts = t.split(/\s+/).filter(Boolean);
                if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) {
                  return parts.slice(0, -1).join(" ");
                }
                return t;
              };

              const storeyLabelFromLevel = (lvl: string): string | null => {
                const n = normalizeAlphaNum(lvl);
                if (!n) return null;
                if (n.includes("pb") || n.includes("baix") || n.includes("baja")) return "PB";

                const pm = n.match(/p(\d+)/);
                if (pm) return `P${parseInt(pm[1], 10)}`;

                const nm = n.match(/nivel(\d+)/);
                if (nm) {
                  const num = parseInt(nm[1], 10);
                  if (Number.isFinite(num)) return num === 1 ? "PB" : `P${num - 1}`;
                }

                return null;
              };

              const catNorm = normalizeAlphaNum(category);
              const refNorm = normalizeAlphaNum(reference);
              const nameNorm = normalizeAlphaNum(roomName);

              const isBuiltArea =
                catNorm.startsWith("area") ||
                catNorm.includes("zona") ||
                catNorm.includes("zone") ||
                refNorm.startsWith("area") ||
                nameNorm.startsWith("area");

              const refRaw = decodeIfc(reference).trim();
              const roomRaw = decodeIfc(roomName).trim();
              const roomLooksNumeric = roomRaw !== "" && /^\d+$/.test(roomRaw);

              const displayName = (() => {
                if (isBuiltArea) {
                  const label = storeyLabelFromLevel(level);
                  const shouldOverride = (nameNorm.startsWith("area") && roomRaw.includes(":")) || refNorm === "area";
                  if (shouldOverride) return label ? `Área ${label}` : "Área";
                  return roomName;
                }

                const isHabitacioRef = refNorm.startsWith("habitacion") || refNorm.startsWith("habitacio");
                if (refRaw && (isHabitacioRef || roomLooksNumeric)) {
                  return stripTrailingNumericToken(refRaw);
                }
                return roomName;
              })();

              if (isBuiltArea) {
                ifcBuilt.push({
                  id: metaObj.id,
                  level,
                  name: displayName,
                  computation: getComputationValue(metaObj),
                  area,
                  isFromIFC: true,
                });
              } else {
                ifcUseful.push({
                  id: metaObj.id,
                  level,
                  name: displayName,
                  reference: refRaw,
                  area,
                  isFromIFC: true,
                });
              }
            }
            
            // Process children recursively
            if (metaObj.children) {
              metaObj.children.forEach((child: any) => processMetaObject(child, currentStorey));
            }
          };
          
          // Start processing from root
          const rootMetaObject = metaModel.rootMetaObject;
          console.log("[SurfaceAreasModal] Root meta object:", {
            id: rootMetaObject?.id,
            type: rootMetaObject?.type,
            name: rootMetaObject?.name,
            childrenCount: rootMetaObject?.children?.length || 0,
            childrenTypes: rootMetaObject?.children?.map((c: any) => ({ type: c.type, name: c.name, childrenCount: c.children?.length || 0 }))
          });
          
          // Also scan ALL metaObjects in metaScene (flat dict) to find any IfcSpace we might miss
          const allMetaObjects = viewer?.metaScene?.metaObjects || {};
          const allSpacesInScene = Object.values(allMetaObjects).filter((mo: any) => isSpaceType(mo));
          console.log("[SurfaceAreasModal] ALL IfcSpace in metaScene (flat):", allSpacesInScene.length, 
            allSpacesInScene.map((s: any) => ({ id: s.id, name: s.name, parent: s.parent?.name, parentType: s.parent?.type }))
          );
          
          // Process the root itself (in case it has spaces directly)
          processMetaObject(rootMetaObject);
        }
        
        console.log("[SurfaceAreasModal] Total useful areas found:", ifcUseful.length);
        console.log("[SurfaceAreasModal] Total built areas found:", ifcBuilt.length);

        const manualBuilt = savedBuilt.filter((a) => !a.isFromIFC);

        // Preserve saved ordering (and custom edits) while refreshing IFC-derived values
        const sortedSavedUseful = [...savedUseful].sort(
          (a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
        );

        const ifcUsefulById = new Map(ifcUseful.map((r) => [r.id, r] as const));
        const usedIfcIds = new Set<string>();
        const mergedUseful: UsefulAreaRow[] = [];

        // Start from saved order
        for (const savedRow of sortedSavedUseful) {
          if (savedRow.isFromIFC) {
            const latestIfc = ifcUsefulById.get(savedRow.id);
            if (latestIfc) {
              // Preserve linkedToBudget from saved data
              mergedUseful.push({ 
                ...latestIfc, 
                displayOrder: savedRow.displayOrder,
                linkedToBudget: savedRow.linkedToBudget 
              });
              usedIfcIds.add(savedRow.id);
            }
            // If IFC element no longer exists, skip it
          } else {
            mergedUseful.push(savedRow);
          }
        }

        // Append any new IFC rows not previously saved
        for (const row of ifcUseful) {
          if (!usedIfcIds.has(row.id)) mergedUseful.push(row);
        }

        // Similar merge for built areas
        const sortedSavedBuilt = [...savedBuilt].sort(
          (a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
        );
        const ifcBuiltById = new Map(ifcBuilt.map((r) => [r.id, r] as const));
        const usedIfcBuiltIds = new Set<string>();
        const mergedBuilt: BuiltAreaRow[] = [];

        for (const savedRow of sortedSavedBuilt) {
          if (savedRow.isFromIFC) {
            const latestIfc = ifcBuiltById.get(savedRow.id);
            if (latestIfc) {
              // Keep user-edited computation if exists, normalize it
              // Also preserve linkedToBudget from saved data
              const savedComp = savedRow.computation !== undefined ? normalizeComputation(savedRow.computation) : undefined;
              mergedBuilt.push({ 
                ...latestIfc, 
                computation: savedComp ?? latestIfc.computation,
                displayOrder: savedRow.displayOrder,
                linkedToBudget: savedRow.linkedToBudget
              });
              usedIfcBuiltIds.add(savedRow.id);
            }
          } else {
            // Normalize manual entries too
            mergedBuilt.push({
              ...savedRow,
              computation: normalizeComputation(savedRow.computation)
            });
          }
        }

        for (const row of ifcBuilt) {
          if (!usedIfcBuiltIds.has(row.id)) mergedBuilt.push(row);
        }

        // Add manual entries
        for (const row of manualBuilt) {
          if (!mergedBuilt.find(r => r.id === row.id)) {
            mergedBuilt.push(row);
          }
        }

        setUsefulAreas(mergedUseful);
        setBuiltAreas(mergedBuilt);
        setLevelCustomNames(savedLevelNames);
        return;
      }

      // Si el visor encara no està disponible (o el model encara no ha generat metaObjects),
      // mostrem el que hi ha guardat i reintentem uns cops mentre el modal està obert.
      const sortedSavedUseful = [...savedUseful].sort(
        (a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
      );
      // Also sort built areas by displayOrder when loading from DB only
      const sortedSavedBuilt = [...savedBuilt]
        .map(row => ({ ...row, computation: normalizeComputation(row.computation) }))
        .sort((a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER));
      setUsefulAreas(sortedSavedUseful);
      setBuiltAreas(sortedSavedBuilt);
      setLevelCustomNames(savedLevelNames);

      if (openRef.current && retryCountRef.current < 8) {
        retryCountRef.current += 1;
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          if (openRef.current) loadDataFromIFCAndDB();
        }, 500);
      }
    } catch (err) {
      console.error("Error loading surface areas:", err);
    } finally {
      setLoading(false);
    }
  };

  const addRow = (type: "useful" | "built") => {
    if (type === "useful") {
      setUsefulAreas((prev) => [...prev, {
        id: crypto.randomUUID(),
        level: "",
        name: "",
        reference: "",
        area: 0,
        isFromIFC: false,
      }]);
    } else {
      setBuiltAreas((prev) => [...prev, {
        id: crypto.randomUUID(),
        level: "",
        name: "",
        computation: 100, // Default 100%
        area: 0,
        isFromIFC: false,
      }]);
    }
  };

  const updateUsefulRow = (id: string, field: keyof UsefulAreaRow, value: string | number | boolean) => {
    setUsefulAreas((prev) => prev.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  const updateBuiltRow = (id: string, field: keyof BuiltAreaRow, value: string | number | boolean) => {
    setBuiltAreas((prev) => prev.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  // Handler for budget linking - evita duplicats
  const handleBudgetLinkChange = async (surfaceId: string, linked: boolean, zonaPlanta: string, superficie: number) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      if (linked) {
        // Verificar si ja existeix una línia amb el mateix zona_planta per evitar duplicats
        const { data: existingLine } = await supabase
          .from("project_budget_lines")
          .select("id")
          .eq("project_id", projectId)
          .eq("zona_planta", zonaPlanta)
          .maybeSingle();

        if (existingLine) {
          // Ja existeix, només actualitzar la superfície si cal
          await supabase
            .from("project_budget_lines")
            .update({ superficie: superficie })
            .eq("id", existingLine.id);
          
          toast.success(
            language === "ca" 
              ? "Superfície actualitzada al pressupost" 
              : "Superficie actualizada en el presupuesto"
          );
        } else {
          // No existeix, afegir nova línia
          const { data: existingLines } = await supabase
            .from("project_budget_lines")
            .select("display_order")
            .eq("project_id", projectId)
            .order("display_order", { ascending: false })
            .limit(1);

          const nextOrder = existingLines && existingLines.length > 0 
            ? (existingLines[0].display_order || 0) + 1 
            : 0;

          await supabase
            .from("project_budget_lines")
            .insert({
              project_id: projectId,
              zona_planta: zonaPlanta,
              superficie: superficie,
              display_order: nextOrder,
            });

          toast.success(
            language === "ca" 
              ? "Afegit al quadre de pressupost" 
              : "Añadido al cuadro de presupuesto"
          );
        }
      } else {
        // Remove from budget lines by zona_planta
        await supabase
          .from("project_budget_lines")
          .delete()
          .eq("project_id", projectId)
          .eq("zona_planta", zonaPlanta);

        toast.success(
          language === "ca" 
            ? "Eliminat del quadre de pressupost" 
            : "Eliminado del cuadro de presupuesto"
        );
      }
    } catch (err) {
      console.error("Error updating budget link:", err);
      toast.error(
        language === "ca" 
          ? "Error actualitzant el pressupost" 
          : "Error actualizando el presupuesto"
      );
    }
  };

  // Get display name for level (custom name or IFC name)
  const getDisplayLevelName = useCallback((level: string): string => {
    const customName = levelCustomNames.find(l => l.ifcLevel === level)?.customName;
    return customName || level;
  }, [levelCustomNames]);

  const deleteRow = (type: "useful" | "built", id: string) => {
    if (type === "useful") {
      setUsefulAreas((prev) => prev.filter((row) => row.id !== id));
    } else {
      setBuiltAreas((prev) => prev.filter((row) => row.id !== id));
    }
  };

  const calculateTotal = (rows: Array<{ area: number }>): number => {
    return rows.reduce((sum, row) => sum + (Number(row.area) || 0), 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error(language === "ca" ? "No autenticat" : "No autenticado");
        return;
      }

      // Create ordered useful areas with displayOrder
      const orderedUseful = usefulAreas.map((row, idx) => ({ ...row, displayOrder: idx }));
      // Create ordered built areas with displayOrder
      const orderedBuilt = builtAreas.map((row, idx) => ({ ...row, displayOrder: idx }));

      const surfaceData: SurfaceData = {
        useful_areas: orderedUseful,
        built_areas: orderedBuilt,
        level_custom_names: levelCustomNames,
      };

      console.log("Saving surface data:", JSON.stringify(surfaceData, null, 2));

      const { data: existing, error: fetchError } = await supabase
        .from("project_surface_areas")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error checking existing record:", fetchError);
        throw fetchError;
      }

      if (existing) {
        console.log("Updating existing record:", existing.id);
        const { error } = await supabase
          .from("project_surface_areas")
          .update({
            surface_data: surfaceData as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("project_id", projectId);
        if (error) {
          console.error("Error updating:", error);
          throw error;
        }
      } else {
        console.log("Inserting new record for project:", projectId);
        const { error } = await supabase
          .from("project_surface_areas")
          .insert([{
            project_id: projectId,
            surface_data: surfaceData as unknown as Json,
            created_by: user.user.id,
          }]);
        if (error) {
          console.error("Error inserting:", error);
          throw error;
        }
      }

      toast.success(t.saved);
    } catch (err: any) {
      console.error("Error saving surface areas:", err);
      toast.error(`${t.error}: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // Group rows by a field
  const groupByField = <T extends Record<string, any>>(rows: T[], field: keyof T): Map<string, T[]> => {
    const groups = new Map<string, T[]>();
    rows.forEach((row) => {
      const key = String(row[field] || "-");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });
    return groups;
  };

  // Check if any rows have reference (departamento) filled
  const hasReferenceData = usefulAreas.filter(r => r.reference && r.reference.trim() !== "" && r.reference !== "-").length > 0;

  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());

  const toggleLevel = (level: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const toggleRef = (key: string) => {
    setExpandedRefs(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Level custom name helpers
  const getCustomLevelName = (ifcLevel: string): string | undefined => {
    return levelCustomNames.find(l => l.ifcLevel === ifcLevel)?.customName;
  };

  const setCustomLevelName = (ifcLevel: string, customName: string) => {
    setLevelCustomNames(prev => {
      const existing = prev.find(l => l.ifcLevel === ifcLevel);
      if (existing) {
        if (customName.trim() === "") {
          return prev.filter(l => l.ifcLevel !== ifcLevel);
        }
        return prev.map(l => l.ifcLevel === ifcLevel ? { ...l, customName } : l);
      }
      if (customName.trim() === "") return prev;
      return [...prev, { ifcLevel, customName }];
    });
  };

  const startEditingLevelName = (level: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLevelName(level);
    setTempLevelName(getCustomLevelName(level) || "");
  };

  const saveLevelName = () => {
    if (editingLevelName) {
      setCustomLevelName(editingLevelName, tempLevelName);
      setEditingLevelName(null);
      setTempLevelName("");
    }
  };

  // Drag and drop handler for reordering within a department
  const handleDragEnd = useCallback((event: DragEndEvent, level: string, ref: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setUsefulAreas(prev => {
      // Get all rows for this level-ref combination
      const refRows = prev.filter(r => r.level === level && r.reference === ref);
      const otherRows = prev.filter(r => !(r.level === level && r.reference === ref));
      
      const oldIndex = refRows.findIndex(r => r.id === active.id);
      const newIndex = refRows.findIndex(r => r.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) return prev;
      
      const reordered = arrayMove(refRows, oldIndex, newIndex);
      // Reconstruct the full array maintaining order
      const result: UsefulAreaRow[] = [];
      let refRowIndex = 0;
      prev.forEach(row => {
        if (row.level === level && row.reference === ref) {
          result.push(reordered[refRowIndex++]);
        } else {
          result.push(row);
        }
      });
      return result;
    });
  }, []);

  // Drag and drop handler for reordering built areas within a level
  const handleBuiltDragEnd = useCallback((event: DragEndEvent, level: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setBuiltAreas(prev => {
      // Get all rows for this level
      const levelRows = prev.filter(r => r.level === level);
      
      const oldIndex = levelRows.findIndex(r => r.id === active.id);
      const newIndex = levelRows.findIndex(r => r.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) return prev;
      
      const reordered = arrayMove(levelRows, oldIndex, newIndex);
      // Reconstruct the full array maintaining order
      const result: BuiltAreaRow[] = [];
      let levelRowIndex = 0;
      prev.forEach(row => {
        if (row.level === level) {
          result.push(reordered[levelRowIndex++]);
        } else {
          result.push(row);
        }
      });
      return result;
    });
  }, []);

  // Keep accordions collapsed by default - no auto-expansion

  const renderUsefulTable = () => {
    // First group by level
    const groupedByLevel = groupByField(usefulAreas, "level");
    const sortedLevels = Array.from(groupedByLevel.keys()).sort();

    return (
      <TooltipProvider>
        <div className="space-y-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {usefulAreas.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t.noData}
                </div>
              ) : (
                sortedLevels.map((level) => {
                  const levelRows = groupedByLevel.get(level) || [];
                  const levelTotal = calculateTotal(levelRows);
                  const isLevelExpanded = expandedLevels.has(level);
                  const customName = getCustomLevelName(level);
                  const isEditingThisLevel = editingLevelName === level;
                  
                  // Simplified: just Level -> Rooms directly (no intermediate reference accordion)
                  return (
                    <Collapsible key={`level-${level}`} open={isLevelExpanded} onOpenChange={() => toggleLevel(level)}>
                      {/* Level header - accordion trigger */}
                      <div className="flex items-center justify-between bg-muted/70 hover:bg-muted px-3 py-2 rounded-md transition-colors">
                        <CollapsibleTrigger className="flex items-center gap-2 flex-1 cursor-pointer">
                          {isLevelExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {isEditingThisLevel ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={tempLevelName}
                                onChange={(e) => setTempLevelName(e.target.value)}
                                placeholder={language === "ca" ? "Nom personalitzat..." : "Nombre personalizado..."}
                                className="h-7 w-40 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveLevelName();
                                  if (e.key === "Escape") { setEditingLevelName(null); setTempLevelName(""); }
                                }}
                                onBlur={saveLevelName}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {customName ? (
                                <>
                                  <span className="font-bold text-sm">{customName}</span>
                                  <span className="text-xs text-muted-foreground">({level})</span>
                                </>
                              ) : (
                                <span className="font-bold text-sm">{level}</span>
                              )}
                            </div>
                          )}
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => startEditingLevelName(level, e)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <span className="text-sm font-semibold text-primary">{levelTotal.toFixed(2)} m²</span>
                        </div>
                      </div>
                      
                      <CollapsibleContent>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleDragEnd(event, level, levelRows[0]?.reference || "")}
                        >
                          <SortableContext
                            items={levelRows.map(r => r.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <Table className="mt-1">
                              <TableBody>
                                {levelRows.map((row) => (
                                  <SortableRow
                                    key={row.id}
                                    row={row}
                                    isFromIFC={!!row.isFromIFC}
                                    onDelete={(id) => deleteRow("useful", id)}
                                    onUpdate={updateUsefulRow}
                                    fromIFCLabel={t.fromIFC}
                                    onBudgetLinkChange={handleBudgetLinkChange}
                                    getDisplayName={getDisplayLevelName}
                                  />
                                ))}
                              </TableBody>
                            </Table>
                          </SortableContext>
                        </DndContext>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="border-t pt-3 flex items-center justify-between px-4">
            <span className="font-semibold text-primary">{t.total}</span>
            <span className="font-bold text-lg text-primary">{calculateTotal(usefulAreas).toFixed(2)} m²</span>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" size="sm" onClick={() => addRow("useful")} className="gap-2">
              <Plus className="h-4 w-4" />
              {t.addRow}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {t.save}
            </Button>
          </div>
        </div>
      </TooltipProvider>
    );
  };

  // State for expanded built area levels
  const [expandedBuiltLevels, setExpandedBuiltLevels] = useState<Set<string>>(new Set());

  const toggleBuiltLevel = (level: string) => {
    setExpandedBuiltLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  // Calculate computed area (area × computation percentage)
  const calculateComputedArea = (area: number, computation: number): number => {
    return area * (computation / 100);
  };

  // Calculate total computed area for built areas
  const calculateBuiltTotal = (rows: BuiltAreaRow[]): number => {
    return rows.reduce((sum, row) => sum + calculateComputedArea(row.area, row.computation), 0);
  };

  const renderBuiltTable = () => {
    // Group by level
    const groupedByLevel = groupByField(builtAreas, "level");
    const sortedLevels = Array.from(groupedByLevel.keys()).sort();

    return (
      <TooltipProvider>
        <div className="space-y-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {builtAreas.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t.noData}
                </div>
              ) : (
                sortedLevels.map((level) => {
                  const levelRows = groupedByLevel.get(level) || [];
                  const levelTotal = calculateBuiltTotal(levelRows);
                  const isLevelExpanded = expandedBuiltLevels.has(level);
                  const customName = getCustomLevelName(level);
                  const isEditingThisLevel = editingLevelName === level;
                  
                  return (
                    <Collapsible key={`built-level-${level}`} open={isLevelExpanded} onOpenChange={() => toggleBuiltLevel(level)}>
                      {/* Level header - accordion trigger */}
                      <div className="flex items-center justify-between bg-muted/50 hover:bg-muted px-3 py-2 rounded-md transition-colors">
                        <CollapsibleTrigger className="flex items-center gap-2 flex-1 cursor-pointer">
                          {isLevelExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {isEditingThisLevel ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={tempLevelName}
                                onChange={(e) => setTempLevelName(e.target.value)}
                                placeholder={language === "ca" ? "Nom personalitzat..." : "Nombre personalizado..."}
                                className="h-7 w-40 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveLevelName();
                                  if (e.key === "Escape") { setEditingLevelName(null); setTempLevelName(""); }
                                }}
                                onBlur={saveLevelName}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {customName ? (
                                <>
                                  <span className="font-semibold text-sm">{customName}</span>
                                  <span className="text-xs text-muted-foreground">({level})</span>
                                </>
                              ) : (
                                <span className="font-semibold text-sm">{level}</span>
                              )}
                            </div>
                          )}
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => startEditingLevelName(level, e)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <span className="text-sm font-semibold text-primary">{levelTotal.toFixed(2)} m²</span>
                        </div>
                      </div>
                      
                      <CollapsibleContent>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleBuiltDragEnd(event, level)}
                        >
                          <SortableContext
                            items={levelRows.map(r => r.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <Table className="mt-1">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[30px]"></TableHead>
                                  <TableHead className="w-[50px] text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help text-xs">{language === "ca" ? "Pres." : "Pres."}</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="text-xs">{language === "ca" ? "Vincular al quadre de pressupost" : "Vincular al cuadro de presupuesto"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[250px]">
                                          <p className="text-xs">
                                            {language === "ca" 
                                              ? "Les superfícies marcades apareixeran a l'apartat de justificació del pressupost." 
                                              : "Las superficies marcadas aparecerán en el apartado de justificación del presupuesto."}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableHead>
                                  <TableHead>{t.name}</TableHead>
                                  <TableHead className="w-[90px] text-right">{t.area}</TableHead>
                                  <TableHead className="w-[110px] text-center">{t.computation}</TableHead>
                                  <TableHead className="w-[90px] text-right">{language === "ca" ? "S. Computable" : "S. Computable"}</TableHead>
                                  <TableHead className="w-[50px] text-center">{language === "ca" ? "Font" : "Fuente"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {levelRows.map((row) => (
                                  <SortableBuiltRow
                                    key={row.id}
                                    row={row}
                                    isFromIFC={!!row.isFromIFC}
                                    onUpdate={updateBuiltRow}
                                    fromIFCLabel={t.fromIFC}
                                    calculateComputedArea={calculateComputedArea}
                                    onBudgetLinkChange={handleBudgetLinkChange}
                                    getDisplayName={getDisplayLevelName}
                                  />
                                ))}
                              </TableBody>
                            </Table>
                          </SortableContext>
                        </DndContext>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="border-t pt-3 flex items-center justify-between px-4">
            <span className="font-semibold text-primary">{t.total}</span>
            <span className="font-bold text-lg text-primary">{calculateBuiltTotal(builtAreas).toFixed(2)} m²</span>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {t.save}
            </Button>
          </div>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {language === "ca"
              ? "Quadre de superfícies automàtic des del model IFC"
              : "Cuadro de superficies automático desde el modelo IFC"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "useful" | "built")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="useful" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              {t.usefulTab}
              {usefulAreas.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{usefulAreas.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="built" className="gap-2">
              <Building2 className="h-4 w-4" />
              {t.builtTab}
              {builtAreas.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{builtAreas.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="useful" className="flex-1 overflow-auto mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : renderUsefulTable()}
          </TabsContent>

          <TabsContent value="built" className="flex-1 overflow-auto mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : renderBuiltTable()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

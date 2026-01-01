import { useEffect, useState, useMemo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info, Send, BookOpen, Lock, CheckCircle, Users, FileDown, Eye, XCircle, Layers, FileText, Hash, Ruler, AlertCircle, UserCheck, Lightbulb, Calendar, GripVertical, Plus, Hand, Box, BarChart3, Filter, List, Grid3x3, ChevronDown, ChevronRight, Building2, MapPin, Mail, Phone, Sparkles, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BUDGET_CHAPTERS, BudgetChapter, BudgetSubchapter, BudgetSubsubchapter } from "@/data/budgetChapters";
import { useBudgetChapterTranslations } from "@/hooks/useBudgetChapterTranslations";
import { getSpecialistCategoryForBudgetCode as getStaticCategoryForBudgetCode } from "@/data/budgetToSpecialistMapping";
import { SupplierCoverageModal } from "./SupplierCoverageModal";
import { SupplierCoverageTab } from "./SupplierCoverageTab";
import { BatchDescriptionGenerator } from "./BatchDescriptionGenerator";
import { ElementTypeDetailsModal } from "./ElementTypeDetailsModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle, NestedDialogDescription } from "@/components/ui/nested-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSearchParams } from "react-router-dom";
import { useUserCredits } from "@/hooks/useUserCredits";
import { CreditConfirmationModal, getCreditConfirmationDisabled } from "@/components/credits/CreditConfirmationModal";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ElementMeasurement {
  id: string;
  name: string;
  value: number;
  aabbDimensions?: { dx: number; dy: number; dz: number };
  comentarios?: string;
}

interface BudgetConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string | null;
  viewer?: any;
  versionId?: string | null;
}

interface ElementTypeConfig {
  id: string;
  type_name: string;
  custom_name: string | null;
  ifc_category: string;
  preferred_unit: string;
  description: string | null;
  chapter_id: string | null;
  subchapter_id: string | null;
  subsubchapter_id: string | null;
  measured_value: number | null;
  display_order: number;
  is_manual?: boolean;
}

interface Supplier {
  id: string;
  name: string;
  city: string | null;
  email: string;
  phone: string | null;
}

interface BudgetValuation {
  supplier_id: string;
  chapter_code: string;
}

// Component sortable per les partides
const SortableItem = ({ 
  element, 
  getElementFullCode, 
  isLocked,
  elementMeasurements,
  language
}: { 
  element: ElementTypeConfig; 
  getElementFullCode: (el: ElementTypeConfig) => string; 
  isLocked: boolean;
  elementMeasurements?: ElementMeasurement[];
  language: 'ca' | 'es';
}) => {
  const [showMeasurements, setShowMeasurements] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isLocked ? 0.6 : 1,
  };

  // Mostrar línies de medició si no és manual i hi ha mesures
  const hasMeasurements = !element.is_manual && elementMeasurements && elementMeasurements.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group p-4 border border-primary/30 rounded-xl transition-all duration-200 bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 hover:border-primary/50 hover:shadow-lg shadow-sm"
    >
      <div className="flex items-start gap-4">
        {/* Codi i badge de tipus */}
        <div className="flex-shrink-0 space-y-2">
          <div className="px-2.5 py-1 bg-primary/20 rounded-lg border border-primary/40 shadow-sm">
            <span className="font-mono text-xs font-bold text-primary-foreground drop-shadow-sm">
              {getElementFullCode(element)}
            </span>
          </div>
          {element.is_manual ? (
            <div className="flex items-center justify-center gap-1 px-2 py-1 bg-amber-500/80 rounded-lg border border-amber-400 shadow-sm">
              <Hand className="h-3 w-3 text-white" />
              <span className="text-[10px] font-semibold text-white">MANUAL</span>
            </div>
          ) : (
            <div className="flex items-center justify-center px-2 py-1 bg-blue-500/80 rounded-lg border border-blue-400 shadow-sm">
              <Box className="h-3 w-3 text-white mr-1" />
              <span className="text-[10px] font-semibold text-white">IFC</span>
            </div>
          )}
        </div>
        
        {/* Contingut principal */}
        <div className="flex-1 space-y-2 min-w-0">
          {/* Nom de la partida */}
          <h4 className="font-semibold text-sm text-foreground leading-tight">
            {element.custom_name || element.type_name}
          </h4>
          
          {/* Valor mesurat destacat */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/20 rounded-lg border border-primary/40 shadow-sm">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
            <span className="font-bold text-lg tabular-nums text-foreground">{(element.measured_value || 0).toFixed(2)}</span>
            <span className="text-sm font-medium text-foreground/80">{element.preferred_unit}</span>
            {hasMeasurements && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMeasurements(!showMeasurements);
                }}
                className="h-6 px-2 ml-2 text-xs gap-1 hover:bg-primary/30 rounded-md text-foreground"
              >
                <Ruler className="h-3 w-3" />
                <span className="text-[10px] font-medium">{elementMeasurements.length} {language === 'ca' ? 'línies' : 'líneas'}</span>
              </Button>
            )}
          </div>
          
          {/* Descripció */}
          {element.description && (
            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap bg-background/50 p-2 rounded-lg border border-border/50">
              {element.description}
            </p>
          )}
          
          {/* Taula de línies de medició */}
          {hasMeasurements && showMeasurements && (
            <div className="mt-3 border border-primary/30 rounded-lg overflow-hidden shadow-md">
              <table className="w-full text-xs">
                <thead className="bg-primary/20">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-foreground w-10">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground">{language === 'ca' ? 'Comentaris' : 'Comentarios'}</th>
                    <th className="text-right px-3 py-2 font-semibold text-foreground">{element.preferred_unit}</th>
                  </tr>
                </thead>
                <tbody>
                  {elementMeasurements.map((m, idx) => (
                    <tr key={m.id} className={`${idx % 2 === 0 ? "bg-background/80" : "bg-primary/5"} hover:bg-primary/15 transition-colors`}>
                      <td className="px-3 py-2 text-foreground/70 font-medium">{idx + 1}</td>
                      <td className="px-3 py-2 text-foreground truncate max-w-[250px]" title={m.comentarios || ''}>
                        {m.comentarios || <span className="text-foreground/50 italic">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                        {m.value.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-primary/30 border-t-2 border-primary/40">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right font-semibold text-foreground">Total:</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-foreground text-base">
                      {elementMeasurements.reduce((sum, m) => sum + m.value, 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {element.preferred_unit}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Funcions helper per calcular mesures des del viewer
function getNiceTypeName(mo: any): string {
  if (mo.propertySets) {
    for (const ps of mo.propertySets) {
      if (ps.properties) {
        for (const prop of ps.properties) {
          if (prop.name === 'Reference' && prop.value) {
            return String(prop.value);
          }
        }
      }
    }
  }
  return mo.name || mo.type || 'Unknown';
}

// Funció per obtenir Comentarios des de les propietats IFC (Revit/IFC)
function getComentarios(mo: any): string | undefined {
  // DEBUG: Log complet de l'objecte per trobar on està "FAÇANA EST"
  const moId = mo?.id || 'unknown';
  const moName = mo?.name || '';
  
  // Buscar en els atributs directes (com Revit emmagatzema sovint els comentaris)
  const attrs = mo?.attributes || mo?.props || {};
  
  // Claus possibles per Comentarios en Revit/IFC
  const keysToSearch = [
    'comentarios', 'comments', 'comentaris', 'descripcion', 'descripció', 
    'description', 'remarks', 'notes', 'note', 'tag', 'mark'
  ];
  
  // Path 1: Buscar directament als atributs/props
  for (const key of Object.keys(attrs)) {
    const keyLower = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (keysToSearch.some(k => keyLower.includes(k))) {
      const val = attrs[key];
      if (val && typeof val === 'string' && val.trim()) {
        console.log(`[getComentarios] Found in attrs[${key}]:`, val, 'for', moId);
        return val.trim();
      }
      // Si és objecte amb value
      if (val && typeof val === 'object' && val.value && typeof val.value === 'string') {
        console.log(`[getComentarios] Found in attrs[${key}].value:`, val.value, 'for', moId);
        return val.value.trim();
      }
    }
  }
  
  // Path 2: Buscar a propertySets
  if (mo?.propertySets && Array.isArray(mo.propertySets)) {
    for (const ps of mo.propertySets) {
      const psName = ps?.name || ps?.Name || '';
      
      // Buscar a les propietats del propertySet
      if (ps.properties && Array.isArray(ps.properties)) {
        for (const prop of ps.properties) {
          const propName = prop.name || prop.Name || '';
          const propNameLower = propName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          if (keysToSearch.some(k => propNameLower.includes(k))) {
            const val = prop.value ?? prop.Value ?? prop.nominalValue ?? prop.NominalValue;
            if (val && typeof val === 'string' && val.trim()) {
              console.log(`[getComentarios] Found in pset[${psName}].prop[${propName}]:`, val, 'for', moId);
              return val.trim();
            }
            // Si és objecte
            if (val && typeof val === 'object' && (val.value || val.Value)) {
              const innerVal = val.value || val.Value;
              if (typeof innerVal === 'string' && innerVal.trim()) {
                console.log(`[getComentarios] Found in pset.prop.value:`, innerVal, 'for', moId);
                return innerVal.trim();
              }
            }
          }
        }
      }
    }
  }
  
  // Path 3: Buscar a "properties" directe (altre format possible)
  if (mo?.properties && typeof mo.properties === 'object') {
    for (const key of Object.keys(mo.properties)) {
      const keyLower = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (keysToSearch.some(k => keyLower.includes(k))) {
        const val = mo.properties[key];
        if (val && typeof val === 'string' && val.trim()) {
          console.log(`[getComentarios] Found in properties[${key}]:`, val, 'for', moId);
          return val.trim();
        }
      }
    }
  }
  
  // DEBUG: Si aquest és un element amb 32.94 m2 aprox, logejem tot
  // (per ajudar a trobar on està el comentari)
  
  return undefined;
}

function calculateAreaFromGeometryLocal(viewer: any, entityId: string, ifcType: string): number | null {
  if (!viewer || !entityId) return null;
  
  const possibleIds = [entityId, `myModel#${entityId}`, entityId.replace('myModel#', '')];
  let entity = null;
  for (const id of possibleIds) {
    entity = viewer.scene?.objects?.[id];
    if (entity) break;
  }
  
  if (!entity || !entity.aabb) return null;
  
  const aabb = entity.aabb;
  const dx = Math.abs(aabb[3] - aabb[0]);
  const dy = Math.abs(aabb[4] - aabb[1]);
  const dz = Math.abs(aabb[5] - aabb[2]);
  
  const type = ifcType.toLowerCase();
  
  if (type.includes("wall")) return Math.max(dx, dz) * dy;
  if (type.includes("slab") || type.includes("floor") || type.includes("roof") || type.includes("ceiling")) return dx * dz;
  if (type.includes("window") || type.includes("door")) return Math.max(dx * dy, dz * dy);
  
  return Math.max(dx * dy, dx * dz, dy * dz);
}

// Claus per buscar propietats IFC (igual que ifcMeasurements.ts)
const AREA_KEYS_LOCAL = new Set(["netarea", "grossarea", "area", "superficie", "netsidearea", "grosssidearea", "netsurfacearea", "grosssurfacearea", "outersurfacearea", "totalsurfacearea"]);
const VOL_KEYS_LOCAL = new Set(["netvolume", "grossvolume", "volume", "volumen", "vol"]);
const LEN_KEYS_LOCAL = new Set(["length", "longitud", "len", "altura", "height", "width", "anchura", "profundidad", "depth"]);
const MASS_KEYS_LOCAL = new Set(["mass", "massa", "masa", "weight", "peso", "pes"]);

function normKeyLocal(s: string): string {
  const t = (typeof s === 'string' ? s : String(s || "")).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-\.]/g, "");
  return t;
}

function toNumLocal(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  if (typeof v === "object") {
    for (const k of ["value", "Value", "val", "Val", "NominalValue"]) {
      if (k in v) {
        const n = toNumLocal(v[k]);
        if (n != null) return n;
      }
    }
  }
  return null;
}

function getByKeysFromPropsLocal(mo: any, keySet: Set<string>): number | null {
  // Path 1: propertySets array
  const psets = mo?.propertySets;
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const arr = ps?.properties;
      if (!Array.isArray(arr)) continue;
      for (const prop of arr) {
        const nk = normKeyLocal(prop?.name ?? prop?.Name ?? "");
        if (keySet.has(nk)) {
          const val = toNumLocal(prop?.value ?? prop?.Value ?? prop);
          if (val != null && val > 0) return val;
        }
      }
    }
  }
  
  // Path 2: BaseQuantities específic
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const psName = normKeyLocal(ps?.name ?? ps?.Name ?? "");
      if (psName.includes("basequantities") || psName.includes("quantities")) {
        const arr = ps?.properties;
        if (!Array.isArray(arr)) continue;
        for (const prop of arr) {
          const nk = normKeyLocal(prop?.name ?? prop?.Name ?? "");
          if (keySet.has(nk)) {
            const val = toNumLocal(prop?.value ?? prop?.Value ?? prop?.nominalValue ?? prop?.NominalValue ?? prop);
            if (val != null && val > 0) return val;
          }
        }
      }
    }
  }
  
  return null;
}

function getValueByUnitFromViewerLocal(mo: any, unit: string, viewer: any): number {
  if (unit === "UT") return 1;
  
  let value: number | null = null;
  
  // Primer, intentar obtenir de propietats IFC (igual que ifcMeasurements.ts)
  switch (unit) {
    case "M2":
      value = getByKeysFromPropsLocal(mo, AREA_KEYS_LOCAL);
      break;
    case "ML":
      value = getByKeysFromPropsLocal(mo, LEN_KEYS_LOCAL);
      break;
    case "M3":
      value = getByKeysFromPropsLocal(mo, VOL_KEYS_LOCAL);
      break;
    case "KG":
      value = getByKeysFromPropsLocal(mo, MASS_KEYS_LOCAL);
      break;
  }
  
  // Si s'ha trobat valor de propietats IFC, retornar-lo
  if (value != null && value > 0) return value;
  
  // Fallback: calcular des de geometria AABB
  if (unit === "M2") {
    const area = calculateAreaFromGeometryLocal(viewer, mo.id, mo?.type || "");
    return area || 1;
  }
  
  const possibleIds = [mo.id, `myModel#${mo.id}`, mo.id?.replace('myModel#', '')];
  for (const id of possibleIds) {
    const entity = viewer.scene?.objects?.[id];
    if (entity?.aabb) {
      const aabb = entity.aabb;
      const dx = Math.abs(aabb[3] - aabb[0]);
      const dy = Math.abs(aabb[4] - aabb[1]);
      const dz = Math.abs(aabb[5] - aabb[2]);
      
      if (unit === "ML") return Math.max(dx, dz);
      if (unit === "M3") return dx * dy * dz;
    }
  }
  
  return 1;
}

function getElementMeasurementsForTypeLocal(
  viewer: any, 
  ifcCategory: string, 
  typeName: string,
  preferredUnit: string
): ElementMeasurement[] {
  if (!viewer) return [];
  
  const measurements: ElementMeasurement[] = [];
  const metaModels: any = viewer?.metaScene?.metaModels;
  
  if (!metaModels) return [];
  
  const ids = Object.keys(metaModels);
  if (ids.length === 0) return [];
  
  const mm = metaModels[ids[0]];
  const metaObjects = mm?.metaObjects;
  
  if (!metaObjects) return [];
  
  for (const id of Object.keys(metaObjects)) {
    const mo = metaObjects[id];
    if (!mo) continue;
    
    if (mo.type === ifcCategory) {
      const objTypeName = getNiceTypeName(mo);
      if (objTypeName === typeName) {
        const value = getValueByUnitFromViewerLocal(mo, preferredUnit, viewer);
        
        let aabbDimensions: { dx: number; dy: number; dz: number } | undefined;
        const possibleIds = [mo.id, `myModel#${mo.id}`, mo.id?.replace('myModel#', '')];
        for (const entityId of possibleIds) {
          const entity = viewer.scene?.objects?.[entityId];
          if (entity?.aabb) {
            const aabb = entity.aabb;
            aabbDimensions = {
              dx: Math.abs(aabb[3] - aabb[0]),
              dy: Math.abs(aabb[4] - aabb[1]),
              dz: Math.abs(aabb[5] - aabb[2])
            };
            break;
          }
        }
        
        // Obtenir comentarios
        const comentarios = getComentarios(mo);
        
        // DEBUG: Log complet per element de ~32.94 m2 per trobar on està "FAÇANA EST"
        if (value > 32 && value < 33) {
          console.log('[DEBUG 32.94] metaObject complet:', mo);
          console.log('[DEBUG 32.94] mo.id:', mo.id);
          console.log('[DEBUG 32.94] mo.name:', mo.name);
          console.log('[DEBUG 32.94] mo.type:', mo.type);
          console.log('[DEBUG 32.94] mo.attributes:', mo.attributes);
          console.log('[DEBUG 32.94] mo.props:', mo.props);
          console.log('[DEBUG 32.94] mo.properties:', mo.properties);
          console.log('[DEBUG 32.94] mo.propertySets:', mo.propertySets);
          if (mo.propertySets) {
            for (let i = 0; i < mo.propertySets.length; i++) {
              const ps = mo.propertySets[i];
              console.log(`[DEBUG 32.94] PropertySet[${i}]:`, ps.name, ps);
              if (ps.properties) {
                for (const prop of ps.properties) {
                  console.log(`[DEBUG 32.94]   Property: "${prop.name}" = "${prop.value}" (type: ${prop.type})`);
                }
              }
            }
          }
          // Log de totes les claus del metaObject
          console.log('[DEBUG 32.94] Totes les claus de mo:', Object.keys(mo));
          for (const key of Object.keys(mo)) {
            if (key !== 'propertySets' && key !== 'metaModels') {
              console.log(`[DEBUG 32.94] mo.${key}:`, mo[key]);
            }
          }
        }
        
        measurements.push({
          id: mo.id,
          name: mo.name || mo.id,
          value,
          aabbDimensions,
          comentarios
        });
      }
    }
  }
  
  return measurements;
}

export const BudgetConfigModal = ({
  open,
  onOpenChange,
  centerId,
  viewer,
  versionId,
}: BudgetConfigModalProps) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { getTranslatedName } = useBudgetChapterTranslations();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  
  // LOG INICIAL - Aquest hauria d'aparèixer sempre que es renderitzi el component
  console.log("🔵 BudgetConfigModal RENDERITZAT", { 
    open, 
    mode: projectId ? "PROJECTE" : centerId ? "CENTRE" : "CAP",
    id: projectId || centerId 
  });
  const [elements, setElements] = useState<ElementTypeConfig[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [budgetValuations, setBudgetValuations] = useState<BudgetValuation[]>([]);
  const [isVisibleToSuppliers, setIsVisibleToSuppliers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  // NOTE: Tabs "coverage", "budgets", "accepted", "rejected" are hidden for now. 
  // The logic is preserved for future "industriales" module.
  const [activeTab, setActiveTab] = useState<"structure" | "budgets" | "coverage" | "accepted" | "rejected">("structure");
  const [coverageModalOpen, setCoverageModalOpen] = useState(false);
  const [receivedBudgets, setReceivedBudgets] = useState<any[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [confirmVisibilityOpen, setConfirmVisibilityOpen] = useState(false);
  const [newBudgetsCount, setNewBudgetsCount] = useState(0);
  
  // Estats per filtres i visualització dels pressupostos rebuts
  const [filterProjectName, setFilterProjectName] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [viewMode, setViewMode] = useState<"accordion" | "list" | "cards">("accordion");
  const [expandedBudgets, setExpandedBudgets] = useState<Set<string>>(new Set());
  
  // Estats per rebutjar pressupost amb motiu
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [budgetToReject, setBudgetToReject] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  
  // Estats per acceptar pressupost amb confirmació
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [budgetToAccept, setBudgetToAccept] = useState<any | null>(null);
  
  // Estats per crear partida manual
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [selectedSubchapter, setSelectedSubchapter] = useState<string>("");
  const [selectedSubsubchapter, setSelectedSubsubchapter] = useState<string>("");
  const [newPartida, setNewPartida] = useState({
    customName: "",
    description: "",
    measuredValue: "",
    preferredUnit: "UT",
  });
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingAIForElement, setGeneratingAIForElement] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  
  // Estats per modal de detalls de partida
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedElementForDetails, setSelectedElementForDetails] = useState<ElementTypeConfig | null>(null);
  
  // Estats per confirmació de crèdits
  const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  const [pendingAIElement, setPendingAIElement] = useState<ElementTypeConfig | null>(null);
  const [pendingNewPartidaAI, setPendingNewPartidaAI] = useState(false);
  const { credits, config: creditsConfig, shouldSkipCredits } = useUserCredits();
  
  // Mapping de categories des de la base de dades
  const [dbCategoryMappings, setDbCategoryMappings] = useState<Map<string, string>>(new Map());
  
  // Cache de mesures per element
  const [measurementsCache, setMeasurementsCache] = useState<Map<string, ElementMeasurement[]>>(new Map());
  
  // Funció per obtenir mesures d'un element (amb cache)
  const getMeasurementsForElement = useCallback((element: ElementTypeConfig): ElementMeasurement[] => {
    if (element.is_manual || !viewer) return [];
    
    const cacheKey = `${element.ifc_category}|${element.type_name}|${element.preferred_unit}`;
    
    if (measurementsCache.has(cacheKey)) {
      return measurementsCache.get(cacheKey) || [];
    }
    
    const measurements = getElementMeasurementsForTypeLocal(
      viewer, 
      element.ifc_category, 
      element.type_name,
      element.preferred_unit
    );
    
    setMeasurementsCache(prev => new Map(prev).set(cacheKey, measurements));
    return measurements;
  }, [viewer, measurementsCache]);
  
  // Netejar cache quan canvia el viewer
  useEffect(() => {
    setMeasurementsCache(new Map());
  }, [viewer]);

  // Sensors pel drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler per obrir el modal de detalls
  const handleOpenDetails = useCallback((element: ElementTypeConfig) => {
    setSelectedElementForDetails(element);
    setDetailsModalOpen(true);
  }, []);

  // Handler per generar descripció amb IA per una partida existent
  const handleGenerateAIForElement = useCallback((element: ElementTypeConfig) => {
    // Si és usuari demo sense lògica de crèdits, executar directament
    if (shouldSkipCredits || getCreditConfirmationDisabled("ai_budget_description")) {
      executeAIForElement(element);
    } else {
      setPendingAIElement(element);
      setShowCreditConfirmation(true);
    }
  }, [shouldSkipCredits, language]);

  const executeAIForElement = useCallback(async (element: ElementTypeConfig) => {
    setGeneratingAIForElement(element.id);
    try {
      // Obtenir plantilla activa
      const { data: templateData } = await supabase
        .from("budget_description_templates")
        .select("template_json")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      const template = templateData?.template_json || {};
      
      // Obtenir noms dels capítols
      const chapter = BUDGET_CHAPTERS.find(c => c.code === element.chapter_id);
      const subchapter = chapter?.subchapters.find(s => s.code === element.subchapter_id);
      const subsubchapter = subchapter?.subsubchapters.find(ss => ss.code === element.subsubchapter_id);
      
      const category = element.subsubchapter_id 
        ? (getStaticCategoryForBudgetCode(element.subsubchapter_id) || "General")
        : "General";
      
      const { data, error } = await supabase.functions.invoke("generate-budget-description", {
        body: {
          shortDescription: element.custom_name || element.type_name,
          unit: element.preferred_unit,
          chapterCode: element.chapter_id || "",
          chapterName: chapter?.name || "",
          subchapterName: subchapter?.name || "",
          subsubchapterName: subsubchapter?.name || "",
          category,
          existingDescription: element.description,
          template,
          language
        }
      });
      
      if (error) throw error;
      
      if (data?.description) {
        // Actualitzar la descripció a la base de dades
        const { error: updateError } = await supabase
          .from("element_type_configs")
          .update({ description: data.description })
          .eq("id", element.id);
        
        if (updateError) throw updateError;
        
        // Actualitzar l'estat local
        setElements(prev => prev.map(el => 
          el.id === element.id 
            ? { ...el, description: data.description }
            : el
        ));
        
        toast({ title: language === "ca" ? "Descripció generada i guardada!" : "¡Descripción generada y guardada!" });
      }
    } catch (err: any) {
      console.error("Error generating description:", err);
      toast({ variant: "destructive", title: "Error", description: err.message || (language === "ca" ? "No s'ha pogut generar" : "No se ha podido generar") });
    } finally {
      setGeneratingAIForElement(null);
    }
  }, [toast, language]);

  // Handler per generar descripció amb IA per nova partida
  const handleGenerateAIForNewPartida = useCallback(() => {
    if (!newPartida.customName) {
      toast({ variant: "destructive", title: "Cal una descripció curta" });
      return;
    }
    // Si és usuari demo sense lògica de crèdits, executar directament
    if (shouldSkipCredits || getCreditConfirmationDisabled("ai_budget_description")) {
      executeAIForNewPartida();
    } else {
      setPendingNewPartidaAI(true);
      setShowCreditConfirmation(true);
    }
  }, [newPartida.customName, toast, shouldSkipCredits, language]);

  const executeAIForNewPartida = useCallback(async () => {
    setGeneratingAI(true);
    try {
      // Obtenir plantilla activa
      const { data: templateData } = await supabase
        .from("budget_description_templates")
        .select("template_json")
        .eq("is_active", true)
        .single();
      
      const template = templateData?.template_json || {};
      
      // Obtenir noms dels capítols
      const chapter = BUDGET_CHAPTERS.find(c => c.code === selectedChapter);
      const subchapter = chapter?.subchapters.find(s => s.code === selectedSubchapter);
      const subsubchapter = subchapter?.subsubchapters.find(ss => ss.code === selectedSubsubchapter);
      
      const category = selectedSubsubchapter 
        ? (getStaticCategoryForBudgetCode(selectedSubsubchapter) || "General")
        : "General";
      
      const { data, error } = await supabase.functions.invoke("generate-budget-description", {
        body: {
          shortDescription: newPartida.customName,
          unit: newPartida.preferredUnit,
          chapterCode: selectedChapter || "",
          chapterName: chapter?.name || "",
          subchapterName: subchapter?.name || "",
          subsubchapterName: subsubchapter?.name || "",
          category,
          existingDescription: newPartida.description,
          template,
          language
        }
      });
      
      if (error) throw error;
      if (data?.description) {
        setNewPartida(prev => ({ ...prev, description: data.description }));
        toast({ title: language === "ca" ? "Descripció generada!" : "¡Descripción generada!" });
      }
    } catch (err: any) {
      console.error("Error generating description:", err);
      toast({ variant: "destructive", title: "Error", description: err.message || (language === "ca" ? "No s'ha pogut generar" : "No se ha podido generar") });
    } finally {
      setGeneratingAI(false);
    }
  }, [newPartida, selectedChapter, selectedSubchapter, selectedSubsubchapter, toast, language]);

  // Funció per generar el PDF del tutorial
  const generateTutorialPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Colors
    const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo
    const blueColor: [number, number, number] = [59, 130, 246];
    const greenColor: [number, number, number] = [34, 197, 94];
    const amberColor: [number, number, number] = [245, 158, 11];
    const purpleColor: [number, number, number] = [168, 85, 247];
    const indigoColor: [number, number, number] = [99, 102, 241];
    const grayColor: [number, number, number] = [107, 114, 128];

    // Helper per afegir nova pàgina si cal
    const checkNewPage = (neededSpace: number) => {
      if (yPos + neededSpace > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Helper per dibuixar capçalera de secció
    const drawSectionHeader = (title: string, color: [number, number, number]) => {
      checkNewPage(25);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 5, yPos + 8);
      doc.setTextColor(0, 0, 0);
      yPos += 18;
    };

    // Helper per text normal
    const drawText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, contentWidth);
      const lineHeight = fontSize * 0.5;
      checkNewPage(lines.length * lineHeight + 5);
      doc.text(lines, margin, yPos);
      yPos += lines.length * lineHeight + 3;
    };

    // Helper per llistes
    const drawListItem = (text: string, bullet: string = "•", indent: number = 5) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, contentWidth - indent - 5);
      const lineHeight = 5;
      checkNewPage(lines.length * lineHeight + 2);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text(bullet, margin + indent, yPos);
      doc.setTextColor(0, 0, 0);
      doc.text(lines, margin + indent + 5, yPos);
      yPos += lines.length * lineHeight + 2;
    };

    // Helper per caixes destacades
    const drawHighlightBox = (text: string, color: [number, number, number], title?: string) => {
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(text, contentWidth - 16);
      const boxHeight = (title ? 8 : 0) + lines.length * 4 + 8;
      checkNewPage(boxHeight + 5);
      
      // Usar color clar per al fons (mescla amb blanc per simular transparència)
      const lightColor: [number, number, number] = [
        Math.round(color[0] * 0.1 + 255 * 0.9),
        Math.round(color[1] * 0.1 + 255 * 0.9),
        Math.round(color[2] * 0.1 + 255 * 0.9)
      ];
      doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, 'F');
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, 'S');
      
      let textY = yPos + 5;
      if (title) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(title, margin + 5, textY);
        textY += 6;
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(lines, margin + 5, textY);
      doc.setTextColor(0, 0, 0);
      yPos += boxHeight + 5;
    };

    // ========== PORTADA ==========
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Guia Completa", pageWidth / 2, 30, { align: "center" });
    doc.setFontSize(18);
    doc.text("Pressupostos - Configuració", pageWidth / 2, 42, { align: "center" });
    
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Tot el que necessites saber per configurar i gestionar els teus pressupostos de projecte", pageWidth / 2, 55, { align: "center" });
    
    yPos = 75;
    doc.setTextColor(0, 0, 0);
    
    // Taula de continguts
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Contingut", margin, yPos);
    yPos += 10;
    
    const tocItems = [
      "1. Què és Pressupostos - Configuració?",
      "2. Com funciona? - Flux de treball",
      "3. Estadístiques - Què t'informen?",
      "4. Fer Visible per Industrials",
      "5. Reordenar Partides",
      "6. Avantatges del Sistema",
      "7. Consells pràctics"
    ];
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    tocItems.forEach((item, index) => {
      doc.text(item, margin + 5, yPos);
      yPos += 7;
    });
    
    yPos += 10;

    // ========== SECCIÓ 1 ==========
    doc.addPage();
    yPos = margin;
    drawSectionHeader("1. Què és Pressupostos - Configuració?", primaryColor);
    
    drawText("Pressupostos - Configuració és el mòdul central per organitzar, estructurar i preparar el teu pressupost abans d'enviar-lo als industrials perquè facin les seves ofertes.", 11);
    yPos += 5;
    
    drawHighlightBox(
      "El sistema extreu automàticament les partides del teu arxiu IFC i les organitza segons l'estructura de capítols predefinida. Tu només has de revisar i completar.",
      blueColor,
      "Per a usuaris amb model BIM"
    );
    
    drawHighlightBox(
      "Pots crear totes les partides manualment des de zero. El sistema et guia per classificar cada partida dins l'estructura de capítols.",
      amberColor,
      "Per a usuaris sense model BIM"
    );
    
    yPos += 5;
    drawText("En resum, aquest mòdul et permet:", 11, true);
    drawListItem("Organitzar les partides del pressupost en una estructura jeràrquica de 3 nivells", "✓");
    drawListItem("Crear partides manuals per completar o complementar les del model BIM", "✓");
    drawListItem("Reordenar les partides segons les teves preferències", "✓");
    drawListItem("Visualitzar estadístiques del pressupost en temps real", "✓");
    drawListItem("Fer visible el pressupost als industrials quan estigui llest", "✓");

    // ========== SECCIÓ 2 ==========
    doc.addPage();
    yPos = margin;
    drawSectionHeader("2. Com funciona? - Flux de treball", blueColor);
    
    drawText("El procés segueix un flux lògic dissenyat per maximitzar l'eficiència:", 11);
    yPos += 5;
    
    // Pas 1
    drawText("PAS 1: Càrrega del model IFC (si en tens)", 11, true);
    drawText("Quan carregues un arxiu IFC, el sistema analitza automàticament tots els elements i extreu les seves mesures i propietats.");
    drawHighlightBox("Lògica interna: S'identifiquen tipus d'elements IFC (portes, finestres, parets, etc.) i s'agrupen per tipologia amb les seves quantificacions.", blueColor);
    
    // Pas 2
    drawText("PAS 2: Classificació en capítols", 11, true);
    drawText("Les partides s'organitzen dins l'estructura de 3 nivells: Capítol → Subcapítol → Subsubcapítol. Pots ajustar la classificació si cal.");
    drawHighlightBox("Lògica interna: El sistema mapeja automàticament tipus IFC a categories de pressupost segons una taula de correspondències predefinida.", purpleColor);
    
    // Pas 3
    drawText("PAS 3: Creació de partides manuals", 11, true);
    drawText("Afegeix partides que no provenen del model BIM: treballs preliminars, seguretat, gestió de residus, etc.");
    drawHighlightBox("Lògica interna: Les partides manuals reben un codi seqüencial dins del subsubcapítol corresponent i es marquen amb badge 'MANUAL'.", amberColor);
    
    checkNewPage(60);
    
    // Pas 4
    drawText("PAS 4: Reordenació de partides", 11, true);
    drawText("Arrossega les partides per ordenar-les segons la lògica d'execució de l'obra o les teves preferències.");
    drawHighlightBox("Lògica interna: L'ordre es guarda al camp 'display_order' de cada partida i es manté entre sessions.", indigoColor);
    
    // Pas 5
    drawText("PAS 5: Fer visible per industrials", 11, true);
    drawText("Quan el pressupost estigui complet, el fas visible. Els industrials podran accedir i enviar les seves ofertes.");
    drawHighlightBox("Lògica interna: S'activa el flag 'is_visible' a la taula project_supplier_visibility. Un cop activat, el pressupost queda bloquejat per evitar canvis.", greenColor);

    // ========== SECCIÓ 3 ==========
    doc.addPage();
    yPos = margin;
    drawSectionHeader("3. Estadístiques - Què t'informen?", purpleColor);
    
    drawText("A la part inferior del modal sempre tens visibles 4 indicadors clau que t'ajuden a controlar l'estat del pressupost:", 11);
    yPos += 5;
    
    drawText("TOTAL PARTIDES", 11, true);
    drawText("Suma total de totes les partides del pressupost, tant les extretes del BIM com les creades manualment.");
    drawHighlightBox("Utilitat: Et permet tenir una visió ràpida del volum del projecte.", primaryColor);
    
    drawText("PARTIDES IFC", 11, true);
    drawText("Partides que provenen directament del model BIM/IFC. S'identifiquen amb el badge blau 'IFC'.");
    drawHighlightBox("Utilitat: Indica el grau d'automatització del procés de pressupost.", blueColor);
    
    drawText("PARTIDES MANUALS", 11, true);
    drawText("Partides creades manualment per tu. S'identifiquen amb el badge taronja 'MANUAL'.");
    drawHighlightBox("Utilitat: Et permet saber quantes partides has afegit a mà.", amberColor);
    
    drawText("% BIM", 11, true);
    drawText("Percentatge de partides que provenen del model BIM respecte al total.");
    drawHighlightBox("Utilitat: Un % alt indica bona qualitat del model BIM. Un % baix pot indicar que el model necessita més detall.", greenColor);

    // ========== SECCIÓ 4 ==========
    doc.addPage();
    yPos = margin;
    drawSectionHeader("4. Fer Visible per Industrials", greenColor);
    
    drawText("Aquesta és l'acció més important del mòdul. Quan el pressupost està llest, el fas visible perquè els industrials puguin valorar-lo.", 11);
    yPos += 5;
    
    drawText("ABANS DE FER-LO VISIBLE:", 11, true);
    drawListItem("Pots afegir, editar i eliminar partides", "•");
    drawListItem("Pots modificar quantitats i unitats", "•");
    drawListItem("Pots reordenar les partides lliurement", "•");
    drawListItem("Els industrials NO veuen el pressupost", "•");
    yPos += 5;
    
    drawText("DESPRÉS DE FER-LO VISIBLE:", 11, true);
    drawListItem("El pressupost queda BLOQUEJAT", "🔒");
    drawListItem("No pots afegir ni eliminar partides", "🔒");
    drawListItem("No pots modificar quantitats ni unitats", "🔒");
    drawListItem("Els industrials JA poden veure i valorar", "👁");
    yPos += 5;
    
    // Caixa d'advertència
    doc.setFillColor(254, 202, 202);
    doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'F');
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'S');
    doc.setTextColor(153, 27, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("⚠️ ATENCIÓ: Acció irreversible", margin + 5, yPos + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Un cop facis visible el pressupost, no hi ha marxa enrere. Assegura't que tot estigui", margin + 5, yPos + 15);
    doc.text("correcte abans de fer clic al botó.", margin + 5, yPos + 20);
    doc.setTextColor(0, 0, 0);
    yPos += 32;
    
    drawHighlightBox("Per què es bloqueja? El bloqueig garanteix que tots els industrials valorin exactament les mateixes partides amb les mateixes quantitats. Això permet comparar les ofertes de forma justa i transparent.", primaryColor);

    // ========== SECCIÓ 5 ==========
    doc.addPage();
    yPos = margin;
    drawSectionHeader("5. Reordenar Partides", indigoColor);
    
    drawText("El sistema utilitza tecnologia de drag & drop per permetre't reordenar les partides de forma intuïtiva:", 11);
    yPos += 5;
    
    drawText("Com reordenar pas a pas:", 11, true);
    yPos += 3;
    
    drawText("1. Localitza l'asa d'arrossegament", 10, true);
    drawText("   A l'esquerra de cada partida veuràs una icona de sis punts verticals.");
    yPos += 2;
    
    drawText("2. Fes clic i mantén premut", 10, true);
    drawText("   El cursor canviarà a mode 'grab' i la partida es ressaltarà.");
    yPos += 2;
    
    drawText("3. Arrossega amunt o avall", 10, true);
    drawText("   Les altres partides es mouran per fer espai.");
    yPos += 2;
    
    drawText("4. Deixa anar per confirmar", 10, true);
    drawText("   L'ordre es guarda automàticament a la base de dades.");
    yPos += 5;
    
    drawHighlightBox("Important: Només pots reordenar partides dins del mateix subsubcapítol. No pots moure partides entre diferents capítols.", primaryColor);

    // ========== SECCIÓ 6 ==========
    doc.addPage();
    yPos = margin;
    drawSectionHeader("6. Avantatges del Sistema", greenColor);
    
    yPos += 5;
    
    drawText("Automatització BIM", 11, true);
    drawText("Extracció automàtica de mesures del model IFC, reduint errors i temps de treball manual.");
    yPos += 3;
    
    drawText("Estructura estandarditzada", 11, true);
    drawText("Tots els pressupostos segueixen la mateixa estructura de capítols, facilitant la comparació.");
    yPos += 3;
    
    drawText("Flexibilitat manual", 11, true);
    drawText("Pots completar o crear pressupostos des de zero sense necessitat de model BIM.");
    yPos += 3;
    
    drawText("Integritat garantida", 11, true);
    drawText("El bloqueig assegura que tots els industrials valoren el mateix pressupost exacte.");
    yPos += 3;
    
    drawText("Control en temps real", 11, true);
    drawText("Estadístiques sempre visibles per monitoritzar l'estat del pressupost.");
    yPos += 3;
    
    drawText("Comparació justa", 11, true);
    drawText("Els industrials valoren les mateixes partides, permetent comparar ofertes objectivament.");

    // ========== SECCIÓ 7 ==========
    doc.addPage();
    yPos = margin;
    drawSectionHeader("7. Consells pràctics", primaryColor);
    
    yPos += 5;
    
    drawText("SI ETS NOU AL SISTEMA:", 11, true);
    yPos += 2;
    drawListItem("Comença revisant l'estructura de capítols per familiaritzar-te amb l'organització", "1.");
    drawListItem("Si tens model BIM, deixa que el sistema faci l'extracció automàtica primer", "2.");
    drawListItem("Afegeix partides manuals només després de revisar les partides IFC", "3.");
    drawListItem("No tinguis pressa en fer visible el pressupost - revisa-ho tot amb calma", "4.");
    drawListItem("Consulta les estadístiques del footer per verificar que tot quadra", "5.");
    
    yPos += 8;
    
    drawText("SI JA TENS EXPERIÈNCIA:", 11, true);
    yPos += 2;
    drawListItem("Optimitza el teu model IFC per maximitzar l'extracció automàtica (% BIM alt)", "1.");
    drawListItem("Utilitza descripcions consistents per facilitar futures cerques i comparacions", "2.");
    drawListItem("Ordena les partides seguint la lògica d'execució de l'obra", "3.");
    drawListItem("Crea plantilles de partides manuals per a treballs recurrents", "4.");
    drawListItem("Revisa el mapatge BIM-capítols per millorar la classificació automàtica", "5.");
    
    // Peu de pàgina
    yPos = pageHeight - 25;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Generat el ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, yPos);
    doc.text("Guia Completa - Pressupostos Configuració", pageWidth - margin, yPos, { align: "right" });

    // Descarregar
    doc.save(`Guia_Pressupostos_Configuracio_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    
    toast({
      title: "PDF generat correctament",
      description: "La guia s'ha descarregat al teu dispositiu",
    });
  };

  // Handler per crear partida manual
  const handleCreatePartida = (chapterCode: string, subchapterCode: string, subsubchapterCode: string) => {
    setSelectedChapter(chapterCode);
    setSelectedSubchapter(subchapterCode);
    setSelectedSubsubchapter(subsubchapterCode);
    setNewPartida({
      customName: "",
      description: "",
      measuredValue: "",
      preferredUnit: "UT",
    });
    setCreateDialogOpen(true);
  };

  const handleSavePartida = async () => {
    if (!selectedChapter || !selectedSubchapter || !selectedSubsubchapter || !newPartida.customName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cal omplir com a mínim el nom de la partida",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No s'ha pogut identificar l'usuari",
        });
        return;
      }

      // Obtenir les partides existents d'aquest subsubcapítol per calcular el display_order
      const existingElements = elements.filter(
        e => e.subsubchapter_id === selectedSubsubchapter
      );
      const maxOrder = existingElements.length > 0 
        ? Math.max(...existingElements.map(e => e.display_order)) 
        : 0;

      // Preparar les dades segons si és projecte o centre
      const insertData: any = {
        user_id: user.id,
        ifc_category: "MANUAL",
        type_name: newPartida.customName,
        custom_name: newPartida.customName,
        chapter_id: selectedChapter,
        subchapter_id: selectedSubchapter,
        subsubchapter_id: selectedSubsubchapter,
        preferred_unit: newPartida.preferredUnit,
        description: newPartida.description || null,
        measured_value: parseFloat(newPartida.measuredValue) || 0,
        display_order: maxOrder + 1,
        is_manual: true,
      };

      // Afegir projectId o centerId segons el cas + versionId
      if (projectId) {
        insertData.project_id = projectId;
        if (versionId) {
          insertData.version_id = versionId;
        }
      } else if (centerId) {
        insertData.center_id = centerId;
      }

      const { error } = await supabase
        .from("element_type_configs")
        .insert(insertData);

      if (error) {
        console.error("Error creating manual partida:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al crear la partida manual",
        });
        return;
      }

      toast({
        title: "Partida creada",
        description: "Partida manual creada correctament",
      });
      
      setCreateDialogOpen(false);
      
      // Recarregar les dades sense tancar els acordions
      if (projectId) {
        await loadProjectData();
      } else if (centerId) {
        await loadCenterData();
      }
      
      // Mantenir obert el subsubcapítol on s'ha creat la partida
      const accordionKey = `ssch-${selectedSubsubchapter}`;
      if (!openAccordions.includes(accordionKey)) {
        setOpenAccordions([...openAccordions, accordionKey]);
      }
    } catch (error) {
      console.error("Error creating manual partida:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al crear la partida manual",
      });
    }
  };

  // Handler pel drag and drop
  const handleDragEnd = async (event: DragEndEvent, subsubchapterCode: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Trobar els elements d'aquest subsubcapítol
    const subsubchapterElements = elements.filter(
      (e) => e.subsubchapter_id === subsubchapterCode
    );

    const oldIndex = subsubchapterElements.findIndex((e) => e.id === active.id);
    const newIndex = subsubchapterElements.findIndex((e) => e.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reordenar els elements
    const reorderedElements = arrayMove(subsubchapterElements, oldIndex, newIndex);

    // Actualitzar els display_order (començant des d'1)
    const updates = reorderedElements.map((el, idx) => ({
      id: el.id,
      display_order: idx + 1,
    }));

    // Actualitzar l'estat local immediatament per millor UX
    setElements((prev) => {
      const updatedElements = [...prev];
      updates.forEach((update) => {
        const idx = updatedElements.findIndex((e) => e.id === update.id);
        if (idx !== -1) {
          updatedElements[idx] = { ...updatedElements[idx], display_order: update.display_order };
        }
      });
      return updatedElements;
    });

    // Actualitzar la base de dades
    try {
      for (const update of updates) {
        const { error } = await supabase
          .from("element_type_configs")
          .update({ display_order: update.display_order })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast({
        title: "Ordre actualitzat",
        description: "L'ordre de les partides s'ha actualitzat correctament",
      });
    } catch (error) {
      console.error("Error actualitzant ordre:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'ha pogut actualitzar l'ordre de les partides",
      });
      // Recarregar les dades en cas d'error
      if (projectId) {
        loadProjectData();
      } else if (centerId) {
        loadCenterData();
      }
    }
  };

  // Funció per formatar números amb separador de milers i coma decimal
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0,00';
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
  };

  // Crear maps per accés ràpid als codis
  const chaptersMap = useMemo(() => {
    const map = new Map<string, BudgetChapter>();
    BUDGET_CHAPTERS.forEach(ch => map.set(ch.code, ch));
    return map;
  }, []);

  const subchaptersMap = useMemo(() => {
    const map = new Map<string, BudgetSubchapter>();
    BUDGET_CHAPTERS.forEach(ch => {
      ch.subchapters.forEach(sub => map.set(sub.code, sub));
    });
    return map;
  }, []);

  const subsubchaptersMap = useMemo(() => {
    const map = new Map<string, BudgetSubsubchapter>();
    BUDGET_CHAPTERS.forEach(ch => {
      ch.subchapters.forEach(sub => {
        sub.subsubchapters.forEach(subsub => map.set(subsub.code, subsub));
      });
    });
    return map;
  }, []);

  // Funció per obtenir el codi complet de 4 nivells d'un element
  const getElementFullCode = (element: ElementTypeConfig) => {
    if (element.subsubchapter_id && element.display_order) {
      return `${element.subsubchapter_id}.${String(element.display_order).padStart(2, '0')}`;
    }
    return element.subsubchapter_id || element.subchapter_id || element.chapter_id || 'N/A';
  };

  // Calcular estadístiques de partides IFC vs Manuals
  const partidesStats = useMemo(() => {
    const totalPartides = elements.length;
    const partidesIFC = elements.filter(e => !e.is_manual).length;
    const partidesManuals = elements.filter(e => e.is_manual).length;
    const percentatgeBIM = totalPartides > 0 ? (partidesIFC / totalPartides) * 100 : 0;

    return {
      totalPartides,
      ifc: partidesIFC,
      manual: partidesManuals,
      percentageBIM: percentatgeBIM.toFixed(1),
    };
  }, [elements]);

  // Funció per comptar partides per nivell
  const countPartidesByLevel = (chapterCode?: string, subchapterCode?: string, subsubchapterCode?: string) => {
    if (subsubchapterCode && subchapterCode && chapterCode) {
      // Nivell 3: comptar partides d'aquest subsubcapítol
      return elements.filter(e => 
        e.chapter_id === chapterCode && 
        e.subchapter_id === subchapterCode && 
        e.subsubchapter_id === subsubchapterCode
      ).length;
    } else if (subchapterCode && chapterCode) {
      // Nivell 2: comptar partides d'aquest subcapítol
      return elements.filter(e => 
        e.chapter_id === chapterCode && 
        e.subchapter_id === subchapterCode
      ).length;
    } else if (chapterCode) {
      // Nivell 1: comptar partides d'aquest capítol
      return elements.filter(e => e.chapter_id === chapterCode).length;
    }
    return 0;
  };

  // Agrupar elements editats per l'estructura jeràrquica
  const getStructuredElements = useMemo(() => {
    console.log("🟢 === DEBUG ESTRUCTURA PRESSUPOST ===");
    console.log("🟢 Total elements carregats:", elements.length);
    console.log("🟢 Elements array:", elements);
    
    // Filtrar només elements editats (amb chapter_id, subchapter_id, subsubchapter_id)
    const editedElements = elements.filter(e => 
      e.chapter_id && e.subchapter_id && e.subsubchapter_id
    );
    
    console.log("Elements amb tots els nivells (chapter_id, subchapter_id, subsubchapter_id):", editedElements.length);
    
    if (editedElements.length > 0) {
      console.log("Mostra del primer element editat:", {
        type_name: editedElements[0].type_name,
        chapter_id: editedElements[0].chapter_id,
        subchapter_id: editedElements[0].subchapter_id,
        subsubchapter_id: editedElements[0].subsubchapter_id,
        display_order: editedElements[0].display_order,
        measured_value: editedElements[0].measured_value,
        preferred_unit: editedElements[0].preferred_unit,
      });
    } else {
      console.log("⚠️ No hi ha cap element amb els 3 nivells assignats");
      // Mostrem quins elements hi ha i quins camps tenen
      console.log("Mostra dels primers 5 elements:", elements.slice(0, 5).map(e => ({
        type_name: e.type_name,
        chapter_id: e.chapter_id,
        subchapter_id: e.subchapter_id,
        subsubchapter_id: e.subsubchapter_id,
        display_order: e.display_order,
      })));
    }

    // Agrupar per capítol -> subcapítol -> subsubcapítol
    type SubsubChapterMap = Map<string, ElementTypeConfig[]>;
    type SubChapterMap = Map<string, SubsubChapterMap>;
    type ChapterMap = Map<string, SubChapterMap>;
    
    const structure: ChapterMap = new Map();

    editedElements.forEach(element => {
      if (!element.chapter_id || !element.subchapter_id || !element.subsubchapter_id) return;

      if (!structure.has(element.chapter_id)) {
        structure.set(element.chapter_id, new Map());
      }
      const chapterMap = structure.get(element.chapter_id)!;

      if (!chapterMap.has(element.subchapter_id)) {
        chapterMap.set(element.subchapter_id, new Map());
      }
      const subchapterMap = chapterMap.get(element.subchapter_id)!;

      if (!subchapterMap.has(element.subsubchapter_id)) {
        subchapterMap.set(element.subsubchapter_id, []);
      }
      subchapterMap.get(element.subsubchapter_id)!.push(element);
    });

    console.log("Estructura creada - Capítols:", structure.size);
    console.log("=== FI DEBUG ===");

    return structure;
  }, [elements]);

  // Carregar mappings de categories de la base de dades
  const loadCategoryMappings = async () => {
    try {
      // Carregar mappings de budget_category_mappings
      const { data: mappingsData } = await supabase
        .from("budget_category_mappings")
        .select("budget_code, category_id");
      
      // Carregar categories d'especialistes
      const { data: categoriesData } = await supabase
        .from("specialist_categories")
        .select("id, name");
      
      if (mappingsData && categoriesData) {
        const categoryIdToName = new Map(categoriesData.map(c => [c.id, c.name]));
        const newMappings = new Map<string, string>();
        
        mappingsData.forEach(mapping => {
          const categoryName = categoryIdToName.get(mapping.category_id);
          if (categoryName) {
            newMappings.set(mapping.budget_code, categoryName);
          }
        });
        
        setDbCategoryMappings(newMappings);
      }
    } catch (error) {
      console.error("Error loading category mappings:", error);
    }
  };

  // Funció per obtenir la categoria d'un codi de pressupost (primer BBDD, després estàtic)
  const getCategoryForBudgetCode = (budgetCode: string): string | null => {
    // Normalitzar a 3 nivells (XX.XX.XX)
    const parts = budgetCode.split('.');
    const normalizedCode = parts.slice(0, 3).join('.');
    
    // Primer buscar a la base de dades
    const dbCategory = dbCategoryMappings.get(normalizedCode);
    if (dbCategory) {
      return dbCategory;
    }
    
    // Si no hi ha a la BBDD, usar el mapping estàtic
    return getStaticCategoryForBudgetCode(budgetCode);
  };

  // Calcular categories dels elements per la pestanya d'abast (incloent les partides)
  const categoriesWithItems = useMemo(() => {
    const categoryData = new Map<string, { count: number; items: typeof elements }>();
    
    elements.forEach(element => {
      if (element.subsubchapter_id) {
        const category = getCategoryForBudgetCode(element.subsubchapter_id);
        if (category) {
          const existing = categoryData.get(category) || { count: 0, items: [] };
          existing.count += 1;
          existing.items.push(element);
          categoryData.set(category, existing);
        }
      }
    });
    
    return Array.from(categoryData.entries())
      .map(([categoryName, data]) => ({ 
        categoryName, 
        itemCount: data.count,
        items: data.items 
      }))
      .sort((a, b) => b.itemCount - a.itemCount);
  }, [elements, dbCategoryMappings]);

  // Estat per industrials únics
  const [uniqueSuppliersCount, setUniqueSuppliersCount] = useState(0);

  // Calcular industrials únics quan canvien les categories
  useEffect(() => {
    const loadUniqueSuppliersCount = async () => {
      if (categoriesWithItems.length === 0) {
        setUniqueSuppliersCount(0);
        return;
      }

      try {
        // Obtenir totes les categories d'especialista
        const { data: allCategories } = await supabase
          .from("specialist_categories")
          .select("id, name");

        if (!allCategories) {
          setUniqueSuppliersCount(0);
          return;
        }

        const categoryMap = new Map(allCategories.map(c => [c.name.toLowerCase().trim(), c.id]));

        // Obtenir els IDs de les categories del projecte
        const categoryIds: string[] = [];
        for (const catItem of categoriesWithItems) {
          const normalizedName = catItem.categoryName.toLowerCase().trim();
          const categoryId = categoryMap.get(normalizedName);
          if (categoryId) {
            categoryIds.push(categoryId);
          }
        }

        if (categoryIds.length === 0) {
          setUniqueSuppliersCount(0);
          return;
        }

        // Obtenir tots els industrials únics que tenen alguna d'aquestes categories
        const { data: supplierCategories } = await supabase
          .from("supplier_categories")
          .select("supplier_id")
          .in("category_id", categoryIds);

        if (supplierCategories) {
          // Comptar suppliers únics
          const uniqueSupplierIds = new Set(supplierCategories.map(sc => sc.supplier_id));
          setUniqueSuppliersCount(uniqueSupplierIds.size);
        } else {
          setUniqueSuppliersCount(0);
        }
      } catch (error) {
        console.error("Error loading unique suppliers count:", error);
        setUniqueSuppliersCount(0);
      }
    };

    loadUniqueSuppliersCount();
  }, [categoriesWithItems]);

  // Carregar mappings quan s'obri el modal
  useEffect(() => {
    if (open) {
      loadCategoryMappings();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      if (projectId) {
        console.log("🔄 Carregant dades MODE PROJECTE:", projectId, "versionId:", versionId);
        loadProjectData();
        // Carregar pressupostos immediatament en mode projecte
        loadReceivedBudgets();
      } else if (centerId) {
        console.log("🔄 Carregant dades MODE CENTRE:", centerId);
        loadCenterData();
      }
    }
  }, [open, centerId, projectId, versionId]);

  const loadProjectData = async () => {
    if (!projectId) return;

    console.log("🔵 MODE PROJECTE - ID:", projectId);
    setLoading(true);
    try {
      // Carregar NOMÉS elements del projecte (filtrat per versionId si existeix)
      let elementsQuery = supabase
        .from("element_type_configs")
        .select("*")
        .eq("project_id", projectId);
      
      // Filtrar per version_id si existeix
      if (versionId) {
        elementsQuery = elementsQuery.eq("version_id", versionId);
      } else {
        elementsQuery = elementsQuery.is("version_id", null);
      }
      
      const { data: elementsData, error: elementsError } = await elementsQuery.order("display_order");

      if (elementsError) throw elementsError;

      console.log("✅ Elements del projecte carregats:", elementsData?.length || 0);
      
      // Carregar valoracions del projecte
      const { data: valuationsData, error: valuationsError } = await supabase
        .from("budget_supplier_valuations")
        .select("supplier_id, chapter_code")
        .eq("center_id", projectId); // Nota: aquesta taula usa center_id per projectes també

      if (valuationsError) throw valuationsError;

      console.log("💰 Valoracions carregades:", valuationsData?.length || 0);

      const [elementsRes, valuationsRes] = await Promise.all([
        Promise.resolve({ data: elementsData, error: elementsError }),
        Promise.resolve({ data: valuationsData, error: valuationsError }),
      ]);

      setElements(elementsRes.data || []);
      setBudgetValuations(valuationsRes.data || []);

      // Obtenir suppliers únics
      const uniqueSupplierIds = Array.from(
        new Set(valuationsRes.data?.map((v) => v.supplier_id) || [])
      );

      if (uniqueSupplierIds.length > 0) {
        const suppliersRes = await supabase
          .from("suppliers")
          .select("id, name, city, email, phone")
          .in("id", uniqueSupplierIds);

        if (suppliersRes.error) throw suppliersRes.error;
        setSuppliers(suppliersRes.data || []);
      } else {
        setSuppliers([]);
      }

      // Carregar la visibilitat del projecte per a industrials
      const { data: visibilityData } = await supabase
        .from("project_supplier_visibility")
        .select("is_visible")
        .eq("project_id", projectId)
        .maybeSingle();

      setIsVisibleToSuppliers(visibilityData?.is_visible || false);
      
    } catch (error) {
      console.error("❌ Error carregant dades del projecte:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'han pogut carregar les dades del projecte",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCenterData = async () => {
    if (!centerId) return;

    console.log("🟢 MODE CENTRE - ID:", centerId);
    setLoading(true);
    try {
      // Carregar NOMÉS elements del centre
      const { data: elementsData, error: elementsError } = await supabase
        .from("element_type_configs")
        .select("*")
        .eq("center_id", centerId)
        .order("display_order");

      if (elementsError) throw elementsError;

      console.log("✅ Elements del centre carregats:", elementsData?.length || 0);

      // Carregar valoracions del centre
      const { data: valuationsData, error: valuationsError } = await supabase
        .from("budget_supplier_valuations")
        .select("supplier_id, chapter_code")
        .eq("center_id", centerId);

      if (valuationsError) throw valuationsError;

      console.log("💰 Valoracions carregades:", valuationsData?.length || 0);

      setElements(elementsData || []);
      setBudgetValuations(valuationsData || []);

      // Obtenir suppliers únics
      const uniqueSupplierIds = Array.from(
        new Set(valuationsData?.map((v) => v.supplier_id) || [])
      );

      if (uniqueSupplierIds.length > 0) {
        const suppliersRes = await supabase
          .from("suppliers")
          .select("id, name, city, email, phone")
          .in("id", uniqueSupplierIds);

        if (suppliersRes.error) throw suppliersRes.error;
        setSuppliers(suppliersRes.data || []);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error("❌ Error carregant dades del centre:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'han pogut carregar les dades del centre",
      });
    } finally {
      setLoading(false);
    }
  };

  // Obtenir categories úniques dels pressupostos (basant-se en la categoria del pressupost, no del supplier)
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    receivedBudgets.forEach(budget => {
      // Usar la categoria del pressupost (budget.category) en lloc de les categories del supplier
      if (budget.category) {
        categories.add(budget.category);
      }
    });
    return Array.from(categories).sort();
  }, [receivedBudgets]);

  // Obtenir noms de projectes únics
  const uniqueProjectNames = useMemo(() => {
    const names = new Set<string>();
    receivedBudgets.forEach(budget => {
      if (budget.project_name) names.add(budget.project_name);
    });
    return Array.from(names).sort();
  }, [receivedBudgets]);

  // Funció per determinar l'estat del pressupost basat en validesa
  const getBudgetStatus = (budget: any) => {
    const now = new Date();
    const expiresAt = new Date(budget.expires_at);
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (budget.status === "accepted") return "accepted";
    if (budget.status === "rejected") return "rejected";
    if (daysRemaining < 0) return "expired";
    if (daysRemaining <= 7) return "expiring-soon";
    return "valid";
  };

  // Filtrar i ordenar pressupostos
  const filteredAndSortedBudgets = useMemo(() => {
    let filtered = [...receivedBudgets];

    // Filtre per pestanya activa (estat del pressupost)
    if (activeTab === "budgets") {
      filtered = filtered.filter(b => b.status === 'submitted');
    } else if (activeTab === "accepted") {
      filtered = filtered.filter(b => b.status === 'accepted');
    } else if (activeTab === "rejected") {
      filtered = filtered.filter(b => b.status === 'rejected');
    }

    // Filtre per nom de projecte
    if (filterProjectName && filterProjectName !== "all") {
      filtered = filtered.filter(b => 
        b.project_name === filterProjectName
      );
    }

    // Filtre per categoria (usar budget.category en lloc de supplier_categories)
    if (filterCategory && filterCategory !== "all") {
      filtered = filtered.filter(b => 
        b.category === filterCategory
      );
    }

    // Filtre per estat (només aplicable si no estem filtrant per pestanya)
    if (filterStatus && filterStatus !== "all" && activeTab !== "accepted" && activeTab !== "rejected") {
      filtered = filtered.filter(b => getBudgetStatus(b) === filterStatus);
    }

    // Ordenació
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
        case "date-asc":
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        case "price-asc":
          return (a.total_amount || 0) - (b.total_amount || 0);
        case "price-desc":
          return (b.total_amount || 0) - (a.total_amount || 0);
        case "company-asc":
          return (a.profiles?.full_name || "").localeCompare(b.profiles?.full_name || "");
        case "company-desc":
          return (b.profiles?.full_name || "").localeCompare(a.profiles?.full_name || "");
        default:
          return 0;
      }
    });

    return filtered;
  }, [receivedBudgets, filterProjectName, filterCategory, filterStatus, sortBy, activeTab]);

  // Funció per toggle expanded state d'un pressupost
  const toggleBudgetExpanded = (budgetId: string) => {
    const newExpanded = new Set(expandedBudgets);
    if (newExpanded.has(budgetId)) {
      newExpanded.delete(budgetId);
    } else {
      newExpanded.add(budgetId);
    }
    setExpandedBudgets(newExpanded);
  };

  const loadReceivedBudgets = async () => {
    if (!projectId) return;

    setBudgetsLoading(true);
    try {
      console.log("Carregant pressupostos per project_id:", projectId);
      
      // Carregar dades del projecte
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single();

      if (projectError) {
        console.error("Error obtenint dades del projecte:", projectError);
      }
      
      // Primer obtenim els pressupostos
      const { data: budgets, error: budgetsError } = await supabase
        .from("supplier_budgets")
        .select("*")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: false });

      if (budgetsError) {
        console.error("Error obtenint pressupostos:", budgetsError);
        throw budgetsError;
      }

      console.log("Pressupostos obtinguts:", budgets);

      if (!budgets || budgets.length === 0) {
        console.log("No hi ha pressupostos per aquest projecte");
        setReceivedBudgets([]);
        return;
      }

      // Obtenir les partides (item_ids) dels pressupostos ja acceptats
      const acceptedBudgets = budgets.filter(b => b.status === "accepted");
      const acceptedItemIds = new Set<string>();
      acceptedBudgets.forEach(budget => {
        const valuations = Array.isArray(budget.valuations) ? budget.valuations : [];
        valuations.forEach((val: any) => {
          if (val.item_id) acceptedItemIds.add(val.item_id);
        });
      });
      console.log("Partides ja acceptades:", Array.from(acceptedItemIds));

      // Filtrar pressupostos pendents que tinguin TOTES les partides ja acceptades
      // (automàticament rebutjar-los perquè no té sentit mostrar-los)
      const budgetsToAutoReject: string[] = [];
      const filteredBudgets = budgets.filter(budget => {
        // Si ja està acceptat o rebutjat, mantenir-lo
        if (budget.status === "accepted" || budget.status === "rejected") {
          return true;
        }
        
        // Si està pendent (submitted), comprovar si té partides que ja estan acceptades
        const valuations = Array.isArray(budget.valuations) ? budget.valuations : [];
        const budgetItemIds = valuations.map((v: any) => v.item_id).filter(Boolean);
        
        // Comprovar si alguna partida ja ha estat acceptada
        const hasAcceptedItems = budgetItemIds.some((itemId: string) => acceptedItemIds.has(itemId));
        
        if (hasAcceptedItems) {
          // Marcar per rebutjar automàticament
          budgetsToAutoReject.push(budget.id);
          return false; // No mostrar en la llista de rebuts
        }
        
        return true;
      });

      // Rebutjar automàticament els pressupostos amb partides ja acceptades
      if (budgetsToAutoReject.length > 0) {
        console.log("Rebutjant automàticament pressupostos amb partides ja acceptades:", budgetsToAutoReject);
        const { error: rejectError } = await supabase
          .from("supplier_budgets")
          .update({ 
            status: "rejected",
            rejection_reason: "Rebutjat automàticament: Les partides ja han estat acceptades en un altre pressupost",
            rejected_at: new Date().toISOString()
          })
          .in("id", budgetsToAutoReject);

        if (rejectError) {
          console.error("Error rebutjant pressupostos automàticament:", rejectError);
        }
      }

      // Obtenim els IDs únics dels suppliers
      const supplierIds = Array.from(new Set(filteredBudgets.map(b => b.supplier_id)));
      console.log("IDs de suppliers:", supplierIds);

      // Obtenim tots els item_ids de totes les valoracions per buscar els display_order
      const allItemIds = new Set<string>();
      filteredBudgets.forEach(budget => {
        const valuations = Array.isArray(budget.valuations) ? budget.valuations : [];
        valuations.forEach((val: any) => {
          if (val.item_id) allItemIds.add(val.item_id);
        });
      });

      // Obtenim els display_order de element_type_configs
      const { data: elementConfigs, error: configsError } = await supabase
        .from("element_type_configs")
        .select("id, display_order")
        .in("id", Array.from(allItemIds));

      if (configsError) {
        console.error("Error obtenint element configs:", configsError);
      }

      console.log("Element configs obtinguts:", elementConfigs);

      // Crear un mapa d'item_id -> display_order
      const displayOrderMap = new Map<string, number>();
      elementConfigs?.forEach(config => {
        displayOrderMap.set(config.id, config.display_order);
      });

      // Carregar dades de la taula suppliers per obtenir els IDs i user_ids
      const { data: suppliersTableData, error: supplierCoordsError } = await supabase
        .from("suppliers")
        .select("id, user_id")
        .in("id", supplierIds);

      if (supplierCoordsError) console.error("Error loading supplier data:", supplierCoordsError);

      // Obtenir els user_ids per buscar els perfils
      const userIds = suppliersTableData?.map(s => s.user_id) || [];
      console.log("User IDs per buscar perfils:", userIds);

      // Obtenim els perfils dels suppliers usant els user_ids
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, nif, street, street_number, city, postal_code, province")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error obtenint profiles:", profilesError);
        throw profilesError;
      }

      console.log("Profiles obtinguts:", profiles);

      // Obtenir el nombre total de partides del projecte
      const { count: totalPartides, error: totalElementsError } = await supabase
        .from("element_type_configs")
        .select("*", { count: 'exact', head: true })
        .eq("project_id", projectId);

      console.log("Total partides del projecte:", totalPartides);

      // Mapa per convertir supplier_id -> user_id
      const supplierIdToUserIdMap = new Map(suppliersTableData?.map(s => [s.id, s.user_id]) || []);
      const userIdToSupplierIdMap = new Map(suppliersTableData?.map(s => [s.user_id, s.id]) || []);
      const supplierTableIds = suppliersTableData?.map(s => s.id) || [];
      
      // Carregar categories dels suppliers
      const { data: supplierCategoriesData, error: categoriesError } = await supabase
        .from("supplier_categories")
        .select("supplier_id, category_id, specialist_categories(name, display_order)")
        .in("supplier_id", supplierTableIds);

      if (categoriesError) console.error("Error loading supplier categories:", categoriesError);

      const supplierIdToCategoriesMap = new Map<string, { categories: string[]; order: number }>();
      supplierCategoriesData?.forEach((sc: any) => {
        const categoryData = sc.specialist_categories;
        if (categoryData) {
          const supplierId = sc.supplier_id;
          const existing = supplierIdToCategoriesMap.get(supplierId);
          
          if (existing) {
            existing.categories.push(categoryData.name || "Sense categoria");
          } else {
            supplierIdToCategoriesMap.set(supplierId, {
              categories: [categoryData.name || "Sense categoria"],
              order: categoryData.display_order || 999,
            });
          }
        }
      });

      // Combinem les dades i afegim el codi complet a cada valoració
      const budgetsWithProfiles = filteredBudgets.map(budget => {
        // Obtenir el user_id a partir del supplier_id
        const userId = supplierIdToUserIdMap.get(budget.supplier_id);
        const profile = profiles?.find(p => p.id === userId) || null;
        
        // Obtenir categories del supplier
        const categoryInfo = supplierIdToCategoriesMap.get(budget.supplier_id) || { 
          categories: ["Sense categoria especificada"], 
          order: 999 
        };
        
        // Processar valuations per afegir el codi de 4 nivells
        const valuations = Array.isArray(budget.valuations) ? budget.valuations : [];
        const valuationsWithFullCode = valuations.map((val: any) => {
          // Intentar obtenir display_order de la valoració o del mapa
          const displayOrder = val.display_order || displayOrderMap.get(val.item_id);
          
          const fullCode = val.subsubchapter_id && displayOrder
            ? `${val.subsubchapter_id}.${String(displayOrder).padStart(2, '0')}`
            : val.subsubchapter_id || val.subchapter_id || val.chapter_id || 'N/A';

          console.log(`Generant codi per ${val.item_name}: subsubchapter=${val.subsubchapter_id}, display_order=${displayOrder}, full_code=${fullCode}`);

          return {
            ...val,
            display_order: displayOrder,
            full_code: fullCode
          };
        });

        return {
          ...budget,
          profiles: profile,
          supplier_categories: categoryInfo.categories,
          valuations: valuationsWithFullCode,
          project_name: projectData?.name || "Projecte sense nom",
          total_partides: totalPartides
        };
      });

      console.log("Pressupostos amb profiles i codis complets:", budgetsWithProfiles);
      setReceivedBudgets(budgetsWithProfiles);
      
      // Comptar pressupostos nous (no visualitzats)
      const newCount = budgetsWithProfiles.filter(b => !b.viewed_at).length;
      setNewBudgetsCount(newCount);
    } catch (error) {
      console.error("Error carregant pressupostos rebuts:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'han pogut carregar els pressupostos rebuts",
      });
    } finally {
      setBudgetsLoading(false);
    }
  };

  const handleAcceptBudget = (budget: any) => {
    setBudgetToAccept(budget);
    setAcceptDialogOpen(true);
  };
  
  const confirmAcceptBudget = async () => {
    if (!budgetToAccept) return;
    
    try {
      // Obtenir les partides (item_ids) del pressupost a acceptar
      const acceptedValuations = Array.isArray(budgetToAccept.valuations) 
        ? budgetToAccept.valuations 
        : [];
      const acceptedItemIds = acceptedValuations.map((v: any) => v.item_id).filter(Boolean);
      
      console.log("Acceptant pressupost amb partides:", acceptedItemIds);

      // Acceptar el pressupost seleccionat
      const { error: acceptError } = await supabase
        .from("supplier_budgets")
        .update({ status: "accepted" })
        .eq("id", budgetToAccept.id);

      if (acceptError) throw acceptError;

      // Trobar i rebutjar automàticament tots els altres pressupostos 
      // que tinguin partides coincidents (del mateix projecte, diferent supplier)
      if (acceptedItemIds.length > 0) {
        // Obtenir tots els altres pressupostos pendents del mateix projecte
        const { data: otherBudgets, error: fetchError } = await supabase
          .from("supplier_budgets")
          .select("id, valuations")
          .eq("project_id", projectId)
          .eq("status", "submitted")
          .neq("id", budgetToAccept.id);

        if (fetchError) {
          console.error("Error obtenint altres pressupostos:", fetchError);
        } else if (otherBudgets && otherBudgets.length > 0) {
          // Filtrar pressupostos que tinguin partides coincidents
          const budgetsToReject: string[] = [];
          
          otherBudgets.forEach((budget: any) => {
            const valuations = Array.isArray(budget.valuations) ? budget.valuations : [];
            const budgetItemIds = valuations.map((v: any) => v.item_id).filter(Boolean);
            
            // Comprovar si hi ha partides coincidents
            const hasOverlap = budgetItemIds.some((itemId: string) => 
              acceptedItemIds.includes(itemId)
            );
            
            if (hasOverlap) {
              budgetsToReject.push(budget.id);
            }
          });

          console.log("Pressupostos a rebutjar automàticament:", budgetsToReject);

          // Rebutjar els pressupostos coincidents
          if (budgetsToReject.length > 0) {
            const { error: rejectError } = await supabase
              .from("supplier_budgets")
              .update({ 
                status: "rejected",
                rejection_reason: "Rebutjat automàticament: S'ha acceptat un altre pressupost amb les mateixes partides",
                rejected_at: new Date().toISOString()
              })
              .in("id", budgetsToReject);

            if (rejectError) {
              console.error("Error rebutjant pressupostos automàticament:", rejectError);
            } else {
              console.log(`${budgetsToReject.length} pressupostos rebutjats automàticament`);
            }
          }
        }
      }

      const rejectedCount = acceptedItemIds.length > 0 
        ? (await supabase
            .from("supplier_budgets")
            .select("id", { count: 'exact', head: true })
            .eq("project_id", projectId)
            .eq("status", "rejected")
            .neq("id", budgetToAccept.id)).count || 0
        : 0;

      toast({
        title: "Pressupost acceptat",
        description: rejectedCount > 0 
          ? `El pressupost ha estat acceptat i s'han rebutjat automàticament els pressupostos amb partides coincidents.`
          : "El pressupost ha estat acceptat correctament",
      });

      setAcceptDialogOpen(false);
      setBudgetToAccept(null);
      loadReceivedBudgets();
    } catch (error) {
      console.error("Error acceptant pressupost:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'ha pogut acceptar el pressupost",
      });
    }
  };

  const handleRejectBudget = (budget: any) => {
    setBudgetToReject(budget);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmRejectBudget = async () => {
    if (!budgetToReject || !rejectionReason) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Has de seleccionar un motiu per al rebuig",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("supplier_budgets")
        .update({ 
          status: "rejected",
          rejection_reason: rejectionReason,
          rejected_at: new Date().toISOString()
        })
        .eq("id", budgetToReject.id);

      if (error) throw error;

      toast({
        title: "Pressupost rebutjat",
        description: "El pressupost ha estat rebutjat correctament",
      });

      setRejectDialogOpen(false);
      setBudgetToReject(null);
      setRejectionReason("");
      loadReceivedBudgets();
    } catch (error) {
      console.error("Error rebutjant pressupost:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'ha pogut rebutjar el pressupost",
      });
    }
  };

  const generatePDF = async (budget: any) => {
    try {
      // Carregar dades del projecte
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) {
        console.error("Error carregant projecte:", projectError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No s'han pogut carregar les dades del projecte",
        });
        return;
      }

      // Carregar dades del client (propietari del projecte)
      const { data: clientProfile, error: clientError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", project.created_by)
        .single();

      if (clientError) {
        console.error("Error carregant dades del client:", clientError);
      }

      const doc = new jsPDF();
      const profile = budget.profiles;
      
      // Configuració de colors
      const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
      const textColor: [number, number, number] = [0, 0, 0];
      
      let yPosition = 20;
      
      // Títol del document
      doc.setFontSize(22);
      doc.setTextColor(...primaryColor);
      doc.text("PRESSUPOST", 105, yPosition, { align: "center" });
      yPosition += 15;
      
      // Dues columnes: Industrial (esquerra) i Client/Projecte (dreta)
      const leftColumnX = 20;
      const rightColumnX = 110;
      let leftY = yPosition;
      let rightY = yPosition;
      
      // ===== COLUMNA ESQUERRA: INDUSTRIAL =====
      doc.setFontSize(11);
      doc.setTextColor(...textColor);
      doc.setFont("helvetica", "bold");
      doc.text("DADES DE L'EMPRESA", leftColumnX, leftY);
      leftY += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      if (profile?.full_name) {
        doc.text(`Nom: ${profile.full_name}`, leftColumnX, leftY);
        leftY += 6;
      }
      
      if (profile?.nif) {
        doc.text(`NIF: ${profile.nif}`, leftColumnX, leftY);
        leftY += 6;
      }
      
      if (profile?.email) {
        const emailText = doc.splitTextToSize(`Email: ${profile.email}`, 85);
        emailText.forEach((line: string) => {
          doc.text(line, leftColumnX, leftY);
          leftY += 6;
        });
      }
      
      if (profile?.phone) {
        doc.text(`Telèfon: ${profile.phone}`, leftColumnX, leftY);
        leftY += 6;
      }
      
      if (profile?.street || profile?.street_number) {
        const address = `${profile.street || ''} ${profile.street_number || ''}`.trim();
        const addressLines = doc.splitTextToSize(`Adreça: ${address}`, 85);
        addressLines.forEach((line: string) => {
          doc.text(line, leftColumnX, leftY);
          leftY += 6;
        });
      }
      
      if (profile?.city || profile?.postal_code || profile?.province) {
        const cityInfo = [profile.city, profile.postal_code, profile.province].filter(Boolean).join(', ');
        const cityLines = doc.splitTextToSize(cityInfo, 85);
        cityLines.forEach((line: string) => {
          doc.text(line, leftColumnX, leftY);
          leftY += 6;
        });
      }
      
      // ===== COLUMNA DRETA: CLIENT I PROJECTE =====
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DADES DEL CLIENT", rightColumnX, rightY);
      rightY += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      if (clientProfile?.full_name) {
        doc.text(`Nom: ${clientProfile.full_name}`, rightColumnX, rightY);
        rightY += 6;
      }
      
      if (clientProfile?.nif) {
        doc.text(`NIF: ${clientProfile.nif}`, rightColumnX, rightY);
        rightY += 6;
      }
      
      if (clientProfile?.email) {
        const emailText = doc.splitTextToSize(`Email: ${clientProfile.email}`, 85);
        emailText.forEach((line: string) => {
          doc.text(line, rightColumnX, rightY);
          rightY += 6;
        });
      }
      
      if (clientProfile?.phone) {
        doc.text(`Telèfon: ${clientProfile.phone}`, rightColumnX, rightY);
        rightY += 6;
      }
      
      if (clientProfile?.street || clientProfile?.street_number) {
        const address = `${clientProfile.street || ''} ${clientProfile.street_number || ''}`.trim();
        const addressLines = doc.splitTextToSize(`Adreça: ${address}`, 85);
        addressLines.forEach((line: string) => {
          doc.text(line, rightColumnX, rightY);
          rightY += 6;
        });
      }
      
      if (clientProfile?.city || clientProfile?.postal_code || clientProfile?.province) {
        const cityInfo = [clientProfile.city, clientProfile.postal_code, clientProfile.province].filter(Boolean).join(', ');
        const cityLines = doc.splitTextToSize(cityInfo, 85);
        cityLines.forEach((line: string) => {
          doc.text(line, rightColumnX, rightY);
          rightY += 6;
        });
      }
      
      rightY += 4;
      
      // Dades del projecte
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DADES DEL PROJECTE", rightColumnX, rightY);
      rightY += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      if (project?.name) {
        const nameLines = doc.splitTextToSize(`Nom: ${project.name}`, 85);
        nameLines.forEach((line: string) => {
          doc.text(line, rightColumnX, rightY);
          rightY += 6;
        });
      }
      
      if (project?.description) {
        const descLines = doc.splitTextToSize(`Descripció: ${project.description}`, 85);
        descLines.forEach((line: string) => {
          doc.text(line, rightColumnX, rightY);
          rightY += 6;
        });
      }
      
      if (project?.address) {
        const addrLines = doc.splitTextToSize(`Adreça: ${project.address}`, 85);
        addrLines.forEach((line: string) => {
          doc.text(line, rightColumnX, rightY);
          rightY += 6;
        });
      }
      
      if (project?.city) {
        doc.text(`Ciutat: ${project.city}`, rightColumnX, rightY);
        rightY += 6;
      }
      
      if (project?.postal_code) {
        doc.text(`Codi Postal: ${project.postal_code}`, rightColumnX, rightY);
        rightY += 6;
      }
      
      if (project?.province) {
        doc.text(`Província: ${project.province}`, rightColumnX, rightY);
        rightY += 6;
      }
      
      if (project?.cadastral_reference) {
        const catLines = doc.splitTextToSize(`Ref. Cadastral: ${project.cadastral_reference}`, 85);
        catLines.forEach((line: string) => {
          doc.text(line, rightColumnX, rightY);
          rightY += 6;
        });
      }
      
      // Calcular la posició Y màxima
      yPosition = Math.max(leftY, rightY) + 8;
      
      // Línia separadora
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 8;
      
      // Informació del pressupost
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("INFORMACIÓ DEL PRESSUPOST", 20, yPosition);
      yPosition += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      const submittedDate = format(new Date(budget.submitted_at), "dd/MM/yyyy");
      doc.text(`Data d'enviament: ${submittedDate}`, 20, yPosition);
      yPosition += 6;
      
      // Calcular data d'expiració
      const expirationDate = format(addDays(new Date(budget.submitted_at), budget.validity_days), "dd/MM/yyyy");
      doc.text(`Data d'expiració: ${expirationDate} (${budget.validity_days} dies)`, 20, yPosition);
      yPosition += 6;
      
      doc.text(`Partides valorades: ${budget.valuations?.length || 0}`, 20, yPosition);
      yPosition += 10;
      
      // Taula de partides
      const tableData = budget.valuations?.map((val: any) => [
        val.full_code || "-",
        val.item_name || "",
        val.description || "-",
        `${formatNumber(val.total)} €`
      ]) || [];
      
      autoTable(doc, {
        startY: yPosition,
        head: [["Codi", "Partida", "Quantitat", "Preu Unit.", "Import"]],
        body: budget.valuations?.map((val: any) => [
          val.full_code || "-",
          `${val.item_name || val.short_description || ""}\n${val.long_description ? val.long_description : ""}`,
          `${val.quantity?.toFixed(2) || ""} ${val.unit || ""}`,
          `${formatNumber(val.unit_price)} €`,
          `${formatNumber(val.total)} €`
        ]) || [],
        theme: "striped",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10,
        },
        bodyStyles: {
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 70 },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 25, halign: "right" },
          4: { cellWidth: 25, halign: "right" },
        },
        foot: [[
          { content: "TOTAL PRESSUPOST:", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
          { content: `${formatNumber(budget.total_amount)} €`, styles: { fontStyle: "bold", fontSize: 11, textColor: primaryColor } }
        ]],
        footStyles: {
          fillColor: [240, 240, 240],
        },
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 10;
      
      // Condicions
      const conditions = [];
      if (budget.condition_scope) conditions.push({ title: "Objecte i abast", texts: ["Aquest pressupost es refereix exclusivament als treballs i subministraments detallats en les partides adjuntes.", "Qualsevol modificació, ampliació o treball addicional no especificat serà objecte de valoració a part.", "Els preus inclouen mà d'obra, materials i mitjans propis necessaris per a l'execució correcta, excepte si s'indica el contrari."] });
      if (budget.condition_economic) conditions.push({ title: "Condicions econòmiques", texts: ["Els preus no inclouen IVA i són vàlids durant 30 dies des de la data del pressupost.", "Les certificacions i pagaments es faran segons l'avanç real dels treballs, amb un termini màxim de pagament de 30 dies des de la seva aprovació.", "L'empresa es reserva el dret d'aplicar interessos per demora segons la Llei 3/2004 de lluita contra la morositat.", "Els preus es consideren tancats excepte per variacions justificades en materials o condicions d'obra alienes a l'industrial.", "Qualsevol aturada, retard o modificació no imputable a l'empresa podrà donar lloc a ajustament de terminis o cost addicional.", "En cas d'augment excepcional de costos de materials o energia, es podrà sol·licitar revisió proporcional de preus."] });
      if (budget.condition_deadlines) conditions.push({ title: "Terminis i planificació", texts: ["Els terminis d'execució s'entenen orientatius i condicionats a la correcta coordinació d'oficis, lliurament de zones d'obra, permisos, subministraments i condicions meteorològiques.", "L'empresa no serà responsable de retards derivats de causes alienes o canvis d'ordre d'execució."] });
      if (budget.condition_execution) conditions.push({ title: "Condicions d'execució", texts: ["Els treballs s'executaran segons el projecte o les instruccions rebudes, sempre que siguin tècnicament viables i segures.", "Si es detecten incoherències, riscos o errades de projecte, l'empresa ho comunicarà a la Direcció Facultativa i suspendrà temporalment l'actuació fins a aclariment.", "Les partides inclouen mitjans auxiliars propis habituals, però no bastides generals, grues torre, o altres mitjans col·lectius si no s'especifica.", "La zona d'obra haurà d'estar lliure, accessible i amb serveis bàsics (llum, aigua, acopi)."] });
      if (budget.condition_materials) conditions.push({ title: "Materials i garanties", texts: ["Els materials utilitzats seran de primera qualitat i amb marcat CE.", "Les garanties dels materials o equips seran les del fabricant, i l'empresa respondrà únicament de la muntatge i posada en obra.", "Les reparacions durant el període de garantia es limitaran a defectes d'execució demostrats.", "No s'admeten reclamacions per mal ús, falta de manteniment o intervencions d'altres oficis."] });
      if (budget.condition_safety) conditions.push({ title: "Seguretat i medi ambient", texts: ["L'empresa compleix amb el Pla de Seguretat i Salut i amb la normativa vigent en matèria laboral i mediambiental.", "Les despeses associades a seguretat, gestió de residus o transport s'inclouen només si es detallen expressament al pressupost."] });
      if (budget.condition_coordination) conditions.push({ title: "Coordinació i responsabilitats", texts: ["L'empresa es compromet a coordinar-se amb la resta d'industrials, però no assumeix responsabilitat per danys o repassos derivats d'altres oficis.", "Els treballs afectats per altres empreses o intervencions posteriors no seran objecte de repàs sense cost addicional."] });
      if (budget.condition_documentation) conditions.push({ title: "Documentació i recepció", texts: ["En finalitzar els treballs, s'emetrà un certificat d'obra executada i es lliuraran les fitxes tècniques i garanties.", "La recepció s'entendrà feta si, en un termini de 7 dies, no es formulen observacions per escrit.", "Els treballs tindran una garantia d'un any per defectes d'execució, excepte per normativa o acord diferent."] });
      if (budget.condition_suspension) conditions.push({ title: "Causes de suspensió o resolució", texts: ["L'empresa podrà suspendre o rescindir el contracte si:", "• No es compleixen els terminis de pagament acordats.", "• S'ordenen modificacions substancials sense autorització escrita.", "• No es garanteixen les condicions mínimes de seguretat o accés.", "En aquests casos, l'empresa tindrà dret a cobrar els treballs executats i a reclamar els perjudicis derivats."] });
      if (budget.condition_jurisdiction) conditions.push({ title: "Jurisdicció", texts: ["Qualsevol discrepància es resoldrà preferentment per via amistosa, i en cas contrari, davant els tribunals del lloc d'execució de l'obra."] });
      
      if (conditions.length > 0) {
        // Nova pàgina per condicions
        doc.addPage();
        yPosition = 20;
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text("CONDICIONS DEL PRESSUPOST", 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        
        conditions.forEach((cond) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFont("helvetica", "bold");
          doc.text(cond.title, 20, yPosition);
          yPosition += 5;
          
          doc.setFont("helvetica", "normal");
          cond.texts.forEach((text) => {
            const lines = doc.splitTextToSize(text, 170);
            lines.forEach((line: string) => {
              if (yPosition > 280) {
                doc.addPage();
                yPosition = 20;
              }
              doc.text(line, 20, yPosition);
              yPosition += 4;
            });
          });
          yPosition += 3;
        });
      }
      
      // Observacions
      if (budget.notes) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        yPosition += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...primaryColor);
        doc.text("OBSERVACIONS", 20, yPosition);
        yPosition += 7;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        const notesLines = doc.splitTextToSize(budget.notes, 170);
        notesLines.forEach((line: string) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += 4;
        });
      }
      
      // Generar nom del fitxer
      const fileName = `Pressupost_${project?.name?.replace(/\s+/g, '_') || 'Projecte'}_${profile?.full_name?.replace(/\s+/g, '_') || 'Industrial'}_${submittedDate.replace(/\//g, '-')}.pdf`;
      
      // Descarregar PDF
      doc.save(fileName);
      
      toast({
        title: "PDF generat",
        description: "El pressupost s'ha descarregat correctament",
      });
    } catch (error) {
      console.error("Error generant PDF:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'ha pogut generar el PDF",
      });
    }
  };

  const handleTutorial = () => {
    setTutorialOpen(true);
  };

  const getElementCode = (element: ElementTypeConfig) => {
    // Generar codi de 4 nivells: Capitol.Subcapitol.Subsubcapitol.Element
    const chapterCode = element.chapter_id || "00";
    const subchapterCode = element.subchapter_id || `${chapterCode}.00`;
    const subsubchapterCode = element.subsubchapter_id || `${subchapterCode}.00`;
    
    // Pad display_order amb zeros (mínim 2 digits), començant per 01
    const elementOrderStr = String(element.display_order || 1).padStart(2, '0');
    
    return `${subsubchapterCode}.${elementOrderStr}`;
  };

  const handleProjectVisibilityToggle = () => {
    // Si ja és visible, no fer res (és irreversible)
    if (isVisibleToSuppliers) {
      return;
    }
    
    // Obrir el modal de confirmació
    setConfirmVisibilityOpen(true);
  };

  const confirmMakeVisible = async () => {
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'ha trobat l'identificador del projecte",
      });
      return;
    }

    try {
      // Comprovar si ja existeix un registre
      const { data: existing } = await supabase
        .from("project_supplier_visibility")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (existing) {
        // Actualitzar l'estat existent
        const { error } = await supabase
          .from("project_supplier_visibility")
          .update({ is_visible: true })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Crear un nou registre
        const { error } = await supabase
          .from("project_supplier_visibility")
          .insert({
            project_id: projectId,
            is_visible: true
          });

        if (error) throw error;
      }

      setIsVisibleToSuppliers(true);
      setConfirmVisibilityOpen(false);
      
      // Mostrar el modal de cobertura d'industrials
      setCoverageModalOpen(true);

      toast({
        title: "Pressupost fixat i visible",
        description: "El pressupost ha estat fixat i els industrials ja poden veure'l. Ja no es poden fer modificacions.",
      });
    } catch (error) {
      console.error("Error making project visible:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'ha pogut fer visible el projecte",
      });
    }
  };

  const handleSendRequest = async (supplierId: string) => {
    if (!centerId) return;

    setSendingRequest(supplierId);
    try {
      // Aquí s'hauria de cridar l'edge function per enviar emails
      toast({
        title: "Sol·licitud enviada",
        description: "S'ha enviat la sol·licitud de pressupost a l'industrial",
      });
    } catch (error) {
      console.error("Error sending request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No s'ha pogut enviar la sol·licitud",
      });
    } finally {
      setSendingRequest(null);
    }
  };

  // Organitzar elements per supplier i capítol (primer nivell)
  const getElementsBySupplier = (supplierId: string) => {
    // Obtenir els chapter_codes assignats a aquest supplier
    const assignedChapterCodes = budgetValuations
      .filter((v) => v.supplier_id === supplierId)
      .map((v) => v.chapter_code);

    const uniqueChapterCodes = Array.from(new Set(assignedChapterCodes));

    // Agrupar elements per capítol
    const organized: {
      chapter: BudgetChapter | null;
      elements: ElementTypeConfig[];
    }[] = [];

    uniqueChapterCodes.forEach((chapterCode) => {
      const chapter = chaptersMap.get(chapterCode);
      const chapterElements = elements.filter((e) => 
        e.chapter_id === chapterCode
      );

      if (chapterElements.length > 0) {
        organized.push({
          chapter: chapter || null,
          elements: chapterElements,
        });
      }
    });

    return organized;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[98vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-gradient-to-b from-background to-muted/20">
          {/* Header amb gradient i estil visual millorat */}
          <div className="p-6 pb-4 flex-shrink-0 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                  <Ruler className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-bold text-foreground">
                    {language === 'ca' ? 'Visor final de medicions' : 'Visor final de mediciones'}
                  </DialogTitle>
                  <DialogDescription className="text-sm mt-1 text-muted-foreground">
                    {language === 'ca' 
                      ? "Resum de totes les medicions organitzades per capítols"
                      : "Resumen de todas las mediciones organizadas por capítulos"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

        {/* Contingut amb scroll */}
        <div className="flex-1 overflow-y-auto px-6">{activeTab === "structure" ? (
          // Pestanya d'estructura del pressupost
          loading ? (
            <div className="mt-6 p-4 border rounded-lg bg-muted/50 flex-shrink-0">
              <p className="text-sm text-muted-foreground text-center">
                {language === 'ca' ? 'Carregant...' : 'Cargando...'}
              </p>
            </div>
          ) : getStructuredElements.size === 0 ? (
            <div className="mt-6 p-8 border-2 border-dashed rounded-xl bg-muted/30 text-center">
              <Hash className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {language === 'ca' ? 'Cap partida editada' : 'Ninguna partida editada'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ca' 
                  ? "Encara no s'han editat i classificat partides al pressupost"
                  : "Todavía no se han editado y clasificado partidas en el presupuesto"}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {isVisibleToSuppliers && (
                <div className="mb-4 p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-green-700 dark:text-green-300">
                        {language === 'ca' ? 'Pressupost fixat' : 'Presupuesto fijado'}
                      </h4>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {language === 'ca' 
                          ? "Aquest pressupost està visible pels industrials i ja no es pot modificar. No es poden afegir, editar ni reordenar partides."
                          : "Este presupuesto está visible para los industriales y ya no se puede modificar. No se pueden añadir, editar ni reordenar partidas."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <Accordion type="multiple" className="w-full space-y-3">
                    {Array.from(getStructuredElements.entries())
                      .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                      .map(([chapterCode, chapterSubchaptersMap]) => {
                        const chapter = chaptersMap.get(chapterCode);
                        
                        return (
                          <AccordionItem
                            key={`ch-${chapterCode}`}
                            value={`ch-${chapterCode}`}
                            className="border border-border/60 rounded-xl bg-card shadow-sm overflow-hidden"
                          >
                             <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-primary/5 transition-colors">
                               <div className="flex items-center gap-4 text-left w-full justify-between pr-4">
                                 <div className="flex items-center gap-4">
                                   <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-md">
                                     <Hash className="h-5 w-5 text-primary-foreground" />
                                   </div>
                                   <div>
                                     <span className="font-mono text-xs text-primary font-semibold">{chapterCode}</span>
                                     <h3 className="font-bold text-foreground text-base">
                                       {chapter ? getTranslatedName(chapterCode, chapter.name) : (language === 'ca' ? "Capítol desconegut" : "Capítulo desconocido")}
                                     </h3>
                                   </div>
                                 </div>
                                  <Badge variant="secondary" className="mr-2 px-3 py-1 text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                    {countPartidesByLevel(chapterCode)} {countPartidesByLevel(chapterCode) === 1 ? (language === 'ca' ? 'partida' : 'partida') : (language === 'ca' ? 'partides' : 'partidas')}
                                  </Badge>
                               </div>
                             </AccordionTrigger>
                            <AccordionContent className="px-5 pb-5 bg-muted/20">
                              <div className="space-y-2 mt-2">
                                {Array.from(chapterSubchaptersMap.entries())
                                  .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                                  .map(([subchapterCode, subchapterSubsubchaptersMap]) => {
                                    const subchapter = subchaptersMap.get(subchapterCode);
                                    
                                    return (
                                      <div key={`sch-${subchapterCode}`} className="border border-border/50 rounded-xl bg-card/50 overflow-hidden">
                                         <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
                                           <div className="flex items-center gap-3 justify-between w-full">
                                             <div className="flex items-center gap-3">
                                               <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/20 border border-primary/30">
                                                 <Layers className="h-3.5 w-3.5 text-primary" />
                                               </div>
                                               <div>
                                                 <span className="font-mono text-[10px] text-primary/70 font-medium">{subchapterCode}</span>
                                                 <h4 className="font-semibold text-sm text-foreground">
                                                   {subchapter ? getTranslatedName(subchapterCode, subchapter.name) : (language === 'ca' ? "Subcapítol desconegut" : "Subcapítulo desconocido")}
                                                 </h4>
                                               </div>
                                             </div>
                                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                                                {countPartidesByLevel(chapterCode, subchapterCode)} {countPartidesByLevel(chapterCode, subchapterCode) === 1 ? (language === 'ca' ? 'partida' : 'partida') : (language === 'ca' ? 'partides' : 'partidas')}
                                              </Badge>
                                           </div>
                                         </div>
                                         
                                         <div className="p-3">
                                           <Accordion 
                                             type="multiple" 
                                             className="w-full space-y-2"
                                             value={openAccordions}
                                             onValueChange={setOpenAccordions}
                                           >
                                            {Array.from(subchapterSubsubchaptersMap.entries())
                                              .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                                              .map(([subsubchapterCode, elementsArray]) => {
                                                const subsubchapter = subsubchaptersMap.get(subsubchapterCode);
                                                
                                                return (
                                                  <AccordionItem
                                                    key={`ssch-${subsubchapterCode}`}
                                                    value={`ssch-${subsubchapterCode}`}
                                                    className="border border-border/40 rounded-lg bg-background shadow-sm"
                                                  >
                                                     <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-primary/5 transition-colors">
                                                       <div className="flex items-center justify-between gap-3 text-left w-full">
                                                         <div className="flex items-center gap-3 flex-1">
                                                           <div className="h-2 w-2 rounded-full bg-primary/60" />
                                                           <div>
                                                             <span className="font-mono text-[10px] text-muted-foreground">{subsubchapterCode}</span>
                                                             <span className="font-medium text-sm block text-foreground">
                                                               {subsubchapter ? getTranslatedName(subsubchapterCode, subsubchapter.name) : (language === 'ca' ? "Subsubcapítol desconegut" : "Subsubcapítulo desconocido")}
                                                             </span>
                                                           </div>
                                                            <Badge variant="outline" className="bg-muted/50 text-xs ml-2 font-medium">
                                                              {countPartidesByLevel(chapterCode, subchapterCode, subsubchapterCode)} {countPartidesByLevel(chapterCode, subchapterCode, subsubchapterCode) === 1 ? (language === 'ca' ? 'partida' : 'partida') : (language === 'ca' ? 'partides' : 'partidas')}
                                                            </Badge>
                                                         </div>
                                                          {/* Botó per afegir partides manuals - ocult en mode visor final
                                                             Es rescatarà pel mòdul d'industrials
                                                          {!isVisibleToSuppliers && (
                                                             <Button
                                                               variant="ghost"
                                                               size="sm"
                                                               className="h-6 w-6 p-0 hover:bg-primary/20 flex-shrink-0"
                                                               onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 handleCreatePartida(chapterCode, subchapterCode, subsubchapterCode);
                                                               }}
                                                             >
                                                               <Plus className="h-3 w-3" />
                                                             </Button>
                                                           )}
                                                          */}
                                                       </div>
                                                     </AccordionTrigger>
                                                     <AccordionContent className="px-4 pb-4 pt-2">
                                                      {/* Component per generació conjunta IA - desactivat en BudgetConfigModal */}
                                                      <DndContext
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={(event) => handleDragEnd(event, subsubchapterCode)}
                                                      >
                                                        <SortableContext
                                                          items={elementsArray.map((el) => el.id)}
                                                          strategy={verticalListSortingStrategy}
                                                        >
                                                          <div className="space-y-3">
                                                             {elementsArray
                                                               .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                                                               .map((element) => {
                                                                 const elementMeasurements = getMeasurementsForElement(element);
                                                                 return (
                                                                    <SortableItem
                                                                       key={element.id}
                                                                       element={element}
                                                                       getElementFullCode={getElementFullCode}
                                                                       isLocked={true}
                                                                       elementMeasurements={elementMeasurements}
                                                                       language={language}
                                                                     />
                                                                 );
                                                               })}
                                                          </div>
                                                        </SortableContext>
                                                      </DndContext>
                                                    </AccordionContent>
                                                  </AccordionItem>
                                                );
                                              })}
                                          </Accordion>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
              </Accordion>
            </div>
          )) : activeTab === "coverage" ? (
            // Pestanya d'abast d'industrials
            projectId ? (
              <SupplierCoverageTab
                projectId={projectId}
                categoriesWithItems={categoriesWithItems}
                isVisible={isVisibleToSuppliers}
              />
            ) : (
              <div className="py-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Funcionalitat només per projectes</h3>
                <p className="text-muted-foreground">
                  L'abast d'industrials només està disponible quan treballes amb un projecte.
                </p>
              </div>
            )
          ) : (activeTab === "budgets" || activeTab === "accepted" || activeTab === "rejected") ? (budgetsLoading ? (
            <div className="mt-6 p-4 border rounded-lg bg-muted/50 flex-shrink-0">
              <p className="text-sm text-muted-foreground text-center">
                Carregant pressupostos...
              </p>
            </div>
          ) : filteredAndSortedBudgets.length === 0 ? (
            <div className="mt-6 p-8 border-2 border-dashed rounded-xl bg-muted/30 text-center">
              {activeTab === "accepted" ? (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <h3 className="text-lg font-semibold mb-2">Cap pressupost acceptat</h3>
                  <p className="text-sm text-muted-foreground">
                    Encara no s'ha acceptat cap pressupost per aquest projecte
                  </p>
                </>
              ) : activeTab === "rejected" ? (
                <>
                  <XCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
                  <h3 className="text-lg font-semibold mb-2">Cap pressupost rebutjat</h3>
                  <p className="text-sm text-muted-foreground">
                    No s'ha rebutjat cap pressupost per aquest projecte
                  </p>
                </>
              ) : (
                <>
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Cap pressupost pendent</h3>
                  <p className="text-sm text-muted-foreground">
                    No hi ha pressupostos pendents de revisió per aquest projecte
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="py-4">
              <div className="mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {activeTab === "accepted" ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Pressupostos acceptats
                    </>
                  ) : activeTab === "rejected" ? (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      Pressupostos rebutjats
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 text-primary" />
                      Bustia d'entrada de pressupostos
                    </>
                  )}
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "accepted" ? (
                      <>S'han acceptat <strong className="font-semibold text-green-600">{filteredAndSortedBudgets.length}</strong> {filteredAndSortedBudgets.length === 1 ? 'pressupost' : 'pressupostos'}</>
                    ) : activeTab === "rejected" ? (
                      <>S'han rebutjat <strong className="font-semibold text-red-600">{filteredAndSortedBudgets.length}</strong> {filteredAndSortedBudgets.length === 1 ? 'pressupost' : 'pressupostos'}</>
                    ) : (
                      <>S'han rebut <strong className="font-semibold text-foreground">{filteredAndSortedBudgets.length}</strong> {filteredAndSortedBudgets.length === 1 ? 'pressupost pendent' : 'pressupostos pendents'}</>
                    )}
                  </p>
                  {activeTab === "budgets" && newBudgetsCount > 0 && (
                    <Badge variant="default" className="bg-primary">
                      {newBudgetsCount} {newBudgetsCount === 1 ? 'nou' : 'nous'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Filtres i controls */}
              <Card className="mb-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Filtres i visualització</CardTitle>
                    </div>
                    <Badge variant="secondary">
                      {filteredAndSortedBudgets.length} de {receivedBudgets.length} pressupost{receivedBudgets.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Primera fila: Filtres de cerca */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Nom del projecte</Label>
                      <Select value={filterProjectName} onValueChange={setFilterProjectName}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tots els projectes" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-popover">
                          <SelectItem value="all">Tots els projectes</SelectItem>
                          {uniqueProjectNames.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Categoria industrial</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Totes les categories" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-popover">
                          <SelectItem value="all">Totes les categories</SelectItem>
                          {uniqueCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Estat</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tots els estats" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-popover">
                          <SelectItem value="all">Tots els estats</SelectItem>
                          <SelectItem value="valid">Vàlids</SelectItem>
                          <SelectItem value="expiring-soon">A punt de caducar</SelectItem>
                          <SelectItem value="expired">Caducats</SelectItem>
                          <SelectItem value="accepted">Acceptats</SelectItem>
                          <SelectItem value="rejected">Rebutjats</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Segona fila: Ordenació i mode de visualització */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4">
                      <Label className="text-xs font-medium">Ordenar per:</Label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-popover">
                          <SelectItem value="date-desc">Data (més recent)</SelectItem>
                          <SelectItem value="date-asc">Data (més antic)</SelectItem>
                          <SelectItem value="price-asc">Preu (menor a major)</SelectItem>
                          <SelectItem value="price-desc">Preu (major a menor)</SelectItem>
                          <SelectItem value="company-asc">Empresa (A-Z)</SelectItem>
                          <SelectItem value="company-desc">Empresa (Z-A)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium">Vista:</Label>
                      <div className="flex gap-1 p-1 bg-muted rounded-lg">
                        <Button
                          variant={viewMode === "accordion" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("accordion")}
                          className="h-8 px-3"
                        >
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Acordion
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="h-8 px-3"
                        >
                          <List className="h-4 w-4 mr-1" />
                          Llista
                        </Button>
                        <Button
                          variant={viewMode === "cards" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("cards")}
                          className="h-8 px-3"
                        >
                          <Grid3x3 className="h-4 w-4 mr-1" />
                          Targetes
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Renderitzar pressupostos segons el mode seleccionat */}
              {filteredAndSortedBudgets.length === 0 ? (
                <Card className="p-8">
                  <div className="text-center">
                    <Filter className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Cap pressupost coincideix amb els filtres</h3>
                    <p className="text-sm text-muted-foreground">
                      Prova d'ajustar els criteris de cerca
                    </p>
                  </div>
                </Card>
              ) : viewMode === "accordion" ? (
                /* MODE ACORDION - Similar a l'actual */
              
              <div className="space-y-4 pr-4 pb-6">
                      {(() => {
                        // Agrupar per la categoria del pressupost (budget.category)
                        const budgetsByCategory = new Map<string, any[]>();
                        filteredAndSortedBudgets.forEach((budget: any) => {
                          // Usar la categoria del pressupost en lloc de les categories del supplier
                          const cat = budget.category || "Sense categoria";
                          const existing = budgetsByCategory.get(cat) || [];
                          if (!existing.find((b: any) => b.id === budget.id)) {
                            existing.push(budget);
                          }
                          budgetsByCategory.set(cat, existing);
                        });

                        return Array.from(budgetsByCategory.entries())
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .map(([category, categoryBudgets]) => {
                            // Calcular millor i pitjor oferta d'aquesta categoria
                            const amounts = categoryBudgets.map(b => b.total_amount);
                            const minAmount = Math.min(...amounts);
                            const maxAmount = Math.max(...amounts);

                            return (
                              <Card key={category}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-5 w-5 text-primary" />
                                      <CardTitle className="text-lg">{category}</CardTitle>
                                    </div>
                                    <Badge variant="secondary">
                                      {categoryBudgets.length} ofert{categoryBudgets.length !== 1 ? 'es' : 'a'}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  {categoryBudgets.map((budget: any) => {
                                    const profile = budget.profiles;
                                    const isExpired = budget.expires_at && new Date(budget.expires_at) < new Date();
                                    const daysRemaining = budget.expires_at 
                                      ? Math.ceil((new Date(budget.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                      : 0;
                                    const isBestOffer = budget.total_amount === minAmount && categoryBudgets.length > 1;
                                    const isWorstOffer = budget.total_amount === maxAmount && categoryBudgets.length > 1;

                                    return (
                                      <details key={budget.id} className="group mb-3 last:mb-0">
                                        <summary className="cursor-pointer list-none">
                                          <div className={`flex items-start justify-between w-full p-5 rounded-lg border-2 hover:border-primary/50 transition-colors group-open:border-primary ${
                                            budget.status === "accepted" ? 'bg-green-50 dark:bg-green-950/20 border-green-500 shadow-lg' :
                                            isBestOffer ? 'bg-green-50 dark:bg-green-950/20 border-green-500' : 
                                            isWorstOffer ? 'bg-red-50 dark:bg-red-950/20 border-red-500' : ''
                                          }`}>
                                            <div className="flex flex-col items-start gap-3 flex-1">
                                              {/* Header amb nom i estat */}
                                              <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-lg">
                                                    {profile?.full_name || "Industrial"}
                                                  </span>
                                                  {isBestOffer && (
                                                    <Badge className="bg-green-500 text-white">Millor oferta</Badge>
                                                  )}
                                                  {isWorstOffer && (
                                                    <Badge variant="destructive">Pitjor oferta</Badge>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                  {(budget.status === "submitted" || budget.status === "draft") ? (
                                                    <Badge variant="secondary" className="gap-1">
                                                      <Info className="h-3 w-3" />
                                                      Pendent
                                                    </Badge>
                                                  ) : budget.status === "accepted" ? (
                                                    <Badge className="bg-green-500 gap-1">
                                                      <CheckCircle className="h-3 w-3" />
                                                      Acceptat
                                                    </Badge>
                                                  ) : (
                                                    <Badge variant="destructive" className="gap-1">
                                                      <XCircle className="h-3 w-3" />
                                                      Rebutjat
                                                    </Badge>
                                                  )}
                                                  <span className="text-2xl font-bold text-primary">
                                                    {formatNumber(budget.total_amount)}&nbsp;€
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Grid amb informació de l'empresa */}
                                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-full text-sm">
                                                <div className="flex items-center gap-2">
                                                  <Hash className="h-4 w-4 text-muted-foreground" />
                                                  <span className="text-muted-foreground">NIF:</span>
                                                  <span className="font-medium">{profile?.nif || "N/D"}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                                                  <span className="text-muted-foreground">Email:</span>
                                                  <span className="font-medium">{profile?.email || "N/D"}</span>
                                                </div>
                                                {profile?.phone && (
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Telèfon:</span>
                                                    <span className="font-medium">{profile.phone}</span>
                                                  </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                                  <span className="text-muted-foreground">Adreça:</span>
                                                  <span className="font-medium">
                                                    {profile?.street ? `${profile.street} ${profile.street_number || 's/n'}` : "N/D"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-2 col-span-2">
                                                  <span className="text-muted-foreground ml-6">Població:</span>
                                                  <span className="font-medium">
                                                    {profile?.postal_code && profile?.city 
                                                      ? `${profile.postal_code} ${profile.city}${profile.province ? `, ${profile.province}` : ''}`
                                                      : "N/D"}
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Informació del pressupost */}
                                              <div className="flex items-center gap-6 w-full text-sm pt-2 border-t">
                                                {budget.offer_code && (
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Codi referència:</span>
                                                    <span className="font-mono font-bold text-primary">{budget.offer_code}</span>
                                                  </div>
                                                )}
                                                {/* Per pressupostos acceptats/rebutjats mostrar data d'acceptació/rebuig */}
                                                {(activeTab === "accepted" || activeTab === "rejected") ? (
                                                  <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-muted-foreground">
                                                      {activeTab === "accepted" ? "Data d'acceptació:" : "Data de rebuig:"}
                                                    </span>
                                                    <span className={`font-medium ${activeTab === "accepted" ? 'text-green-600' : 'text-destructive'}`}>
                                                      {new Date(budget.updated_at).toLocaleDateString("ca-ES", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                      })}
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <div className="flex items-center gap-2">
                                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                                      <span className="text-muted-foreground">Data enviament:</span>
                                                      <span className="font-medium">
                                                        {new Date(budget.submitted_at).toLocaleDateString("ca-ES", {
                                                          day: "numeric",
                                                          month: "short",
                                                          year: "numeric",
                                                        })}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-muted-foreground">Validesa:</span>
                                                      <div className="flex items-center gap-2">
                                                        {/* Visualització de bateria */}
                                                        <div className="flex items-center gap-1.5">
                                                          <div className="w-16 h-4 border-2 border-current rounded-sm relative overflow-hidden">
                                                            <div 
                                                              className={`h-full transition-all ${
                                                                isExpired 
                                                                  ? 'bg-destructive' 
                                                                  : daysRemaining <= 5 
                                                                    ? 'bg-destructive' 
                                                                    : 'bg-primary'
                                                              }`}
                                                              style={{ 
                                                                width: `${Math.min(100, Math.max(0, (daysRemaining / budget.validity_days) * 100))}%` 
                                                              }}
                                                            />
                                                          </div>
                                                          <span className={`text-xs font-medium ${
                                                            isExpired 
                                                              ? 'text-destructive' 
                                                              : daysRemaining <= 5 
                                                                ? 'text-destructive' 
                                                                : 'text-primary'
                                                          }`}>
                                                            {isExpired ? '0' : daysRemaining} {daysRemaining === 1 ? "dia" : "dies"}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </>
                                                )}
                                              </div>

                                              {/* Informació de partides i projecte */}
                                              <div className="flex items-center gap-6 w-full text-sm">
                                                <div className="flex items-center gap-2">
                                                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                                  <span className="text-muted-foreground">Partides pressupostades:</span>
                                                  <TooltipProvider>
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <span className="font-bold text-primary cursor-help">
                                                          ({budget.valuations?.length || 0}/{budget.total_partides || 0}) {budget.total_partides > 0 ? Math.round(((budget.valuations?.length || 0) / budget.total_partides) * 100) : 0}%
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p>Partides del pressupost respecte el total del projecte</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Layers className="h-4 w-4 text-muted-foreground" />
                                                  <span className="text-muted-foreground">Projecte:</span>
                                                  <span className="font-semibold">{budget.project_name}</span>
                                                </div>
                                              </div>

                                            </div>
                                          </div>
                                        </summary>
                                      
                                      <div className="mt-3 pl-4 space-y-4">
                                        {/* Per pressupostos acceptats/rebutjats: primer detall de partides */}
                                        {(activeTab === "accepted" || activeTab === "rejected") && budget.valuations && budget.valuations.length > 0 && (
                                          <Card>
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-sm flex items-center gap-2">
                                                <Layers className="h-4 w-4" />
                                                Detall de partides valorades
                                              </CardTitle>
                                            </CardHeader>
                                             <CardContent>
                                               <div className="border rounded-lg overflow-hidden">
                                                 <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead className="w-[120px]">Codi</TableHead>
                                                        <TableHead className="text-center w-[100px]">Quantitat</TableHead>
                                                        <TableHead className="text-center w-[80px]">Unitat</TableHead>
                                                        <TableHead>Partida</TableHead>
                                                        <TableHead className="text-right w-[100px]">Preu Unit.</TableHead>
                                                        <TableHead className="text-right w-[120px]">Import</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                   <TableBody>
                                                     {budget.valuations.map((val: any, idx: number) => {
                                                       const unitPrice = val.unit_price || 0;
                                                       const quantity = val.quantity || 0;
                                                       const importTotal = unitPrice * quantity;
                                                       
                                                       return (
                                                         <TableRow key={idx}>
                                                           <TableCell className="font-mono text-xs font-medium">
                                                             {val.full_code || "-"}
                                                           </TableCell>
                                                           <TableCell className="text-center font-medium">
                                                             {quantity.toFixed(2)}
                                                           </TableCell>
                                                           <TableCell className="text-center text-sm">
                                                             {val.unit}
                                                           </TableCell>
                                                           <TableCell>
                                                             <div className="font-medium">{val.item_name || val.short_description}</div>
                                                             {val.long_description && (
                                                               <div className="text-xs text-muted-foreground mt-1">{val.long_description}</div>
                                                             )}
                                                           </TableCell>
                                                           <TableCell className="text-right">
                                                             <div className="font-medium">{formatNumber(unitPrice)}&nbsp;€</div>
                                                           </TableCell>
                                                           <TableCell className="text-right font-semibold text-primary whitespace-nowrap">
                                                             {formatNumber(importTotal)}&nbsp;€
                                                           </TableCell>
                                                         </TableRow>
                                                       );
                                                     })}
                                                      <TableRow className="bg-muted/50 font-bold">
                                                        <TableCell colSpan={5} className="text-right">
                                                          TOTAL PRESSUPOST:
                                                        </TableCell>
                                                        <TableCell className="text-right text-primary text-xl font-bold whitespace-nowrap">
                                                          {formatNumber(budget.total_amount)}&nbsp;€
                                                        </TableCell>
                                                      </TableRow>
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        )}

                                        {/* Informació del pressupost */}
                                        <div className="grid md:grid-cols-2 gap-4">
                                          <Card>
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-sm">Informació de l'oferta</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Data de presentació:</span>
                                                <span className="font-medium">
                                                  {new Date(budget.submitted_at).toLocaleDateString("ca-ES", {
                                                    day: "numeric",
                                                    month: "long",
                                                    year: "numeric",
                                                  })}
                                                </span>
                                              </div>
                                              {(activeTab === "accepted" || activeTab === "rejected") ? (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-muted-foreground">
                                                    {activeTab === "accepted" ? "Data d'acceptació:" : "Data de rebuig:"}
                                                  </span>
                                                  <span className={`font-medium ${activeTab === "accepted" ? 'text-green-600' : 'text-destructive'}`}>
                                                    {new Date(budget.updated_at).toLocaleDateString("ca-ES", {
                                                      day: "numeric",
                                                      month: "long",
                                                      year: "numeric",
                                                    })}
                                                  </span>
                                                </div>
                                              ) : (
                                                <>
                                                  <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Dies de validesa:</span>
                                                    <span className="font-medium">{budget.validity_days} dies</span>
                                                  </div>
                                                  <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground">Data d'expiració:</span>
                                                    <div className="flex items-center gap-2">
                                                      {isExpired ? (
                                                        <>
                                                          <AlertCircle className="h-4 w-4 text-destructive" />
                                                          <Badge variant="destructive">Caducada</Badge>
                                                        </>
                                                      ) : daysRemaining <= 7 ? (
                                                        <>
                                                          <AlertCircle className="h-4 w-4 text-orange-500" />
                                                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                                                            {daysRemaining} {daysRemaining === 1 ? "dia" : "dies"}
                                                          </Badge>
                                                        </>
                                                      ) : (
                                                        <>
                                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                                          <span className="font-medium text-green-600">
                                                            {new Date(budget.expires_at).toLocaleDateString("ca-ES")}
                                                          </span>
                                                        </>
                                                      )}
                                                    </div>
                                                  </div>
                                                </>
                                              )}
                                            </CardContent>
                                          </Card>

                                           <Card>
                                             <CardHeader className="pb-3">
                                               <CardTitle className="text-sm">Total pressupost</CardTitle>
                                             </CardHeader>
                                             <CardContent>
                                               <div className="text-3xl font-bold text-primary">
                                                 {formatNumber(budget.total_amount)}&nbsp;€
                                               </div>
                                             </CardContent>
                                           </Card>
                                         </div>
                                         
                                         {/* Observacions */}
                                         {budget.notes && (
                                           <Card>
                                             <CardHeader className="pb-3">
                                               <CardTitle className="text-sm flex items-center gap-2">
                                                 <Lightbulb className="h-4 w-4" />
                                                 Observacions
                                               </CardTitle>
                                             </CardHeader>
                                             <CardContent>
                                               <p className="text-sm text-muted-foreground whitespace-pre-wrap">{budget.notes}</p>
                                             </CardContent>
                                           </Card>
                                         )}
                                         
                                         {/* Condicions - Per acceptats/rebutjats va després de les partides */}
                                         <Card>
                                           <CardHeader className="pb-3">
                                             <CardTitle className="text-sm flex items-center gap-2">
                                               <FileText className="h-4 w-4" />
                                               Condicions del Pressupost
                                             </CardTitle>
                                           </CardHeader>
                                           <CardContent className="space-y-3">
                                              {budget.condition_scope && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">1️⃣ Objecte i abast</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>Aquest pressupost es refereix exclusivament als treballs i subministraments detallats en les partides adjuntes.</p>
                                                      <p>Qualsevol treball, material o actuació no expressament descrita queda fora d&apos;abast, i haurà de pressupostar-se de manera addicional.</p>
                                                      <p>Les medicions s&apos;entenen aproximades i seran objecte de comprovació en l&apos;execució real.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_economic && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">2️⃣ Condicions econòmiques</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>Els preus no inclouen IVA i són vàlids durant 30 dies des de la data del pressupost.</p>
                                                      <p>Les certificacions i pagaments es faran segons l&apos;avanç real dels treballs, amb un termini màxim de pagament de 30 dies des de la seva aprovació.</p>
                                                      <p>L&apos;empresa es reserva el dret d&apos;aplicar interessos per demora segons la Llei 3/2004 de lluita contra la morositat.</p>
                                                      <p>Els preus es consideren tancats excepte per variacions justificades en materials o condicions d&apos;obra alienes a l&apos;industrial.</p>
                                                      <p>Qualsevol aturada, retard o modificació no imputable a l&apos;empresa podrà donar lloc a ajustament de terminis o cost addicional.</p>
                                                      <p>En cas d&apos;augment excepcional de costos de materials o energia, es podrà sol·licitar revisió proporcional de preus.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_deadlines && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">3️⃣ Terminis i planificació</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>Els terminis d&apos;execució s&apos;entenen orientatius i condicionats a la correcta coordinació d&apos;oficis, lliurament de zones d&apos;obra, permisos, subministraments i condicions meteorològiques.</p>
                                                      <p>L&apos;empresa no serà responsable de retards derivats de causes alienes o canvis d&apos;ordre d&apos;execució.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_execution && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">4️⃣ Condicions d&apos;execució</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>Els treballs s&apos;executaran segons el projecte o les instruccions rebudes, sempre que siguin tècnicament viables i segures.</p>
                                                      <p>Si es detecten incoherències, riscos o errades de projecte, l&apos;empresa ho comunicarà a la Direcció Facultativa i suspendrà temporalment l&apos;actuació fins a aclariment.</p>
                                                      <p>Les partides inclouen mitjans auxiliars propis habituals, però no bastides generals, grues torre, o altres mitjans col·lectius si no s&apos;especifica.</p>
                                                      <p>La zona d&apos;obra haurà d&apos;estar lliure, accessible i amb serveis bàsics (llum, aigua, acopi).</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_materials && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">5️⃣ Materials i garanties</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>Els materials seran de primera qualitat i amb marcat CE segons normativa.</p>
                                                      <p>Les garanties aplicables seran les establertes pel fabricant i la legislació vigent.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_safety && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">6️⃣ Seguretat i salut</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>L&apos;empresa compleix amb la normativa de seguretat i salut laboral vigent.</p>
                                                      <p>S&apos;adhereix al Pla de Seguretat i Salut de l&apos;obra i aporta la documentació requerida per la coordinació d&apos;activitats empresarials.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_coordination && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">7️⃣ Coordinació</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>L&apos;empresa es compromet a coordinar-se amb la resta d&apos;industrials i amb la Direcció d&apos;Obra.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_documentation && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">8️⃣ Documentació</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>L&apos;empresa facilitarà tota la documentació tècnica i administrativa requerida per a la correcta execució i recepció dels treballs.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_suspension && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">9️⃣ Suspensió</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>En cas de suspensió dels treballs per causes no imputables a l&apos;empresa, aquesta tindrà dret a la revisió de preus i terminis.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {budget.condition_jurisdiction && (
                                                <div className="flex items-start gap-2">
                                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                  <div className="text-sm">
                                                    <div className="font-medium">🔟 Jurisdicció</div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                      <p>Per a qualsevol controvèrsia derivada d&apos;aquest pressupost, les parts se sotmeten als jutjats i tribunals de la localitat de l&apos;obra.</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                          </CardContent>
                                        </Card>

                                        {/* Detall partides - Per pressupostos pendents */}
                                        {activeTab === "budgets" && budget.valuations && budget.valuations.length > 0 && (
                                          <Card>
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-sm flex items-center gap-2">
                                                <Layers className="h-4 w-4" />
                                                Detall de partides valorades
                                              </CardTitle>
                                            </CardHeader>
                                             <CardContent>
                                               <div className="border rounded-lg overflow-hidden">
                                                 <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead className="w-[120px]">Codi</TableHead>
                                                        <TableHead className="text-center w-[100px]">Quantitat</TableHead>
                                                        <TableHead className="text-center w-[80px]">Unitat</TableHead>
                                                        <TableHead>Partida</TableHead>
                                                        <TableHead className="text-right w-[100px]">Preu Unit.</TableHead>
                                                        <TableHead className="text-right w-[120px]">Import</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                   <TableBody>
                                                     {budget.valuations.map((val: any, idx: number) => {
                                                       const unitPrice = val.unit_price || 0;
                                                       const quantity = val.quantity || 0;
                                                       const importTotal = unitPrice * quantity;
                                                       
                                                       return (
                                                         <TableRow key={idx}>
                                                           <TableCell className="font-mono text-xs font-medium">
                                                             {val.full_code || "-"}
                                                           </TableCell>
                                                           <TableCell className="text-center font-medium">
                                                             {quantity.toFixed(2)}
                                                           </TableCell>
                                                           <TableCell className="text-center text-sm">
                                                             {val.unit}
                                                           </TableCell>
                                                           <TableCell>
                                                             <div className="font-medium">{val.item_name || val.short_description}</div>
                                                             {val.long_description && (
                                                               <div className="text-xs text-muted-foreground mt-1">{val.long_description}</div>
                                                             )}
                                                           </TableCell>
                                                           <TableCell className="text-right">
                                                             <div className="font-medium">{formatNumber(unitPrice)}&nbsp;€</div>
                                                           </TableCell>
                                                           <TableCell className="text-right font-semibold text-primary whitespace-nowrap">
                                                             {formatNumber(importTotal)}&nbsp;€
                                                           </TableCell>
                                                         </TableRow>
                                                       );
                                                     })}
                                                      <TableRow className="bg-muted/50 font-bold">
                                                        <TableCell colSpan={5} className="text-right">
                                                          TOTAL PRESSUPOST:
                                                        </TableCell>
                                                        <TableCell className="text-right text-primary text-xl font-bold whitespace-nowrap">
                                                          {formatNumber(budget.total_amount)}&nbsp;€
                                                        </TableCell>
                                                      </TableRow>
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        )}

                                        {/* Botons d'acció */}
                                        {(budget.status === "submitted" || budget.status === "draft") && (
                                          <div className="flex gap-2">
                                            <Button
                                              onClick={() => handleAcceptBudget(budget)}
                                              className="gap-2"
                                            >
                                              <CheckCircle className="h-4 w-4" />
                                              Acceptar pressupost
                                            </Button>
                                            <Button
                                              onClick={() => handleRejectBudget(budget)}
                                              variant="destructive"
                                              className="gap-2"
                                            >
                                              <XCircle className="h-4 w-4" />
                                              Rebutjar pressupost
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </details>
                                    );
                                  })}
                                </CardContent>
                              </Card>
                            );
                          });
                       })()}
                  </div>
              ) : viewMode === "list" ? (
                /* MODE LLISTA - Compacte en taula */
                <div className="space-y-2">
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa / Projecte</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-center">Partides</TableHead>
                          <TableHead className="text-right">Import</TableHead>
                          {activeTab !== "accepted" && activeTab !== "rejected" && (
                            <TableHead className="text-center">Validesa</TableHead>
                          )}
                          <TableHead className="text-center">Estat</TableHead>
                          <TableHead className="text-center">Accions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedBudgets.map((budget: any) => {
                          const profile = budget.profiles;
                          const status = getBudgetStatus(budget);
                          const isExpanded = expandedBudgets.has(budget.id);
                          const isExpired = budget.expires_at && new Date(budget.expires_at) < new Date();
                          const daysRemaining = budget.expires_at 
                            ? Math.ceil((new Date(budget.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                          
                          return (
                            <>
                              <TableRow key={budget.id} className={`cursor-pointer hover:bg-muted/50 ${budget.status === "accepted" ? 'bg-green-50 dark:bg-green-950/20' : ''}`} onClick={() => toggleBudgetExpanded(budget.id)}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <div>
                                      <div className="font-medium">{profile?.full_name || "Industrial"}</div>
                                      <div className="text-xs text-muted-foreground">{budget.project_name}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{budget.category || "Sense categoria"}</TableCell>
                                <TableCell className="text-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="cursor-help">
                                          ({budget.valuations?.length || 0}/{partidesStats.totalPartides || budget.total_partides || 0}) {(partidesStats.totalPartides || budget.total_partides) > 0 ? Math.round(((budget.valuations?.length || 0) / (partidesStats.totalPartides || budget.total_partides || 1)) * 100) : 0}%
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Partides del pressupost respecte el total del projecte</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="text-right font-bold text-primary">{formatNumber(budget.total_amount)}&nbsp;€</TableCell>
                                {activeTab !== "accepted" && activeTab !== "rejected" && (
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <div className="w-12 h-3 border border-current rounded-sm relative overflow-hidden">
                                        <div 
                                          className={`h-full transition-all ${
                                            isExpired 
                                              ? 'bg-destructive' 
                                              : daysRemaining <= 5 
                                                ? 'bg-destructive' 
                                                : 'bg-primary'
                                          }`}
                                          style={{ 
                                            width: `${Math.min(100, Math.max(0, (daysRemaining / budget.validity_days) * 100))}%` 
                                          }}
                                        />
                                      </div>
                                      <span className={`text-xs font-medium ${
                                        isExpired 
                                          ? 'text-destructive' 
                                          : daysRemaining <= 5 
                                            ? 'text-destructive' 
                                            : 'text-primary'
                                      }`}>
                                        {isExpired ? '0' : daysRemaining}d
                                      </span>
                                    </div>
                                  </TableCell>
                                )}
                                <TableCell className="text-center">
                                  {budget.status === "accepted" ? (
                                    <Badge className="bg-green-500">Acceptat</Badge>
                                  ) : budget.status === "rejected" ? (
                                    <Badge variant="destructive">Rebutjat</Badge>
                                  ) : (
                                    <Badge variant="secondary">Pendent</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex gap-1 justify-center">
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); generatePDF(budget); }} title="Descarregar PDF">
                                      <FileDown className="h-4 w-4" />
                                    </Button>
                                    {(budget.status === "submitted" || budget.status === "draft") && (
                                      <>
                                        <Button variant="ghost" size="sm" className="text-green-600" onClick={(e) => { e.stopPropagation(); handleAcceptBudget(budget); }}>
                                          <CheckCircle className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleRejectBudget(budget); }}>
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow>
                                  <TableCell colSpan={activeTab === "accepted" || activeTab === "rejected" ? 6 : 7} className="bg-muted/30">
                                    <div className="p-4 space-y-4">
                                      {/* Informació detallada de l'empresa */}
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-2">
                                          <h4 className="font-semibold">Dades de l'empresa</h4>
                                          <div className="space-y-1 text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                              <Hash className="h-3 w-3" />
                                              <span>NIF: {profile?.nif || "N/D"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Mail className="h-3 w-3" />
                                              <span>{profile?.email || "N/D"}</span>
                                            </div>
                                            {profile?.phone && (
                                              <div className="flex items-center gap-2">
                                                <Phone className="h-3 w-3" />
                                                <span>{profile.phone}</span>
                                              </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                              <MapPin className="h-3 w-3" />
                                              <span>
                                                {profile?.street ? `${profile.street} ${profile.street_number || 's/n'}` : "N/D"}
                                                {profile?.city && `, ${profile.postal_code} ${profile.city}`}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <h4 className="font-semibold">Detalls del pressupost</h4>
                                          <div className="space-y-1 text-muted-foreground">
                                            <div>Codi: <span className="font-mono font-medium text-primary">{budget.offer_code}</span></div>
                                            <div>Data enviament: {new Date(budget.submitted_at).toLocaleDateString("ca-ES")}</div>
                                            {(activeTab === "accepted" || activeTab === "rejected") ? (
                                              <div>
                                                {activeTab === "accepted" ? "Data d'acceptació: " : "Data de rebuig: "}
                                                <span className={activeTab === "accepted" ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                                                  {new Date(budget.updated_at).toLocaleDateString("ca-ES")}
                                                </span>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              ) : (
                /* MODE TARGETES - Grid de targetes */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSortedBudgets.map((budget: any) => {
                    const profile = budget.profiles;
                    const status = getBudgetStatus(budget);
                    const isExpanded = expandedBudgets.has(budget.id);
                    const amounts = filteredAndSortedBudgets.map(b => b.total_amount);
                    const isBestOffer = budget.total_amount === Math.min(...amounts) && amounts.length > 1;
                    const isExpired = budget.expires_at && new Date(budget.expires_at) < new Date();
                    const daysRemaining = budget.expires_at 
                      ? Math.ceil((new Date(budget.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      : 0;

                    return (
                      <Card key={budget.id} className={`overflow-hidden transition-all ${budget.status === "accepted" ? 'border-green-500 border-2 bg-green-50 dark:bg-green-950/20 shadow-lg' : isBestOffer ? 'border-green-500 border-2' : ''} ${isExpanded ? 'col-span-full' : ''}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {profile?.full_name || "Industrial"}
                              </CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {budget.category || "Sense categoria"}
                              </CardDescription>
                            </div>
                            {isBestOffer && (
                              <Badge className="bg-green-500 text-white text-xs">Millor</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Preu i estat */}
                          <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold text-primary">
                              {formatNumber(budget.total_amount)}&nbsp;€
                            </div>
                            <div>
                              {budget.status === "accepted" ? (
                                <Badge className="bg-green-500">Acceptat</Badge>
                              ) : budget.status === "rejected" ? (
                                <Badge variant="destructive">Rebutjat</Badge>
                              ) : (
                                <Badge variant="secondary">Pendent</Badge>
                              )}
                            </div>
                          </div>

                          {/* Informació del projecte i partides */}
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Projecte:</span>
                              <span className="font-medium truncate">{budget.project_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Layers className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Partides:</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs cursor-help">
                                      ({budget.valuations?.length || 0}/{partidesStats.totalPartides || budget.total_partides || 0}) {(partidesStats.totalPartides || budget.total_partides) > 0 ? Math.round(((budget.valuations?.length || 0) / (partidesStats.totalPartides || budget.total_partides || 1)) * 100) : 0}%
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Partides del pressupost respecte el total del projecte</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            {(activeTab === "accepted" || activeTab === "rejected") ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">Enviament:</span>
                                  <span className="text-xs">
                                    {new Date(budget.submitted_at).toLocaleDateString("ca-ES")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {activeTab === "accepted" ? "Acceptació:" : "Rebuig:"}
                                  </span>
                                  <span className={`text-xs font-medium ${activeTab === "accepted" ? 'text-green-600' : 'text-destructive'}`}>
                                    {new Date(budget.updated_at).toLocaleDateString("ca-ES")}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Validesa:</span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-12 h-3 border border-current rounded-sm relative overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${
                                        isExpired 
                                          ? 'bg-destructive' 
                                          : daysRemaining <= 5 
                                            ? 'bg-destructive' 
                                            : 'bg-primary'
                                      }`}
                                      style={{ 
                                        width: `${Math.min(100, Math.max(0, (daysRemaining / budget.validity_days) * 100))}%` 
                                      }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    isExpired 
                                      ? 'text-destructive' 
                                      : daysRemaining <= 5 
                                        ? 'text-destructive' 
                                        : 'text-primary'
                                  }`}>
                                    {isExpired ? '0' : daysRemaining} {daysRemaining === 1 ? "dia" : "dies"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Botons d'acció */}
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => toggleBudgetExpanded(budget.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                              Detalls
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generatePDF(budget)}
                              title="Descarregar PDF"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            {(budget.status === "submitted" || budget.status === "draft") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600"
                                  onClick={() => handleAcceptBudget(budget)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleRejectBudget(budget)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>

                          {/* Detalls expandits */}
                          {isExpanded && (
                            <div className="pt-3 border-t space-y-3 mt-3">
                              <div className="space-y-2 text-xs">
                                <h4 className="font-semibold text-sm">Dades de contacte</h4>
                                <div className="space-y-1 text-muted-foreground">
                                  <div>NIF: {profile?.nif || "N/D"}</div>
                                  <div>Email: {profile?.email || "N/D"}</div>
                                  {profile?.phone && <div>Telèfon: {profile.phone}</div>}
                                  <div>
                                    Adreça: {profile?.street ? `${profile.street} ${profile.street_number || 's/n'}` : "N/D"}
                                    {profile?.city && `, ${profile.postal_code} ${profile.city}`}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2 text-xs">
                                <h4 className="font-semibold text-sm">Informació addicional</h4>
                                <div className="space-y-1 text-muted-foreground">
                                  <div>Codi: <span className="font-mono text-primary">{budget.offer_code}</span></div>
                                  {activeTab !== "accepted" && activeTab !== "rejected" && (
                                    <div>Data: {new Date(budget.submitted_at).toLocaleDateString("ca-ES")}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )) : null}
        </div>

        {/* Footer amb estadístiques - sempre visible */}
        <div className={`border-t px-6 py-4 flex-shrink-0 ${
          isVisibleToSuppliers 
            ? 'bg-gradient-to-r from-green-50 via-green-100 to-green-50 dark:from-green-950/20 dark:via-green-950/30 dark:to-green-950/20' 
            : 'bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5'
        }`}>
          <div className="flex items-center justify-center gap-6">
            {/* Total Partides */}
            <div className="flex items-center gap-3 px-5 py-2 bg-gradient-to-br from-primary/15 to-primary/5 rounded-lg border-2 border-primary/30">
              <Hash className="h-6 w-6 text-primary" />
              <div className="text-left">
                <p className="text-xs text-muted-foreground font-medium">
                  {language === 'ca' 
                    ? (partidesStats.totalPartides === 1 ? 'Total Partida' : 'Total Partides')
                    : (partidesStats.totalPartides === 1 ? 'Total Partida' : 'Total Partidas')}
                </p>
                <p className="text-2xl font-bold text-primary tabular-nums">{partidesStats.totalPartides}</p>
              </div>
            </div>

            {/* Partides IFC */}
            <div className="flex items-center gap-3 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-2 border-blue-300 dark:border-blue-700">
              <Box className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {language === 'ca' 
                    ? (partidesStats.ifc === 1 ? 'Partida IFC' : 'Partides IFC')
                    : (partidesStats.ifc === 1 ? 'Partida IFC' : 'Partidas IFC')}
                </p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">{partidesStats.ifc}</p>
              </div>
            </div>

            {/* Partides Manuals */}
            <div className="flex items-center gap-3 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg border-2 border-amber-300 dark:border-amber-700">
              <Hand className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div className="text-left">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {language === 'ca' 
                    ? (partidesStats.manual === 1 ? 'Partida Manual' : 'Partides Manuals')
                    : (partidesStats.manual === 1 ? 'Partida Manual' : 'Partidas Manuales')}
                </p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{partidesStats.manual}</p>
              </div>
            </div>

            {/* Percentatge BIM */}
            <div className="flex items-center gap-3 px-6 py-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg border-2 border-primary shadow-lg">
              <BarChart3 className="h-6 w-6 text-primary" />
              <div className="text-left">
                <p className="text-xs text-muted-foreground font-medium">% BIM</p>
                <p className="text-2xl font-bold text-primary tabular-nums">{partidesStats.percentageBIM}%</p>
              </div>
            </div>

            {/* Indicador de pressupost fixat - ocultat per ara */}
            {/* isVisibleToSuppliers && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-500">
                <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                  {language === 'ca' ? 'Pressupost Fixat' : 'Presupuesto Fijado'}
                </span>
              </div>
            ) */}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal informatiu per ACCEPTAR pressupost */}
    <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Acceptar pressupost
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-4">
            {budgetToAccept && (
              <>
                {/* Informació del pressupost */}
                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-foreground">Estàs a punt d'acceptar aquest pressupost:</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-muted-foreground">Industrial:</span>
                        <p className="font-semibold text-foreground">{budgetToAccept.profiles?.full_name || "Sense nom"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Import total:</span>
                        <p className="font-bold text-green-600 text-lg">{formatNumber(budgetToAccept.total_amount)}&nbsp;€</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Projecte:</span>
                        <p className="font-medium text-foreground">{budgetToAccept.project_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Partides pressupostades:</span>
                        <p className="font-medium text-foreground">{budgetToAccept.valuations?.length || 0} / {budgetToAccept.total_partides || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Efectes de l'acceptació */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Què passarà quan acceptis aquest pressupost?
                  </h4>
                  
                  <div className="space-y-3">
                    <Card className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-foreground">📋 Efectes per al projecte:</CardTitle>
                      </CardHeader>
                                      <CardContent className="text-sm text-muted-foreground space-y-1">
                                        <p>• El pressupost quedarà <strong className="text-green-600">marcat com a acceptat</strong></p>
                                        <p>• <strong className="text-amber-600">Les partides acceptades es bloquejaran</strong> i no es podran rebre més ofertes d'aquestes partides</p>
                                        <p>• Els altres industrials no podran enviar ofertes per les partides ja acceptades</p>
                                        <p>• Tindràs accés complet a totes les dades i detalls del pressupost</p>
                                        <p>• Aquest pressupost quedarà destacat en verd en el llistat</p>
                                      </CardContent>
                    </Card>

                    <Card className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-foreground">🏢 Efectes per a l'industrial:</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1">
                        <p>• L'industrial <strong className="text-green-600">rebrà una notificació</strong> que el seu pressupost ha estat acceptat</p>
                        <p>• Podrà veure que el seu pressupost està acceptat en el seu tauler</p>
                        <p>• Es podrà posar en contacte amb tu per concretar els següents passos</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Important:</strong> Aquesta acció bloqueja les partides acceptades. Ja no es podran rebre més ofertes d'aquestes partides per part d'altres industrials.</span>
                  </p>
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmAcceptBudget}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar acceptació
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Modal informatiu per REBUTJAR pressupost */}
    <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <XCircle className="h-6 w-6 text-destructive" />
            Rebutjar pressupost
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-4">
            {budgetToReject && (
              <>
                {/* Informació del pressupost */}
                <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-foreground">Estàs a punt de rebutjar aquest pressupost:</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-muted-foreground">Industrial:</span>
                        <p className="font-semibold text-foreground">{budgetToReject.profiles?.full_name || "Sense nom"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Import total:</span>
                        <p className="font-bold text-destructive text-lg">{formatNumber(budgetToReject.total_amount)}&nbsp;€</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Projecte:</span>
                        <p className="font-medium text-foreground">{budgetToReject.project_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Partides pressupostades:</span>
                        <p className="font-medium text-foreground">{budgetToReject.valuations?.length || 0} / {budgetToReject.total_partides || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Efectes del rebuig */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Què passarà quan rebutgis aquest pressupost?
                  </h4>
                  
                  <div className="space-y-3">
                    <Card className="border-destructive/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-foreground">📋 Efectes per al projecte:</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1">
                        <p>• El pressupost quedarà <strong className="text-destructive">marcat com a rebutjat</strong></p>
                        <p>• Continuarà visible en el teu historial però amb estat "Rebutjat"</p>
                        <p>• Podràs veure el motiu del rebuig que has indicat</p>
                        <p>• Continuaràs rebent altres ofertes dels altres industrials</p>
                      </CardContent>
                    </Card>

                    <Card className="border-destructive/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-foreground">🏢 Efectes per a l'industrial:</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1">
                        <p>• L'industrial <strong className="text-destructive">rebrà una notificació</strong> que el seu pressupost ha estat rebutjat</p>
                        <p>• Podrà veure el motiu del rebuig que has seleccionat</p>
                        <p>• Aquesta informació l'ajudarà a millorar futures ofertes</p>
                        <p>• El pressupost apareixerà com a rebutjat en el seu sistema</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Selector de motiu */}
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason" className="text-foreground font-semibold">
                    Motiu del rebuig <span className="text-destructive">*</span>
                  </Label>
                  <Select value={rejectionReason} onValueChange={setRejectionReason}>
                    <SelectTrigger id="rejection-reason" className="w-full bg-background">
                      <SelectValue placeholder="Selecciona un motiu..." />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-popover">
                      <SelectItem value="pressupost_elevat">💰 Pressupost elevat</SelectItem>
                      <SelectItem value="condicions_excessives">📜 Condicions excessives</SelectItem>
                      <SelectItem value="data_validesa">📅 Data de validesa del pressupost</SelectItem>
                      <SelectItem value="motius_personals">👤 Motius personals</SelectItem>
                      <SelectItem value="no_compleix_requisits">⚠️ No compleix els requisits tècnics</SelectItem>
                      <SelectItem value="temps_execucio">⏱️ Temps d'execució massa llarg</SelectItem>
                      <SelectItem value="altres">📝 Altres</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Aquest motiu serà visible per l'industrial</p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Recorda:</strong> Rebutjar un pressupost és una acció que no es pot desfer. Si us plau, assegura't abans de confirmar.</span>
                  </p>
                </div>
              </>
            )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel·lar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmRejectBudget}
            className="bg-destructive hover:bg-destructive/90"
            disabled={!rejectionReason}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Confirmar rebuig
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Modal de confirmació per fer visible */}
    <AlertDialog open={confirmVisibilityOpen} onOpenChange={setConfirmVisibilityOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Fer visible el pressupost per industrials?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="font-semibold text-foreground">
              ⚠️ Aquesta acció és <span className="text-destructive">irreversible</span>
            </p>
            <div className="space-y-2 text-sm">
              <p>Un cop el pressupost sigui visible pels industrials:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Quedarà <strong>completament fixat</strong> i no es podrà modificar</li>
                <li>No podràs afegir, editar ni eliminar cap partida</li>
                <li>No podràs canviar l'ordre de les partides</li>
                <li>Els industrials podran veure i valorar totes les partides</li>
              </ul>
            </div>
            <p className="text-foreground font-medium pt-2">
              Estàs segur que vols continuar amb aquest procés?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmMakeVisible} className="bg-green-600 hover:bg-green-700">
            Sí, fer visible i fixar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Modal per crear partida manual */}
    <NestedDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
      <NestedDialogContent className="max-w-lg">
        <NestedDialogHeader>
          <NestedDialogTitle>Crear partida manual</NestedDialogTitle>
        </NestedDialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="measuredValue">Quantificació</Label>
              <Input
                id="measuredValue"
                type="number"
                step="0.01"
                value={newPartida.measuredValue}
                onChange={(e) => setNewPartida({ ...newPartida, measuredValue: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredUnit">Unitats preferides</Label>
              <Select
                value={newPartida.preferredUnit}
                onValueChange={(value) => setNewPartida({ ...newPartida, preferredUnit: value })}
              >
                <SelectTrigger id="preferredUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UT">UT (Unitats)</SelectItem>
                  <SelectItem value="ML">ML (Metres lineals)</SelectItem>
                  <SelectItem value="M2">M2 (Metres quadrats)</SelectItem>
                  <SelectItem value="M3">M3 (Metres cúbics)</SelectItem>
                  <SelectItem value="KG">KG (Quilograms)</SelectItem>
                  <SelectItem value="PA">PA (Partida alçada)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customName">Descripció curta *</Label>
            <Input
              id="customName"
              value={newPartida.customName}
              onChange={(e) => setNewPartida({ ...newPartida, customName: e.target.value })}
              placeholder="Nom de la partida"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Descripció llarga</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                disabled={generatingAI || !newPartida.customName}
                onClick={handleGenerateAIForNewPartida}
              >
                {generatingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generar amb IA
              </Button>
            </div>
            <Textarea
              id="description"
              value={newPartida.description}
              onChange={(e) => setNewPartida({ ...newPartida, description: e.target.value })}
              placeholder="Descripció detallada"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel·lar
            </Button>
            <Button onClick={handleSavePartida}>
              Crear partida
            </Button>
          </div>
        </div>
      </NestedDialogContent>
    </NestedDialog>

    <NestedDialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
      <NestedDialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0">
        <NestedDialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <NestedDialogTitle className="flex items-center gap-2 text-2xl">
                <BookOpen className="h-6 w-6 text-primary" />
                Guia Completa - Pressupostos Configuració
              </NestedDialogTitle>
              <NestedDialogDescription>
                Tot el que necessites saber per configurar i gestionar els teus pressupostos de projecte
              </NestedDialogDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={generateTutorialPDF}>
              <FileDown className="h-4 w-4" />
              Descarregar PDF
            </Button>
          </div>
        </NestedDialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-8 pt-6">
            
            {/* SECCIÓ 1: Què és i per a què serveix */}
            <Card className="border-2 border-primary/30 shadow-xl bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="bg-primary/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Info className="h-7 w-7 text-primary" />
                  </div>
                  1. Què és Pressupostos - Configuració?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Pressupostos - Configuració</strong> és el mòdul central per organitzar, estructurar i preparar el teu pressupost abans d'enviar-lo als industrials perquè facin les seves ofertes.
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <Box className="h-5 w-5 text-white" />
                      </div>
                      <h4 className="font-bold text-blue-900">Per a usuaris amb model BIM</h4>
                    </div>
                    <p className="text-sm text-blue-800">
                      El sistema extreu automàticament les partides del teu arxiu IFC i les organitza segons l'estructura de capítols predefinida. Tu només has de revisar i completar.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-amber-500 rounded-lg">
                        <Hand className="h-5 w-5 text-white" />
                      </div>
                      <h4 className="font-bold text-amber-900">Per a usuaris sense model BIM</h4>
                    </div>
                    <p className="text-sm text-amber-800">
                      Pots crear totes les partides manualment des de zero. El sistema et guia per classificar cada partida dins l'estructura de capítols.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-5 rounded-xl border border-primary/20">
                  <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    En resum, aquest mòdul et permet:
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Organitzar les partides del pressupost en una estructura jeràrquica de 3 nivells</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Crear partides manuals per completar o complementar les del model BIM</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Reordenar les partides segons les teves preferències</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Visualitzar estadístiques del pressupost en temps real</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Fer visible el pressupost als industrials quan estigui llest</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓ 2: Com funciona - Flux de treball */}
            <Card className="border-2 border-blue-200/50 shadow-xl">
              <CardHeader className="bg-blue-50/50 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Layers className="h-7 w-7 text-blue-600" />
                  </div>
                  2. Com funciona? - Flux de treball
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                <p className="text-muted-foreground">
                  El procés segueix un flux lògic dissenyat per maximitzar l'eficiència:
                </p>

                {/* Timeline visual */}
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-green-500"></div>
                  
                  <div className="space-y-6">
                    {/* Pas 1 */}
                    <div className="relative flex gap-4">
                      <div className="flex-shrink-0 w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-lg z-10">1</div>
                      <div className="flex-1 p-4 rounded-xl border-2 border-blue-200 bg-blue-50/30">
                        <h5 className="font-bold text-blue-900 text-lg mb-2">Càrrega del model IFC (si en tens)</h5>
                        <p className="text-sm text-blue-800 mb-2">
                          Quan carregues un arxiu IFC, el sistema analitza automàticament tots els elements i extreu les seves mesures i propietats.
                        </p>
                        <div className="bg-white/50 p-2 rounded-lg text-xs text-blue-700">
                          <strong>Lògica interna:</strong> S'identifiquen tipus d'elements IFC (portes, finestres, parets, etc.) i s'agrupen per tipologia amb les seves quantificacions.
                        </div>
                      </div>
                    </div>

                    {/* Pas 2 */}
                    <div className="relative flex gap-4">
                      <div className="flex-shrink-0 w-16 h-16 rounded-full bg-purple-500 text-white flex items-center justify-center text-xl font-bold shadow-lg z-10">2</div>
                      <div className="flex-1 p-4 rounded-xl border-2 border-purple-200 bg-purple-50/30">
                        <h5 className="font-bold text-purple-900 text-lg mb-2">Classificació en capítols</h5>
                        <p className="text-sm text-purple-800 mb-2">
                          Les partides s'organitzen dins l'estructura de 3 nivells: Capítol → Subcapítol → Subsubcapítol. Pots ajustar la classificació si cal.
                        </p>
                        <div className="bg-white/50 p-2 rounded-lg text-xs text-purple-700">
                          <strong>Lògica interna:</strong> El sistema mapeja automàticament tipus IFC a categories de pressupost segons una taula de correspondències predefinida.
                        </div>
                      </div>
                    </div>

                    {/* Pas 3 */}
                    <div className="relative flex gap-4">
                      <div className="flex-shrink-0 w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center text-xl font-bold shadow-lg z-10">3</div>
                      <div className="flex-1 p-4 rounded-xl border-2 border-amber-200 bg-amber-50/30">
                        <h5 className="font-bold text-amber-900 text-lg mb-2">Creació de partides manuals</h5>
                        <p className="text-sm text-amber-800 mb-2">
                          Afegeix partides que no provenen del model BIM: treballs preliminars, seguretat, gestió de residus, etc.
                        </p>
                        <div className="bg-white/50 p-2 rounded-lg text-xs text-amber-700">
                          <strong>Lògica interna:</strong> Les partides manuals reben un codi seqüencial dins del subsubcapítol corresponent i es marquen amb badge "MANUAL".
                        </div>
                      </div>
                    </div>

                    {/* Pas 4 */}
                    <div className="relative flex gap-4">
                      <div className="flex-shrink-0 w-16 h-16 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xl font-bold shadow-lg z-10">4</div>
                      <div className="flex-1 p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/30">
                        <h5 className="font-bold text-indigo-900 text-lg mb-2">Reordenació de partides</h5>
                        <p className="text-sm text-indigo-800 mb-2">
                          Arrossega les partides per ordenar-les segons la lògica d'execució de l'obra o les teves preferències.
                        </p>
                        <div className="bg-white/50 p-2 rounded-lg text-xs text-indigo-700">
                          <strong>Lògica interna:</strong> L'ordre es guarda al camp "display_order" de cada partida i es manté entre sessions.
                        </div>
                      </div>
                    </div>

                    {/* Pas 5 */}
                    <div className="relative flex gap-4">
                      <div className="flex-shrink-0 w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center text-xl font-bold shadow-lg z-10">5</div>
                      <div className="flex-1 p-4 rounded-xl border-2 border-green-200 bg-green-50/30">
                        <h5 className="font-bold text-green-900 text-lg mb-2">Fer visible per industrials</h5>
                        <p className="text-sm text-green-800 mb-2">
                          Quan el pressupost estigui complet, el fas visible. Els industrials podran accedir i enviar les seves ofertes.
                        </p>
                        <div className="bg-white/50 p-2 rounded-lg text-xs text-green-700">
                          <strong>Lògica interna:</strong> S'activa el flag "is_visible" a la taula project_supplier_visibility. Un cop activat, el pressupost queda bloquejat per evitar canvis.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓ 3: Estadístiques del pressupost */}
            <Card className="border-2 border-purple-200/50 shadow-xl">
              <CardHeader className="bg-purple-50/50 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <BarChart3 className="h-7 w-7 text-purple-600" />
                  </div>
                  3. Estadístiques - Què t'informen?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                <p className="text-muted-foreground">
                  A la part inferior del modal sempre tens visibles 4 indicadors clau que t'ajuden a controlar l'estat del pressupost:
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-primary/20 rounded-full">
                        <Hash className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Total Partides</h4>
                        <p className="text-xs text-muted-foreground">Exemple: 45</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Suma total de totes les partides del pressupost, tant les extretes del BIM com les creades manualment.
                    </p>
                    <div className="mt-3 p-2 bg-background/50 rounded-lg text-xs">
                      <strong>Utilitat:</strong> Et permet tenir una visió ràpida del volum del projecte.
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-blue-500 rounded-full">
                        <Box className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-blue-900">Partides IFC</h4>
                        <p className="text-xs text-blue-700">Exemple: 38</p>
                      </div>
                    </div>
                    <p className="text-sm text-blue-800">
                      Partides que provenen directament del model BIM/IFC. S'identifiquen amb el badge blau "IFC".
                    </p>
                    <div className="mt-3 p-2 bg-white/50 rounded-lg text-xs text-blue-700">
                      <strong>Utilitat:</strong> Indica el grau d'automatització del procés de pressupost.
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-amber-500 rounded-full">
                        <Hand className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-amber-900">Partides Manuals</h4>
                        <p className="text-xs text-amber-700">Exemple: 7</p>
                      </div>
                    </div>
                    <p className="text-sm text-amber-800">
                      Partides creades manualment per tu. S'identifiquen amb el badge taronja "MANUAL".
                    </p>
                    <div className="mt-3 p-2 bg-white/50 rounded-lg text-xs text-amber-700">
                      <strong>Utilitat:</strong> Et permet saber quantes partides has afegit a mà.
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-green-100/50 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-green-500 rounded-full">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-green-900">% BIM</h4>
                        <p className="text-xs text-green-700">Exemple: 84%</p>
                      </div>
                    </div>
                    <p className="text-sm text-green-800">
                      Percentatge de partides que provenen del model BIM respecte al total.
                    </p>
                    <div className="mt-3 p-2 bg-white/50 rounded-lg text-xs text-green-700">
                      <strong>Utilitat:</strong> Un % alt indica bona qualitat del model BIM. Un % baix pot indicar que el model necessita més detall.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓ 4: Fer visible per industrials */}
            <Card className="border-2 border-green-200/50 shadow-xl">
              <CardHeader className="bg-green-50/50 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Eye className="h-7 w-7 text-green-600" />
                  </div>
                  4. Fer Visible per Industrials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                <p className="text-muted-foreground text-lg">
                  Aquesta és l'acció més important del mòdul. Quan el pressupost està llest, el fas visible perquè els industrials puguin valorar-lo.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Abans */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2 text-amber-700">
                      <AlertCircle className="h-5 w-5" />
                      Abans de fer-lo visible
                    </h4>
                    <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/50">
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Pots afegir, editar i eliminar partides</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Pots modificar quantitats i unitats</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Pots reordenar les partides lliurement</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Els industrials NO veuen el pressupost</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Després */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2 text-green-700">
                      <Lock className="h-5 w-5" />
                      Després de fer-lo visible
                    </h4>
                    <div className="p-4 rounded-xl border-2 border-green-300 bg-green-50/50">
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <Lock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>El pressupost queda <strong>BLOQUEJAT</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>No pots afegir ni eliminar partides</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>No pots modificar quantitats ni unitats</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Eye className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Els industrials JA poden veure i valorar</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border-2 border-red-300 p-5 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-red-900 text-lg mb-2">⚠️ ATENCIÓ: Acció irreversible</h5>
                      <p className="text-sm text-red-800">
                        Un cop facis visible el pressupost, <strong>no hi ha marxa enrere</strong>. Assegura't que tot estigui correcte abans de fer clic al botó.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-xl">
                  <h5 className="font-semibold mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Per què es bloqueja?
                  </h5>
                  <p className="text-sm text-muted-foreground">
                    El bloqueig garanteix que tots els industrials valorin exactament les mateixes partides amb les mateixes quantitats. Això permet comparar les ofertes de forma justa i transparent.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓ 5: Reordenar partides */}
            <Card className="border-2 border-indigo-200/50 shadow-xl">
              <CardHeader className="bg-indigo-50/50 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <GripVertical className="h-7 w-7 text-indigo-600" />
                  </div>
                  5. Reordenar Partides
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                <p className="text-muted-foreground">
                  El sistema utilitza tecnologia de drag & drop per permetre't reordenar les partides de forma intuïtiva:
                </p>

                <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-200">
                  <h5 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-indigo-600" />
                    Com reordenar pas a pas:
                  </h5>
                  <ol className="space-y-4">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">1</span>
                      <div>
                        <p className="font-semibold text-indigo-900">Localitza l'asa d'arrossegament</p>
                        <p className="text-sm text-indigo-700">A l'esquerra de cada partida veuràs una icona <GripVertical className="h-4 w-4 inline text-indigo-500" /></p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">2</span>
                      <div>
                        <p className="font-semibold text-indigo-900">Fes clic i mantén premut</p>
                        <p className="text-sm text-indigo-700">El cursor canviarà a mode "grab" i la partida es ressaltarà</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">3</span>
                      <div>
                        <p className="font-semibold text-indigo-900">Arrossega amunt o avall</p>
                        <p className="text-sm text-indigo-700">Les altres partides es mouran per fer espai</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">4</span>
                      <div>
                        <p className="font-semibold text-indigo-900">Deixa anar per confirmar</p>
                        <p className="text-sm text-indigo-700">L'ordre es guarda automàticament a la base de dades</p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="bg-muted/50 p-4 rounded-xl">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span><strong>Important:</strong> Només pots reordenar partides dins del mateix subsubcapítol. No pots moure partides entre diferents capítols.</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓ 6: Avantatges */}
            <Card className="border-2 border-green-300 shadow-xl bg-gradient-to-br from-green-50/50 to-transparent">
              <CardHeader className="bg-green-100/50 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle className="h-7 w-7 text-green-600" />
                  </div>
                  6. Avantatges del Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-white/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-100 rounded-lg">
                        <Box className="h-4 w-4 text-blue-600" />
                      </div>
                      <h5 className="font-bold">Automatització BIM</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Extracció automàtica de mesures del model IFC, reduint errors i temps de treball manual.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border bg-white/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-purple-100 rounded-lg">
                        <Layers className="h-4 w-4 text-purple-600" />
                      </div>
                      <h5 className="font-bold">Estructura estandarditzada</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tots els pressupostos segueixen la mateixa estructura de capítols, facilitant la comparació.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border bg-white/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-amber-100 rounded-lg">
                        <Hand className="h-4 w-4 text-amber-600" />
                      </div>
                      <h5 className="font-bold">Flexibilitat manual</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pots completar o crear pressupostos des de zero sense necessitat de model BIM.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border bg-white/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-green-100 rounded-lg">
                        <Lock className="h-4 w-4 text-green-600" />
                      </div>
                      <h5 className="font-bold">Integritat garantida</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      El bloqueig assegura que tots els industrials valoren el mateix pressupost exacte.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border bg-white/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-indigo-100 rounded-lg">
                        <BarChart3 className="h-4 w-4 text-indigo-600" />
                      </div>
                      <h5 className="font-bold">Control en temps real</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Estadístiques sempre visibles per monitoritzar l'estat del pressupost.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border bg-white/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-pink-100 rounded-lg">
                        <Users className="h-4 w-4 text-pink-600" />
                      </div>
                      <h5 className="font-bold">Comparació justa</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Els industrials valoren les mateixes partides, permetent comparar ofertes objectivament.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓ 7: Consells per a usuaris novells i experts */}
            <Card className="border-2 border-primary/30 shadow-xl">
              <CardHeader className="bg-primary/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Lightbulb className="h-7 w-7 text-primary" />
                  </div>
                  7. Consells pràctics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Per a novells */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2 border-b pb-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Si ets nou al sistema
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold">1.</span>
                        <span>Comença revisant l'estructura de capítols per familiaritzar-te amb l'organització</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold">2.</span>
                        <span>Si tens model BIM, deixa que el sistema faci l'extracció automàtica primer</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold">3.</span>
                        <span>Afegeix partides manuals només després de revisar les partides IFC</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold">4.</span>
                        <span>No tinguis pressa en fer visible el pressupost - revisa-ho tot amb calma</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold">5.</span>
                        <span>Consulta les estadístiques del footer per verificar que tot quadra</span>
                      </li>
                    </ul>
                  </div>

                  {/* Per a experts */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2 border-b pb-2">
                      <UserCheck className="h-5 w-5 text-green-600" />
                      Si ja tens experiència
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 font-bold">1.</span>
                        <span>Optimitza el teu model IFC per maximitzar l'extracció automàtica (% BIM alt)</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 font-bold">2.</span>
                        <span>Utilitza descripcions consistents per facilitar futures cerques i comparacions</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 font-bold">3.</span>
                        <span>Ordena les partides seguint la lògica d'execució de l'obra</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 font-bold">4.</span>
                        <span>Crea plantilles de partides manuals per a treballs recurrents</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 font-bold">5.</span>
                        <span>Revisa el mapatge BIM-capítols per millorar la classificació automàtica</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Peu amb botó PDF */}
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="lg" className="gap-2" onClick={generateTutorialPDF}>
                <FileDown className="h-5 w-5" />
                Descarregar aquesta guia en PDF
              </Button>
            </div>

          </div>
        </div>
      </NestedDialogContent>
    </NestedDialog>

    {/* Modal de cobertura d'industrials - apareix després de fer visible */}
    {projectId && (
      <SupplierCoverageModal
        open={coverageModalOpen}
        onOpenChange={setCoverageModalOpen}
        projectId={projectId}
        categoriesWithItems={categoriesWithItems}
      />
    )}

    {/* Modal de detalls de partida */}
    {selectedElementForDetails && (
      <ElementTypeDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        elementTypeConfigId={selectedElementForDetails.id}
        elementName={selectedElementForDetails.custom_name || selectedElementForDetails.type_name}
      />
    )}
    {/* Modal de confirmació de crèdits per IA */}
    <CreditConfirmationModal
      open={showCreditConfirmation}
      onOpenChange={setShowCreditConfirmation}
      actionType="ai_budget_description"
      creditCost={creditsConfig.creditsPerAiDescription || 5}
      currentCredits={credits}
      onConfirm={() => {
        if (pendingAIElement) {
          executeAIForElement(pendingAIElement);
          setPendingAIElement(null);
        } else if (pendingNewPartidaAI) {
          executeAIForNewPartida();
          setPendingNewPartidaAI(false);
        }
      }}
      onCancel={() => {
        setPendingAIElement(null);
        setPendingNewPartidaAI(false);
      }}
    />
    </>
  );
};

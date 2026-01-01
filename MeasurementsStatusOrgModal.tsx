import { useState, useEffect, useMemo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Info, GripVertical, Plus, Box, FileText, Pencil, Trash2, Users, CheckCircle2, Layers, Link, CheckCircle, Send, Eye, BarChart3, FileCheck, UserCheck, Lightbulb, Hash, Ruler, Square, Weight, Calculator, AlertCircle, XCircle, FileDown, Building2, Sparkles, Loader2, Coins } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle, NestedDialogDescription } from "@/components/ui/nested-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BUDGET_CHAPTERS } from "@/data/budgetChapters";
import { getSpecialistCategoryForBudgetCode } from "@/data/budgetToSpecialistMapping";
import { useBudgetChapterTranslations } from "@/hooks/useBudgetChapterTranslations";
import { AssignSuppliersModal } from "./AssignSuppliersModal";
import { BudgetStructureTutorial } from "./BudgetStructureTutorial";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Viewer } from "@xeokit/xeokit-sdk";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserCredits } from "@/hooks/useUserCredits";
import { ElementTypeDetailsModal } from "./ElementTypeDetailsModal";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditConfirmationModal, getCreditConfirmationDisabled } from "@/components/credits/CreditConfirmationModal";
import { useUISettings } from "@/hooks/useUISettings";
import { BatchDescriptionGenerator } from "./BatchDescriptionGenerator";

interface MeasurementsStatusOrgModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string; // Now represents projectId
  refreshTrigger?: number;
  viewer: Viewer | null;
  versionId?: string | null;
}

interface ProjectData {
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  project_type: string | null;
  project_type_name: string | null;
  description: string | null;
  created_at: string;
}

interface ElementMeasurement {
  id: string;
  name: string;
  value: number;
  aabbDimensions?: { dx: number; dy: number; dz: number };
  comentarios?: string;
}

interface ElementConfig {
  id: string;
  ifc_category: string;
  type_name: string;
  custom_name: string | null;
  chapter_id: string | null;
  subchapter_id: string | null;
  subsubchapter_id: string | null;
  preferred_unit: string;
  description: string | null;
  measured_value: number | null;
  display_order: number;
  is_manual: boolean;
}

interface ManualMeasurementLine {
  id: string;
  element_type_config_id: string;
  comment: string | null;
  quantity: number;
  display_order: number;
}

interface SortableItemProps {
  element: ElementConfig;
  itemNumber: string;
  onEdit?: (element: ElementConfig) => void;
  onDelete?: (element: ElementConfig) => void;
  onDetails?: (element: ElementConfig) => void;
  onGenerateAI?: (element: ElementConfig) => void;
  generatingAI?: boolean;
  elementMeasurements?: ElementMeasurement[];
  manualMeasurementLines?: ManualMeasurementLine[];
  // Propietats per a generació conjunta
  hasBatchTemplate?: boolean;
  isSelectedForBatch?: boolean;
  onBatchSelectionToggle?: (id: string) => void;
  creditCostPerItem?: number;
  shouldSkipCredits?: boolean;
}

function SortableItem({ 
  element, 
  itemNumber, 
  onEdit, 
  onDelete, 
  onDetails, 
  onGenerateAI, 
  generatingAI, 
  elementMeasurements, 
  manualMeasurementLines,
  hasBatchTemplate,
  isSelectedForBatch,
  onBatchSelectionToggle,
  creditCostPerItem,
  shouldSkipCredits
}: SortableItemProps) {
  const [showMeasurements, setShowMeasurements] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Utilitzar measured_value directament de la base de dades
  const displayValue = element.measured_value || 0;
  const formattedValue = Number(displayValue).toLocaleString('ca-ES', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  // Mostrar línies de medició: IFC o manuals
  const hasIfcMeasurements = !element.is_manual && elementMeasurements && elementMeasurements.length > 0;
  const hasManualMeasurements = element.is_manual && manualMeasurementLines && manualMeasurementLines.length > 0;
  const hasMeasurements = hasIfcMeasurements || hasManualMeasurements;
  const measurementCount = hasIfcMeasurements ? elementMeasurements!.length : (hasManualMeasurements ? manualMeasurementLines!.length : 0);

  // El botó de IA individual es bloqueja si la partida està seleccionada per batch
  const isAIBlocked = hasBatchTemplate && isSelectedForBatch;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-1 py-2 px-3 rounded-md bg-background border ${
        isSelectedForBatch 
          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20' 
          : 'border-border/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox per generació conjunta - només si hi ha template */}
        {hasBatchTemplate && onBatchSelectionToggle && (
          <div className="flex items-center pt-0.5">
            <Checkbox
              checked={isSelectedForBatch}
              onCheckedChange={() => onBatchSelectionToggle(element.id)}
              className="h-4 w-4"
            />
          </div>
        )}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-xs font-mono text-primary font-semibold whitespace-nowrap">
          {itemNumber}
        </span>
        {/* Mostrar cost del crèdit si està seleccionat */}
        {hasBatchTemplate && isSelectedForBatch && !shouldSkipCredits && creditCostPerItem && (
          <span className="text-xs text-amber-500 flex items-center gap-0.5">
            <Coins className="h-2.5 w-2.5" />
            {creditCostPerItem}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {element.is_manual ? (
                    <FileText className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Box className="h-3.5 w-3.5 text-blue-500" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {element.is_manual ? "Partida manual" : "Partida del model IFC"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formattedValue} {element.preferred_unit}
            </span>
            <span className="font-medium text-sm text-foreground">
              {element.custom_name || element.type_name}
            </span>
            {hasMeasurements && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMeasurements(!showMeasurements);
                }}
                className="h-5 px-1.5 text-xs gap-1"
              >
                <Ruler className="h-3 w-3" />
                <span className="text-[10px]">{measurementCount}</span>
              </Button>
            )}
          </div>
          {element.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {element.description}
            </p>
          )}
          
          {/* Taula de línies de medició - IFC */}
          {hasIfcMeasurements && showMeasurements && (
            <div className="mt-2 border border-border/30 rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left px-2 py-1 font-medium text-muted-foreground">Comentaris</th>
                    <th className="text-right px-2 py-1 font-medium text-muted-foreground">{element.preferred_unit}</th>
                  </tr>
                </thead>
                <tbody>
                  {elementMeasurements!.map((m, idx) => (
                    <tr key={m.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1 text-muted-foreground truncate max-w-[250px]" title={m.comentarios || ''}>
                        {m.comentarios || "-"}
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-medium">
                        {m.value.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-primary/5 border-t border-border/30">
                  <tr>
                    <td colSpan={2} className="px-2 py-1 text-right font-medium">Total:</td>
                    <td className="px-2 py-1 text-right font-mono font-bold text-primary">
                      {elementMeasurements!.reduce((sum, m) => sum + m.value, 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {element.preferred_unit}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Taula de línies de medició - Manuals */}
          {hasManualMeasurements && showMeasurements && (
            <div className="mt-2 border border-amber-200 dark:border-amber-800/50 rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-amber-50 dark:bg-amber-900/20">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left px-2 py-1 font-medium text-muted-foreground">Comentari</th>
                    <th className="text-right px-2 py-1 font-medium text-muted-foreground">{element.preferred_unit}</th>
                  </tr>
                </thead>
                <tbody>
                  {manualMeasurementLines!.map((line, idx) => (
                    <tr key={line.id} className={idx % 2 === 0 ? "bg-background" : "bg-amber-50/30 dark:bg-amber-900/10"}>
                      <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1 text-muted-foreground truncate max-w-[250px]" title={line.comment || ''}>
                        {line.comment || "-"}
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-medium">
                        {Number(line.quantity).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-amber-100/50 dark:bg-amber-800/20 border-t border-amber-200 dark:border-amber-800/50">
                  <tr>
                    <td colSpan={2} className="px-2 py-1 text-right font-medium">Total:</td>
                    <td className="px-2 py-1 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                      {manualMeasurementLines!.reduce((sum, line) => sum + Number(line.quantity), 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {element.preferred_unit}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {/* Botó de detalls - sempre visible */}
          {onDetails && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDetails(element);
                    }}
                    className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Detalls de la partida</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Botó de generació amb IA - bloquejat si seleccionat per batch */}
          {onGenerateAI && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isAIBlocked) {
                        onGenerateAI(element);
                      }
                    }}
                    disabled={generatingAI || isAIBlocked}
                    className={`h-7 w-7 p-0 ${
                      isAIBlocked 
                        ? 'text-muted-foreground/50 cursor-not-allowed' 
                        : 'text-amber-500 hover:text-amber-600'
                    }`}
                  >
                    {generatingAI ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isAIBlocked 
                    ? "Desselecciona per generar individualment" 
                    : "Generar descripció amb IA"
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Botons d'editar/eliminar només per partides manuals */}
          {element.is_manual && onEdit && onDelete && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(element);
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar partida</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(element);
                      }}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eliminar partida</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Funcions helper per calcular mesures des del viewer
function getNiceTypeName(mo: any): string {
  // Agafar el nom del tipus des de les propietats
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
  // Fallback: agafar el nom directament
  return mo.name || mo.type || 'Unknown';
}

// Funció per obtenir Comentarios des de les propietats IFC (Revit/IFC)
function getComentarios(mo: any): string | undefined {
  // DEBUG: Log complet de l'objecte per trobar on està "FAÇANA EST"
  const moId = mo?.id || 'unknown';
  
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
  
  return undefined;
}

function calculateAreaFromGeometry(viewer: any, entityId: string, ifcType: string): number | null {
  if (!viewer || !entityId) return null;
  
  const possibleIds = [
    entityId,
    `myModel#${entityId}`,
    entityId.replace('myModel#', ''),
  ];
  
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
  
  if (type.includes("wall")) {
    const length = Math.max(dx, dz);
    const height = dy;
    return length * height;
  }
  
  if (type.includes("slab") || type.includes("floor") || type.includes("roof") || type.includes("ceiling")) {
    return dx * dz;
  }
  
  if (type.includes("window") || type.includes("door")) {
    return Math.max(dx * dy, dz * dy);
  }
  
  const areas = [dx * dy, dx * dz, dy * dz];
  return Math.max(...areas);
}

// Claus per buscar propietats IFC (igual que ifcMeasurements.ts)
const AREA_KEYS_ORG = new Set(["netarea", "grossarea", "area", "superficie", "netsidearea", "grosssidearea", "netsurfacearea", "grosssurfacearea", "outersurfacearea", "totalsurfacearea"]);
const VOL_KEYS_ORG = new Set(["netvolume", "grossvolume", "volume", "volumen", "vol"]);
const LEN_KEYS_ORG = new Set(["length", "longitud", "len", "altura", "height", "width", "anchura", "profundidad", "depth"]);
const MASS_KEYS_ORG = new Set(["mass", "massa", "masa", "weight", "peso", "pes"]);

function normKeyOrg(s: string): string {
  const t = (typeof s === 'string' ? s : String(s || "")).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-\.]/g, "");
  return t;
}

function toNumOrg(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  if (typeof v === "object") {
    for (const k of ["value", "Value", "val", "Val", "NominalValue"]) {
      if (k in v) {
        const n = toNumOrg(v[k]);
        if (n != null) return n;
      }
    }
  }
  return null;
}

function getByKeysFromPropsOrg(mo: any, keySet: Set<string>): number | null {
  // Path 1: propertySets array
  const psets = mo?.propertySets;
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const arr = ps?.properties;
      if (!Array.isArray(arr)) continue;
      for (const prop of arr) {
        const nk = normKeyOrg(prop?.name ?? prop?.Name ?? "");
        if (keySet.has(nk)) {
          const val = toNumOrg(prop?.value ?? prop?.Value ?? prop);
          if (val != null && val > 0) return val;
        }
      }
    }
  }
  
  // Path 2: BaseQuantities específic
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const psName = normKeyOrg(ps?.name ?? ps?.Name ?? "");
      if (psName.includes("basequantities") || psName.includes("quantities")) {
        const arr = ps?.properties;
        if (!Array.isArray(arr)) continue;
        for (const prop of arr) {
          const nk = normKeyOrg(prop?.name ?? prop?.Name ?? "");
          if (keySet.has(nk)) {
            const val = toNumOrg(prop?.value ?? prop?.Value ?? prop?.nominalValue ?? prop?.NominalValue ?? prop);
            if (val != null && val > 0) return val;
          }
        }
      }
    }
  }
  
  return null;
}

function getValueByUnitFromViewer(mo: any, unit: string, viewer: any): number {
  if (unit === "UT") return 1;
  
  let value: number | null = null;
  
  // Primer, intentar obtenir de propietats IFC (igual que ifcMeasurements.ts)
  switch (unit) {
    case "M2":
      value = getByKeysFromPropsOrg(mo, AREA_KEYS_ORG);
      break;
    case "ML":
      value = getByKeysFromPropsOrg(mo, LEN_KEYS_ORG);
      break;
    case "M3":
      value = getByKeysFromPropsOrg(mo, VOL_KEYS_ORG);
      break;
    case "KG":
      value = getByKeysFromPropsOrg(mo, MASS_KEYS_ORG);
      break;
  }
  
  // Si s'ha trobat valor de propietats IFC, retornar-lo
  if (value != null && value > 0) return value;
  
  // Fallback: calcular des de geometria AABB
  if (unit === "M2") {
    const area = calculateAreaFromGeometry(viewer, mo.id, mo?.type || "");
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

function getElementMeasurementsForType(
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
        const value = getValueByUnitFromViewer(mo, preferredUnit, viewer);
        
        // Obtenir dimensions AABB si disponibles
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
          console.log('[DEBUG ORG 32.94] ==================================');
          console.log('[DEBUG ORG 32.94] metaObject complet:', JSON.stringify(mo, (key, val) => {
            if (key === 'metaModels' || key === 'parent' || key === 'children') return '[circular]';
            return val;
          }, 2));
          console.log('[DEBUG ORG 32.94] mo.id:', mo.id);
          console.log('[DEBUG ORG 32.94] mo.name:', mo.name);
          console.log('[DEBUG ORG 32.94] mo.type:', mo.type);
          console.log('[DEBUG ORG 32.94] Totes les claus de mo:', Object.keys(mo));
          for (const key of Object.keys(mo)) {
            if (key !== 'propertySets' && key !== 'metaModels' && key !== 'parent' && key !== 'children') {
              console.log(`[DEBUG ORG 32.94] mo.${key}:`, mo[key]);
            }
          }
          if (mo.propertySets) {
            console.log('[DEBUG ORG 32.94] PropertySets count:', mo.propertySets.length);
            for (let i = 0; i < mo.propertySets.length; i++) {
              const ps = mo.propertySets[i];
              console.log(`[DEBUG ORG 32.94] PropertySet[${i}] name:`, ps.name, 'type:', ps.type);
              console.log(`[DEBUG ORG 32.94] PropertySet[${i}] keys:`, Object.keys(ps));
              if (ps.properties) {
                console.log(`[DEBUG ORG 32.94] PropertySet[${i}] properties count:`, ps.properties.length);
                for (const prop of ps.properties) {
                  console.log(`[DEBUG ORG 32.94]   Property: "${prop.name}" = "${prop.value}" (type: ${prop.type}, keys: ${Object.keys(prop).join(',')})`);
                }
              }
            }
          }
          console.log('[DEBUG ORG 32.94] ==================================');
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

export const MeasurementsStatusOrgModal = ({
  open,
  onOpenChange,
  centerId,
  refreshTrigger,
  viewer,
  versionId,
}: MeasurementsStatusOrgModalProps) => {
  const { language } = useLanguage();
  const { settings: uiSettings } = useUISettings();
  const { isHidden, getTranslatedName } = useBudgetChapterTranslations();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [elementConfigs, setElementConfigs] = useState<ElementConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedSubchapter, setSelectedSubchapter] = useState<string | null>(null);
  const [selectedSubsubchapter, setSelectedSubsubchapter] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<ElementConfig | null>(null);
  const [newPartida, setNewPartida] = useState({
    customName: "",
    description: "",
    measuredValue: "",
    preferredUnit: "UT",
  });
  
  // Estat per a les línies de mesurament de partides manuals
  const [measurementLines, setMeasurementLines] = useState<{ comment: string; quantity: string }[]>([]);
  const [editMeasurementLines, setEditMeasurementLines] = useState<{ id?: string; comment: string; quantity: string }[]>([]);
  
  // Cache de línies de mesurament manuals
  const [manualMeasurementsCache, setManualMeasurementsCache] = useState<Map<string, ManualMeasurementLine[]>>(new Map());
  
  // Cache de mesures per element (per evitar recalcular constantment)
  const [measurementsCache, setMeasurementsCache] = useState<Map<string, ElementMeasurement[]>>(new Map());
  
  // Tracking de sub-subcapítols amb plantilla conjunta
  const [subsubchaptersWithTemplate, setSubsubchaptersWithTemplate] = useState<Set<string>>(new Set());
  
  // Estat de selecció per batch (per sub-subcapítol)
  const [batchSelections, setBatchSelections] = useState<Record<string, Set<string>>>({});

  // Funcions per gestionar la selecció batch
  const getBatchSelection = useCallback((subsubchapterCode: string): Set<string> => {
    return batchSelections[subsubchapterCode] || new Set();
  }, [batchSelections]);

  const handleBatchSelectionChange = useCallback((subsubchapterCode: string, selectedIds: Set<string>) => {
    setBatchSelections(prev => ({
      ...prev,
      [subsubchapterCode]: selectedIds
    }));
  }, []);

  const toggleBatchSelection = useCallback((subsubchapterCode: string, elementId: string) => {
    setBatchSelections(prev => {
      const currentSet = prev[subsubchapterCode] || new Set();
      const newSet = new Set(currentSet);
      if (newSet.has(elementId)) {
        newSet.delete(elementId);
      } else {
        newSet.add(elementId);
      }
      return {
        ...prev,
        [subsubchapterCode]: newSet
      };
    });
  }, []);

  // Filter chapters that are not hidden
  const visibleChapters = useMemo(() => {
    return BUDGET_CHAPTERS.filter(chapter => !isHidden(chapter.code));
  }, [isHidden]);
  const [suppliersModalOpen, setSuppliersModalOpen] = useState(false);
  const [selectedSupplierConfig, setSelectedSupplierConfig] = useState<{
    chapterCode: string;
    chapterName: string;
    subchapterCode: string;
    subchapterName: string;
    subsubchapterCode: string;
    subsubchapterName: string;
    specialistCategory: string;
    elementCount: number;
  } | null>(null);
  const [assignedItems, setAssignedItems] = useState<Set<string>>(new Set());
  const [assignedSuppliers, setAssignedSuppliers] = useState<Set<string>>(new Set());
  const [suppliersListModalOpen, setSuppliersListModalOpen] = useState(false);
  const [assignedSuppliersDetails, setAssignedSuppliersDetails] = useState<Array<{ id: string; name: string; nif: string }>>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  
  // Hook per gestionar crèdits d'usuari
  const { credits, canGenerateAIDescription, deductCreditsForAI, config: creditsConfig, shouldSkipCredits } = useUserCredits();
  const creditCostPerItem = creditsConfig?.creditsPerAiDescription || 0.5;
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] = useState(false);
  const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  const [pendingAIElement, setPendingAIElement] = useState<ElementConfig | null>(null);
  
  // Estat per al modal de detalls de partida
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedElementForDetails, setSelectedElementForDetails] = useState<ElementConfig | null>(null);
  const [generatingAIForElement, setGeneratingAIForElement] = useState<string | null>(null);
  
  // Handler per obrir el modal de detalls
  const handleOpenDetails = useCallback((element: ElementConfig) => {
    setSelectedElementForDetails(element);
    setDetailsModalOpen(true);
  }, []);
  
  // Handler per generar descripció amb IA (amb confirmació)
  const handleGenerateAI = useCallback((element: ElementConfig) => {
    // Si és usuari demo sense lògica de crèdits, executar directament
    if (shouldSkipCredits) {
      executeAIForElement(element);
      return;
    }
    
    // 0. Verificar crèdits disponibles
    if (!canGenerateAIDescription()) {
      setShowInsufficientCreditsModal(true);
      return;
    }
    
    // Comprovar si el modal de confirmació està desactivat
    if (getCreditConfirmationDisabled("ai_budget_description")) {
      executeAIForElement(element);
    } else {
      setPendingAIElement(element);
      setShowCreditConfirmation(true);
    }
  }, [canGenerateAIDescription, shouldSkipCredits, language]);

  // Funció per executar la generació IA
  const executeAIForElement = useCallback(async (element: ElementConfig) => {
    setGeneratingAIForElement(element.id);
    
    try {
      // 1. Descomptar crèdits ABANS de cridar l'edge function
      const creditsDeducted = await deductCreditsForAI(element.id, centerId);
      if (!creditsDeducted) {
        setGeneratingAIForElement(null);
        return;
      }
      
      // 2. Obtenir la plantilla JSON activa
      const { data: templateData, error: templateError } = await supabase
        .from("budget_description_templates")
        .select("template_json")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      if (templateError) throw templateError;
      
      if (!templateData) {
        toast.error("No hi ha cap plantilla activa configurada");
        setGeneratingAIForElement(null);
        return;
      }
      
      // 3. Preparar el context
      const budgetCode = element.chapter_id && element.subchapter_id && element.subsubchapter_id
        ? `${element.chapter_id}.${element.subchapter_id}.${element.subsubchapter_id}`
        : "";
      
      // Obtenir nom de l'estructura pressupostària
      let budgetStructureName = "";
      if (budgetCode) {
        const chapter = BUDGET_CHAPTERS.find(c => c.code === element.chapter_id);
        if (chapter) {
          budgetStructureName = chapter.name;
          const subchapter = chapter.subchapters?.find(s => s.code === element.subchapter_id);
          if (subchapter) {
            budgetStructureName += ` > ${subchapter.name}`;
            const subsubchapter = subchapter.subsubchapters?.find(ss => ss.code === element.subsubchapter_id);
            if (subsubchapter) {
              budgetStructureName += ` > ${subsubchapter.name}`;
            }
          }
        }
      }
      
      // Obtenir categoria industrial
      const industrialCategory = budgetCode ? getSpecialistCategoryForBudgetCode(budgetCode) : null;
      
      // 4. Cridar l'edge function (incloent descripció existent com a prompt/context)
      const { data, error } = await supabase.functions.invoke("generate-budget-description", {
        body: {
          templateJson: templateData.template_json,
          shortDescription: element.custom_name || element.type_name,
          unit: element.preferred_unit,
          budgetCode,
          budgetStructureName,
          industrialCategory: industrialCategory || undefined,
          existingDescription: element.description || undefined,
          language
        }
      });
      
      if (error) throw error;
      
      if (!data?.description) {
        throw new Error(language === "ca" ? "No s'ha pogut generar la descripció" : "No se ha podido generar la descripción");
      }
      
      // 5. Actualitzar la descripció a la base de dades
      const { error: updateError } = await supabase
        .from("element_type_configs")
        .update({ description: data.description })
        .eq("id", element.id);
      
      if (updateError) throw updateError;
      
      // 6. Actualitzar l'estat local
      setElementConfigs(prev => 
        prev.map(e => e.id === element.id ? { ...e, description: data.description } : e)
      );
      
      toast.success(language === "ca" ? "Descripció generada correctament" : "Descripción generada correctamente");
    } catch (error: any) {
      console.error("Error generating AI description:", error);
      toast.error(error.message || (language === "ca" ? "Error generant la descripció" : "Error generando la descripción"));
    } finally {
      setGeneratingAIForElement(null);
    }
  }, [deductCreditsForAI, centerId, language]);
  
  // Funció per obtenir mesures d'un element (amb cache)
  const getMeasurementsForElement = useCallback((element: ElementConfig): ElementMeasurement[] => {
    if (element.is_manual || !viewer) return [];
    
    const cacheKey = `${element.ifc_category}|${element.type_name}|${element.preferred_unit}`;
    
    if (measurementsCache.has(cacheKey)) {
      return measurementsCache.get(cacheKey) || [];
    }
    
    const measurements = getElementMeasurementsForType(
      viewer, 
      element.ifc_category, 
      element.type_name,
      element.preferred_unit
    );
    
    setMeasurementsCache(prev => new Map(prev).set(cacheKey, measurements));
    return measurements;
  }, [viewer, measurementsCache]);
  
  // Netejar cache quan canvia el viewer o es recarreguen configs
  useEffect(() => {
    setMeasurementsCache(new Map());
  }, [viewer, refreshTrigger]);

  // Carregar línies de mesurament per TOTS els element configs (no només manuals)
  const loadManualMeasurementLines = useCallback(async () => {
    if (!elementConfigs.length) return;
    
    // Carregar línies per TOTS els elements, no només els manuals
    const allElementIds = elementConfigs.map(e => e.id);
    if (!allElementIds.length) return;
    
    try {
      const { data, error } = await supabase
        .from("manual_measurement_lines")
        .select("*")
        .in("element_type_config_id", allElementIds)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      
      // Agrupar per element_type_config_id
      const grouped = new Map<string, ManualMeasurementLine[]>();
      (data || []).forEach((line: any) => {
        const key = line.element_type_config_id;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(line);
      });
      
      setManualMeasurementsCache(grouped);
    } catch (error) {
      console.error("Error loading manual measurement lines:", error);
    }
  }, [elementConfigs]);
  
  useEffect(() => {
    loadManualMeasurementLines();
  }, [elementConfigs]);
  
  // Funció per obtenir línies de mesurament manuals d'un element
  const getManualMeasurementsForElement = useCallback((elementId: string): ManualMeasurementLine[] => {
    return manualMeasurementsCache.get(elementId) || [];
  }, [manualMeasurementsCache]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Funció per comptar els tipus únics d'elements del model IFC
  const countUniqueElementTypes = useCallback(() => {
    if (!viewer) {
      console.log('[countUniqueElementTypes] No viewer available');
      return 0;
    }
    
    // Primer intentar obtenir metaObjects directament del metaScene
    const metaScene = viewer?.metaScene;
    let metaObjects = metaScene?.metaObjects;
    
    // Si no hi ha metaObjects al metaScene, provar des de metaModels
    if (!metaObjects || Object.keys(metaObjects).length === 0) {
      const metaModels: any = metaScene?.metaModels;
      if (!metaModels) {
        console.log('[countUniqueElementTypes] No metaModels available');
        return 0;
      }
      
      const ids = Object.keys(metaModels);
      if (ids.length === 0) {
        console.log('[countUniqueElementTypes] No metaModel ids');
        return 0;
      }
      
      const mm = metaModels[ids[0]];
      metaObjects = mm?.metaObjects;
    }
    
    if (!metaObjects) {
      console.log('[countUniqueElementTypes] No metaObjects found');
      return 0;
    }
    
    // Excloure elements de tipus contenidor
    const excludedTypes = new Set([
      'IfcProject', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey', 'IfcSpace',
      'IfcRelAggregates', 'IfcRelContainedInSpatialStructure', 'IfcRelDefinesByProperties',
      'IfcRelDefinesByType', 'IfcRelAssociatesMaterial', 'IfcRelSpaceBoundary',
      'IfcRelConnectsPathElements', 'IfcRelVoidsElement', 'IfcRelFillsElement',
      'IfcOwnerHistory', 'IfcPropertySet', 'IfcMaterialLayerSetUsage'
    ]);
    
    // Comptar tipus únics (categoria IFC + typeName)
    const uniqueTypes = new Set<string>();
    const allObjectKeys = Object.keys(metaObjects);
    
    console.log(`[countUniqueElementTypes] Processing ${allObjectKeys.length} metaObjects`);
    
    for (const id of allObjectKeys) {
      const mo = metaObjects[id];
      if (!mo || !mo.type) continue;
      
      // Excloure tipus no constructius
      if (excludedTypes.has(mo.type)) continue;
      
      // Excloure tipus que comencen per IfcRel (relacions)
      if (mo.type.startsWith('IfcRel')) continue;
      
      const typeName = getNiceTypeName(mo);
      const uniqueKey = `${mo.type}|${typeName}`;
      uniqueTypes.add(uniqueKey);
    }
    
    console.log(`[countUniqueElementTypes] Found ${uniqueTypes.size} unique element types`);
    return uniqueTypes.size;
  }, [viewer]);
  
  // Guardar el total d'elements del model a la base de dades
  const updateTotalModelElements = useCallback(async () => {
    if (!centerId || !viewer) {
      console.log('[updateTotalModelElements] Missing centerId or viewer');
      return;
    }
    
    const totalElements = countUniqueElementTypes();
    console.log(`[updateTotalModelElements] Counted ${totalElements} elements for project ${centerId}${versionId ? `, version ${versionId}` : ''}`);
    
    if (totalElements === 0) {
      console.log('[updateTotalModelElements] No elements found, skipping update');
      return;
    }
    
    try {
      // Si tenim versionId, actualitzar project_versions
      if (versionId) {
        const { error } = await supabase
          .from("project_versions")
          .update({ total_model_elements: totalElements })
          .eq("id", versionId);
        
        if (error) {
          console.error("Error updating version total model elements:", error);
        } else {
          console.log(`[updateTotalModelElements] Updated version ${versionId} with ${totalElements} total element types`);
        }
      }
      
      // També actualitzar el projecte (per compatibilitat)
      const { error } = await supabase
        .from("projects")
        .update({ total_model_elements: totalElements })
        .eq("id", centerId);
      
      if (error) {
        console.error("Error updating total model elements:", error);
      } else {
        console.log(`[updateTotalModelElements] Updated project ${centerId} with ${totalElements} total element types`);
        toast.success(`Model analitzat: ${totalElements} tipus d'elements detectats`);
      }
    } catch (error) {
      console.error("Error updating total model elements:", error);
    }
  }, [centerId, viewer, countUniqueElementTypes, versionId]);

  useEffect(() => {
    if (open && centerId) {
      loadElementConfigs();
      loadUserId();
      loadAssignedItems();
      loadProjectData();
    }
  }, [open, centerId, refreshTrigger]);
  
  // Actualitzar el total d'elements quan s'obre el modal i el viewer està llest
  useEffect(() => {
    if (open && viewer && centerId) {
      // Donar més temps perquè el model es carregui completament
      const timer = setTimeout(() => {
        updateTotalModelElements();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [open, viewer, centerId, updateTotalModelElements]);

  const loadProjectData = async () => {
    try {
      const { data: project, error } = await supabase
        .from("projects")
        .select("name, address, city, province, postal_code, street, street_number, project_type, description, created_at")
        .eq("id", centerId)
        .maybeSingle();

      if (error) throw error;
      if (!project) return;

      // Get project type name if exists
      let projectTypeName = null;
      if (project?.project_type) {
        const { data: typeData } = await supabase
          .from("project_types")
          .select("name_ca")
          .eq("id", project.project_type)
          .maybeSingle();
        projectTypeName = typeData?.name_ca || null;
      }

      setProjectData({
        ...project,
        project_type_name: projectTypeName
      });
    } catch (error) {
      console.error("Error loading project data:", error);
    }
  };

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadAssignedItems = async () => {
    if (!centerId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("budget_supplier_valuations")
        .select("chapter_code, subchapter_code, subsubchapter_code, supplier_id")
        .eq("center_id", centerId)
        .eq("user_id", user.id);

      if (error) throw error;

      const assigned = new Set(
        data?.map(item => `${item.chapter_code}-${item.subchapter_code}-${item.subsubchapter_code}`) || []
      );
      setAssignedItems(assigned);

      // Comptar industrials únics (supplier_id diferents)
      const uniqueSupplierIds = new Set(
        data?.map(item => item.supplier_id).filter(Boolean) || []
      );
      setAssignedSuppliers(uniqueSupplierIds);

      // Obtenir detalls dels industrials
      if (uniqueSupplierIds.size > 0) {
        const { data: suppliersData, error: suppliersError } = await supabase
          .from("suppliers")
          .select("id, name, nif")
          .in("id", Array.from(uniqueSupplierIds));

        if (suppliersError) throw suppliersError;

        setAssignedSuppliersDetails(suppliersData || []);
      } else {
        setAssignedSuppliersDetails([]);
      }
    } catch (error) {
      console.error("Error loading assigned items:", error);
    }
  };

  // Obtenir el perfil de l'usuari per filtrar partides si és industrial
  const { userType, specialistCategories, isLoading: isLoadingProfile } = useUserProfile();

  const loadElementConfigs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("element_type_configs")
        .select("id, ifc_category, type_name, custom_name, chapter_id, subchapter_id, subsubchapter_id, preferred_unit, description, measured_value, display_order, is_manual")
        .or(`project_id.eq.${centerId},center_id.eq.${centerId}`)
        .not("chapter_id", "is", null);
      
      // Filtrar per version_id si existeix
      if (versionId) {
        query = query.eq("version_id", versionId);
      } else {
        query = query.is("version_id", null);
      }
      
      const { data, error } = await query.order('display_order', { ascending: true });

      if (error) {
        console.error("Error loading element configs:", error);
        return;
      }

      let filteredData = data || [];

      // Si l'usuari és industrial, filtrar només les partides de les seves categories
      if (userType === "specialist" && specialistCategories.length > 0) {
        console.log("Filtrament per a industrial amb categories:", specialistCategories);
        
        // Normalitzar les categories de l'especialista per comparació robusta
        const normalizedSpecialistCategories = specialistCategories.map(cat => cat.trim().toLowerCase());
        
        filteredData = filteredData.filter(config => {
          if (!config.subsubchapter_id) return false;
          
          const category = getSpecialistCategoryForBudgetCode(config.subsubchapter_id);
          
          if (!category) return false;
          
          // Normalitzar la categoria del mapping també
          const normalizedCategory = category.trim().toLowerCase();
          const matches = normalizedSpecialistCategories.includes(normalizedCategory);
          
          if (matches) {
            console.log(`Partida visible per industrial: ${config.subsubchapter_id} (${config.custom_name || config.type_name}) -> ${category}`);
          }
          
          return matches;
        });
        
        console.log(`Total partides visibles per industrial: ${filteredData.length}`);
      }

      setElementConfigs(filteredData);
    } catch (error) {
      console.error("Error loading element configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getElementsForSubsubchapter = (chapterCode: string, subchapterCode: string, subsubchapterCode: string) => {
    return elementConfigs.filter(
      (config) => config.chapter_id === chapterCode && config.subchapter_id === subchapterCode && config.subsubchapter_id === subsubchapterCode
    );
  };

  const getChapterElementCount = (chapterCode: string) => {
    return elementConfigs.filter((config) => config.chapter_id === chapterCode).length;
  };

  const getSubchapterElementCount = (chapterCode: string, subchapterCode: string) => {
    return elementConfigs.filter((config) => config.chapter_id === chapterCode && config.subchapter_id === subchapterCode).length;
  };

  const handleTutorial = () => {
    setTutorialOpen(true);
  };

  const handleOpenSuppliersModal = (
    chapterCode: string,
    chapterName: string,
    subchapterCode: string,
    subchapterName: string,
    subsubchapterCode: string,
    subsubchapterName: string,
    elementCount: number
  ) => {
    // Utilitzar el codi de sub-subcapítol (tercer nivell) per determinar la categoria
    const specialistCategory = getSpecialistCategoryForBudgetCode(subsubchapterCode);

    setSelectedSupplierConfig({
      chapterCode,
      chapterName,
      subchapterCode,
      subchapterName,
      subsubchapterCode,
      subsubchapterName,
      specialistCategory: specialistCategory || "",
      elementCount,
    });
    setSuppliersModalOpen(true);
  };

  const handleSuppliersModalClose = (open: boolean) => {
    setSuppliersModalOpen(open);
    if (!open) {
      loadAssignedItems();
    }
  };

  const isItemAssigned = (chapterCode: string, subchapterCode: string, subsubchapterCode: string): boolean => {
    return assignedItems.has(`${chapterCode}-${subchapterCode}-${subsubchapterCode}`);
  };

  const statistics = useMemo(() => {
    const allThirdLevelItems = Object.values(
      elementConfigs.reduce((acc, config) => {
        if (config.chapter_id && config.subchapter_id && config.subsubchapter_id) {
          const key = `${config.chapter_id}-${config.subchapter_id}-${config.subsubchapter_id}`;
          if (!acc[key]) {
            acc[key] = {
              key,
              chapterCode: config.chapter_id,
              subchapterCode: config.subchapter_id,
              subsubchapterCode: config.subsubchapter_id,
              elementCount: 0,
            };
          }
          acc[key].elementCount += 1;
        }
        return acc;
      }, {} as Record<string, any>)
    ).filter(item => item.elementCount > 0);

    const totalItems = allThirdLevelItems.length;
    const assignedItemsCount = allThirdLevelItems.filter(item => 
      isItemAssigned(item.chapterCode, item.subchapterCode, item.subsubchapterCode)
    ).length;
    const unassignedItems = totalItems - assignedItemsCount;

    // Comptar industrials únics assignats (empreses diferents)
    const uniqueSpecialistsCount = assignedSuppliers.size;

    const progress = totalItems > 0 ? (assignedItemsCount / totalItems) * 100 : 0;

    // Calculate IFC vs Manual items
    const totalElements = elementConfigs.length;
    const ifcElements = elementConfigs.filter(config => !config.is_manual).length;
    const manualElements = elementConfigs.filter(config => config.is_manual).length;
    const ifcPercentage = totalElements > 0 ? (ifcElements / totalElements) * 100 : 0;

    return {
      totalItems,
      assignedItemsCount,
      unassignedItems,
      uniqueSpecialistsCount,
      progress,
      ifcPercentage,
      ifcElements,
      manualElements,
      totalElements,
    };
  }, [elementConfigs, assignedItems, assignedSuppliers]);

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
    // Inicialitzar amb una línia de mesurament buida
    setMeasurementLines([{ comment: "", quantity: "" }]);
    setCreateDialogOpen(true);
  };

  const addMeasurementLine = () => {
    setMeasurementLines([...measurementLines, { comment: "", quantity: "" }]);
  };

  const removeMeasurementLine = (index: number) => {
    if (measurementLines.length <= 1) return; // Mantenir com a mínim una línia
    setMeasurementLines(measurementLines.filter((_, i) => i !== index));
  };

  const updateMeasurementLine = (index: number, field: 'comment' | 'quantity', value: string) => {
    setMeasurementLines(measurementLines.map((line, i) => 
      i === index ? { ...line, [field]: value } : line
    ));
  };

  // Funcions per editar línies de mesurament
  const addEditMeasurementLine = () => {
    setEditMeasurementLines([...editMeasurementLines, { comment: "", quantity: "" }]);
  };

  const removeEditMeasurementLine = (index: number) => {
    if (editMeasurementLines.length <= 1) return;
    setEditMeasurementLines(editMeasurementLines.filter((_, i) => i !== index));
  };

  const updateEditMeasurementLine = (index: number, field: 'comment' | 'quantity', value: string) => {
    setEditMeasurementLines(editMeasurementLines.map((line, i) => 
      i === index ? { ...line, [field]: value } : line
    ));
  };

  const handleSavePartida = async () => {
    if (!selectedChapter || !selectedSubchapter || !selectedSubsubchapter || !newPartida.customName) {
      toast.error("Cal omplir com a mínim el nom de la partida");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No s'ha pogut identificar l'usuari");
        return;
      }

      const elements = getElementsForSubsubchapter(selectedChapter, selectedSubchapter, selectedSubsubchapter);
      const maxOrder = elements.length > 0 ? Math.max(...elements.map(e => e.display_order)) : -1;

      // Calcular el total de les línies de mesurament
      const totalQuantity = measurementLines.reduce((sum, line) => sum + (parseFloat(line.quantity) || 0), 0);

      const insertData: any = {
        project_id: centerId,
        user_id: user.id,
        ifc_category: "MANUAL",
        type_name: newPartida.customName,
        custom_name: newPartida.customName,
        chapter_id: selectedChapter,
        subchapter_id: selectedSubchapter,
        subsubchapter_id: selectedSubsubchapter,
        preferred_unit: newPartida.preferredUnit,
        description: newPartida.description || null,
        measured_value: totalQuantity,
        display_order: maxOrder + 1,
        is_manual: true,
      };
      
      // Afegir version_id si existeix
      if (versionId) {
        insertData.version_id = versionId;
      }

      const { data: newElement, error } = await supabase
        .from("element_type_configs")
        .insert(insertData)
        .select("id")
        .single();

      if (error || !newElement) {
        console.error("Error creating manual partida:", error);
        toast.error("Error al crear la partida manual");
        return;
      }

      // Inserir les línies de mesurament
      const linesToInsert = measurementLines
        .filter(line => line.quantity && parseFloat(line.quantity) !== 0)
        .map((line, index) => ({
          element_type_config_id: newElement.id,
          user_id: user.id,
          comment: line.comment || null,
          quantity: parseFloat(line.quantity) || 0,
          display_order: index,
        }));

      if (linesToInsert.length > 0) {
        const { error: linesError } = await supabase
          .from("manual_measurement_lines")
          .insert(linesToInsert);

        if (linesError) {
          console.error("Error inserting measurement lines:", linesError);
          // Continuar igualment, la partida ja s'ha creat
        }
      }

      toast.success("Partida manual creada correctament");
      setCreateDialogOpen(false);
      setMeasurementLines([{ comment: "", quantity: "" }]);
      await loadElementConfigs();
    } catch (error) {
      console.error("Error creating manual partida:", error);
      toast.error("Error al crear la partida manual");
    }
  };

  const handleEditPartida = async (element: ElementConfig) => {
    setEditingElement(element);
    setNewPartida({
      customName: element.custom_name || element.type_name,
      description: element.description || "",
      measuredValue: String(element.measured_value || 0),
      preferredUnit: element.preferred_unit,
    });
    
    // Carregar línies de mesurament existents per partides manuals
    if (element.is_manual) {
      const existingLines = getManualMeasurementsForElement(element.id);
      if (existingLines.length > 0) {
        setEditMeasurementLines(existingLines.map(line => ({
          id: line.id,
          comment: line.comment || "",
          quantity: String(line.quantity),
        })));
      } else {
        setEditMeasurementLines([{ comment: "", quantity: String(element.measured_value || 0) }]);
      }
    } else {
      setEditMeasurementLines([]);
    }
    setEditDialogOpen(true);
  };

  const handleUpdatePartida = async () => {
    if (!editingElement || !newPartida.customName) {
      toast.error("Cal omplir com a mínim el nom de la partida");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No s'ha pogut identificar l'usuari");
        return;
      }

      // Calcular total si és manual amb línies
      let totalQuantity = parseFloat(newPartida.measuredValue) || 0;
      if (editingElement.is_manual && editMeasurementLines.length > 0) {
        totalQuantity = editMeasurementLines.reduce((sum, line) => sum + (parseFloat(line.quantity) || 0), 0);
      }

      const { error } = await supabase
        .from("element_type_configs")
        .update({
          custom_name: newPartida.customName,
          type_name: newPartida.customName,
          description: newPartida.description || null,
          measured_value: totalQuantity,
          preferred_unit: newPartida.preferredUnit,
        })
        .eq("id", editingElement.id);

      if (error) {
        console.error("Error updating manual partida:", error);
        toast.error("Error al actualitzar la partida manual");
        return;
      }

      // Actualitzar línies de mesurament si és manual
      if (editingElement.is_manual) {
        // Eliminar totes les línies existents
        await supabase
          .from("manual_measurement_lines")
          .delete()
          .eq("element_type_config_id", editingElement.id);

        // Inserir les noves línies
        const linesToInsert = editMeasurementLines
          .filter(line => line.quantity && parseFloat(line.quantity) !== 0)
          .map((line, index) => ({
            element_type_config_id: editingElement.id,
            user_id: user.id,
            comment: line.comment || null,
            quantity: parseFloat(line.quantity) || 0,
            display_order: index,
          }));

        if (linesToInsert.length > 0) {
          await supabase.from("manual_measurement_lines").insert(linesToInsert);
        }
      }

      toast.success("Partida actualitzada correctament");
      setEditDialogOpen(false);
      setEditingElement(null);
      setEditMeasurementLines([]);
      await loadElementConfigs();
    } catch (error) {
      console.error("Error updating manual partida:", error);
      toast.error("Error al actualitzar la partida manual");
    }
  };

  const handleDeletePartida = async (element: ElementConfig) => {
    if (!confirm("Estàs segur que vols eliminar aquesta partida manual?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("element_type_configs")
        .delete()
        .eq("id", element.id);

      if (error) {
        console.error("Error deleting manual partida:", error);
        toast.error("Error al eliminar la partida manual");
        return;
      }

      toast.success("Partida manual eliminada correctament");
      await loadElementConfigs();
    } catch (error) {
      console.error("Error deleting manual partida:", error);
      toast.error("Error al eliminar la partida manual");
    }
  };

  const handleDragEnd = async (event: DragEndEvent, chapterCode: string, subchapterCode: string, subsubchapterCode: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const elements = getElementsForSubsubchapter(chapterCode, subchapterCode, subsubchapterCode);
    const oldIndex = elements.findIndex((el) => el.id === active.id);
    const newIndex = elements.findIndex((el) => el.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newElements = arrayMove(elements, oldIndex, newIndex);

    // Actualitzar l'estat local immediatament
    setElementConfigs((prevConfigs) => {
      const otherConfigs = prevConfigs.filter(
        (config) => !(config.chapter_id === chapterCode && config.subchapter_id === subchapterCode && config.subsubchapter_id === subsubchapterCode)
      );
      return [...otherConfigs, ...newElements];
    });

    // Guardar el nou ordre a la base de dades
    try {
      const updates = newElements.map((element, index) => ({
        id: element.id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("element_type_configs")
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }

      toast.success("Ordre actualitzat correctament");
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Error al actualitzar l'ordre");
      await loadElementConfigs();
    }
  };

  // ===== FUNCIÓ EXPORTAR PDF TÈCNIC =====
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Colors corporatius
    const primaryColor: [number, number, number] = [41, 98, 255];
    const secondaryColor: [number, number, number] = [99, 102, 241];
    const darkText: [number, number, number] = [31, 41, 55];
    const lightBg: [number, number, number] = [248, 250, 252];
    const accentGreen: [number, number, number] = [16, 185, 129];
    
    // ===== CALCULAR ESTADÍSTIQUES REALS DEL PRESSUPOST =====
    let realChapterCount = 0;
    let realSubchapterCount = 0;
    let realSubsubchapterCount = 0;
    let realPartidaCount = elementConfigs.length;
    
    // Estructura per mantenir numeració
    const chapterNumbers: Record<string, number> = {};
    const subchapterNumbers: Record<string, number> = {};
    const subsubchapterNumbers: Record<string, number> = {};
    
    let chapIdx = 0;
    for (const chapter of visibleChapters) {
      const chapterElements = elementConfigs.filter(c => c.chapter_id === chapter.code);
      if (chapterElements.length === 0) continue;
      
      chapIdx++;
      chapterNumbers[chapter.code] = chapIdx;
      realChapterCount++;
      
      let subIdx = 0;
      const visibleSubchapters = chapter.subchapters.filter(sub => !isHidden(sub.code));
      for (const subchapter of visibleSubchapters) {
        const subElements = elementConfigs.filter(c => c.chapter_id === chapter.code && c.subchapter_id === subchapter.code);
        if (subElements.length === 0) continue;
        
        subIdx++;
        subchapterNumbers[`${chapter.code}-${subchapter.code}`] = subIdx;
        realSubchapterCount++;
        
        let subsubIdx = 0;
        const visibleSubsubchapters = subchapter.subsubchapters.filter(subsub => !isHidden(subsub.code));
        for (const subsubchapter of visibleSubsubchapters) {
          const items = getElementsForSubsubchapter(chapter.code, subchapter.code, subsubchapter.code);
          if (items.length === 0) continue;
          
          subsubIdx++;
          subsubchapterNumbers[`${chapter.code}-${subchapter.code}-${subsubchapter.code}`] = subsubIdx;
          realSubsubchapterCount++;
        }
      }
    }
    
    // ===== CAPÇALERA ELEGANT =====
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFillColor(...secondaryColor);
    doc.rect(0, 37, pageWidth, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text("ESTAT D'AMIDAMENTS", margin, 16);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Document tècnic de mesuraments BIM', margin, 24);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.text(dateStr, pageWidth - margin, 16, { align: 'right' });
    
    // Nom del projecte a la capçalera
    if (projectData?.name) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(projectData.name, pageWidth - margin, 24, { align: 'right' });
    }
    
    // ===== SECCIÓ DADES DEL PROJECTE =====
    let yPos = 50;
    
    if (projectData) {
      // Calcular altura dinàmica segons la descripció
      const description = projectData.description || '';
      doc.setFontSize(8);
      const maxDescWidth = contentWidth - 16;
      const descLines = doc.splitTextToSize(description, maxDescWidth);
      const descLineCount = Math.min(descLines.length, 4); // Màxim 4 línies
      
      // Altura base + línies de descripció
      const baseHeight = 28;
      const descHeight = descLineCount > 0 ? 6 + (descLineCount * 4) : 0;
      const boxHeight = baseHeight + descHeight;
      
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 3, 3, 'F');
      
      doc.setFillColor(...primaryColor);
      doc.rect(margin, yPos, 3, boxHeight, 'F');
      
      doc.setTextColor(...darkText);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('DADES DEL PROJECTE', margin + 8, yPos + 7);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      
      // Columna esquerra
      doc.setFont(undefined, 'bold');
      doc.text('Nom:', margin + 8, yPos + 14);
      doc.setFont(undefined, 'normal');
      doc.text(projectData.name || '—', margin + 22, yPos + 14);
      
      doc.setFont(undefined, 'bold');
      doc.text('Adreça:', margin + 8, yPos + 20);
      doc.setFont(undefined, 'normal');
      const fullAddress = [
        projectData.street,
        projectData.street_number,
        projectData.postal_code,
        projectData.city
      ].filter(Boolean).join(', ') || projectData.address || '—';
      doc.text(fullAddress.substring(0, 60), margin + 26, yPos + 20);
      
      // Columna dreta
      doc.setFont(undefined, 'bold');
      doc.text('Tipologia:', margin + 100, yPos + 14);
      doc.setFont(undefined, 'normal');
      doc.text(projectData.project_type_name || '—', margin + 120, yPos + 14);
      
      // Descripció completa amb text wrapping
      if (description.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.text('Descripció:', margin + 8, yPos + 26);
        
        // Primera línia (descripció curta) - normal
        doc.setFont(undefined, 'normal');
        if (descLines.length > 0) {
          doc.text(descLines[0], margin + 32, yPos + 26);
        }
        
        // Línies addicionals (descripció llarga) - font més petit
        if (descLines.length > 1) {
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          for (let i = 1; i < Math.min(descLines.length, 4); i++) {
            doc.text(descLines[i], margin + 8, yPos + 26 + (i * 4));
          }
          doc.setTextColor(...darkText);
        }
      }
      
      yPos += boxHeight + 8;
    }
    
    // ===== SECCIÓ DE RESUM ESTADÍSTIC =====
    // Calcular percentatge IFC
    const ifcPartides = elementConfigs.filter(c => !c.is_manual).length;
    const ifcPercentage = realPartidaCount > 0 ? ((ifcPartides / realPartidaCount) * 100).toFixed(1) : '0';
    
    doc.setFillColor(...lightBg);
    doc.roundedRect(margin, yPos, contentWidth, 24, 3, 3, 'F');
    
    doc.setFillColor(...accentGreen);
    doc.rect(margin, yPos, 3, 24, 'F');
    
    doc.setTextColor(...darkText);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('RESUM DE L\'ESTRUCTURA', margin + 8, yPos + 8);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    
    // Primera fila: estructura jeràrquica
    doc.setFont(undefined, 'bold');
    doc.text('Capítols (1r nivell):', margin + 8, yPos + 16);
    doc.setFont(undefined, 'normal');
    doc.text(realChapterCount.toString(), margin + 45, yPos + 16);
    
    doc.setFont(undefined, 'bold');
    doc.text('Subcapítols (2n nivell):', margin + 55, yPos + 16);
    doc.setFont(undefined, 'normal');
    doc.text(realSubchapterCount.toString(), margin + 100, yPos + 16);
    
    doc.setFont(undefined, 'bold');
    doc.text('Sub-subcapítols (3r nivell):', margin + 110, yPos + 16);
    doc.setFont(undefined, 'normal');
    doc.text(realSubsubchapterCount.toString(), margin + 163, yPos + 16);
    
    // Segona fila: partides i percentatge IFC
    doc.setFont(undefined, 'bold');
    doc.text('Partides (4t nivell):', margin + 8, yPos + 22);
    doc.setFont(undefined, 'normal');
    doc.text(realPartidaCount.toString(), margin + 45, yPos + 22);
    
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`Mesurament IFC: ${ifcPercentage}%`, margin + 70, yPos + 22);
    doc.setTextColor(100, 116, 139);
    doc.setFont(undefined, 'normal');
    doc.text(`(${ifcPartides} de ${realPartidaCount} partides)`, margin + 115, yPos + 22);
    
    yPos += 32;
    
    // ===== ITERACIÓ PER CAPÍTOLS =====
    doc.setTextColor(...darkText);
    
    for (const chapter of visibleChapters) {
      const chapterElements = elementConfigs.filter(c => c.chapter_id === chapter.code);
      if (chapterElements.length === 0) continue;
      
      const chapNum = chapterNumbers[chapter.code];
      const chapCode = chapNum.toString().padStart(2, '0');
      
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }
      
      // === CAPÇALERA DE CAPÍTOL ===
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      
      const chapName = getTranslatedName(chapter.code, chapter.name);
      doc.text(`${chapCode}. ${chapName}`, margin + 4, yPos + 7);
      
      doc.setFontSize(8);
      doc.text(`${chapterElements.length} partides`, pageWidth - margin - 4, yPos + 7, { align: 'right' });
      
      yPos += 14;
      
      // === SUBCAPÍTOLS ===
      const visibleSubchapters = chapter.subchapters.filter(sub => !isHidden(sub.code));
      
      for (const subchapter of visibleSubchapters) {
        const subElements = elementConfigs.filter(c => c.chapter_id === chapter.code && c.subchapter_id === subchapter.code);
        if (subElements.length === 0) continue;
        
        const subNum = subchapterNumbers[`${chapter.code}-${subchapter.code}`];
        const subCode = `${chapCode}.${subNum.toString().padStart(2, '0')}`;
        
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        
        doc.setTextColor(...secondaryColor);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        
        const subName = getTranslatedName(subchapter.code, subchapter.name);
        doc.text(`${subCode} ${subName}`, margin + 4, yPos + 5.5);
        
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(7);
        doc.text(`${subElements.length} partides`, pageWidth - margin - 4, yPos + 5.5, { align: 'right' });
        
        yPos += 10;
        
        // === SUB-SUBCAPÍTOLS I PARTIDES ===
        const visibleSubsubchapters = subchapter.subsubchapters.filter(subsub => !isHidden(subsub.code));
        
        for (const subsubchapter of visibleSubsubchapters) {
          const items = getElementsForSubsubchapter(chapter.code, subchapter.code, subsubchapter.code);
          if (items.length === 0) continue;
          
          const subsubNum = subsubchapterNumbers[`${chapter.code}-${subchapter.code}-${subsubchapter.code}`];
          const subsubCode = `${subCode}.${subsubNum.toString().padStart(2, '0')}`;
          
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 20;
          }
          
          // Nom del sub-subcapítol amb codi
          doc.setTextColor(71, 85, 105);
          doc.setFontSize(8);
          doc.setFont(undefined, 'bold');
          const subsubName = getTranslatedName(subsubchapter.code, subsubchapter.name);
          doc.text(`${subsubCode} › ${subsubName}`, margin + 6, yPos);
          
          // Quantitat de partides
          doc.setFont(undefined, 'normal');
          doc.setFontSize(7);
          doc.setTextColor(107, 114, 128);
          doc.text(`(${items.length} partides)`, pageWidth - margin - 4, yPos, { align: 'right' });
          
          yPos += 4;
          
          // Taula de partides amb codi complet de 4 nivells i descripció llarga
          // Preparar dades amb estructura per descripcions + línies de mesura
          const tableBody: any[][] = [];
          
          items.forEach((item, idx) => {
            const partidaNum = (idx + 1).toString().padStart(2, '0');
            const fullItemCode = `${subsubCode}.${partidaNum}`;
            const displayValue = item.measured_value || 0;
            const formattedValue = Number(displayValue).toLocaleString('ca-ES', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            });
            
            const shortName = item.custom_name || item.type_name;
            const longDesc = item.description || '';
            
            // Fila principal amb descripció curta
            tableBody.push([
              fullItemCode,
              shortName,
              item.preferred_unit,
              formattedValue,
              item.is_manual ? 'Manual' : 'IFC'
            ]);
            
            // Fila addicional per descripció llarga (si existeix)
            if (longDesc) {
              tableBody.push([
                { content: '', styles: { fillColor: [255, 255, 255] } },
                { content: longDesc, colSpan: 4, styles: { fontSize: 6, textColor: [100, 116, 139], fontStyle: 'italic', fillColor: [255, 255, 255] } }
              ]);
            }
            
            // AFEGIR LÍNIES DE MESURA (descomposats) per partides IFC
            if (!item.is_manual && viewer) {
              const elementMeasurements = getElementMeasurementsForType(
                viewer,
                item.ifc_category,
                item.type_name,
                item.preferred_unit
              );
              
              if (elementMeasurements.length > 0) {
                // Capçalera de les línies de mesura
                tableBody.push([
                  { content: '', styles: { fillColor: [245, 247, 250] } },
                  { 
                    content: `    Línies de mesura (${elementMeasurements.length} elements):`, 
                    colSpan: 4, 
                    styles: { 
                      fontSize: 6, 
                      textColor: [71, 85, 105], 
                      fontStyle: 'bold', 
                      fillColor: [245, 247, 250]
                    } 
                  }
                ]);
                
                // Cada línia de mesura
                elementMeasurements.forEach((m, mIdx) => {
                  const measureValue = Number(m.value).toLocaleString('ca-ES', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  });
                  
                  // Dimensions si disponibles
                  const dimensions = m.aabbDimensions 
                    ? `(${m.aabbDimensions.dx.toFixed(2)}×${m.aabbDimensions.dy.toFixed(2)}×${m.aabbDimensions.dz.toFixed(2)}m)`
                    : '';
                  
                  // Comentaris si disponibles
                  const comment = m.comentarios || '';
                  
                  // Element name (simplificat)
                  const elementName = m.name.includes(':') 
                    ? m.name.split(':').pop() || m.name 
                    : m.name;
                  
                  tableBody.push([
                    { content: '', styles: { fillColor: [250, 251, 252] } },
                    { 
                      content: `    ${mIdx + 1}. ${elementName} ${dimensions}`, 
                      styles: { 
                        fontSize: 6, 
                        textColor: [100, 116, 139],
                        fillColor: [250, 251, 252]
                      } 
                    },
                    { 
                      content: comment, 
                      styles: { 
                        fontSize: 6, 
                        textColor: [100, 116, 139],
                        fillColor: [250, 251, 252]
                      } 
                    },
                    { 
                      content: measureValue, 
                      styles: { 
                        fontSize: 6, 
                        textColor: [100, 116, 139], 
                        halign: 'right',
                        fillColor: [250, 251, 252]
                      } 
                    },
                    { content: '', styles: { fillColor: [250, 251, 252] } }
                  ]);
                });
              }
            }
          });
          
          autoTable(doc, {
            startY: yPos,
            head: [['Codi', 'Descripció', 'Ut.', 'Quantitat', 'Origen']],
            body: tableBody,
            theme: 'plain',
            styles: { 
              fontSize: 7,
              cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
              textColor: darkText,
              lineColor: [226, 232, 240],
              lineWidth: 0.1
            },
            headStyles: {
              fillColor: [226, 232, 240],
              textColor: [71, 85, 105],
              fontStyle: 'bold',
              fontSize: 7
            },
            columnStyles: {
              0: { cellWidth: 28, halign: 'left', fontStyle: 'bold' },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 12, halign: 'center' },
              3: { cellWidth: 22, halign: 'right' },
              4: { cellWidth: 16, halign: 'center' }
            },
            margin: { left: margin, right: margin },
            alternateRowStyles: {
              fillColor: [250, 251, 252]
            }
          });
          
          yPos = (doc as any).lastAutoTable.finalY + 5;
        }
      }
      
      yPos += 4;
    }
    
    // ===== PEU DE PÀGINA =====
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      
      doc.text('Document generat automàticament des del visor BIM', margin, pageHeight - 10);
      doc.text(`Pàgina ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }
    
    // Nom del fitxer amb nom del projecte
    const fileName = projectData?.name 
      ? `Estat_Amidaments_${projectData.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      : 'Estat_Amidaments.pdf';
    doc.save(fileName);
    toast.success("PDF generat correctament");
  };

  // ===== FUNCIÓ EXPORTAR BC3 (FIEBDC-3/2020) =====
  const handleExportBC3 = () => {
    // Escapar text per BC3 (sense |, ~, \, salts de línia)
    const bc3Escape = (s: string): string => {
      return String(s || "")
        .replace(/\|/g, " ")
        .replace(/~/g, " ")
        .replace(/\\/g, " ")
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .trim();
    };

    // Convertir string a Windows-1252 (ISO-8859-1 compatible)
    const toWindows1252 = (str: string): ArrayBuffer => {
      const buffer = new ArrayBuffer(str.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        // Mapeig de caràcters especials catalans a Windows-1252
        if (char <= 0xFF) {
          view[i] = char;
        } else {
          // Fallback per caràcters fora del rang
          view[i] = 0x3F; // '?'
        }
      }
      return buffer;
    };

    // Descarregar blob amb codificació Windows-1252
    const downloadBlob = (data: string, filename: string) => {
      const buffer = toWindows1252(data);
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // Format data DDMMAAAA
    const formatDate = (d: Date): string => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      return `${dd}${mm}${yyyy}`;
    };

    // Nom de fitxer segur (màx 28 chars + .bc3 = 32)
    const safeFileName = (s: string): string => {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 28);
    };

    const now = new Date();
    const dateStr = formatDate(now);
    const projectNameEscaped = bc3Escape(projectData?.name || "Projecte");

    // ===== CONSTRUCCIÓ DEL BC3 =====
    let out = "";

    // 1. REGISTRE ~V (Versió i propietats)
    // Format: ~V|PROPIETAT|VERSION\DATA|PROGRAMA|CABECERA\ROTULO|JUEGOCAR|COMENTARI|TIPUS|
    out += `~V|BIMCONTROL|FIEBDC-3/2020\\${dateStr}|BIMCONTROL 1.0|${projectNameEscaped}\\P1|ANSI|Pressupost generat des de BIM|2|\r\n`;

    // 2. REGISTRE ~K (Coeficients i moneda)
    // Format: ~K|CI\GG\DIVISA\DC1\DC2\DC3\DC4\DC5\DC6\DC7\DC8\|
    // CI=2 decimals, GG=13% gastos, DIVISA=EUR, DC=decimals per magnituds
    out += `~K|2\\13\\EUR\\2\\2\\2\\2\\2\\3\\2\\3\\|\r\n`;

    // Arrays per emmagatzemar registres
    const conceptRecords: string[] = [];  // ~C
    const textRecords: string[] = [];     // ~T (descripció llarga)
    const measurementRecords: string[] = []; // ~M (línies de medició)
    const decompRecords: string[] = [];   // ~D

    // Cache local per no recalcular mesures IFC repetides durant aquest export
    const exportIfcCache = new Map<string, ElementMeasurement[]>();

    // Codi arrel (## = pressupost raíz segons especificació)
    const ROOT_CODE = "PRES##";

    // 2. REGISTRE ~C per l'arrel (concepte raíz del pressupost)
    // Format: ~C|CODI|UNITAT|RESUM|PREU|DATA|TIPUS|
    conceptRecords.push(`~C|${ROOT_CODE}||${projectNameEscaped}||\r\n`);

    // Generadors de codis (màxim 20 caràcters)
    const genChapCode = (n: number) => `C${String(n).padStart(2, "0")}#`;
    const genSubCode = (chapCode: string, n: number) => `${chapCode.replace("#", "")}${String(n).padStart(2, "0")}#`;
    const genSubsubCode = (subCode: string, n: number) => `${subCode.replace("#", "")}${String(n).padStart(2, "0")}#`;
    const genItemCode = (subsubCode: string, n: number) => `${subsubCode.replace("#", "")}${String(n).padStart(3, "0")}`;

    // Fills de l'arrel (capítols)
    const rootChildren: string[] = [];

    let chapIdx = 0;
    for (const chapter of visibleChapters) {
      const chapterElements = elementConfigs.filter((c) => c.chapter_id === chapter.code);
      if (chapterElements.length === 0) continue;

      chapIdx++;
      const chapCode = genChapCode(chapIdx);
      const chapName = bc3Escape(getTranslatedName(chapter.code, chapter.name));

      // Concepte capítol
      conceptRecords.push(`~C|${chapCode}||${chapName}||\r\n`);
      rootChildren.push(chapCode);

      // Fills del capítol (subcapítols)
      const chapChildren: string[] = [];
      const visibleSubchapters = chapter.subchapters.filter((sub) => !isHidden(sub.code));
      let subIdx = 0;

      for (const subchapter of visibleSubchapters) {
        const subElements = elementConfigs.filter(
          (c) => c.chapter_id === chapter.code && c.subchapter_id === subchapter.code
        );
        if (subElements.length === 0) continue;

        subIdx++;
        const subCode = genSubCode(chapCode, subIdx);
        const subName = bc3Escape(getTranslatedName(subchapter.code, subchapter.name));

        // Concepte subcapítol
        conceptRecords.push(`~C|${subCode}||${subName}||\r\n`);
        chapChildren.push(subCode);

        // Fills del subcapítol (sub-subcapítols)
        const subChildren: string[] = [];
        const visibleSubsubchapters = subchapter.subsubchapters.filter((ss) => !isHidden(ss.code));
        let subsubIdx = 0;

        for (const subsubchapter of visibleSubsubchapters) {
          const items = getElementsForSubsubchapter(chapter.code, subchapter.code, subsubchapter.code);
          if (items.length === 0) continue;

          subsubIdx++;
          const subsubCode = genSubsubCode(subCode, subsubIdx);
          const subsubName = bc3Escape(getTranslatedName(subsubchapter.code, subsubchapter.name));

          // Concepte sub-subcapítol
          conceptRecords.push(`~C|${subsubCode}||${subsubName}||\r\n`);
          subChildren.push(subsubCode);

          // Fills del sub-subcapítol (partides)
          const itemDecompParts: string[] = [];

          items.forEach((item, itemIdx) => {
            const itemCode = genItemCode(subsubCode, itemIdx + 1);
            const itemName = bc3Escape(item.custom_name || item.type_name || "Element");
            const unit = (item.preferred_unit || "UT").toUpperCase();
            const qty = item.preferred_unit === "UT"
              ? Math.round(item.measured_value || 0)
              : Number((item.measured_value || 0).toFixed(3));

            // Concepte partida
            conceptRecords.push(`~C|${itemCode}|${unit}|${itemName}|0.00|\r\n`);
            
            // Text llarg (descripció) si existeix
            if (item.description && item.description.trim()) {
              const longDesc = bc3Escape(item.description);
              textRecords.push(`~T|${itemCode}|${longDesc}|\r\n`);
            }
            
            // Línies de medició (~M) segons FIEBDC-3/2020
            // ~M|[CODIGO_PADRE\]CODIGO_HIJO|{POSICION\}|MEDICION_TOTAL|{TIPO\COMENTARIO{#ID_BIM}\UNIDADES\LONGITUD\LATITUD\ALTURA\}|[ETIQUETA]|
            const manualLines = item.is_manual ? getManualMeasurementsForElement(item.id) : [];

            const ifcMeasurements = (() => {
              if (item.is_manual || !viewer) return [] as ElementMeasurement[];

              const cacheKey = `${item.ifc_category}|${item.type_name}|${item.preferred_unit}`;
              const cached = exportIfcCache.get(cacheKey);
              if (cached) return cached;

              const ms = getElementMeasurementsForType(
                viewer,
                item.ifc_category,
                item.type_name,
                item.preferred_unit
              );
              exportIfcCache.set(cacheKey, ms);
              return ms;
            })();

            type Bc3MeasureLine = { comment: string; quantity: number; idBim?: string };

            let lines: Bc3MeasureLine[] = [];

            // 1) IFC: exportar EXACTAMENT les línies que es mostren al desplegable (Comentaris + valor)
            if (!item.is_manual && ifcMeasurements.length > 0) {
              lines = ifcMeasurements.map((m) => ({
                comment: (m.comentarios || "-").trim(),
                quantity: Number(m.value || 0),
                idBim: String(m.id || "")
              }));
            }
            // 2) Manuals: totes les línies guardades
            else if (item.is_manual && manualLines.length > 0) {
              lines = manualLines.map((l) => ({
                comment: l.comment || "",
                quantity: Number(l.quantity || 0),
              }));
            }
            // 3) Fallback: una línia amb el total
            else if (qty > 0) {
              lines = [{ comment: itemName, quantity: qty }];
            }

            const sumLines = lines.reduce((acc, l) => acc + (l.quantity || 0), 0);
            const qtyExport = item.preferred_unit === "UT"
              ? Math.round(sumLines)
              : Number(sumLines.toFixed(3));

            // Camí complet dins l'estructura (capítol \ subcapítol \ sub-subcapítol \ partida)
            const posPath = `${chapIdx}\\${subIdx}\\${subsubIdx}\\${itemIdx + 1}`;

            // Associar la medició a la línia de descomposició (pare -> fill)
            const codePath = `${subsubCode}\\${itemCode}`;

            const formatLineQty = (v: number) => {
              const n = Number(v || 0);
              return item.preferred_unit === "UT" ? String(Math.round(n)) : String(Number(n.toFixed(3)));
            };

            // Cada línia: TIPO (buit) \ COMENTARI{#ID_BIM} \ UNITATS \ LONG \ LAT \ ALT
            const lineParts = lines
              .map((line) => {
                const idBim = line.idBim ? `#${bc3Escape(line.idBim)}` : "";
                const comment = bc3Escape(line.comment || "");
                const units = formatLineQty(line.quantity);
                // Després d'UNITATS: LONG, LAT, ALT buits
                return `\\${comment}${idBim}\\${units}\\\\\\`;
              })
              .join("");

            if (qtyExport > 0) {
              measurementRecords.push(`~M|${codePath}|${posPath}|${qtyExport}|${lineParts}|\r\n`);
            }

            // Part de la descomposició: CODI\FACTOR\RENDIMENT\
            itemDecompParts.push(`${itemCode}\\1.000\\${qtyExport}\\`);
          });

          // Descomposició: sub-subcapítol -> partides
          if (itemDecompParts.length > 0) {
            decompRecords.push(`~D|${subsubCode}|${itemDecompParts.join("")}|\r\n`);
          }
        }

        // Descomposició: subcapítol -> sub-subcapítols
        if (subChildren.length > 0) {
          const subDecompParts = subChildren.map((c) => `${c}\\1.000\\1.000\\`).join("");
          decompRecords.push(`~D|${subCode}|${subDecompParts}|\r\n`);
        }
      }

      // Descomposició: capítol -> subcapítols
      if (chapChildren.length > 0) {
        const chapDecompParts = chapChildren.map((c) => `${c}\\1.000\\1.000\\`).join("");
        decompRecords.push(`~D|${chapCode}|${chapDecompParts}|\r\n`);
      }
    }

    // Descomposició: arrel -> capítols
    if (rootChildren.length > 0) {
      const rootDecompParts = rootChildren.map((c) => `${c}\\1.000\\1.000\\`).join("");
      decompRecords.push(`~D|${ROOT_CODE}|${rootDecompParts}|\r\n`);
    }

    // 3. ESCRIURE: ~C (conceptes), ~T (textos), ~D (descomposicions), ~M (mesuraments)
    out += conceptRecords.join("");
    out += textRecords.join("");
    out += decompRecords.join("");
    out += measurementRecords.join("");

    // 4. DESCARREGAR
    const baseName = safeFileName(projectData?.name ? `Amid_${projectData.name}` : "Amidaments");
    const fileName = `${baseName}.bc3`;

    downloadBlob(out, fileName);
    toast.success("BC3 generat correctament");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="flex-row items-start justify-between space-y-0">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold">
                {language === "ca" ? "Estructura del pressupost" : "Estructura del presupuesto"}{projectData?.name && <span className="text-primary ml-2">"{projectData.name}"</span>}
              </DialogTitle>
              <DialogDescription className="text-base mt-2 flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium">{statistics.ifcElements}</span>
                  <span className="text-muted-foreground">IFC</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium">{statistics.manualElements}</span>
                  <span className="text-muted-foreground">Manuals</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-primary">{Math.round(statistics.ifcPercentage)}%</span>
                  <span className="text-muted-foreground">IFC</span>
                </span>
              </DialogDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {uiSettings.export_pdf_visible && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleExportPDF}
                        className="gap-2"
                        size="sm"
                      >
                        <FileDown className="h-4 w-4" />
                        PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Genera un PDF tècnic amb l'estat d'amidaments</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {uiSettings.export_bc3_visible && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleExportBC3}
                        className="gap-2"
                        size="sm"
                      >
                        <FileDown className="h-4 w-4" />
                        BC3
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exporta a format BC3 (FIEBDC-3) per programes d'amidaments</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleTutorial}
                      className="flex-shrink-0 p-2 rounded-full hover:bg-muted transition-colors"
                      aria-label="Tutorial"
                    >
                      <Info className="w-5 h-5 text-primary hover:text-primary/80" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{language === "ca" ? "Com funciona?" : "¿Cómo funciona?"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </DialogHeader>

          {/* Statistics Section removed as per request */}

          <div className="flex-1 min-h-0 overflow-y-auto pr-4 mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                {language === "ca" ? "Carregant partides..." : "Cargando partidas..."}
              </div>
            ) : (
              <Accordion type="multiple" className="w-full space-y-2">
                {visibleChapters.map((chapter, idx) => {
                  const chapterElementCount = getChapterElementCount(chapter.code);
                  
                  // Calculate chapter statistics
                  const chapterThirdLevelItems = Object.values(
                    elementConfigs.reduce((acc, config) => {
                      if (config.chapter_id === chapter.code && config.subchapter_id && config.subsubchapter_id) {
                        const key = `${config.chapter_id}-${config.subchapter_id}-${config.subsubchapter_id}`;
                        if (!acc[key]) {
                          acc[key] = {
                            chapterCode: config.chapter_id,
                            subchapterCode: config.subchapter_id,
                            subsubchapterCode: config.subsubchapter_id,
                          };
                        }
                      }
                      return acc;
                    }, {} as Record<string, any>)
                  );
                  
                  const chapterTotalItems = chapterThirdLevelItems.length;
                  const chapterAssignedItems = chapterThirdLevelItems.filter(item => 
                    isItemAssigned(item.chapterCode, item.subchapterCode, item.subsubchapterCode)
                  ).length;
                  const chapterPendingItems = chapterTotalItems - chapterAssignedItems;
                  
                  const chapterIfcElements = elementConfigs.filter(
                    config => config.chapter_id === chapter.code && !config.is_manual
                  ).length;
                  const chapterManualElements = elementConfigs.filter(
                    config => config.chapter_id === chapter.code && config.is_manual
                  ).length;

                  return (
                    <AccordionItem
                      key={idx}
                      value={`chapter-${idx}`}
                      className="border rounded-lg px-4 bg-card"
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3 text-left w-full">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                            {chapter.code}
                          </div>
                          <span className="font-semibold text-base flex-1">
                            {getTranslatedName(chapter.code, chapter.name)}
                          </span>
                          {chapterElementCount > 0 && (
                            <div className="flex items-center gap-2 mr-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 cursor-help">
                                      <Box className="h-3 w-3 text-blue-500" />
                                      <span className="text-xs font-semibold text-blue-600">{chapterIfcElements}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Partides IFC</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 cursor-help">
                                      <FileText className="h-3 w-3 text-amber-500" />
                                      <span className="text-xs font-semibold text-amber-600">{chapterManualElements}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Partides manuals</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 cursor-help">
                                      <span className="text-xs font-semibold text-primary">
                                        {chapterElementCount > 0 ? Math.round((chapterIfcElements / chapterElementCount) * 100) : 0}%
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Percentatge IFC</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-2">
                        <Accordion type="multiple" className="ml-8 space-y-1">
                          {chapter.subchapters.filter(sub => !isHidden(sub.code)).map((subchapter, subIdx) => {
                            const subchapterCount = getSubchapterElementCount(chapter.code, subchapter.code);

                            return (
                              <AccordionItem
                                key={subIdx}
                                value={`subchapter-${idx}-${subIdx}`}
                                className="border rounded-md px-3 bg-muted/20"
                              >
                                <AccordionTrigger className="hover:no-underline py-3">
                                  <div className="flex items-center gap-3 text-left w-full">
                                    <span className="text-sm font-medium text-muted-foreground w-20 flex-shrink-0">
                                      {subchapter.code}
                                    </span>
                                    <span className="text-sm flex-1">
                                      {getTranslatedName(subchapter.code, subchapter.name)}
                                    </span>
                                    {subchapterCount > 0 && (
                                      <Badge variant="outline" className="ml-2">
                                        {subchapterCount}
                                      </Badge>
                                    )}
                                  </div>
                                </AccordionTrigger>

                                <AccordionContent className="pb-3 pt-1">
                                  <Accordion type="multiple" className="ml-6 space-y-1">
                                    {subchapter.subsubchapters.filter(subsub => !isHidden(subsub.code)).map((subsubchapter, subsubIdx) => {
                                      const elements = getElementsForSubsubchapter(chapter.code, subchapter.code, subsubchapter.code);

                                      return (
                                        <AccordionItem
                                          key={subsubIdx}
                                          value={`subsubchapter-${idx}-${subIdx}-${subsubIdx}`}
                                          className="border rounded-md px-3 bg-muted/10"
                                        >
                                          <AccordionTrigger className="hover:no-underline py-2">
                                            <div className="flex items-center gap-3 text-left w-full">
                                              <span className="text-xs font-medium text-muted-foreground w-24 flex-shrink-0">
                                                {subsubchapter.code}
                                              </span>
                                              {subsubchapter.level4Items && subsubchapter.level4Items.length > 0 ? (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <span className="text-xs flex-1 cursor-help underline decoration-dotted">
                                                        {getTranslatedName(subsubchapter.code, subsubchapter.name)}
                                                      </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent 
                                                      side="right" 
                                                      align="start"
                                                      sideOffset={10}
                                                      className="max-w-md max-h-96 overflow-y-auto z-50 bg-popover"
                                                    >
                                                      <div className="text-xs space-y-1 p-2">
                                                        <p className="font-semibold mb-2">Partides del 4t nivell:</p>
                                                        {subsubchapter.level4Items.map((item, idx) => (
                                                          <p key={idx} className="text-muted-foreground">• {item}</p>
                                                        ))}
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              ) : (
                                                <span className="text-xs flex-1">
                                                  {getTranslatedName(subsubchapter.code, subsubchapter.name)}
                                                </span>
                                              )}
                                               <div className="flex items-center gap-1">
                                                {/* Només mostrar botó d'afegir si no és industrial */}
                                                {userType !== "specialist" && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleCreatePartida(chapter.code, subchapter.code, subsubchapter.code);
                                                    }}
                                                    className="h-6 px-2"
                                                  >
                                                    <Plus className="h-3 w-3" />
                                                  </Button>
                                                )}
                                                 {elements.length > 0 && (
                                                  <>
                                                    {isItemAssigned(chapter.code, subchapter.code, subsubchapter.code) && (
                                                      <TooltipProvider>
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <div className="cursor-help">
                                                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-1" />
                                                            </div>
                                                          </TooltipTrigger>
                                                          <TooltipContent>
                                                            <p>Té industrials assignats</p>
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    )}
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Badge variant="outline" className="ml-1 cursor-help">
                                                            {elements.length}
                                                          </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                          <p>Nombre d'elements en aquesta partida</p>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </AccordionTrigger>

                                          {elements.length > 0 && (
                                            <AccordionContent className="pb-2 pt-1">
                                              {/* Generador conjunt de descripcions IA */}
                                              {userType !== "specialist" && elements.length >= 2 && (
                                                <BatchDescriptionGenerator
                                                  subsubchapterCode={subsubchapter.code}
                                                  partides={elements.map((el, idx) => ({
                                                    id: el.id,
                                                    code: `${subsubchapter.code}.${String(idx + 1).padStart(2, '0')}`,
                                                    name: el.custom_name || el.type_name,
                                                    measured_value: el.measured_value || 0,
                                                    unit: el.preferred_unit,
                                                    ifc_category: el.ifc_category,
                                                    description: el.description,
                                                    custom_name: el.custom_name,
                                                    type_name: el.type_name
                                                  }))}
                                                  isLocked={false}
                                                  selectedIds={getBatchSelection(subsubchapter.code)}
                                                  onSelectionChange={(ids) => handleBatchSelectionChange(subsubchapter.code, ids)}
                                                  onDescriptionsGenerated={(updates) => {
                                                    // Actualitzar les descripcions localment
                                                    setElementConfigs(prev => prev.map(config => {
                                                      const update = updates.find(u => u.id === config.id);
                                                      if (update) {
                                                        return { ...config, description: update.description };
                                                      }
                                                      return config;
                                                    }));
                                                  }}
                                                  onTemplateStatusChange={(hasTemplate) => {
                                                    setSubsubchaptersWithTemplate(prev => {
                                                      const newSet = new Set(prev);
                                                      if (hasTemplate) {
                                                        newSet.add(subsubchapter.code);
                                                      } else {
                                                        newSet.delete(subsubchapter.code);
                                                      }
                                                      return newSet;
                                                    });
                                                  }}
                                                />
                                              )}
                                              <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={(event) => handleDragEnd(event, chapter.code, subchapter.code, subsubchapter.code)}
                                              >
                                                <SortableContext
                                                  items={elements.map(el => el.id)}
                                                  strategy={verticalListSortingStrategy}
                                                >
                                                  <div className="space-y-2 pl-4 border-l-2 border-border/50">
                                                    {elements.map((element, elemIdx) => {
                                                      const itemNumber = `${subsubchapter.code}.${String(elemIdx + 1).padStart(2, '0')}`;
                                                      const elementMeasurements = getMeasurementsForElement(element);
                                                      const hasBatchTemplate = subsubchaptersWithTemplate.has(subsubchapter.code);
                                                      const currentSelection = getBatchSelection(subsubchapter.code);
                                                      return (
                                                        <SortableItem
                                                          key={element.id}
                                                          element={element}
                                                          itemNumber={itemNumber}
                                                          onEdit={userType !== "specialist" ? handleEditPartida : undefined}
                                                          onDelete={userType !== "specialist" ? handleDeletePartida : undefined}
                                                          onDetails={userType !== "specialist" ? handleOpenDetails : undefined}
                                                          onGenerateAI={userType !== "specialist" ? handleGenerateAI : undefined}
                                                          generatingAI={generatingAIForElement === element.id}
                                                          elementMeasurements={elementMeasurements}
                                                          manualMeasurementLines={element.is_manual ? getManualMeasurementsForElement(element.id) : undefined}
                                                          hasBatchTemplate={hasBatchTemplate}
                                                          isSelectedForBatch={currentSelection.has(element.id)}
                                                          onBatchSelectionToggle={(id) => toggleBatchSelection(subsubchapter.code, id)}
                                                          creditCostPerItem={creditCostPerItem}
                                                          shouldSkipCredits={shouldSkipCredits}
                                                        />
                                                      );
                                                    })}
                                                  </div>
                                                </SortableContext>
                                              </DndContext>
                                            </AccordionContent>
                                          )}
                                        </AccordionItem>
                                      );
                                    })}
                                  </Accordion>
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
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BudgetStructureTutorial open={tutorialOpen} onOpenChange={setTutorialOpen} />

      <NestedDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <NestedDialogContent className="max-w-lg">
          <NestedDialogHeader>
            <NestedDialogTitle>Crear partida manual</NestedDialogTitle>
          </NestedDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customName">Descripció curta *</Label>
              <Input
                id="customName"
                value={newPartida.customName}
                onChange={(e) => setNewPartida({ ...newPartida, customName: e.target.value })}
                placeholder="Ex: Porta de fusta"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripció llarga</Label>
              <Textarea
                id="description"
                value={newPartida.description}
                onChange={(e) => setNewPartida({ ...newPartida, description: e.target.value })}
                placeholder="Descripció detallada de la partida..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Unitat</Label>
              <Select
                value={newPartida.preferredUnit}
                onValueChange={(value) => setNewPartida({ ...newPartida, preferredUnit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PA">PA (Partida alçada)</SelectItem>
                  <SelectItem value="UT">UT (Unitats)</SelectItem>
                  <SelectItem value="ML">ML (Metres lineals)</SelectItem>
                  <SelectItem value="M2">M2 (Metres quadrats)</SelectItem>
                  <SelectItem value="M3">M3 (Metres cúbics)</SelectItem>
                  <SelectItem value="KG">KG (Quilograms)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Línies de mesurament */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Línies de mesurament</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addMeasurementLine}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Afegir línia
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium w-8">#</th>
                      <th className="text-left px-2 py-1.5 font-medium">Comentari</th>
                      <th className="text-right px-2 py-1.5 font-medium w-24">{newPartida.preferredUnit}</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurementLines.map((line, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                        <td className="px-1 py-1">
                          <Input
                            value={line.comment}
                            onChange={(e) => updateMeasurementLine(idx, 'comment', e.target.value)}
                            placeholder="Comentari..."
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateMeasurementLine(idx, 'quantity', e.target.value)}
                            placeholder="0.00"
                            className="h-7 text-xs text-right"
                          />
                        </td>
                        <td className="px-1 py-1">
                          {measurementLines.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMeasurementLine(idx)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t">
                    <tr>
                      <td colSpan={2} className="px-2 py-1.5 text-right font-medium">Total:</td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-primary">
                        {measurementLines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0), 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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

      <NestedDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <NestedDialogContent className="max-w-lg">
          <NestedDialogHeader>
            <NestedDialogTitle>Editar partida manual</NestedDialogTitle>
          </NestedDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCustomName">Descripció curta *</Label>
              <Input
                id="editCustomName"
                value={newPartida.customName}
                onChange={(e) => setNewPartida({ ...newPartida, customName: e.target.value })}
                placeholder="Ex: Porta de fusta"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Descripció llarga</Label>
              <Textarea
                id="editDescription"
                value={newPartida.description}
                onChange={(e) => setNewPartida({ ...newPartida, description: e.target.value })}
                placeholder="Descripció detallada de la partida..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editMeasuredValue">Quantitat</Label>
                <Input
                  id="editMeasuredValue"
                  type="number"
                  step="0.01"
                  value={newPartida.measuredValue}
                  onChange={(e) => setNewPartida({ ...newPartida, measuredValue: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPreferredUnit">Unitat</Label>
                <Select
                  value={newPartida.preferredUnit}
                  onValueChange={(value) => setNewPartida({ ...newPartida, preferredUnit: value })}
                >
                  <SelectTrigger id="editPreferredUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PA">PA (Partida alçada)</SelectItem>
                    <SelectItem value="UT">UT (Unitats)</SelectItem>
                    <SelectItem value="ML">ML (Metres lineals)</SelectItem>
                    <SelectItem value="M2">M2 (Metres quadrats)</SelectItem>
                    <SelectItem value="M3">M3 (Metres cúbics)</SelectItem>
                    <SelectItem value="KG">KG (Quilograms)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel·lar
              </Button>
              <Button onClick={handleUpdatePartida}>
                Guardar canvis
              </Button>
            </div>
          </div>
        </NestedDialogContent>
      </NestedDialog>

      {selectedSupplierConfig && userId && (
        <AssignSuppliersModal
          open={suppliersModalOpen}
          onOpenChange={handleSuppliersModalClose}
          centerId={centerId}
          userId={userId}
          chapterCode={selectedSupplierConfig.chapterCode}
          chapterName={selectedSupplierConfig.chapterName}
          subchapterCode={selectedSupplierConfig.subchapterCode}
          subchapterName={selectedSupplierConfig.subchapterName}
          subsubchapterCode={selectedSupplierConfig.subsubchapterCode}
          subsubchapterName={selectedSupplierConfig.subsubchapterName}
          specialistCategory={selectedSupplierConfig.specialistCategory}
          elementCount={selectedSupplierConfig.elementCount}
        />
      )}

      <NestedDialog open={suppliersListModalOpen} onOpenChange={setSuppliersListModalOpen}>
        <NestedDialogContent className="max-w-2xl">
          <NestedDialogHeader>
            <NestedDialogTitle>Industrials assignats a l'obra</NestedDialogTitle>
          </NestedDialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Llistat d'industrials o proveïdors diferents que intervenen a l'obra
            </p>
            {assignedSuppliersDetails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-50" />
                <p>Encara no hi ha industrials assignats</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignedSuppliersDetails.map((supplier, index) => (
                  <div
                    key={supplier.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-background border border-border/50 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 font-semibold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground">NIF: {supplier.nif}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </NestedDialogContent>
      </NestedDialog>

      {/* Modal de detalls de partida */}
      {selectedElementForDetails && (
        <ElementTypeDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          elementTypeConfigId={selectedElementForDetails.id}
          elementName={selectedElementForDetails.custom_name || selectedElementForDetails.type_name}
        />
      )}

      {/* Modal de crèdits insuficients */}
      <InsufficientCreditsModal
        open={showInsufficientCreditsModal}
        onClose={() => setShowInsufficientCreditsModal(false)}
        requiredCredits={creditsConfig.creditsPerAiDescription}
        currentCredits={credits}
        userId={userId || ""}
      />

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
          }
        }}
        onCancel={() => setPendingAIElement(null)}
      />
    </>
  );
};

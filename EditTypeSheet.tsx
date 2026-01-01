import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { BUDGET_CHAPTERS } from "@/data/budgetChapters";
import { useBudgetChapterTranslations } from "@/hooks/useBudgetChapterTranslations";
import { Viewer } from "@xeokit/xeokit-sdk";

interface EditTypeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId?: string;
  projectId?: string;
  versionId?: string;
  ifcCategory: string;
  typeName: string;
  onSave: () => void;
  viewer: Viewer | null;
}

// Funcions auxiliars per calcular valors
function normStr(s: any): string {
  if (s == null) return "";
  const v = (typeof s === "object") ? (s.value ?? s.Value ?? s) : s;
  return (typeof v === "string") ? v.trim() : String(v ?? "").trim();
}

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

function normKey(s: string): string {
  const t = normStr(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-\.]/g, "");
  return t;
}

const VOL_KEYS = new Set(["netvolume", "grossvolume", "volume", "volumen", "vol"]);
const LEN_KEYS = new Set(["length", "longitud", "len", "altura", "height", "width", "anchura", "profundidad", "depth"]);
const MASS_KEYS = new Set(["mass", "massa", "masa", "weight", "peso", "pes"]);
const AREA_KEYS = new Set(["netarea", "grossarea", "area", "superficie", "netsidearea", "grosssidearea", "netsurfacearea", "grosssurfacearea", "outersurfacearea", "totalsurfacearea", "netfloorarea", "grossfloorarea"]);

function getByKeysFromProps(mo: any, keySet: Set<string>, metaModel?: any): number | null {
  // Path 1: propertySets directe al metaObject (alguns converters)
  const psets = mo?.propertySets;
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const arr = ps?.properties;
      if (!Array.isArray(arr)) continue;
      for (const prop of arr) {
        const nk = normKey(prop?.name ?? prop?.Name);
        if (keySet.has(nk)) {
          const val = toNum(prop?.value ?? prop?.Value ?? prop);
          if (val != null && val > 0) return val;
        }
      }
    }
  }
  
  // Path 2: propertySetIds referència a metaModel.propertySets (xeokit/CXConverter)
  if (mo?.propertySetIds && metaModel?.propertySets) {
    for (const propSetId of mo.propertySetIds) {
      const propSet = metaModel.propertySets[propSetId];
      if (propSet?.properties) {
        for (const prop of propSet.properties) {
          const nk = normKey(prop?.name ?? prop?.Name ?? "");
          if (keySet.has(nk)) {
            const val = toNum(prop?.value ?? prop?.Value ?? prop);
            if (val != null && val > 0) return val;
          }
        }
      }
    }
  }
  
  return null;
}

function getNiceTypeName(mo: any): string {
  if (!mo) return "Desconegut";
  const BAD = new Set(["ifcproduct", "ifcelement", "ifcbuildingelement"]);
  const base = String(mo?.type || "").toLowerCase();
  if (base && !BAD.has(base) && !base.startsWith("ifc")) return mo.type;

  const candidates: Array<{ s: string; score: number }> = [];
  const add = (raw: any, score = 1) => {
    const s = normStr(raw);
    if (!s) return;
    const low = s.toLowerCase();
    if (low.startsWith("ifc")) return;
    if (s.length < 2) return;
    candidates.push({ s, score: score + Math.min(3, Math.floor(s.length / 12)) });
  };

  const p = mo?.props || {};
  add(p?.type?.name, 10);
  add(p?.type?.Name, 10);
  add(p?.Type?.name, 10);
  add(p?.Type?.Name, 10);
  add(p.ObjectType, 9);
  add(p.TypeName, 9);
  add(p.Type, 8);

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

function getVolumeAny(mo: any, metaModel?: any): number | null {
  return getByKeysFromProps(mo, VOL_KEYS, metaModel);
}

function getLengthAny(mo: any, metaModel?: any): number | null {
  return getByKeysFromProps(mo, LEN_KEYS, metaModel);
}

function getMassAny(mo: any, metaModel?: any): number | null {
  return getByKeysFromProps(mo, MASS_KEYS, metaModel);
}

function getAreaAny(mo: any, metaModel?: any): number | null {
  return getByKeysFromProps(mo, AREA_KEYS, metaModel);
}

function getMainValue(mo: any, metaModel?: any): number {
  const t = String(mo?.type || "").toLowerCase();
  const preferArea = (
    t.startsWith("ifcwall") || t.startsWith("ifcslab") ||
    t.startsWith("ifcwindow") || t.startsWith("ifcdoor") ||
    t.startsWith("ifcroof")
  );

  const A = getAreaAny(mo, metaModel);
  const V = getVolumeAny(mo, metaModel);
  const L = getLengthAny(mo, metaModel);
  const M = getMassAny(mo, metaModel);

  if (preferArea && A && A > 0) return A;
  if (A && A > 0) return A;
  if (V && V > 0) return V;
  if (L && L > 0) return L;
  if (M && M > 0) return M;
  return 1;
}

// Interfície per les mesures individuals dels elements
interface ElementMeasurement {
  id: string;
  name: string;
  value: number;
  aabbDimensions?: { dx: number; dy: number; dz: number };
}

// Funció per calcular àrea des de la geometria (AABB) de l'entitat
function calculateAreaFromGeometry(viewer: any, entityId: string, ifcType: string, debug: boolean = false): number | null {
  if (!viewer || !entityId) return null;
  
  // Provar múltiples formats d'ID d'entitat
  const possibleIds = [
    entityId,
    `myModel#${entityId}`,  // Format amb prefix de model
    entityId.replace('myModel#', ''),  // Sense prefix
  ];
  
  let entity = null;
  let usedId = '';
  for (const id of possibleIds) {
    entity = viewer.scene?.objects?.[id];
    if (entity) {
      usedId = id;
      break;
    }
  }
  
  if (debug) {
    console.log(`[calculateAreaFromGeometry] entityId: ${entityId}, usedId: ${usedId}, entity found: ${!!entity}`);
    if (!entity) {
      const allIds = Object.keys(viewer.scene?.objects || {}).slice(0, 5);
      console.log(`[calculateAreaFromGeometry] Sample scene object IDs:`, allIds);
    }
  }
  
  if (!entity || !entity.aabb) return null;
  
  const aabb = entity.aabb; // [xmin, ymin, zmin, xmax, ymax, zmax]
  const dx = Math.abs(aabb[3] - aabb[0]); // width (X)
  const dy = Math.abs(aabb[4] - aabb[1]); // height (Y - vertical)
  const dz = Math.abs(aabb[5] - aabb[2]); // depth (Z)
  
  if (debug) {
    console.log(`[calculateAreaFromGeometry] AABB: dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, dz=${dz.toFixed(2)}`);
  }
  
  const type = ifcType.toLowerCase();
  
  // Per murs: àrea lateral = longitud × altura
  if (type.includes("wall")) {
    const length = Math.max(dx, dz);
    const height = dy;
    const area = length * height;
    if (debug) console.log(`[calculateAreaFromGeometry] Wall area: ${length.toFixed(2)} x ${height.toFixed(2)} = ${area.toFixed(2)} m2`);
    return area;
  }
  
  // Per terres/sostres: àrea = X × Z
  if (type.includes("slab") || type.includes("floor") || type.includes("roof") || type.includes("ceiling")) {
    return dx * dz;
  }
  
  // Per finestres i portes: X × Y o Z × Y (la més gran)
  if (type.includes("window") || type.includes("door")) {
    return Math.max(dx * dy, dz * dy);
  }
  
  // Per defecte: la cara més gran
  const areas = [dx * dy, dx * dz, dy * dz];
  return Math.max(...areas);
}

function getValueByUnit(mo: any, unit: "UT" | "ML" | "M2" | "M3" | "KG", metaModel?: any, viewer?: any, debug: boolean = false): number {
  let value: number | null = null;
  
  switch(unit) {
    case "UT":
      return 1; // Sempre 1 per unitat
    case "ML":
      value = getLengthAny(mo, metaModel);
      // Fallback: calcular longitud des de geometria
      if (!value && viewer && mo?.id) {
        const possibleIds = [mo.id, `myModel#${mo.id}`, mo.id.replace('myModel#', '')];
        for (const id of possibleIds) {
          const entity = viewer.scene?.objects?.[id];
          if (entity?.aabb) {
            const aabb = entity.aabb;
            const dx = Math.abs(aabb[3] - aabb[0]);
            const dz = Math.abs(aabb[5] - aabb[2]);
            value = Math.max(dx, dz);
            break;
          }
        }
      }
      return value || 1;
    case "M2":
      value = getAreaAny(mo, metaModel);
      // Fallback: calcular àrea des de geometria
      if (!value && viewer && mo?.id) {
        value = calculateAreaFromGeometry(viewer, mo.id, mo?.type || "", debug);
      }
      return value || 1;
    case "M3":
      value = getVolumeAny(mo, metaModel);
      // Fallback: calcular volum des de geometria
      if (!value && viewer && mo?.id) {
        const entity = viewer.scene?.objects?.[mo.id];
        if (entity?.aabb) {
          const aabb = entity.aabb;
          const dx = Math.abs(aabb[3] - aabb[0]);
          const dy = Math.abs(aabb[4] - aabb[1]);
          const dz = Math.abs(aabb[5] - aabb[2]);
          value = dx * dy * dz;
        }
      }
      return value || 1;
    case "KG":
      return getMassAny(mo, metaModel) || 1;
    default:
      return 1;
  }
}

export const EditTypeSheet = ({ 
  open, 
  onOpenChange, 
  centerId,
  projectId,
  versionId,
  ifcCategory, 
  typeName,
  onSave,
  viewer
}: EditTypeSheetProps) => {
  const { language } = useLanguage();
  const { isHidden, getTranslatedName } = useBudgetChapterTranslations();
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");
  const [preferredUnit, setPreferredUnit] = useState<"UT" | "ML" | "M2" | "M3" | "KG">("UT");
  const [chapterId, setChapterId] = useState<string>("");
  const [subchapterId, setSubchapterId] = useState<string>("");
  const [subsubchapterId, setSubsubchapterId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [existingConfig, setExistingConfig] = useState<any>(null);
  
  // Estat per guardar les dades de mesura de cada element individual
  const [elementMeasurements, setElementMeasurements] = useState<ElementMeasurement[]>();

  // Filter chapters that are not hidden
  const visibleChapters = useMemo(() => {
    return BUDGET_CHAPTERS.filter(chapter => !isHidden(chapter.code));
  }, [isHidden]);

  useEffect(() => {
    if (open && (centerId || projectId) && ifcCategory && typeName) {
      console.log("[EditTypeSheet] Loading config for:", { centerId, projectId, versionId, ifcCategory, typeName });
      loadExistingConfig();
    }
  }, [open, centerId, projectId, versionId, ifcCategory, typeName]);

  // Calcular mesures dels elements quan canvia la unitat o s'obre el component
  useEffect(() => {
    if (!open || !viewer || !ifcCategory || !typeName) {
      setElementMeasurements([]);
      return;
    }

    const measurements: ElementMeasurement[] = [];
    const metaModels: any = viewer?.metaScene?.metaModels;
    
    if (metaModels) {
      const ids = Object.keys(metaModels);
      if (ids.length > 0) {
        const mm = metaModels[ids[0]];
        const metaObjects = mm?.metaObjects;
        
        if (metaObjects) {
          for (const id of Object.keys(metaObjects)) {
            const mo = metaObjects[id];
            if (!mo) continue;
            
            if (mo.type === ifcCategory) {
              const objTypeName = getNiceTypeName(mo);
              if (objTypeName === typeName) {
                const value = getValueByUnit(mo, preferredUnit, mm, viewer, false);
                
                // Obtenir dimensions AABB si estan disponibles
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
                
                measurements.push({
                  id: mo.id,
                  name: mo.name || mo.id,
                  value,
                  aabbDimensions
                });
              }
            }
          }
        }
      }
    }
    
    setElementMeasurements(measurements);
  }, [open, viewer, ifcCategory, typeName, preferredUnit]);

  const loadExistingConfig = async () => {
    try {
      if (!centerId && !projectId) return;

      let queryResult: any;
      
      // PRIORITZAR project_id sobre center_id i filtrar per version_id si existeix
      if (projectId) {
        let query = supabase
          .from("element_type_configs")
          .select("*")
          .eq("ifc_category", ifcCategory)
          .eq("type_name", typeName)
          .eq("project_id", projectId);
        
        // Si tenim version_id, filtrar per ell; sinó buscar configs sense version_id
        if (versionId) {
          query = query.eq("version_id", versionId);
        } else {
          query = query.is("version_id", null);
        }
        
        // @ts-ignore - TypeScript inference issue with Supabase queries  
        queryResult = await query.maybeSingle();
      } else if (centerId) {
        // @ts-ignore - TypeScript inference issue with Supabase queries
        queryResult = await supabase
          .from("element_type_configs")
          .select("*")
          .eq("ifc_category", ifcCategory)
          .eq("type_name", typeName)
          .eq("center_id", centerId)
          .maybeSingle();
      }

      const data = queryResult.data;
      const error = queryResult.error;

      if (error) {
        console.error("Error loading config:", error);
        return;
      }

      if (data) {
        console.log("[EditTypeSheet] Existing config found:", data);
        setExistingConfig(data);
        setCustomName(data.custom_name || "");
        setDescription(data.description || "");
        setPreferredUnit((data.preferred_unit as "UT" | "ML" | "M2" | "M3" | "KG") || "UT");
        setChapterId(data.chapter_id || "");
        setSubchapterId(data.subchapter_id || "");
        setSubsubchapterId(data.subsubchapter_id || "");
      } else {
        console.log("[EditTypeSheet] No existing config, using defaults with typeName:", typeName);
        setExistingConfig(null);
        // Pre-fill customName with the element's typeName (user-defined name from IFC)
        setCustomName(typeName || "");
        setDescription("");
        setPreferredUnit("UT");
        setChapterId("");
        setSubchapterId("");
        setSubsubchapterId("");
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error(language === 'ca' ? "No estàs autenticat" : "No estás autenticado");
        return;
      }

      // Calcular el measured_value directament del viewer segons la unitat preferida
      let measured_value = 0;
      let elementCount = 0;
      if (viewer) {
        const metaModels: any = viewer?.metaScene?.metaModels;
        if (metaModels) {
          const ids = Object.keys(metaModels);
          if (ids.length > 0) {
            const mm = metaModels[ids[0]];
            const metaObjects = mm?.metaObjects;
            
            if (metaObjects) {
              // Buscar tots els objectes que coincideixin amb aquest tipus
              let isFirst = true;
              for (const id of Object.keys(metaObjects)) {
                const mo = metaObjects[id];
                if (!mo) continue;
                
                // Comprovar si coincideix el tipus IFC
                if (mo.type === ifcCategory) {
                  // Comprovar si el nom del tipus coincideix
                  const objTypeName = getNiceTypeName(mo);
                  if (objTypeName === typeName) {
                    elementCount++;
                    // DEBUG: Mostrar estructura del primer element
                    if (isFirst) {
                      console.log("[EditTypeSheet] DEBUG - First metaObject structure:");
                      console.log("[EditTypeSheet] - mo.type:", mo.type);
                      console.log("[EditTypeSheet] - mo.propertySets:", mo.propertySets);
                      console.log("[EditTypeSheet] - mo.propertySets is array:", Array.isArray(mo.propertySets));
                      console.log("[EditTypeSheet] - mo.propertySets length:", mo.propertySets?.length);
                      
                      // Mostrar TOTS els propertySets amb les seves propietats
                      if (mo.propertySets && Array.isArray(mo.propertySets)) {
                        mo.propertySets.forEach((ps: any, idx: number) => {
                          console.log(`[EditTypeSheet] PropertySet ${idx}: "${ps.name}" (${ps.type})`);
                          console.log(`[EditTypeSheet]   - ps keys:`, Object.keys(ps));
                          if (ps.properties && Array.isArray(ps.properties)) {
                            ps.properties.forEach((prop: any) => {
                              console.log(`[EditTypeSheet]     - ${prop.name}: ${prop.value} (type: ${prop.type})`);
                            });
                          } else {
                            console.log(`[EditTypeSheet]   - NO properties array, ps.properties:`, ps.properties);
                          }
                        });
                      }
                      isFirst = false;
                    }
                    // Calcular el valor segons la unitat preferida seleccionada
                    // Passar metaModel per propietats i viewer per geometria (fallback)
                    const isDebugElement = elementCount === 1; // Debug només el primer element
                    const value = getValueByUnit(mo, preferredUnit, mm, viewer, isDebugElement);
                    console.log(`[EditTypeSheet] Element ${elementCount}: value=${value.toFixed(2)} for unit=${preferredUnit} (id: ${mo.id})`);
                    measured_value += value;
                  }
                }
              }
            }
          }
        }
      }
      
      console.log(`[EditTypeSheet] Calculated measured_value for ${typeName}: ${measured_value} (${elementCount} elements, unit: ${preferredUnit})`);

      // Calcular display_order si s'ha seleccionat subsubchapter
      // Aquest serà el 4t nivell de la partida (numeració correlativa)
      let display_order = 1;
      if (subsubchapterId && (centerId || projectId)) {
        try {
          let countQuery = supabase
            .from("element_type_configs")
            .select("*", { count: 'exact', head: true })
            .eq("subsubchapter_id", subsubchapterId);
          
          // PRIORITZAR project_id sobre center_id
          if (projectId) {
            countQuery = countQuery.eq("project_id", projectId);
          } else if (centerId) {
            countQuery = countQuery.eq("center_id", centerId);
          }
          
          // Només afegir neq si existeix un ID vàlid
          if (existingConfig?.id) {
            countQuery = countQuery.neq("id", existingConfig.id);
          }

          const { count, error: countError } = await countQuery;

          if (countError) {
            console.error("[EditTypeSheet] Error counting existing items:", {
              message: countError.message,
              details: countError.details,
              hint: countError.hint,
              code: countError.code,
              query: {
                subsubchapter_id: subsubchapterId,
                center_id: centerId,
                project_id: projectId,
                existing_id: existingConfig?.id
              }
            });
            throw countError;
          }
          
          display_order = (count || 0) + 1;
          console.log("[EditTypeSheet] Calculated display_order:", display_order, "for subsubchapter:", subsubchapterId, "count:", count);
        } catch (error: any) {
          console.error("[EditTypeSheet] Exception during count:", {
            error,
            message: error?.message,
            stack: error?.stack
          });
          throw error;
        }
      }

      // Generar el full_code amb 4 nivells: els 3 primers són la classificació,
      // el 4t és la numeració correlativa de la partida (01, 02, 03...)
      // NOTA: full_code és una columna GENERATED ALWAYS a la base de dades.
      // Es calcula automàticament a partir de subsubchapter_id i display_order.
      // NO hem d'insertar-la manualment!

      const configData: any = {
        user_id: user.id,
        ifc_category: ifcCategory,
        type_name: typeName,
        custom_name: customName || null,
        description: description || null,
        preferred_unit: preferredUnit,
        chapter_id: chapterId || null,
        subchapter_id: subchapterId || null,
        subsubchapter_id: subsubchapterId || null,
        // full_code NO s'inclou aquí - es genera automàticament!
        measured_value: measured_value,
        display_order: display_order,
        // Guardar el nombre d'elements geomètrics d'aquest tipus
        element_count: elementMeasurements.length || 1,
      };

      // Afegir project_id, center_id i version_id segons el cas
      // PRIORITZAR project_id sobre center_id perquè les partides IFC
      // editades des del visor han d'aparèixer al panell de pressupostos
      if (projectId) {
        configData.project_id = projectId;
        configData.center_id = null;
        // Afegir version_id si existeix per separar edicions per versió
        configData.version_id = versionId || null;
      } else if (centerId) {
        configData.center_id = centerId;
        configData.project_id = null;
        configData.version_id = null;
      }

      console.log("[EditTypeSheet] Saving config with full_code:", configData);

      console.log("[EditTypeSheet] About to save with data:", JSON.stringify(configData, null, 2));

      if (existingConfig) {
        console.log("[EditTypeSheet] Updating existing config:", existingConfig.id);
        const { data, error: updateError } = await supabase
          .from("element_type_configs")
          .update(configData)
          .eq("id", existingConfig.id)
          .select();

        if (updateError) {
          console.error("[EditTypeSheet] Update error details:", {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
            configData: configData
          });
          throw new Error(`Error updating: ${updateError.message || 'Unknown error'}`);
        }
        console.log("[EditTypeSheet] Update successful:", data);
      } else {
        console.log("[EditTypeSheet] Inserting new config");
        const { data, error: insertError } = await supabase
          .from("element_type_configs")
          .insert([configData])
          .select();

        if (insertError) {
          console.error("[EditTypeSheet] Insert error details:", {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
            configData: configData
          });
          throw new Error(`Error inserting: ${insertError.message || 'Unknown error'}`);
        }
        console.log("[EditTypeSheet] Insert successful:", data);
      }

      toast.success(language === 'ca' ? "Configuració guardada correctament" : "Configuración guardada correctamente");
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("[EditTypeSheet] Error saving config - Full details:", {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        stack: error?.stack
      });
      toast.error(language === 'ca' ? `Error al guardar: ${error?.message || 'Error desconegut'}` : `Error al guardar: ${error?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const labels = {
    ca: {
      title: "Editar tipus",
      customName: "Nom personalitzat",
      customNamePlaceholder: `Nom original: ${typeName}`,
      description: "Descripció",
      descriptionPlaceholder: "Afegeix una descripció...",
      preferredUnit: "Unitat preferida",
      chapter: "Capítol",
      chapterPlaceholder: "Selecciona un capítol",
      subchapter: "Subcapítol",
      subchapterPlaceholder: "Selecciona un subcapítol",
      subsubchapter: "Sub-subcapítol",
      subsubchapterPlaceholder: "Selecciona un sub-subcapítol",
      cancel: "Cancel·lar",
      save: "Guardar",
    },
    es: {
      title: "Editar tipo",
      customName: "Nombre personalizado",
      customNamePlaceholder: `Nombre original: ${typeName}`,
      description: "Descripción",
      descriptionPlaceholder: "Añade una descripción...",
      preferredUnit: "Unidad preferida",
      chapter: "Capítulo",
      chapterPlaceholder: "Selecciona un capítulo",
      subchapter: "Subcapítulo",
      subchapterPlaceholder: "Selecciona un subcapítulo",
      subsubchapter: "Sub-subcapítulo",
      subsubchapterPlaceholder: "Selecciona un sub-subcapítulo",
      cancel: "Cancelar",
      save: "Guardar",
    }
  };

  const getFilteredSubchapters = () => {
    if (!chapterId) return [];
    const chapter = visibleChapters.find(c => `${c.code}` === chapterId);
    // Filter out hidden subchapters
    return (chapter?.subchapters || []).filter(sub => !isHidden(sub.code));
  };

  const getFilteredSubsubchapters = () => {
    if (!chapterId || !subchapterId) return [];
    const chapter = visibleChapters.find(c => `${c.code}` === chapterId);
    const subchapter = chapter?.subchapters.find(sc => `${sc.code}` === subchapterId);
    // Filter out hidden subsubchapters
    return (subchapter?.subsubchapters || []).filter(subsub => !isHidden(subsub.code));
  };

  const t = labels[language];

  console.log("[EditTypeSheet] Rendering - open:", open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.title}</SheetTitle>
          <SheetDescription>
            {ifcCategory} - {typeName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="customName">{t.customName}</Label>
            <Input
              id="customName"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={t.customNamePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t.description}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descriptionPlaceholder}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredUnit">{t.preferredUnit}</Label>
            <Select value={preferredUnit} onValueChange={(value) => setPreferredUnit(value as "UT" | "ML" | "M2" | "M3" | "KG")}>
              <SelectTrigger id="preferredUnit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UT">UT (Unitats)</SelectItem>
                <SelectItem value="ML">ML (Metres lineals)</SelectItem>
                <SelectItem value="M2">M² (Metres quadrats)</SelectItem>
                <SelectItem value="M3">M³ (Metres cúbics)</SelectItem>
                <SelectItem value="KG">KG (Quilograms)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter">{t.chapter}</Label>
            <div className="flex gap-2">
              <Select 
                value={chapterId || undefined} 
                onValueChange={(value) => {
                  setChapterId(value);
                  setSubchapterId("");
                  setSubsubchapterId("");
                }}
              >
                <SelectTrigger id="chapter" className="flex-1">
                  <SelectValue placeholder={t.chapterPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {visibleChapters.map((chapter) => (
                    <SelectItem key={chapter.code} value={chapter.code}>
                      {chapter.code} - {getTranslatedName(chapter.code, chapter.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {chapterId && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    setChapterId("");
                    setSubchapterId("");
                    setSubsubchapterId("");
                  }}
                  type="button"
                >
                  ×
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subchapter">{t.subchapter}</Label>
            <div className="flex gap-2">
              <Select 
                value={subchapterId || undefined} 
                onValueChange={(value) => {
                  setSubchapterId(value);
                  setSubsubchapterId("");
                }}
                disabled={!chapterId}
              >
                <SelectTrigger id="subchapter" className="flex-1">
                  <SelectValue placeholder={t.subchapterPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredSubchapters().map((subchapter) => (
                    <SelectItem key={subchapter.code} value={subchapter.code}>
                      {subchapter.code} - {subchapter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subchapterId && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    setSubchapterId("");
                    setSubsubchapterId("");
                  }}
                  type="button"
                >
                  ×
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subsubchapter">{t.subsubchapter}</Label>
            <div className="flex gap-2">
              <Select 
                value={subsubchapterId || undefined} 
                onValueChange={setSubsubchapterId}
                disabled={!subchapterId}
              >
                <SelectTrigger id="subsubchapter" className="flex-1">
                  <SelectValue placeholder={t.subsubchapterPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredSubsubchapters().map((subsubchapter) => (
                    <SelectItem 
                      key={subsubchapter.code} 
                      value={subsubchapter.code}
                      title={subsubchapter.level4Items ? subsubchapter.level4Items.join(' | ') : ''}
                    >
                      {subsubchapter.code} - {subsubchapter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subsubchapterId && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setSubsubchapterId("")}
                  type="button"
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t.cancel}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (language === 'ca' ? 'Guardant...' : 'Guardando...') : t.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

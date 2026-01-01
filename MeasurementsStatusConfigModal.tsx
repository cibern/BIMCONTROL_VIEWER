import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Viewer } from "@xeokit/xeokit-sdk";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle } from "@/components/ui/nested-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface MeasurementsStatusConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string | null;
  viewer: Viewer | null;
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
}

interface ElementData {
  ut: number;
  marca?: string;
  comentarios?: string;
  length: number;
  area: number;
  volume: number;
  mass: number;
}

interface Chapter {
  id: string;
  name: string;
}

interface Subchapter {
  id: string;
  name: string;
}

// Funció auxiliar per obtenir el metaModel
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

// Funció per obtenir el nom del tipus
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

export const MeasurementsStatusConfigModal = ({
  open,
  onOpenChange,
  centerId,
  viewer,
  versionId,
}: MeasurementsStatusConfigModalProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [elements, setElements] = useState<ElementTypeConfig[]>([]);
  const [chapters, setChapters] = useState<Record<string, Chapter>>({});
  const [subchapters, setSubchapters] = useState<Record<string, Subchapter>>({});
  const [loading, setLoading] = useState(true);
  const [elementDataMap, setElementDataMap] = useState<Map<string, ElementData[]>>(new Map());
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    if (open && centerId && viewer) {
      loadData();
      processViewerData();
    }
  }, [open, centerId, viewer, versionId]);

  const processViewerData = () => {
    if (!viewer) return;

    try {
      const metaModel: any = getMetaModel(viewer);
      if (!metaModel?.metaObjects) {
        console.error("No metaObjects available");
        return;
      }

      const metaObjects = metaModel.metaObjects;
      const dataMap = new Map<string, ElementData[]>();

      for (const id of Object.keys(metaObjects)) {
        const mo = metaObjects[id];
        if (!mo) continue;

        const ifcCategory = mo.type || "Desconegut";
        const typeName = getNiceTypeName(mo);
        const marca = getMarca(mo);
        const comentarios = getComentarios(mo);
        
        const length = getLengthAny(mo) || 0;
        const area = getAreaAny(mo) || 0;
        const volume = getVolumeAny(mo) || 0;
        const mass = getMassAny(mo) || 0;

        const key = `${ifcCategory}|${typeName}`;
        if (!dataMap.has(key)) {
          dataMap.set(key, []);
        }

        dataMap.get(key)!.push({
          ut: 1,
          marca,
          comentarios,
          length,
          area,
          volume,
          mass,
        });
      }

      setElementDataMap(dataMap);
    } catch (error) {
      console.error("Error processing viewer data:", error);
    }
  };

  const loadData = async () => {
    if (!centerId) return;

    setLoading(true);
    try {
      // Construir query per element_type_configs amb filtre de versionId
      let elementsQuery = supabase
        .from("element_type_configs")
        .select("*")
        .eq("center_id", centerId);
      
      // Filtrar per version_id si existeix
      if (versionId) {
        elementsQuery = elementsQuery.eq("version_id", versionId);
      } else {
        elementsQuery = elementsQuery.is("version_id", null);
      }

      const [elementsRes, chaptersRes, subchaptersRes] = await Promise.all([
        elementsQuery.order("ifc_category"),
        supabase
          .from("chapters")
          .select("*")
          .eq("center_id", centerId),
        supabase
          .from("subchapters")
          .select("*")
          .eq("center_id", centerId),
      ]);

      if (elementsRes.error) throw elementsRes.error;
      if (chaptersRes.error) throw chaptersRes.error;
      if (subchaptersRes.error) throw subchaptersRes.error;

      setElements(elementsRes.data || []);
      
      const chaptersMap: Record<string, Chapter> = {};
      (chaptersRes.data || []).forEach((ch) => {
        chaptersMap[ch.id] = ch;
      });
      setChapters(chaptersMap);

      const subchaptersMap: Record<string, Subchapter> = {};
      (subchaptersRes.data || []).forEach((sub) => {
        subchaptersMap[sub.id] = sub;
      });
      setSubchapters(subchaptersMap);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: language === 'ca' ? "No s'han pogut carregar les dades" : "No se han podido cargar los datos",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTutorial = () => {
    setTutorialOpen(true);
  };

  const isEdited = (element: ElementTypeConfig) => {
    return element.chapter_id !== null || element.subchapter_id !== null;
  };

  const getElementStats = (ifcCategory: string) => {
    const categoryElements = elements.filter(e => e.ifc_category === ifcCategory);
    const totalTypes = categoryElements.length;
    const editedElements = categoryElements.filter(e => isEdited(e)).length;
    const pendingElements = totalTypes - editedElements;
    
    // Calcular total d'exemplars
    let totalExemplars = 0;
    categoryElements.forEach(element => {
      const key = `${element.ifc_category}|${element.type_name}`;
      const data = elementDataMap.get(key) || [];
      totalExemplars += data.length;
    });

    return { totalTypes, totalExemplars, editedElements, pendingElements };
  };

  const getElementData = (element: ElementTypeConfig): ElementData => {
    const key = `${element.ifc_category}|${element.type_name}`;
    const dataArray = elementDataMap.get(key) || [];
    
    // Agregem totes les dades
    const aggregated: ElementData = {
      ut: dataArray.length,
      length: 0,
      area: 0,
      volume: 0,
      mass: 0,
    };

    dataArray.forEach(data => {
      aggregated.length += data.length;
      aggregated.area += data.area;
      aggregated.volume += data.volume;
      aggregated.mass += data.mass;
    });

    // Afegir marca si n'hi ha
    const uniqueMarques = new Set(dataArray.map(d => d.marca).filter(Boolean));
    if (uniqueMarques.size > 0) {
      aggregated.marca = Array.from(uniqueMarques).join(", ");
    }

    // Afegir comentarios si n'hi ha
    const uniqueComentarios = new Set(dataArray.map(d => d.comentarios).filter(Boolean));
    if (uniqueComentarios.size > 0) {
      aggregated.comentarios = Array.from(uniqueComentarios).join(", ");
    }

    return aggregated;
  };

  // Agrupar elements per IFC category
  const groupedElements = elements.reduce((acc, element) => {
    if (!acc[element.ifc_category]) {
      acc[element.ifc_category] = [];
    }
    acc[element.ifc_category].push(element);
    return acc;
  }, {} as Record<string, ElementTypeConfig[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-2xl font-bold">
              {language === 'ca' ? "Estat d'amidaments - Configuració" : "Estado de mediciones - Configuración"}
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              {language === 'ca' 
                ? "Elements del projecte. Els elements amb fons groc han estat classificats en capítols/subcapítols."
                : "Elementos del proyecto. Los elementos con fondo amarillo han sido clasificados en capítulos/subcapítulos."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end mt-4 flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleTutorial}
              className="gap-2"
            >
              <Info className="h-4 w-4" />
              Tutorial
            </Button>
          </div>

        {loading ? (
          <div className="mt-6 p-4 border rounded-lg bg-muted/50 flex-shrink-0">
            <p className="text-sm text-muted-foreground text-center">
              {language === 'ca' ? 'Carregant...' : 'Cargando...'}
            </p>
          </div>
        ) : elements.length === 0 ? (
          <div className="mt-6 p-4 border rounded-lg bg-muted/50 flex-shrink-0">
            <p className="text-sm text-muted-foreground text-center">
              {language === 'ca' ? 'No hi ha elements disponibles' : 'No hay elementos disponibles'}
            </p>
          </div>
        ) : (
          <div className="flex-1 mt-6 overflow-y-auto pr-4 pb-4">
            <Accordion type="multiple" className="w-full space-y-2">
              {Object.entries(groupedElements).map(([ifcCategory, categoryElements]) => {
                const stats = getElementStats(ifcCategory);
                return (
                  <AccordionItem key={ifcCategory} value={ifcCategory}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-semibold">{ifcCategory}</span>
                        <span className="text-sm text-muted-foreground">
                          {stats.totalTypes} {language === 'ca' ? 'tipus' : 'tipos'} | {stats.totalExemplars} {stats.totalExemplars === 1 
                            ? (language === 'ca' ? 'exemplar' : 'ejemplar') 
                            : (language === 'ca' ? 'exemplars' : 'ejemplares')} | {stats.editedElements} {language === 'ca' ? 'editats' : 'editados'} | {stats.pendingElements} {language === 'ca' ? 'pendents' : 'pendientes'}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === 'ca' ? 'Nom' : 'Nombre'}</TableHead>
                              <TableHead className="text-center">UT</TableHead>
                              <TableHead className="text-center">ML</TableHead>
                              <TableHead className="text-center">M²</TableHead>
                              <TableHead className="text-center">M³</TableHead>
                              <TableHead className="text-center">KG</TableHead>
                              <TableHead>{language === 'ca' ? 'Exemplar' : 'Ejemplar'}</TableHead>
                              <TableHead>{language === 'ca' ? 'Comentaris' : 'Comentarios'}</TableHead>
                              <TableHead>{language === 'ca' ? 'Unitat' : 'Unidad'}</TableHead>
                              <TableHead>{language === 'ca' ? 'Capítol' : 'Capítulo'}</TableHead>
                              <TableHead>{language === 'ca' ? 'Subcapítol' : 'Subcapítulo'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categoryElements.map((element) => {
                              const data = getElementData(element);
                              const edited = isEdited(element);
                              return (
                                <TableRow
                                  key={element.id}
                                  className={cn(
                                    edited && "bg-yellow-200/70 dark:bg-yellow-700/30 hover:bg-yellow-200/90 dark:hover:bg-yellow-700/40"
                                  )}
                                >
                                  <TableCell className="font-medium">
                                    {element.custom_name || element.type_name}
                                  </TableCell>
                                  <TableCell className="text-center">{data.ut}</TableCell>
                                  <TableCell className="text-center">
                                    {data.length > 0 ? data.length.toFixed(2) : "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {data.area > 0 ? data.area.toFixed(2) : "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {data.volume > 0 ? data.volume.toFixed(2) : "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {data.mass > 0 ? data.mass.toFixed(2) : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {data.marca || "-"}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {data.comentarios || "-"}
                                  </TableCell>
                                  <TableCell>{element.preferred_unit}</TableCell>
                                  <TableCell>
                                    {element.chapter_id && chapters[element.chapter_id]
                                      ? chapters[element.chapter_id].name
                                      : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {element.subchapter_id && subchapters[element.subchapter_id]
                                      ? subchapters[element.subchapter_id].name
                                      : "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
        </DialogContent>
      </Dialog>

      <NestedDialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <NestedDialogContent className="max-w-[98vw] max-h-[95vh]">
          <NestedDialogHeader>
            <NestedDialogTitle>
              {language === 'ca' ? "Tutorial - Estat d'amidaments - Configuració" : "Tutorial - Estado de mediciones - Configuración"}
            </NestedDialogTitle>
          </NestedDialogHeader>
          <div className="p-6">
            <p className="text-muted-foreground">
              {language === 'ca' ? 'Contingut del tutorial (en construcció)' : 'Contenido del tutorial (en construcción)'}
            </p>
          </div>
        </NestedDialogContent>
      </NestedDialog>
    </>
  );
};

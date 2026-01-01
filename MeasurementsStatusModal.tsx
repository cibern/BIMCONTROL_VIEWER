import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface MeasurementRow {
  type: string;
  unit: string;
  qty: number;
  cnt: number;
  approxCount: number;
}

interface Subgroup {
  subchapter: string;
  rows: MeasurementRow[];
  totals: { qty: number; cnt: number };
}

interface Chapter {
  chapter: string;
  subgroups: Subgroup[];
  totals: { qty: number; cnt: number };
}

interface MeasurementsData {
  chapters: Chapter[];
  totals: { qty: number; cnt: number };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: any;
}

type SortKey = "type" | "unit" | "qty" | "cnt";
type SortDir = "asc" | "desc";

const CHAPTER_KEYS = new Set([
  "chapter", "capitol", "capitulo", "capítulo", "uniformat", "uniclass", "csi",
  "assemblycode", "assembly", "keynote", "notaclave", "nota clave", "partida", 
  "capitolid", "capitolcode"
].map(s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "")));

const SUBCHAP_KEYS = new Set([
  "subchapter", "subcapitol", "subcapitulo", "subcapítulo", "subcategory",
  "assemblydescription", "assembly description", "partidatitol", "partida titulo", 
  "subcapitolid", "subcapitolcode"
].map(s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "")));

const AREA_KEYS = new Set([
  "netsidearea", "grosssidearea", "netarea", "grossarea", "area", "footprintarea",
  "grossfootprintarea", "externalsurfacearea", "surfacearea", "glazedarea", "sidearea", "projectedarea"
].map(s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "")));

const VOL_KEYS = new Set(["netvolume", "grossvolume", "volume", "volumen", "volum"]
  .map(s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "")));

const LEN_KEYS = new Set(["length", "perimeter", "longitud", "perimetre", "perimetro"]
  .map(s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "")));

const MASS_KEYS = new Set(["mass", "massa", "peso", "weight"]
  .map(s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "")));

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

function normStr(s: any): string {
  if (s == null) return "";
  const v = typeof s === "object" ? (s.value ?? s.Value ?? s) : s;
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function normKey(s: any): string {
  return normStr(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-\.]/g, "");
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
  for (const k of Object.keys(p)) {
    if (k.toLowerCase().includes("type")) add(p[k], 7);
  }

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

function findFirstPropByKeys(mo: any, keySet: Set<string>): string {
  const psets = mo?.propertySets;
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const arr = ps?.properties;
      if (!Array.isArray(arr)) continue;
      for (const p of arr) {
        const nk = normKey(p?.name ?? p?.Name);
        if (keySet.has(nk)) return normStr(p?.value ?? p?.Value ?? p);
      }
    }
  }
  const props = mo?.props;
  if (props && typeof props === "object") {
    if (Array.isArray(props.properties)) {
      for (const p of props.properties) {
        const nk = normKey(p?.name ?? p?.Name);
        if (keySet.has(nk)) return normStr(p?.value ?? p?.Value ?? p);
      }
    }
    for (const k of Object.keys(props)) {
      const nk = normKey(k);
      if (keySet.has(nk)) return normStr(props[k]);
    }
  }
  return "";
}

function getChapter(mo: any): string {
  const c = findFirstPropByKeys(mo, CHAPTER_KEYS);
  if (c) return c;
  const t = String(mo?.type || "").toLowerCase();
  if (t.startsWith("ifcwall")) return "01 · Murs";
  if (t.startsWith("ifcslab")) return "02 · Lloses / Sòls";
  if (t.startsWith("ifcroof")) return "03 · Cobertes";
  if (t.startsWith("ifcwindow")) return "04 · Finestres";
  if (t.startsWith("ifcdoor")) return "05 · Portes";
  if (t.startsWith("ifccolumn")) return "06 · Columnes";
  if (t.startsWith("ifcbeam")) return "07 · Bigues";
  return "99 · Altres";
}

function getSubchapter(mo: any): string {
  return findFirstPropByKeys(mo, SUBCHAP_KEYS) || "";
}

function scanArrayForBest(arr: any[], keySet: Set<string>): number | null {
  if (!Array.isArray(arr)) return null;
  for (const p of arr) {
    const nk = normKey(p?.name ?? p?.Name);
    if (keySet.has(nk)) {
      const n = toNum(p?.value ?? p?.Value ?? p);
      if (n != null && n > 0) return n;
    }
  }
  return null;
}

function getByKeysFromProps(mo: any, keySet: Set<string>): number | null {
  const psets = mo?.propertySets;
  if (Array.isArray(psets)) {
    for (const ps of psets) {
      const v = scanArrayForBest(ps?.properties, keySet);
      if (v != null) return v;
    }
  }
  const props = mo?.props;
  if (props && typeof props === "object") {
    if (Array.isArray(props.properties)) {
      const v = scanArrayForBest(props.properties, keySet);
      if (v != null) return v;
    }
    for (const k of Object.keys(props)) {
      const nk = normKey(k);
      if (keySet.has(nk)) {
        const n = toNum(props[k]);
        if (n != null && n > 0) return n;
      }
    }
  }
  return null;
}

function getAreaAny(mo: any, viewer: any, id: string): { value: number; source: string } | null {
  const ifc = getByKeysFromProps(mo, AREA_KEYS);
  if (ifc != null) return { value: ifc, source: "IFC" };
  try {
    const ent = viewer?.scene?.objects?.[id];
    const aabb = ent?.aabb;
    if (aabb && aabb.length === 6) {
      const [minx, miny, minz, maxx, maxy, maxz] = aabb;
      const sx = Math.max(0, maxx - minx);
      const sy = Math.max(0, maxy - miny);
      const sz = Math.max(0, maxz - minz);
      const area = Math.max(sx * sy, sy * sz, sx * sz);
      if (area > 0) return { value: area, source: "AABB2D" };
    }
  } catch {}
  return null;
}

function getVolumeAny(mo: any): { value: number; source: string } | null {
  const ifc = getByKeysFromProps(mo, VOL_KEYS);
  if (ifc != null) return { value: ifc, source: "IFC" };
  return null;
}

function getLengthAny(mo: any): { value: number; source: string } | null {
  const ifc = getByKeysFromProps(mo, LEN_KEYS);
  if (ifc != null) return { value: ifc, source: "IFC" };
  return null;
}

function getMassAny(mo: any): { value: number; source: string } | null {
  const ifc = getByKeysFromProps(mo, MASS_KEYS);
  if (ifc != null) return { value: ifc, source: "IFC" };
  return null;
}

function pickUnitAndValue(mo: any, viewer: any, id: string): { unit: string; value: number; approx: boolean } {
  const t = String(mo?.type || "").toLowerCase();
  const preferArea = t.startsWith("ifcwall") || t.startsWith("ifcslab") ||
    t.startsWith("ifcwindow") || t.startsWith("ifcdoor") || t.startsWith("ifcroof");

  const A = getAreaAny(mo, viewer, id);
  const V = getVolumeAny(mo);
  const L = getLengthAny(mo);
  const M = getMassAny(mo);

  if (preferArea && A?.value && A.value > 0) return { unit: "M2", value: A.value, approx: A.source !== "IFC" };
  if (A?.value && A.value > 0) return { unit: "M2", value: A.value, approx: A.source !== "IFC" };
  if (V?.value && V.value > 0) return { unit: "M3", value: V.value, approx: V.source !== "IFC" };
  if (L?.value && L.value > 0) return { unit: "ML", value: L.value, approx: false };
  if (M?.value && M.value > 0) return { unit: "KG", value: M.value, approx: false };
  return { unit: "UT", value: 1, approx: false };
}

function computeGlobal(viewer: any): MeasurementsData {
  console.log("🔍 computeGlobal - viewer:", viewer);
  
  // Try different paths to access metaObjects
  let mos: any = null;
  
  // Path 1: viewer.metaScene.metaModels
  if (viewer?.metaScene?.metaModels) {
    const mm = viewer.metaScene.metaModels;
    const modelIds = Object.keys(mm);
    console.log("📦 Found modelIds via metaScene:", modelIds);
    if (modelIds.length) {
      const firstModel = mm[modelIds[0]];
      mos = firstModel?.metaObjects;
      console.log("✅ Path 1: metaScene.metaModels.metaObjects -", mos ? Object.keys(mos).length + " objects" : "null");
    }
  }
  
  // Path 2: Direct scene.models
  if (!mos && viewer?.scene?.models) {
    console.log("🔄 Trying Path 2: scene.models");
    const models = Object.values(viewer.scene.models);
    console.log("📦 Found models via scene:", models.length);
    if (models.length > 0) {
      const firstModel: any = models[0];
      // Try to get objects from model
      if (firstModel?.objects) {
        console.log("✅ Path 2: Found objects in model:", Object.keys(firstModel.objects).length);
        // Convert scene objects to metaObjects format
        const sceneObjects = firstModel.objects;
        mos = {};
        for (const id of Object.keys(sceneObjects)) {
          const obj = sceneObjects[id];
          // Try to find corresponding metaObject
          if (viewer?.metaScene?.metaObjects?.[id]) {
            mos[id] = viewer.metaScene.metaObjects[id];
          }
        }
        console.log("📊 Converted metaObjects count:", Object.keys(mos).length);
      }
    }
  }
  
  // Path 3: Direct metaScene.metaObjects
  if (!mos && viewer?.metaScene?.metaObjects) {
    console.log("🔄 Trying Path 3: metaScene.metaObjects");
    mos = viewer.metaScene.metaObjects;
    console.log("✅ Path 3: metaScene.metaObjects -", Object.keys(mos).length + " objects");
  }
  
  if (!mos || Object.keys(mos).length === 0) {
    console.log("❌ No metaObjects found in any path");
    console.log("Viewer structure:", {
      hasMetaScene: !!viewer?.metaScene,
      hasMetaModels: !!viewer?.metaScene?.metaModels,
      hasMetaObjects: !!viewer?.metaScene?.metaObjects,
      hasScene: !!viewer?.scene,
      hasModels: !!viewer?.scene?.models,
    });
    return { chapters: [], totals: { qty: 0, cnt: 0 } };
  }

  console.log("📊 Processing", Object.keys(mos).length, "metaObjects");
  const chapters = new Map<string, Map<string, Map<string, MeasurementRow>>>();

  let processedCount = 0;
  for (const id of Object.keys(mos)) {
    const mo = mos[id];
    if (!mo) continue;
    
    processedCount++;
    if (processedCount <= 3) {
      console.log(`🔍 Sample object ${processedCount}:`, {
        id,
        type: mo.type,
        hasProps: !!mo.props,
        hasPropertySets: !!mo.propertySets
      });
    }

    const chap = getChapter(mo) || "—";
    const sub = getSubchapter(mo) || "—";
    const typeName = getNiceTypeName(mo) || "Desconegut";

    const { unit, value, approx } = pickUnitAndValue(mo, viewer, id);
    const key = `${typeName}__${unit}`;

    let mSub = chapters.get(chap);
    if (!mSub) {
      mSub = new Map();
      chapters.set(chap, mSub);
    }

    let mRows = mSub.get(sub);
    if (!mRows) {
      mRows = new Map();
      mSub.set(sub, mRows);
    }

    let row = mRows.get(key);
    if (!row) {
      row = { type: typeName, unit, qty: 0, cnt: 0, approxCount: 0 };
      mRows.set(key, row);
    }
    row.cnt += 1;
    row.qty += value || 0;
    if (approx) row.approxCount += 1;
  }

  const chaptersArr: Chapter[] = [];
  for (const [chap, subMap] of chapters.entries()) {
    const subsArr: Subgroup[] = [];
    let chapTotals = { qty: 0, cnt: 0 };

    for (const [sub, rowsMap] of subMap.entries()) {
      const rows = Array.from(rowsMap.values());
      const subTotals = {
        qty: rows.reduce((s, r) => s + r.qty, 0),
        cnt: rows.reduce((s, r) => s + r.cnt, 0)
      };
      chapTotals.qty += subTotals.qty;
      chapTotals.cnt += subTotals.cnt;
      subsArr.push({ subchapter: sub, rows, totals: subTotals });
    }

    subsArr.sort((a, b) =>
      String(a.subchapter).localeCompare(String(b.subchapter), undefined, { sensitivity: "base" })
    );

    chaptersArr.push({ chapter: chap, subgroups: subsArr, totals: chapTotals });
  }

  chaptersArr.sort((a, b) =>
    String(a.chapter).localeCompare(String(b.chapter), undefined, { sensitivity: "base" })
  );

  const grandTotals = {
    qty: chaptersArr.reduce((s, c) => s + c.totals.qty, 0),
    cnt: chaptersArr.reduce((s, c) => s + c.totals.cnt, 0)
  };

  return { chapters: chaptersArr, totals: grandTotals };
}

function fmt(n: number | null, digits = 2): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

function sortRows(rows: MeasurementRow[], key: SortKey, dir: SortDir): MeasurementRow[] {
  const asc = dir === "asc";
  const arr = [...rows];

  if (key === "type") {
    arr.sort((a, b) => asc
      ? String(a.type).localeCompare(String(b.type), undefined, { sensitivity: "base" })
      : String(b.type).localeCompare(String(a.type), undefined, { sensitivity: "base" })
    );
  } else if (key === "unit") {
    arr.sort((a, b) => asc
      ? String(a.unit).localeCompare(String(b.unit))
      : String(b.unit).localeCompare(String(a.unit))
    );
  } else if (key === "qty") {
    arr.sort((a, b) => asc ? a.qty - b.qty : b.qty - a.qty);
  } else if (key === "cnt") {
    arr.sort((a, b) => asc ? a.cnt - b.cnt : b.cnt - a.cnt);
  }

  return arr;
}

export function MeasurementsStatusModal({ open, onOpenChange, viewer }: Props) {
  const { language } = useLanguage();
  const [sortKey, setSortKey] = useState<SortKey>("type");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedSubchapters, setExpandedSubchapters] = useState<Set<string>>(new Set());

  const data = useMemo(() => {
    console.log("🎯 useMemo data - open:", open, "viewer:", viewer);
    if (!open || !viewer) {
      console.log("⚠️ Modal tancat o viewer null");
      return { chapters: [], totals: { qty: 0, cnt: 0 } };
    }
    console.log("✅ Cridant computeGlobal...");
    return computeGlobal(viewer);
  }, [open, viewer]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleChapter = (chapter: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapter)) {
      newExpanded.delete(chapter);
    } else {
      newExpanded.add(chapter);
    }
    setExpandedChapters(newExpanded);
  };

  const toggleSubchapter = (subKey: string) => {
    const newExpanded = new Set(expandedSubchapters);
    if (newExpanded.has(subKey)) {
      newExpanded.delete(subKey);
    } else {
      newExpanded.add(subKey);
    }
    setExpandedSubchapters(newExpanded);
  };

  const exportCSV = () => {
    const rows = [[language === 'ca' ? "Capítol" : "Capítulo", language === 'ca' ? "Subcapítol" : "Subcapítulo", language === 'ca' ? "Nom (tipus)" : "Nombre (tipo)", language === 'ca' ? "Unitats" : "Unidades", language === 'ca' ? "Mesura" : "Medida", language === 'ca' ? "Unitats (#)" : "Unidades (#)", language === 'ca' ? "Aprox?" : "¿Aprox?"]];
    for (const chap of data.chapters) {
      for (const sg of chap.subgroups) {
        for (const r of sg.rows) {
          rows.push([
            chap.chapter,
            sg.subchapter || "",
            r.type,
            r.unit,
            String(r.unit === "UT" ? Math.round(r.qty) : Number(r.qty.toFixed(4))),
            String(r.cnt),
            r.approxCount ? (language === 'ca' ? "sí" : "sí") : "no"
          ]);
        }
      }
    }
    const csv = rows.map(line => line.map(v => {
      const s = String(v).replace(/\r?\n/g, " ");
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = language === 'ca' ? "Estat_Amidaments.csv" : "Estado_Mediciones.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  const title = language === "ca" ? "Estat d'amidaments" : "Estado de mediciones";
  const totalsText = language === "ca" ? "Totals" : "Totales";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogTitle>{title}</DialogTitle>
        
        <div className="flex-1 overflow-auto">
          <div className="mb-4 text-sm text-muted-foreground">
            {totalsText}: {fmt(data.totals.qty, 2)} · # {fmt(data.totals.cnt, 0)}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 w-[35%]">{language === 'ca' ? 'Capítol / Subcapítol' : 'Capítulo / Subcapítulo'}</th>
                  <th 
                    className="text-left p-3 cursor-pointer hover:bg-muted-foreground/10"
                    onClick={() => handleSort("type")}
                  >
                    {language === 'ca' ? 'Nom (tipus)' : 'Nombre (tipo)'} {sortKey === "type" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-right p-3 cursor-pointer hover:bg-muted-foreground/10"
                    onClick={() => handleSort("unit")}
                  >
                    {language === 'ca' ? 'Unitats' : 'Unidades'} {sortKey === "unit" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-right p-3 cursor-pointer hover:bg-muted-foreground/10"
                    onClick={() => handleSort("qty")}
                  >
                    {language === 'ca' ? 'Mesura' : 'Medida'} {sortKey === "qty" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-right p-3 cursor-pointer hover:bg-muted-foreground/10"
                    onClick={() => handleSort("cnt")}
                  >
                    # UT {sortKey === "cnt" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.chapters.map((chap, chapIdx) => {
                  const chapKey = `chap-${chapIdx}`;
                  const isChapExpanded = expandedChapters.has(chapKey);

                  return (
                    <>
                      <tr key={chapKey} className="bg-primary/10 font-semibold border-t">
                        <td className="p-3">
                          <button
                            onClick={() => toggleChapter(chapKey)}
                            className="flex items-center gap-2 hover:text-primary"
                          >
                            {isChapExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {chap.chapter}
                          </button>
                        </td>
                        <td colSpan={2} className="p-3"></td>
                        <td className="p-3 text-right">{fmt(chap.totals.qty, 2)}</td>
                        <td className="p-3 text-right">{fmt(chap.totals.cnt, 0)}</td>
                      </tr>

                      {isChapExpanded && chap.subgroups.map((sg, sgIdx) => {
                        const subKey = `${chapKey}-sub-${sgIdx}`;
                        const isSubExpanded = expandedSubchapters.has(subKey);
                        const sortedRows = sortRows(sg.rows, sortKey, sortDir);

                        return (
                          <>
                            <tr key={subKey} className="bg-primary/5 border-t">
                              <td className="p-3 pl-8">
                                <button
                                  onClick={() => toggleSubchapter(subKey)}
                                  className="flex items-center gap-2 hover:text-primary"
                                >
                                  {isSubExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  {sg.subchapter}
                                </button>
                              </td>
                              <td className="p-3"></td>
                              <td className="p-3"></td>
                              <td className="p-3 text-right">{fmt(sg.totals.qty, 2)}</td>
                              <td className="p-3 text-right">{fmt(sg.totals.cnt, 0)}</td>
                            </tr>

                            {isSubExpanded && sortedRows.map((r, rIdx) => (
                              <tr key={`${subKey}-row-${rIdx}`} className="border-t hover:bg-muted/50">
                                <td className="p-3 pl-12"></td>
                                <td className="p-3">
                                  {r.type}
                                  {r.approxCount > 0 && (
                                    <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded" title={language === 'ca' ? "Inclou valors aproximats" : "Incluye valores aproximados"}>
                                      ≈
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right">{r.unit}</td>
                                <td className="p-3 text-right">
                                  {fmt(r.qty, r.unit === "UT" ? 0 : 2)}
                                </td>
                                <td className="p-3 text-right">{fmt(r.cnt, 0)}</td>
                              </tr>
                            ))}
                          </>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted font-semibold border-t-2">
                <tr>
                  <td className="p-3">{language === 'ca' ? 'TOTAL GENERAL' : 'TOTAL GENERAL'}</td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right">{fmt(data.totals.qty, 2)}</td>
                  <td className="p-3 text-right">{fmt(data.totals.cnt, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={exportCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

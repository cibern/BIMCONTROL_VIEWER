import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import {
  Viewer,
  XKTLoaderPlugin,
  CxConverterIFCLoaderPlugin,
  NavCubePlugin,
  FastNavPlugin,
  SectionPlanesPlugin,
  AnnotationsPlugin,
  PhongMaterial,
  DistanceMeasurementsPlugin,
  DistanceMeasurementsMouseControl
} from "@xeokit/xeokit-sdk";
import * as CxConverter from "@creooxag/cxconverter";
import { useProjectThumbnail } from "@/hooks/useProjectThumbnail";
import { useModelElementCount } from "@/hooks/useModelElementCount";
import { useLanguage } from "@/contexts/LanguageContext";
import { useViewerState } from "@/contexts/ViewerStateContext";
import { Loader2, AlertCircle, Building2, Palette, Layers, DoorOpen, SquareDashed, Cuboid, FileText, MessageSquarePlus } from "lucide-react";
import { ModelLoadingOverlay } from "./ModelLoadingOverlay";
import { getCachedModel, cacheModel } from "@/hooks/useModelCache";
import { AnnotationModal, AnnotationType, getAnnotationTypeConfig } from "./AnnotationModal";
import { AnnotationDetailModal } from "./AnnotationDetailModal";
import { AnnotationsListModal } from "./AnnotationsListModal";
import { OffersListModal } from "./OffersListModal";
import { QuantificationTooltip } from "./QuantificationTooltip";
import { SpacePropertiesModal } from "./SpacePropertiesModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ModelTreeView } from "./ModelTreeView";
import { ViewerContextMenu } from "./ViewerContextMenu";
import { SectionHeightSlider } from "./SectionHeightSlider";
import { RoomsNavigator } from "./RoomsNavigator";
import { EditTypeSheet } from "./EditTypeSheet";
import { FloorPlanElementModal } from "./FloorPlanElementModal";
import { ElementInfoModal } from "./ElementInfoModal";
import { applyUGradientToWalls, clearUGradient } from "@/lib/upaint";
import { getValueByUnit } from "@/lib/ifcMeasurements";
import { 
  initMeasurementModals,
  showWallsMeasurements,
  showDoorsMeasurements,
  showWindowsMeasurements,
  showFloorMeasurements,
  showGlobalMeasurements
} from "@/lib/measurementsInit";
import "@/styles/measurements.css";
import "@/styles/measurementsDoors.css";
import "@/styles/measurementsFloor.css";
import "@/styles/measurementsWindow.css";
import "@/styles/measurementsGlobal.css";
import "@/styles/annotations.css";

interface Storey {
  id: string;
  name: string;
  elevation: number;
  aabb: number[];
}

interface XeokitViewerProps {
  ifcUrl?: string;
  exteriorTemperature?: number;
  overlayModels?: Array<{
    id: string;
    name: string;
    ifc_file_url: string;
    display_order: number;
    visible?: boolean;
  }>;
  projectId?: string;
  projectName?: string;
  versionId?: string;
  onContextMenuAddNote?: (viewpoint: { entityId: string; entityType?: string; camera?: any }) => void;
  city?: string;
  country?: string;
  centerId?: string;
  showAnnotations?: boolean;
  showMeasurements?: boolean;
  showViewTree?: boolean;
  showToggle3D?: boolean;
  showSliders?: boolean;
  showSectionSlider?: boolean;
  edgesEnabled?: boolean;
}

export interface XeokitViewerRef {
  setBaseModelOpacity: (opacity: number) => void;
  setEditedElementsOpacity: (opacity: number) => void;
  extractRooms: () => { name: string; level: string; area: number; maxOccupancy?: number }[];
  viewer: Viewer | null;
  isModelReady: boolean;
  currentModel: any;
}

export const XeokitViewer = forwardRef<XeokitViewerRef, XeokitViewerProps>(({ 
  ifcUrl, 
  exteriorTemperature = 20, 
  overlayModels = [], 
  projectId,
  projectName,
  versionId,
  onContextMenuAddNote, 
  city, 
  country, 
  centerId,
  showAnnotations = true,
  showMeasurements = true,
  showViewTree = true,
  showToggle3D = true,
  showSliders = true,
  showSectionSlider = true,
  edgesEnabled = true
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const xktLoaderRef = useRef<XKTLoaderPlugin | null>(null);
  const ifcLoaderRef = useRef<CxConverterIFCLoaderPlugin | null>(null);
  const navCubeRef = useRef<NavCubePlugin | null>(null);
  const sectionPlanesRef = useRef<SectionPlanesPlugin | null>(null);
  const sectionFillMeshRef = useRef<any>(null); // legacy (cleanup only)
  const sectionCapMaterialRef = useRef<any>(null); // PhongMaterial for true section caps
  const annotationsRef = useRef<AnnotationsPlugin | null>(null);
  const distanceMeasurementsRef = useRef<DistanceMeasurementsPlugin | null>(null);
  const distanceMeasurementsControlRef = useRef<DistanceMeasurementsMouseControl | null>(null);
  const currentModelRef = useRef<any>(null);
  const lastEntityRef = useRef<any>(null);
  const lastColorizeRef = useRef<number[] | null>(null);
  const isLoadingRef = useRef<boolean>(false);
  const isModelReadyRef = useRef<boolean>(false);
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string>("");
  const [fileSize, setFileSize] = useState<number | undefined>(undefined);
  const [loadedSize, setLoadedSize] = useState<number | undefined>(undefined);
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [hoveredMarca, setHoveredMarca] = useState<string | null>(null);
  const [floorPlanMode, setFloorPlanMode] = useState(false);
  const [storeys, setStoreys] = useState<Storey[]>([]);
  const [selectedStorey, setSelectedStorey] = useState<string>("");
  const [uGradientActive, setUGradientActive] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [viewerInitialized, setViewerInitialized] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(10); // Will be updated to max when model loads
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(10);
  const savedCameraState = useRef<{ eye: number[]; look: number[]; up: number[]; projection: string } | null>(null);
  const overlayModelsRef = useRef<Map<string, any>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; entityId: string; entityType?: string; worldPos?: [number, number, number] } | null>(null);
  const pickedEntityRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const { uGradientState, setUGradientState, baseModelOpacity } = useViewerState();
  const { captureAndUploadThumbnail } = useProjectThumbnail();
  const { updateTotalModelElements } = useModelElementCount();
  const thumbnailCapturedRef = useRef(false);
  const secretKeySequenceRef = useRef<string>("");
  const secretKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentOpacityRef = useRef<number>(baseModelOpacity / 100);
  const [extractedRooms, setExtractedRooms] = useState<Array<{ id: string; name: string; level: string; area: number; maxOccupancy?: number; aabb?: number[] }>>([]);
  const selectedWallsRef = useRef<Set<string>>(new Set());
  const currentRoomRef = useRef<{ id: string; name: string } | null>(null);
  const [annotationsMode, setAnnotationsMode] = useState(false);
  const annotationsModeRef = useRef(false);
  const [annotationsVisible, setAnnotationsVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem("viewer-annotations-visible");
    return saved === "true";
  });
  const [pendingAnnotation, setPendingAnnotation] = useState<{ worldPos: [number, number, number]; entityId?: string } | null>(null);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [showAnnotationDetailModal, setShowAnnotationDetailModal] = useState(false);
  const [selectedAnnotationData, setSelectedAnnotationData] = useState<any>(null);
  const annotationCounter = useRef(1);
  const [loadedAnnotations, setLoadedAnnotations] = useState<Set<string>>(new Set());
  const [showAnnotationsListModal, setShowAnnotationsListModal] = useState(false);
  const [showRequestsListModal, setShowRequestsListModal] = useState(false);
  const [showOffersListModal, setShowOffersListModal] = useState(false);
  const [editedElementsMode, setEditedElementsMode] = useState<"normal" | "highlight" | "only-edited" | "hide-edited" | "accepted-budget">("normal");
  const editedElementsRef = useRef<Map<string, { color: number[]; visible: boolean }>>(new Map()); // Store original state
  const highlightedElementIdsRef = useRef<Set<string>>(new Set()); // Store IDs of actually highlighted/edited elements
  const [roomsVisibilityMode, setRoomsVisibilityMode] = useState<"show" | "only" | "hide" | "zones" | "peces">(() => {
    const saved = localStorage.getItem("viewer-rooms-visibility-mode") as "show" | "only" | "hide" | "zones" | "peces" | null;
    return saved || "hide"; // Default to "hide" to match ViewerDropdown
  });
  const roomsOriginalStateRef = useRef<Map<string, { visible: boolean; color: number[] }>>(new Map()); // Store original visibility and color of rooms
  const hasWebGL2Ref = useRef<boolean>(false); // Track WebGL2 support for safe mobile rendering
  
  // State for distance measurements (acotacions)
  const [distanceMeasurementsActive, setDistanceMeasurementsActive] = useState(false);
  const distanceMeasurementsActiveRef = useRef(false); // Ref to track current state for event handlers
  const [distanceMeasurementsVisible, setDistanceMeasurementsVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem("viewer-distance-measurements-visible");
    return saved === "true";
  });
  
  // State for element info modal toggle
  const [elementInfoEnabled, setElementInfoEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("viewer-element-info-enabled");
    return saved !== "false"; // Default: true
  });
  const elementInfoEnabledRef = useRef(true);
  
  // Keep refs in sync with state
  useEffect(() => {
    distanceMeasurementsActiveRef.current = distanceMeasurementsActive;
  }, [distanceMeasurementsActive]);
  
  useEffect(() => {
    elementInfoEnabledRef.current = elementInfoEnabled;
  }, [elementInfoEnabled]);

  // State for edit type sheet from context menu
  const [showEditTypeSheet, setShowEditTypeSheet] = useState(false);
  const [editTypeSheetData, setEditTypeSheetData] = useState<{ ifcCategory: string; typeName: string } | null>(null);
  const [isProjectShared, setIsProjectShared] = useState(false);
  
  // State for quantification tooltip
  const [quantificationTooltip, setQuantificationTooltip] = useState<{
    data: {
      elementValue: number;
      totalValue: number;
      elementCount: number;
      typeName: string;
      ifcCategory: string;
      preferredUnit: string;
      customName?: string;
    } | null;
    position: { x: number; y: number } | null;
  }>({ data: null, position: null });
  const editedConfigsCacheRef = useRef<Map<string, any>>(new Map()); // Cache edited configs

  // State for space properties modal (when clicking on IfcSpace in "only spaces" mode)
  const [showSpacePropertiesModal, setShowSpacePropertiesModal] = useState(false);
  const [selectedSpaceMetaObject, setSelectedSpaceMetaObject] = useState<any>(null);
  const [selectedSpaceEntityId, setSelectedSpaceEntityId] = useState<string>("");

  // State for floor plan element modal (when clicking on element in floor plan mode)
  const [showFloorPlanElementModal, setShowFloorPlanElementModal] = useState(false);
  const [floorPlanElementData, setFloorPlanElementData] = useState<{
    entityId: string;
    ifcType: string;
    name: string;
    propertySets?: any[];
  } | null>(null);
  const floorPlanModeRef = useRef(false);
  
  // State for chapter filter modal (Estructura, Envolvent, Interiors)
  const [showChapterFilterModal, setShowChapterFilterModal] = useState(false);
  const [chapterFilterType, setChapterFilterType] = useState<"no-elements" | "success">("no-elements");
  const [chapterFilterElementCount, setChapterFilterElementCount] = useState(0);
  const [chapterFilterInfo, setChapterFilterInfo] = useState<{ code: string; name: string; color: number[] }>({ code: "30", name: "Envolvent", color: [0.4, 0.7, 1.0, 1.0] });
  const chapterFilterOriginalStateRef = useRef<Map<string, { visible: boolean; color: number[] }>>(new Map());

  // State for element info modal (when clicking on any element)
  const [showElementInfoModal, setShowElementInfoModal] = useState(false);
  const [elementInfoData, setElementInfoData] = useState<{
    entityId: string;
    ifcType: string;
    name: string;
    marca?: string | null;
    propertySets?: any[];
  } | null>(null);

  // Check if project is shared with suppliers
  useEffect(() => {
    const checkProjectVisibility = async () => {
      if (!projectId) {
        setIsProjectShared(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("project_supplier_visibility")
          .select("is_visible")
          .eq("project_id", projectId)
          .maybeSingle();
        
        if (error) {
          console.error("[XeokitViewer] Error checking project visibility:", error);
          return;
        }
        
        setIsProjectShared(data?.is_visible ?? false);
        console.log("[XeokitViewer] Project shared status:", data?.is_visible ?? false);
      } catch (err) {
        console.error("[XeokitViewer] Exception checking project visibility:", err);
      }
    };
    
    checkProjectVisibility();
  }, [projectId]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    setBaseModelOpacity: (opacity: number) => {
      currentOpacityRef.current = opacity;
      applyOpacityToBaseModel(opacity);
    },
    setEditedElementsOpacity: (opacity: number) => {
      applyOpacityToEditedElements(opacity);
    },
    extractRooms: () => {
      if (!currentModelRef.current) {
        console.warn("[XeokitViewer] Cannot extract rooms: no model loaded");
        return [];
      }
      return extractRoomsWithGeometry(currentModelRef.current.id);
    },
    viewer: viewerRef.current,
    isModelReady: modelReady,
    currentModel: currentModelRef.current
  }), [modelReady]);

  // Function to apply opacity to base model
  const applyOpacityToBaseModel = (opacity: number) => {
    if (!currentModelRef.current || !viewerRef.current) {
      console.warn("[XeokitViewer] Cannot apply opacity: model or viewer not ready");
      return;
    }

    try {
      const model = currentModelRef.current;
      const entities = Object.values(model.objects);
      
      entities.forEach((entity: any) => {
        if (entity && entity.opacity !== undefined) {
          entity.opacity = opacity;
        }
      });

      console.info("[XeokitViewer] Applied opacity to base model:", opacity);
    } catch (error) {
      console.error("[XeokitViewer] Error applying opacity:", error);
    }
  };

  // Function to apply opacity only to edited/highlighted elements
  const applyOpacityToEditedElements = (opacity: number) => {
    if (!viewerRef.current) {
      console.warn("[XeokitViewer] Cannot apply edited elements opacity: viewer not ready");
      return;
    }

    try {
      const scene = viewerRef.current.scene;
      // Get only the actually highlighted/edited element IDs
      const highlightedIds = Array.from(highlightedElementIdsRef.current);
      
      if (highlightedIds.length === 0) {
        console.info("[XeokitViewer] No highlighted elements to apply opacity to");
        return;
      }

      highlightedIds.forEach((entityId: string) => {
        const entity = scene.objects[entityId];
        if (entity && entity.opacity !== undefined) {
          entity.opacity = opacity;
        }
      });

      console.info("[XeokitViewer] Applied opacity to highlighted elements:", opacity, "elements:", highlightedIds.length);
    } catch (error) {
      console.error("[XeokitViewer] Error applying edited elements opacity:", error);
    }
  };

  // Utility functions for value extraction (used in quantification tooltip)
  const normStr = (s: any): string => {
    if (s == null) return "";
    const v = (typeof s === "object") ? (s.value ?? s.Value ?? s) : s;
    return (typeof v === "string") ? v.trim() : String(v ?? "").trim();
  };

  const toNum = (v: any): number | null => {
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
  };

  const normKey = (s: string): string => {
    const t = normStr(s).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s_\-\.]/g, "");
    return t;
  };

  const VOL_KEYS = new Set(["netvolume", "grossvolume", "volume", "volumen"]);
  const LEN_KEYS = new Set(["length", "longitud"]);
  const MASS_KEYS = new Set(["mass", "massa", "masa"]);
  const AREA_KEYS = new Set(["netarea", "grossarea", "area", "area"]);

  const getByKeysFromProps = (mo: any, keySet: Set<string>): number | null => {
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
    return null;
  };

  const getValueByUnit = (mo: any, unit: string): number => {
    switch(unit) {
      case "UT":
        return 1;
      case "ML":
        return getByKeysFromProps(mo, LEN_KEYS) || 1;
      case "M2":
        return getByKeysFromProps(mo, AREA_KEYS) || 1;
      case "M3":
        return getByKeysFromProps(mo, VOL_KEYS) || 1;
      case "KG":
        return getByKeysFromProps(mo, MASS_KEYS) || 1;
      default:
        return 1;
    }
  };

  // Function to get nice type name (same logic as used for edited elements detection)
  const getNiceTypeNameForQuantification = (mo: any): string => {
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
  };

  // Function to show quantification tooltip when clicking an edited element
  const showQuantificationTooltip = async (entityId: string, metaObject: any, x: number, y: number) => {
    if (!viewerRef.current?.metaScene) return;

    const targetId = projectId || centerId;
    if (!targetId) return;

    const ifcCategory = metaObject.type || "";
    const typeName = getNiceTypeNameForQuantification(metaObject);
    const entityKey = `${ifcCategory}:${typeName}`;

    try {
      // Check cache first, otherwise fetch - IMPORTANT: include measured_value from DB
      let config = editedConfigsCacheRef.current.get(entityKey);
      
      if (!config) {
        let query = supabase
          .from("element_type_configs")
          .select("preferred_unit, custom_name, measured_value")
          .or(`project_id.eq.${targetId},center_id.eq.${targetId}`)
          .eq("ifc_category", ifcCategory)
          .eq("type_name", typeName);
        
        // Filtrar per version_id si existeix
        if (versionId) {
          query = query.eq("version_id", versionId);
        } else {
          query = query.is("version_id", null);
        }
        
        const { data, error } = await query.maybeSingle();

        if (error || !data) {
          console.warn("[XeokitViewer] Could not find config for:", entityKey);
          return;
        }
        config = data;
        editedConfigsCacheRef.current.set(entityKey, config);
      }

      const preferredUnit = config.preferred_unit || "UT";
      const customName = config.custom_name;
      // El measured_value guardat a la BD és el TOTAL de tots els elements d'aquest tipus
      const storedMeasuredValue = config.measured_value || 0;

      // Calcular el valor REAL de l'element seleccionat des de les propietats IFC
      let elementValue = 0;
      const AREA_KEYS = new Set(["netarea", "grossarea", "area", "superficie", "netsidearea", "grosssidearea", "netsurfacearea", "grosssurfacearea", "outersurfacearea", "totalsurfacearea"]);
      const VOL_KEYS = new Set(["netvolume", "grossvolume", "volume", "volumen", "vol"]);
      const LEN_KEYS = new Set(["length", "longitud", "len", "altura", "height", "width", "anchura", "profundidad", "depth"]);
      const MASS_KEYS = new Set(["mass", "massa", "masa", "weight", "peso", "pes"]);

      const getValueFromProps = (mo: any, keySet: Set<string>): number | null => {
        const psets = mo?.propertySets;
        if (Array.isArray(psets)) {
          for (const ps of psets) {
            const arr = ps?.properties;
            if (!Array.isArray(arr)) continue;
            for (const prop of arr) {
              const propName = normStr(prop?.name ?? prop?.Name ?? "");
              const nk = propName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "");
              if (keySet.has(nk)) {
                const val = toNum(prop?.value ?? prop?.Value ?? prop);
                if (val != null && val > 0) return val;
              }
            }
          }
        }
        // Check BaseQuantities
        if (Array.isArray(psets)) {
          for (const ps of psets) {
            const psName = normStr(ps?.name ?? ps?.Name ?? "").toLowerCase();
            if (psName.includes("basequantities") || psName.includes("quantities")) {
              const arr = ps?.properties;
              if (!Array.isArray(arr)) continue;
              for (const prop of arr) {
                const propName = normStr(prop?.name ?? prop?.Name ?? "");
                const nk = propName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "");
                if (keySet.has(nk)) {
                  const val = toNum(prop?.value ?? prop?.Value ?? prop?.nominalValue ?? prop?.NominalValue ?? prop);
                  if (val != null && val > 0) return val;
                }
              }
            }
          }
        }
        return null;
      };

      // Funció per calcular àrea des de geometria (AABB) de l'entitat
      const calculateAreaFromGeometry = (entity: any, ifcType: string): number | null => {
        if (!entity?.aabb) return null;
        const aabb = entity.aabb;
        const dx = Math.abs(aabb[3] - aabb[0]);
        const dy = Math.abs(aabb[4] - aabb[1]);
        const dz = Math.abs(aabb[5] - aabb[2]);
        const type = ifcType.toLowerCase();
        if (type.includes("wall")) return Math.max(dx, dz) * dy;
        if (type.includes("slab") || type.includes("floor") || type.includes("roof") || type.includes("ceiling")) return dx * dz;
        if (type.includes("window") || type.includes("door")) return Math.max(dx * dy, dz * dy);
        return Math.max(dx * dy, dx * dz, dy * dz);
      };

      // Funció unificada per calcular el valor d'un element segons la unitat
      const getElementValueByUnit = (mo: any, eid: string, unit: string): number => {
        switch (unit) {
          case "UT":
            return 1;
          case "ML": {
            const fromProps = getValueFromProps(mo, LEN_KEYS);
            if (fromProps && fromProps > 0) return fromProps;
            const entity = viewerRef.current?.scene?.objects?.[eid];
            if (entity?.aabb) {
              const aabb = entity.aabb;
              const dx = Math.abs(aabb[3] - aabb[0]); // width (X)
              const dy = Math.abs(aabb[4] - aabb[1]); // height (Y - vertical)
              const dz = Math.abs(aabb[5] - aabb[2]); // depth (Z)
              // La longitud és la dimensió més gran de les tres
              // Funciona per elements horitzontals (dx o dz) i verticals (dy)
              return Math.max(dx, dy, dz);
            }
            return 1;
          }
          case "M2": {
            const fromProps = getValueFromProps(mo, AREA_KEYS);
            if (fromProps && fromProps > 0) return fromProps;
            const entity = viewerRef.current?.scene?.objects?.[eid];
            if (entity) {
              const area = calculateAreaFromGeometry(entity, ifcCategory);
              return area || 1;
            }
            return 1;
          }
          case "M3": {
            const fromProps = getValueFromProps(mo, VOL_KEYS);
            if (fromProps && fromProps > 0) return fromProps;
            const entity = viewerRef.current?.scene?.objects?.[eid];
            if (entity?.aabb) {
              const aabb = entity.aabb;
              const dx = Math.abs(aabb[3] - aabb[0]);
              const dy = Math.abs(aabb[4] - aabb[1]);
              const dz = Math.abs(aabb[5] - aabb[2]);
              return dx * dy * dz;
            }
            return 1;
          }
          case "KG": {
            const fromProps = getValueFromProps(mo, MASS_KEYS);
            return (fromProps && fromProps > 0) ? fromProps : 1;
          }
          default:
            return 1;
        }
      };

      // Calcular el valor de l'element seleccionat
      elementValue = getElementValueByUnit(metaObject, entityId, preferredUnit);

      // Comptar elements d'aquest tipus I calcular el TOTAL REAL (suma de tots els elements individuals)
      let elementCount = 0;
      let calculatedTotalValue = 0;
      
      // Get metaModel correctly from metaScene.metaModels
      const metaModels = viewerRef.current.metaScene?.metaModels;
      const modelIds = Object.keys(metaModels || {});
      const metaModel = modelIds.length > 0 ? (metaModels as any)[modelIds[0]] : null;
      const allMetaObjects = metaModel?.metaObjects;
      
      if (allMetaObjects) {
        for (const id of Object.keys(allMetaObjects)) {
          const mo = allMetaObjects[id];
          if (!mo) continue;
          if (mo.type === ifcCategory) {
            const objTypeName = getNiceTypeNameForQuantification(mo);
            if (objTypeName === typeName) {
              elementCount++;
              // Calcular el valor real d'aquest element
              const elemValue = getElementValueByUnit(mo, mo.id, preferredUnit);
              calculatedTotalValue += elemValue;
            }
          }
        }
      }

      // Usar el total calculat dinàmicament (suma de tots els elements individuals)
      const totalValue = calculatedTotalValue;

      setQuantificationTooltip({
        data: {
          elementValue,
          totalValue,
          elementCount,
          typeName,
          ifcCategory,
          preferredUnit,
          customName
        },
        position: { x, y }
      });

      console.info("[XeokitViewer] Quantification tooltip (real element value):", { 
        entityId,
        typeName, 
        ifcCategory, 
        elementValue, 
        totalValue,
        calculatedTotalValue,
        storedMeasuredValue,
        elementCount, 
        preferredUnit 
      });
    } catch (error) {
      console.error("[XeokitViewer] Error showing quantification tooltip:", error);
    }
  };

  // Clear quantification cache when mode changes, project changes, or version changes
  useEffect(() => {
    editedConfigsCacheRef.current.clear();
  }, [projectId, centerId, versionId, editedElementsMode]);

  // Function to hide the evaluation version element permanently
  const hideEvaluationElement = () => {
    if (!viewerRef.current?.scene || !currentModelRef.current) {
      return;
    }

    try {
      const scene = viewerRef.current.scene;
      const metaScene = viewerRef.current.metaScene;
      const objects = scene.objects;
      const entityIds = Object.keys(objects);
      
      // Look for entities that might be the evaluation watermark
      let hiddenCount = 0;
      const evaluationPatterns = [
        /^0+$/,           // Just zeros like "0", "00", "0000"
        /:0+$/,           // Ends with :0, :00, :0000
        /evaluation/i,    // Contains "evaluation" (case insensitive)
        /watermark/i,     // Contains "watermark"
        /license/i,       // Contains "license"
        /trial/i,         // Contains "trial"
      ];
      
      for (const entityId of entityIds) {
        const entity = objects[entityId];
        if (!entity) continue;
        
        let shouldHideEntity = false;
        
        // Check ID patterns
        for (const pattern of evaluationPatterns) {
          if (pattern.test(entityId)) {
            shouldHideEntity = true;
            break;
          }
        }
        
        // Also check metadata name if available
        if (!shouldHideEntity && metaScene?.metaObjects) {
          const metaObject = metaScene.metaObjects[entityId];
          if (metaObject) {
            const name = metaObject.name?.toLowerCase() || "";
            const type = metaObject.type?.toLowerCase() || "";
            
            if (name.includes("evaluation") || name.includes("watermark") || 
                name.includes("license") || name.includes("trial") ||
                type.includes("evaluation") || type.includes("watermark")) {
              shouldHideEntity = true;
            }
          }
        }
        
        if (shouldHideEntity) {
          entity.visible = false;
          hiddenCount++;
        }
      }

      if (hiddenCount > 0) {
        console.info("[XeokitViewer] Hidden evaluation elements:", hiddenCount);
      }
    } catch (error) {
      console.error("[XeokitViewer] Error hiding evaluation element:", error);
    }
  };

  // Handle edges toggle changes
  useEffect(() => {
    if (!viewerRef.current?.scene || !isModelReadyRef.current || !modelReady) {
      return;
    }

    try {
      const objects = viewerRef.current.scene.objects;
      let edgeCount = 0;
      for (const objectId in objects) {
        const entity = objects[objectId];
        if (entity) {
          (entity as any).edges = edgesEnabled;
          edgeCount++;
        }
      }
      console.info("[XeokitViewer] ✓ Edges", edgesEnabled ? "enabled" : "disabled", "on", edgeCount, "entities (prop change)");
    } catch (e) {
      console.warn("[XeokitViewer] Error toggling edges:", e);
    }
  }, [edgesEnabled, modelReady]);

  // Load/unload overlay models when they change
  useEffect(() => {
    // Extra safety check - ensure all refs are properly initialized
    if (!viewerRef.current || !xktLoaderRef.current || !ifcLoaderRef.current || !isModelReadyRef.current) {
      console.warn("[XeokitViewer] Overlay effect: refs no inicialitzats correctament", {
        viewer: !!viewerRef.current,
        xktLoader: !!xktLoaderRef.current,
        ifcLoader: !!ifcLoaderRef.current,
        modelReady: isModelReadyRef.current
      });
      return;
    }

    const loadOverlayModels = async () => {
      // Double-check refs before async operations
      if (!xktLoaderRef.current || !ifcLoaderRef.current) {
        console.error("[XeokitViewer] Loaders no disponibles per carregar overlays");
        return;
      }

      const currentOverlayIds = new Set(overlayModels.map(o => o.id));
      const loadedOverlayIds = new Set(overlayModelsRef.current.keys());

      // Remove only overlays that are no longer in the list (deleted)
      for (const [overlayId, overlayModel] of overlayModelsRef.current.entries()) {
        if (!currentOverlayIds.has(overlayId)) {
          console.info("[XeokitViewer] Eliminant overlay model (eliminat de la llista):", overlayId);
          try {
            overlayModel.destroy();
            overlayModelsRef.current.delete(overlayId);
          } catch (e) {
            console.warn("[XeokitViewer] Error eliminant overlay:", e);
          }
        }
      }

      // Load new overlays (only once when they are first added)
      for (const overlay of overlayModels) {
        if (!loadedOverlayIds.has(overlay.id)) {
          // Re-check loaders are still available
          if (!xktLoaderRef.current || !ifcLoaderRef.current) {
            console.error("[XeokitViewer] Loaders han estat destruïts durant càrrega d'overlays");
            break;
          }

          try {
            const ext = overlay.ifc_file_url.toLowerCase().split(".").pop() || "xkt";
            const modelId = `overlay-${overlay.id}`;
            
            console.info("[XeokitViewer] Carregant overlay model:", { id: modelId, url: overlay.ifc_file_url });

            if (ext === "ifc") {
              const sceneModel = await ifcLoaderRef.current.load({
                src: overlay.ifc_file_url,
                progressCallback: (progress: number) => {
                  console.info(`[XeokitViewer] Overlay ${overlay.name}: ${progress.toFixed(1)}%`);
                }
              });
              overlayModelsRef.current.set(overlay.id, sceneModel);
            } else if (ext === "xkt") {
              const sceneModel = xktLoaderRef.current.load({
                id: modelId,
                src: overlay.ifc_file_url,
                saoEnabled: hasWebGL2Ref.current,
                edges: false,
                dtxEnabled: hasWebGL2Ref.current,
                pbrEnabled: hasWebGL2Ref.current
              });
              overlayModelsRef.current.set(overlay.id, sceneModel);
            }
            
            console.info("[XeokitViewer] ✓ Overlay model carregat:", overlay.name);
          } catch (e) {
            console.error("[XeokitViewer] Error carregant overlay:", e);
          }
        }
      }

      // Update visibility for all existing overlays (without destroying/recreating)
      for (const overlay of overlayModels) {
        const overlayModel = overlayModelsRef.current.get(overlay.id);
        if (overlayModel) {
          const newVisibility = overlay.visible !== false;
          overlayModel.visible = newVisibility;
          console.info("[XeokitViewer] Actualitzant visibilitat overlay:", { 
            id: overlay.id, 
            name: overlay.name,
            visible: newVisibility 
          });
        }
      }
    };

    loadOverlayModels();
  }, [overlayModels, modelReady]);

  // Hide evaluation element when model is ready
  useEffect(() => {
    if (modelReady && isMountedRef.current) {
      // Small delay to ensure model is fully loaded
      const timeoutId = setTimeout(() => {
        hideEvaluationElement();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [modelReady]);

  // Listen for room name updates from RoomsManager
  useEffect(() => {
    const handleRoomNameUpdate = (event: CustomEvent) => {
      const { roomId, roomName, customName } = event.detail;
      
      console.log("[XeokitViewer] Room name updated:", { roomId, roomName, customName });
      
      setExtractedRooms(prevRooms => 
        prevRooms.map(room => {
          // Match by ID first, then by name as fallback
          if (room.id === roomId || room.name === roomName) {
            return { ...room, customName: customName || undefined };
          }
          return room;
        })
      );
    };

    window.addEventListener("room-name-updated", handleRoomNameUpdate as EventListener);
    
    return () => {
      window.removeEventListener("room-name-updated", handleRoomNameUpdate as EventListener);
    };
  }, []);

  // Function to apply edited elements mode (normal, highlight, only-edited, hide-edited, accepted-budget)
  const applyEditedElementsMode = async (mode: "normal" | "highlight" | "only-edited" | "hide-edited" | "accepted-budget") => {
    // Enhanced safety checks
    if (!isMountedRef.current) {
      console.warn("[XeokitViewer] Cannot apply edited elements mode: component unmounted");
      return;
    }
    
    if (!viewerRef.current || !currentModelRef.current || !isModelReadyRef.current) {
      console.warn("[XeokitViewer] Cannot apply edited elements mode: viewer/model not ready");
      return;
    }

    const targetId = projectId || centerId;
    if (!targetId) {
      console.warn("[XeokitViewer] No projectId/centerId for edited elements mode");
      return;
    }

    const viewer = viewerRef.current;
    
    // Check if viewer scene is still valid (use try-catch for safety)
    try {
      if (!viewer.scene || !viewer.scene.objects) {
        console.warn("[XeokitViewer] Cannot apply edited elements mode: scene invalid");
        return;
      }
    } catch (e) {
      console.warn("[XeokitViewer] Cannot apply edited elements mode: scene access error", e);
      return;
    }
    
    const metaScene = viewer.metaScene;
    const scene = viewer.scene;

    if (!metaScene) return;

    // First, restore all elements to original state
    editedElementsRef.current.forEach((originalState, entityId) => {
      const entity = scene.objects[entityId];
      if (entity) {
        entity.colorize = originalState.color;
        entity.visible = originalState.visible;
      }
    });
    editedElementsRef.current.clear();
    highlightedElementIdsRef.current.clear(); // Clear the highlighted IDs as well

    // If mode is normal, we're done
    if (mode === "normal") {
      console.info("[XeokitViewer] Edited elements mode: normal (all restored)");
      setEditedElementsMode(mode);
      return;
    }

    try {
      // Fetch element_type_configs to know which types have been edited
      // Filter by version_id if available to only show configs for this specific version
      let query = supabase
        .from("element_type_configs")
        .select("type_name, ifc_category, full_code")
        .or(`project_id.eq.${targetId},center_id.eq.${targetId}`);
      
      // Si tenim versionId, filtrar per ell; sinó buscar configs sense version_id
      if (versionId) {
        query = query.eq("version_id", versionId);
      } else {
        query = query.is("version_id", null);
      }
      
      const { data: configs, error } = await query;

      if (error) throw error;

      if (!configs || configs.length === 0) {
        console.info("[XeokitViewer] No edited elements found for this version");
        setEditedElementsMode(mode);
        return;
      }

      // Create a set of edited type keys for EXACT lookup: "ifc_category:type_name"
      const editedTypeKeys = new Set(configs.map(c => `${c.ifc_category}:${c.type_name}`));
      console.info("[XeokitViewer] Processing edited types (exact keys):", Array.from(editedTypeKeys));

      // Pale yellow color for highlighting
      const highlightColor = [1.0, 0.95, 0.6, 1.0];
      // Pale green for accepted budget elements
      const acceptedColor = [0.6, 0.95, 0.7, 1.0];
      // Pale orange for non-accepted elements (in accepted-budget mode)
      const pendingColor = [1.0, 0.8, 0.5, 1.0];

      // For accepted-budget mode, fetch accepted budgets and create a set of accepted categories
      let acceptedCategories = new Set<string>();
      let elementCategoryMap = new Map<string, string>(); // Map ifc_category:type_name -> category_name
      
      if (mode === "accepted-budget" && projectId) {
        // 1. Fetch accepted budgets for this project
        const { data: acceptedBudgets, error: budgetError } = await supabase
          .from("supplier_budgets")
          .select("category")
          .eq("project_id", projectId)
          .eq("status", "accepted");
        
        if (budgetError) {
          console.error("[XeokitViewer] Error fetching accepted budgets:", budgetError);
        } else if (acceptedBudgets && acceptedBudgets.length > 0) {
          acceptedBudgets.forEach(b => {
            const normalizedCategory = b.category.trim().toLowerCase();
            acceptedCategories.add(normalizedCategory);
          });
          console.info("[XeokitViewer] Accepted categories:", Array.from(acceptedCategories));
        }
        
        // 2. Get the category mapping for each edited element via budget_category_mappings
        // First, get all the full_codes from configs
        const fullCodes = configs
          .filter(c => c.full_code)
          .map(c => {
            // Normalize to 3 levels (e.g., "1.1.1" from "1.1.1.2")
            const parts = c.full_code!.split('.');
            return parts.length > 3 ? parts.slice(0, 3).join('.') : c.full_code!;
          });
        
        if (fullCodes.length > 0) {
          const uniqueCodes = [...new Set(fullCodes)];
          const { data: mappings, error: mappingsError } = await supabase
            .from("budget_category_mappings")
            .select(`
              budget_code,
              specialist_categories (name)
            `)
            .in("budget_code", uniqueCodes);
          
          if (!mappingsError && mappings) {
            // Create a map from budget_code to category_name
            const codeToCategory = new Map<string, string>();
            mappings.forEach((m: any) => {
              if (m.specialist_categories?.name) {
                codeToCategory.set(m.budget_code, m.specialist_categories.name.toLowerCase());
              }
            });
            
            // Map each config to its category
            configs.forEach(c => {
              if (c.full_code) {
                const parts = c.full_code.split('.');
                const normalizedCode = parts.length > 3 ? parts.slice(0, 3).join('.') : c.full_code;
                const categoryName = codeToCategory.get(normalizedCode);
                if (categoryName) {
                  elementCategoryMap.set(`${c.ifc_category}:${c.type_name}`, categoryName);
                }
              }
            });
          }
        }
        
        console.info("[XeokitViewer] Element category map entries:", elementCategoryMap.size);
      }

      // Helper function to get "nice type name" - SAME LOGIC as used when saving
      const getNiceTypeName = (mo: any): string => {
        if (!mo) return "Desconegut";
        const BAD = new Set(["ifcproduct", "ifcelement", "ifcbuildingelement"]);
        const base = String(mo?.type || "").toLowerCase();
        if (base && !BAD.has(base) && !base.startsWith("ifc")) return mo.type;
        
        const candidates: Array<{ s: string; score: number }> = [];
        const add = (raw: any, score = 1) => {
          const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
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
              const nk = (prop?.name ?? prop?.Name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "");
              if (nk.includes("type") || nk === "reference" || nk === "typename" || nk === "familyandtype" || nk === "familytype") {
                add(prop?.value ?? prop?.Value ?? prop, 6);
              }
            }
          }
        }
        
        const nameMaybe = typeof p.Name === "string" ? p.Name.trim() : "";
        if (nameMaybe && !nameMaybe.toLowerCase().startsWith("ifc")) add(nameMaybe, 5);
        
        if (candidates.length) {
          candidates.sort((a, b) => (b.score - a.score) || (b.s.length - a.s.length));
          return candidates[0].s;
        }
        return mo.type || "Desconegut";
      };

      // Helper to check if entity matches edited types EXACTLY using getNiceTypeName
      const isEditedElement = (entity: any): boolean => {
        const metaObject = metaScene.metaObjects?.[entity.id];
        if (!metaObject) return false;
        
        const ifcCategory = metaObject.type || "";
        const typeName = getNiceTypeName(metaObject);
        
        // Build the exact key matching the database format
        const entityKey = `${ifcCategory}:${typeName}`;
        
        return editedTypeKeys.has(entityKey);
      };

      // Helper to get category for element
      const getElementCategory = (entity: any): string | null => {
        const metaObject = metaScene.metaObjects?.[entity.id];
        if (!metaObject) return null;
        
        const ifcCategory = metaObject.type || "";
        const typeName = getNiceTypeName(metaObject);
        const entityKey = `${ifcCategory}:${typeName}`;
        
        return elementCategoryMap.get(entityKey) || null;
      };

      let processedCount = 0;

      // Process all objects based on mode
      Object.values(scene.objects).forEach((entity: any) => {
        const isEdited = isEditedElement(entity);
        
        // Store original state before modifying
        if (!editedElementsRef.current.has(entity.id)) {
          editedElementsRef.current.set(entity.id, {
            color: entity.colorize?.slice() || [1, 1, 1, 1],
            visible: entity.visible !== false
          });
        }

        switch (mode) {
          case "highlight":
            // Highlight edited elements in yellow, leave others normal
            if (isEdited) {
              entity.colorize = highlightColor;
              entity.visible = true;
              processedCount++;
              highlightedElementIdsRef.current.add(entity.id); // Track highlighted element
              
              // IMPORTANT: If this entity is currently hovered, update lastColorizeRef
              // so when hover ends, it restores to yellow instead of the old color
              if (lastEntityRef.current && lastEntityRef.current.id === entity.id) {
                lastColorizeRef.current = highlightColor.slice();
              }
            }
            break;
          
          case "only-edited":
            // Show only edited elements with highlight, hide all others
            if (isEdited) {
              entity.visible = true;
              entity.colorize = highlightColor; // Apply same yellow highlight as "highlight" mode
              processedCount++;
              highlightedElementIdsRef.current.add(entity.id); // Track edited element
            } else {
              entity.visible = false;
            }
            break;
          
          case "hide-edited":
            // Hide edited elements, show all others
            if (isEdited) {
              entity.visible = false;
              processedCount++;
              highlightedElementIdsRef.current.add(entity.id); // Track edited element
            } else {
              entity.visible = true;
            }
            break;
          
          case "accepted-budget":
            // Show all edited elements: green for accepted, orange for pending
            if (isEdited) {
              entity.visible = true;
              const category = getElementCategory(entity);
              
              if (category && acceptedCategories.has(category)) {
                // Element has accepted budget - pale green
                entity.colorize = acceptedColor;
              } else {
                // Element without accepted budget - pale orange
                entity.colorize = pendingColor;
              }
              
              processedCount++;
              highlightedElementIdsRef.current.add(entity.id);
              
              if (lastEntityRef.current && lastEntityRef.current.id === entity.id) {
                lastColorizeRef.current = entity.colorize.slice();
              }
            }
            break;
        }
      });

      console.info(`[XeokitViewer] Edited elements mode: ${mode}, processed: ${processedCount}`);
    } catch (error) {
      console.error("[XeokitViewer] Error applying edited elements mode:", error);
    }

    setEditedElementsMode(mode);
  };

  // Listen for edited elements mode change event
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const { mode } = event.detail;
      applyEditedElementsMode(mode);
    };

    window.addEventListener("change-edited-elements-mode", handleModeChange as EventListener);
    
    return () => {
      window.removeEventListener("change-edited-elements-mode", handleModeChange as EventListener);
    };
  }, [projectId, centerId]);

  // Listen for annotations visibility toggle from nav menu
  useEffect(() => {
    const handleAnnotationsVisibilityToggle = async (event: CustomEvent) => {
      const { visible } = event.detail;
      setAnnotationsVisible(visible);
      
      const targetId = projectId || centerId;
      if (visible && targetId && annotationsRef.current) {
        // Load annotations first, then show markers
        await loadAnnotationsAndShow();
        toast.success("Notes mostrades al visor");
      } else if (!visible && annotationsRef.current) {
        // Hide all annotations
        const annotations = annotationsRef.current.annotations;
        Object.keys(annotations).forEach(id => {
          const annotation = annotations[id];
          if (annotation) {
            annotation.setMarkerShown(false);
            annotation.setLabelShown(false);
          }
        });
        toast.info("Notes ocultades");
      }
    };

    window.addEventListener("toggle-annotations-visibility", handleAnnotationsVisibilityToggle as EventListener);
    
    return () => {
      window.removeEventListener("toggle-annotations-visibility", handleAnnotationsVisibilityToggle as EventListener);
    };
  }, [projectId, centerId]);

  // Event listener for distance measurements visibility toggle (from nav menu)
  useEffect(() => {
    const handleDistanceMeasurementsVisibilityToggle = (event: CustomEvent) => {
      const { visible } = event.detail;
      setDistanceMeasurementsVisible(visible);
      localStorage.setItem("viewer-distance-measurements-visible", String(visible));
      
      if (distanceMeasurementsRef.current) {
        const measurements = distanceMeasurementsRef.current.measurements;
        Object.keys(measurements).forEach(id => {
          const measurement = measurements[id];
          if (measurement) {
            measurement.visible = visible;
          }
        });
        
        if (visible) {
          toast.success("Acotacions mostrades al visor");
        } else {
          toast.info("Acotacions ocultades");
        }
      }
    };

    const handleDistanceMeasurementsActiveToggle = (event: CustomEvent) => {
      const { active } = event.detail;
      setDistanceMeasurementsActive(active);
      
      if (distanceMeasurementsControlRef.current) {
        if (active) {
          distanceMeasurementsControlRef.current.activate();
          toast.success("Mode acotació activat - Fes clic per acotar (RR per esborrar l'última)");
        } else {
          distanceMeasurementsControlRef.current.deactivate();
          // Esborrar totes les cotes quan es desactiva
          if (distanceMeasurementsRef.current) {
            distanceMeasurementsRef.current.clear();
          }
          toast.info("Mode acotació desactivat - Acotacions eliminades");
        }
      }
    };

    const handleClearDistanceMeasurements = () => {
      if (distanceMeasurementsRef.current) {
        distanceMeasurementsRef.current.clear();
        toast.info("Acotacions eliminades");
      }
    };

    const handleDeleteLastMeasurement = () => {
      if (distanceMeasurementsRef.current) {
        const measurements = distanceMeasurementsRef.current.measurements;
        const measurementIds = Object.keys(measurements);
        if (measurementIds.length > 0) {
          const lastId = measurementIds[measurementIds.length - 1];
          distanceMeasurementsRef.current.destroyMeasurement(lastId);
          toast.info("Última cota eliminada");
        }
      }
    };

    // Keyboard listener for "RR" to delete last measurement
    let rrKeyBuffer = "";
    let rrKeyTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleRRKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      
      // Only respond when distance measurements are active
      if (!distanceMeasurementsRef.current) return;
      
      if (event.key.toLowerCase() === "r") {
        rrKeyBuffer += "r";
        
        if (rrKeyTimeout) clearTimeout(rrKeyTimeout);
        
        rrKeyTimeout = setTimeout(() => {
          rrKeyBuffer = "";
        }, 500);
        
        if (rrKeyBuffer === "rr") {
          handleDeleteLastMeasurement();
          rrKeyBuffer = "";
          if (rrKeyTimeout) clearTimeout(rrKeyTimeout);
        }
      } else {
        rrKeyBuffer = "";
      }
    };

    const handleElementInfoToggle = (event: CustomEvent) => {
      const { enabled } = event.detail;
      setElementInfoEnabled(enabled);
    };

    window.addEventListener("toggle-distance-measurements-visibility", handleDistanceMeasurementsVisibilityToggle as EventListener);
    window.addEventListener("toggle-distance-measurements-active", handleDistanceMeasurementsActiveToggle as EventListener);
    window.addEventListener("clear-distance-measurements", handleClearDistanceMeasurements as EventListener);
    window.addEventListener("toggle-element-info-enabled", handleElementInfoToggle as EventListener);
    window.addEventListener("keydown", handleRRKeyDown);
    
    return () => {
      window.removeEventListener("toggle-distance-measurements-visibility", handleDistanceMeasurementsVisibilityToggle as EventListener);
      window.removeEventListener("toggle-distance-measurements-active", handleDistanceMeasurementsActiveToggle as EventListener);
      window.removeEventListener("clear-distance-measurements", handleClearDistanceMeasurements as EventListener);
      window.removeEventListener("toggle-element-info-enabled", handleElementInfoToggle as EventListener);
      window.removeEventListener("keydown", handleRRKeyDown);
      if (rrKeyTimeout) clearTimeout(rrKeyTimeout);
    };
  }, []);

  // Auto-show annotations when model is ready if annotationsVisible is true
  useEffect(() => {
    const targetId = projectId || centerId;
    if (modelReady && annotationsVisible && targetId && annotationsRef.current) {
      loadAnnotationsAndShow();
    }
  }, [modelReady, annotationsVisible, projectId, centerId]);

  // Re-apply edited elements mode when model is ready or version changes
  useEffect(() => {
    if (modelReady) {
      const savedMode = localStorage.getItem("viewer-edited-elements-mode") as "normal" | "highlight" | "only-edited" | "hide-edited" | "accepted-budget" | null;
      if (savedMode && savedMode !== "normal") {
        setTimeout(() => {
          applyEditedElementsMode(savedMode);
        }, 500);
      }
    }
  }, [modelReady, projectId, centerId, versionId]);

  // Function to apply rooms visibility mode (zones = built surfaces, peces = useful surfaces)
  const applyRoomsVisibilityMode = (mode: "show" | "only" | "hide" | "zones" | "peces") => {
    if (!viewerRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] Cannot apply rooms visibility: model or viewer not ready");
      return;
    }

    const scene = viewerRef.current.scene;
    const metaScene = viewerRef.current.metaScene;
    
    if (!metaScene) {
      console.warn("[XeokitViewer] Cannot apply rooms visibility: no metaScene");
      return;
    }

    const modelId = currentModelRef.current.id;
    const metaModel = metaScene.metaModels[modelId];
    
    if (!metaModel) {
      console.warn("[XeokitViewer] Cannot apply rooms visibility: no metaModel");
      return;
    }

    // Colors for zones and peces (RGBA 0-1 range)
    const ZONE_COLOR = [0.86, 0.47, 0.47, 0.6]; // Vermell pàlid (rgba(220, 120, 120, 0.6))
    const PECE_COLOR = [1.0, 0.71, 0.39, 0.6]; // Taronja pàlid (rgba(255, 180, 100, 0.6))

    try {
      // First, identify all IfcSpace entities and categorize them
      const zonesIds = new Set<string>(); // Built surfaces (àrees)
      const pecesIds = new Set<string>(); // Useful surfaces (habitacions)
      const allMetaObjects = metaScene.metaObjects || {};

      const normalizeAlphaNum = (v: unknown) =>
        String(v ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "");
      
      Object.values(allMetaObjects).forEach((metaObj: any) => {
        if (metaObj.type === "IfcSpace") {
          // Classify spaces the same way as SurfaceAreasModal (robust: accents, category/reference/name)

          const categoryProp = getPropertyValueFromMetaObj(metaObj, [
            "category",
            "categoria",
            "categoría",
            "Category",
            "Categoria",
            "Categoría",
          ]);
          const referenceProp = getPropertyValueFromMetaObj(metaObj, [
            "reference",
            "referencia",
            "referència",
            "ref",
            "Reference",
            "Referencia",
            "Referència",
            "Ref",
          ]);

          const nameText = String(metaObj.name ?? "");
          const systemText = String(metaObj.originalSystemId ?? "");

          const catNorm = normalizeAlphaNum(categoryProp);
          const refNorm = normalizeAlphaNum(referenceProp);
          const nameNorm = normalizeAlphaNum(nameText);
          const sysNorm = normalizeAlphaNum(systemText);

          const isBuiltArea =
            catNorm.startsWith("area") ||
            catNorm.includes("zona") ||
            catNorm.includes("zone") ||
            refNorm.startsWith("area") ||
            nameNorm.startsWith("area") ||
            sysNorm.startsWith("area");

          if (isBuiltArea) {
            zonesIds.add(metaObj.id);
          } else {
            pecesIds.add(metaObj.id);
          }
        } else if (metaObj.type === "IfcSpatialZone" || metaObj.type === "IfcZone") {
          zonesIds.add(metaObj.id);
        }
      });

      console.info("[XeokitViewer] Found", pecesIds.size, "Peces and", zonesIds.size, "Zones for visibility control");

      const allSpaceIds = new Set([...zonesIds, ...pecesIds]);

      // Check if there are no spaces - just log and return silently (no modal)
      if (allSpaceIds.size === 0) {
        console.warn("[XeokitViewer] No IfcSpace entities found in model");
        return;
      }

      // Also check for specific mode when there are no items of that type - just log
      if (mode === "zones" && zonesIds.size === 0) {
        console.warn("[XeokitViewer] No Zones found in model");
        return;
      }

      if (mode === "peces" && pecesIds.size === 0) {
        console.warn("[XeokitViewer] No Peces found in model");
        return;
      }

      // Store original state if not already stored
      Object.values(scene.objects).forEach((entity: any) => {
        if (!roomsOriginalStateRef.current.has(entity.id)) {
          roomsOriginalStateRef.current.set(entity.id, {
            visible: entity.visible !== false,
            color: entity.colorize ? [...entity.colorize] : [1, 1, 1]
          });
        }
      });

      // Apply visibility and colors based on mode
      Object.values(scene.objects).forEach((entity: any) => {
        const isZone = zonesIds.has(entity.id);
        const isPece = pecesIds.has(entity.id);
        const isSpace = isZone || isPece;
        const originalState = roomsOriginalStateRef.current.get(entity.id);

        switch (mode) {
          case "show":
            // Restore original visibility and color for spaces
            if (originalState) {
              entity.visible = originalState.visible;
              if (isSpace) {
                entity.colorize = originalState.color;
                entity.opacity = 1.0;
              }
            } else {
              entity.visible = true;
            }
            break;
          
          case "only":
            // Show only spaces (all), hide everything else
            if (isSpace) {
              entity.visible = true;
              // Apply color based on type
              if (isZone) {
                entity.colorize = ZONE_COLOR.slice(0, 3);
                entity.opacity = ZONE_COLOR[3];
              } else if (isPece) {
                entity.colorize = PECE_COLOR.slice(0, 3);
                entity.opacity = PECE_COLOR[3];
              }
            } else {
              entity.visible = false;
            }
            break;

          case "zones":
            // Show only zones (built surfaces), hide everything else
            if (isZone) {
              entity.visible = true;
              entity.colorize = ZONE_COLOR.slice(0, 3);
              entity.opacity = ZONE_COLOR[3];
            } else {
              entity.visible = false;
            }
            break;

          case "peces":
            // Show only peces (useful surfaces), hide everything else
            if (isPece) {
              entity.visible = true;
              entity.colorize = PECE_COLOR.slice(0, 3);
              entity.opacity = PECE_COLOR[3];
            } else {
              entity.visible = false;
            }
            break;
          
          case "hide":
            // Hide spaces, show everything else
            if (isSpace) {
              entity.visible = false;
            } else if (originalState) {
              entity.visible = originalState.visible;
            } else {
              entity.visible = true;
            }
            break;
        }
      });

      console.info("[XeokitViewer] Applied rooms visibility mode:", mode);
    } catch (error) {
      console.error("[XeokitViewer] Error applying rooms visibility mode:", error);
    }

    setRoomsVisibilityMode(mode);
  };

  // Helper function to get property value from metaObject
  const getPropertyValueFromMetaObj = (metaObj: any, keys: string[]): string => {
    if (!metaObj) return "";
    
    // Check in propertySets
    if (metaObj.propertySets) {
      for (const propSet of Object.values(metaObj.propertySets) as any[]) {
        if (propSet.properties) {
          for (const key of keys) {
            const keyLower = key.toLowerCase();
            for (const prop of Object.values(propSet.properties) as any[]) {
              if (prop.name?.toLowerCase() === keyLower) {
                return String(prop.value || "");
              }
            }
          }
        }
      }
    }
    
    // Check direct properties
    for (const key of keys) {
      if (metaObj[key]) return String(metaObj[key]);
    }
    
    return "";
  };

  // Listen for rooms visibility mode change event
  useEffect(() => {
    const handleRoomsVisibilityChange = (event: CustomEvent) => {
      const { mode } = event.detail;
      applyRoomsVisibilityMode(mode);
    };

    window.addEventListener("change-rooms-visibility", handleRoomsVisibilityChange as EventListener);
    
    return () => {
      window.removeEventListener("change-rooms-visibility", handleRoomsVisibilityChange as EventListener);
    };
  }, []);

  // Chapter filter configuration
  const CHAPTER_FILTERS = {
    "10": { name: "Moviment de terres", color: [0.6, 0.4, 0.2, 1.0] }, // Brown for earthworks
    "20": { name: "Estructura", color: [0.8, 0.5, 0.2, 1.0] }, // Orange-brown for structure
    "30": { name: "Envolvent", color: [0.4, 0.7, 1.0, 1.0] }, // Light blue for envelope
    "40": { name: "Interiors", color: [0.6, 0.8, 0.4, 1.0] }, // Light green for interiors
    "50": { name: "Instal·lacions", color: [0.9, 0.6, 0.0, 1.0] }, // Orange for installations
    "60": { name: "Equipaments i mobiliari", color: [0.7, 0.3, 0.7, 1.0] }, // Purple for equipment
    "70": { name: "Urbanització", color: [0.3, 0.7, 0.3, 1.0] }, // Green for urbanization
    "80": { name: "Construccions provisionals", color: [0.7, 0.7, 0.3, 1.0] }, // Yellow-olive for provisional
  };

  // Generic function to show elements by chapter code
  const showChapterElements = async (chapterCode: string) => {
    if (!viewerRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] Cannot show chapter elements: model or viewer not ready");
      toast.error("El model no està carregat encara");
      return;
    }

    const targetId = projectId || centerId;
    if (!targetId) {
      console.warn("[XeokitViewer] Cannot show chapter elements: no project or center ID");
      return;
    }

    const chapterConfig = CHAPTER_FILTERS[chapterCode as keyof typeof CHAPTER_FILTERS];
    if (!chapterConfig) {
      console.warn("[XeokitViewer] Unknown chapter code:", chapterCode);
      return;
    }

    const viewer = viewerRef.current;
    const scene = viewer.scene;
    const metaScene = viewer.metaScene;

    if (!metaScene) {
      console.warn("[XeokitViewer] Cannot show chapter elements: no metaScene");
      return;
    }

    try {
      // Fetch element_type_configs where full_code starts with the chapter code
      let query = supabase
        .from("element_type_configs")
        .select("type_name, ifc_category, full_code, subchapter_id")
        .or(`project_id.eq.${targetId},center_id.eq.${targetId}`)
        .like("full_code", `${chapterCode}.%`);
      
      // Filter by version if available
      if (versionId) {
        query = query.eq("version_id", versionId);
      } else {
        query = query.is("version_id", null);
      }
      
      const { data: configs, error } = await query;

      if (error) {
        console.error(`[XeokitViewer] Error fetching ${chapterConfig.name} elements:`, error);
        toast.error(`Error carregant elements de ${chapterConfig.name}`);
        return;
      }

      // If no configs found, hide all elements and show toast
      if (!configs || configs.length === 0) {
        console.info(`[XeokitViewer] No ${chapterConfig.name} elements found (chapter ${chapterCode}.x)`);
        
        // Store original state and hide all elements
        Object.values(scene.objects).forEach((entity: any) => {
          if (!chapterFilterOriginalStateRef.current.has(entity.id)) {
            chapterFilterOriginalStateRef.current.set(entity.id, {
              color: entity.colorize?.slice() || [1, 1, 1, 1],
              visible: entity.visible !== false
            });
          }
          entity.visible = false;
        });
        
        setChapterFilterInfo({ code: chapterCode, name: chapterConfig.name, color: chapterConfig.color });
        setChapterFilterElementCount(0);
        setChapterFilterType("success");
        setShowChapterFilterModal(true);
        toast.info(`No s'han trobat elements de ${chapterConfig.name}`);
        return;
      }

      // Create a set of type keys for EXACT lookup
      const typeKeys = new Set(configs.map(c => `${c.ifc_category}:${c.type_name}`));
      console.info(`[XeokitViewer] ${chapterConfig.name} type keys:`, Array.from(typeKeys));

      // Helper function to get "nice type name"
      const getNiceTypeName = (mo: any): string => {
        if (!mo) return "Desconegut";
        const BAD = new Set(["ifcproduct", "ifcelement", "ifcbuildingelement"]);
        const base = String(mo?.type || "").toLowerCase();
        if (base && !BAD.has(base) && !base.startsWith("ifc")) return mo.type;
        
        const candidates: Array<{ s: string; score: number }> = [];
        const add = (raw: any, score = 1) => {
          const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
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
              const nk = (prop?.name ?? prop?.Name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "");
              if (nk.includes("type") || nk === "reference" || nk === "typename" || nk === "familyandtype" || nk === "familytype") {
                add(prop?.value ?? prop?.Value ?? prop, 6);
              }
            }
          }
        }
        
        const nameMaybe = typeof p.Name === "string" ? p.Name.trim() : "";
        if (nameMaybe && !nameMaybe.toLowerCase().startsWith("ifc")) add(nameMaybe, 5);
        
        if (candidates.length) {
          candidates.sort((a, b) => (b.score - a.score) || (b.s.length - a.s.length));
          return candidates[0].s;
        }
        return mo.type || "Desconegut";
      };

      // Clear previous filter state if any
      chapterFilterOriginalStateRef.current.forEach((originalState, entityId) => {
        const entity = scene.objects[entityId];
        if (entity) {
          entity.colorize = originalState.color;
          entity.visible = originalState.visible;
        }
      });
      chapterFilterOriginalStateRef.current.clear();

      let elementCount = 0;

      // Process all objects - show only matching elements, hide others
      Object.values(scene.objects).forEach((entity: any) => {
        const metaObject = metaScene.metaObjects?.[entity.id];
        if (!metaObject) return;
        
        const ifcCategory = metaObject.type || "";
        const typeName = getNiceTypeName(metaObject);
        const entityKey = `${ifcCategory}:${typeName}`;
        
        const isMatch = typeKeys.has(entityKey);

        // Store original state
        if (!chapterFilterOriginalStateRef.current.has(entity.id)) {
          chapterFilterOriginalStateRef.current.set(entity.id, {
            color: entity.colorize?.slice() || [1, 1, 1, 1],
            visible: entity.visible !== false
          });
        }

        if (isMatch) {
          entity.visible = true;
          entity.colorize = chapterConfig.color;
          elementCount++;
          
          // Update lastColorizeRef if this entity is currently hovered
          if (lastEntityRef.current && lastEntityRef.current.id === entity.id) {
            lastColorizeRef.current = chapterConfig.color.slice();
          }
        } else {
          entity.visible = false;
        }
      });

      console.info(`[XeokitViewer] Showing ${elementCount} ${chapterConfig.name} elements`);
      setChapterFilterInfo({ code: chapterCode, name: chapterConfig.name, color: chapterConfig.color });
      setChapterFilterElementCount(elementCount);
      setChapterFilterType("success");
      setShowChapterFilterModal(true);
      toast.success(`S'han trobat ${elementCount} elements de ${chapterConfig.name}`);

    } catch (error) {
      console.error(`[XeokitViewer] Error showing ${chapterConfig.name} elements:`, error);
      toast.error(`Error mostrant elements de ${chapterConfig.name}`);
    }
  };

  // Function to restore view from chapter filter mode
  const restoreFromChapterFilterMode = () => {
    if (!viewerRef.current) return;
    
    const scene = viewerRef.current.scene;
    
    chapterFilterOriginalStateRef.current.forEach((originalState, entityId) => {
      const entity = scene.objects[entityId];
      if (entity) {
        entity.colorize = originalState.color;
        entity.visible = originalState.visible;
      }
    });
    chapterFilterOriginalStateRef.current.clear();
    console.info("[XeokitViewer] Restored view from chapter filter mode");
  };

  // Listen for chapter filter events
  useEffect(() => {
    const handleShowEarthworks = () => showChapterElements("10");
    const handleShowStructure = () => showChapterElements("20");
    const handleShowEnvelope = () => showChapterElements("30");
    const handleShowInterior = () => showChapterElements("40");
    const handleShowInstallations = () => showChapterElements("50");
    const handleShowEquipment = () => showChapterElements("60");
    const handleShowUrbanization = () => showChapterElements("70");
    const handleShowProvisional = () => showChapterElements("80");

    window.addEventListener("show-earthworks-elements", handleShowEarthworks as EventListener);
    window.addEventListener("show-structure-elements", handleShowStructure as EventListener);
    window.addEventListener("show-envelope-elements", handleShowEnvelope as EventListener);
    window.addEventListener("show-interior-elements", handleShowInterior as EventListener);
    window.addEventListener("show-installations-elements", handleShowInstallations as EventListener);
    window.addEventListener("show-equipment-elements", handleShowEquipment as EventListener);
    window.addEventListener("show-urbanization-elements", handleShowUrbanization as EventListener);
    window.addEventListener("show-provisional-elements", handleShowProvisional as EventListener);
    
    return () => {
      window.removeEventListener("show-earthworks-elements", handleShowEarthworks as EventListener);
      window.removeEventListener("show-structure-elements", handleShowStructure as EventListener);
      window.removeEventListener("show-envelope-elements", handleShowEnvelope as EventListener);
      window.removeEventListener("show-interior-elements", handleShowInterior as EventListener);
      window.removeEventListener("show-installations-elements", handleShowInstallations as EventListener);
      window.removeEventListener("show-equipment-elements", handleShowEquipment as EventListener);
      window.removeEventListener("show-urbanization-elements", handleShowUrbanization as EventListener);
      window.removeEventListener("show-provisional-elements", handleShowProvisional as EventListener);
    };
  }, [projectId, centerId, versionId]);

  // Listen for floor plan mode events from ViewerToolsDropdown
  useEffect(() => {
    // Handle floor plan mode toggle from dropdown
    const handleToggleFloorPlanMode = (event: CustomEvent) => {
      const { enabled } = event.detail;
      if (enabled) {
        if (!floorPlanMode) {
          activateFloorPlanModeFromDropdown();
        }
      } else {
        if (floorPlanMode) {
          deactivateFloorPlanMode();
        }
      }
    };

    // Handle storey selection from dropdown
    const handleSelectStorey = (event: CustomEvent) => {
      const { storeyId } = event.detail;
      if (storeyId && floorPlanMode) {
        handleStoreyChange(storeyId);
      }
    };

    // Handle request for current storeys (from dropdown when it mounts)
    const handleRequestStoreys = () => {
      emitStoreysUpdate();
    };

    // Handle ortho/perspective toggle from dropdown
    const handleToggleOrthoMode = (event: CustomEvent) => {
      const { ortho } = event.detail;
      if (viewerRef.current?.scene?.camera) {
        const camera = viewerRef.current.scene.camera;
        if (ortho) {
          // Switch to orthographic projection
          camera.projection = "ortho";
          console.info("[XeokitViewer] Switched to orthographic projection");
        } else {
          // Switch to perspective projection
          camera.projection = "perspective";
          console.info("[XeokitViewer] Switched to perspective projection");
        }
      }
    };

    window.addEventListener("toggle-floor-plan-mode", handleToggleFloorPlanMode as EventListener);
    window.addEventListener("select-storey", handleSelectStorey as EventListener);
    window.addEventListener("request-viewer-storeys", handleRequestStoreys as EventListener);
    window.addEventListener("toggle-ortho-mode", handleToggleOrthoMode as EventListener);
    
    return () => {
      window.removeEventListener("toggle-floor-plan-mode", handleToggleFloorPlanMode as EventListener);
      window.removeEventListener("select-storey", handleSelectStorey as EventListener);
      window.removeEventListener("request-viewer-storeys", handleRequestStoreys as EventListener);
      window.removeEventListener("toggle-ortho-mode", handleToggleOrthoMode as EventListener);
    };
  }, [floorPlanMode, storeys, selectedStorey]);

  // Emit storeys update to dropdown when storeys change
  const emitStoreysUpdate = () => {
    window.dispatchEvent(new CustomEvent("viewer-storeys-update", {
      detail: {
        storeys: storeys.map(s => ({ id: s.id, name: s.name, elevation: s.elevation })),
        selectedStorey,
        floorPlanMode
      }
    }));
  };

  // Emit storeys update when relevant state changes
  useEffect(() => {
    emitStoreysUpdate();
  }, [storeys, selectedStorey, floorPlanMode]);

  // Ref to store IfcSpace visibility state before floor plan mode
  const floorPlanSpacesStateRef = useRef<Map<string, boolean>>(new Map());
  
  // Ref to store original colors of sectioned elements for floor plan mode
  const floorPlanSectionedColorsRef = useRef<Map<string, number[]>>(new Map());
  
  // Ref to store elements visibility above the section plane
  const floorPlanHiddenAboveRef = useRef<Map<string, boolean>>(new Map());

  // Hide all IfcSpace entities (zones and rooms) for floor plan mode
  const hideIfcSpacesForFloorPlan = () => {
    if (!viewerRef.current?.metaScene) return;

    const scene = viewerRef.current.scene;
    const metaObjects = viewerRef.current.metaScene.metaObjects;
    
    // Clear previous state
    floorPlanSpacesStateRef.current.clear();

    // Find and hide all IfcSpace entities
    for (const metaObjectId in metaObjects) {
      const metaObject = metaObjects[metaObjectId];
      if (metaObject.type === "IfcSpace") {
        const entity = scene.objects[metaObject.id];
        if (entity) {
          // Save current visibility state
          floorPlanSpacesStateRef.current.set(metaObject.id, entity.visible);
          // Hide the entity
          entity.visible = false;
        }
      }
    }

    console.info("[XeokitViewer] IfcSpaces ocultats per mode planta:", floorPlanSpacesStateRef.current.size);
  };

  // Restore IfcSpace visibility after exiting floor plan mode
  const restoreIfcSpacesAfterFloorPlan = () => {
    if (!viewerRef.current?.scene) return;

    const scene = viewerRef.current.scene;

    // Restore visibility for each saved entity
    floorPlanSpacesStateRef.current.forEach((wasVisible, entityId) => {
      const entity = scene.objects[entityId];
      if (entity) {
        entity.visible = wasVisible;
      }
    });

    console.info("[XeokitViewer] IfcSpaces restaurats:", floorPlanSpacesStateRef.current.size);
    
    // Clear the saved state
    floorPlanSpacesStateRef.current.clear();
  };

  // Check if an entity is a floor/slab type (paviment)
  const isFloorOrSlabType = (metaObject: any): boolean => {
    if (!metaObject) return false;
    
    const type = (metaObject.type || "").toLowerCase();
    const name = (metaObject.name || "").toLowerCase();
    
    // Check IFC type
    if (type.includes("slab") || type.includes("floor") || type.includes("covering")) {
      return true;
    }
    
    // Check name patterns (Spanish/Catalan)
    if (name.includes("suelo") || name.includes("losa") || name.includes("paviment") || 
        name.includes("solera") || name.includes("forjado") || name.includes("piso")) {
      return true;
    }
    
    return false;
  };

  // Check if an entity is a furniture type (mobiliari)
  const isFurnitureType = (metaObject: any): boolean => {
    if (!metaObject) return false;
    
    const type = (metaObject.type || "").toLowerCase();
    const name = (metaObject.name || "").toLowerCase();
    
    // Check IFC types for furniture
    if (type.includes("furnishing") || type.includes("furniture") || 
        type === "ifcfurnishingelement" || type === "ifcfurniture") {
      return true;
    }
    
    // Check name patterns (Spanish/Catalan/English)
    if (name.includes("mobili") || name.includes("mueble") || name.includes("furniture") ||
        name.includes("sofà") || name.includes("sofa") || name.includes("taula") || 
        name.includes("mesa") || name.includes("cadira") || name.includes("silla") ||
        name.includes("armari") || name.includes("armario") || name.includes("llit") ||
        name.includes("cama") || name.includes("bed") || name.includes("chair") ||
        name.includes("table") || name.includes("desk") || name.includes("cabinet")) {
      return true;
    }
    
    return false;
  };

  // Paint sectioned elements black (elements that intersect with the section plane)
  // Also paint floors/slabs in pale brown
  const paintSectionedElementsBlack = (sectionHeight: number, minElevation: number, maxElevation: number) => {
    if (!viewerRef.current?.scene) return;

    const scene = viewerRef.current.scene;
    
    // Clear previous sectioned colors
    floorPlanSectionedColorsRef.current.forEach((originalColor, entityId) => {
      const entity = scene.objects[entityId];
      if (entity) {
        entity.colorize = originalColor;
      }
    });
    floorPlanSectionedColorsRef.current.clear();
    
    // Clear previous hidden elements above section
    floorPlanHiddenAboveRef.current.forEach((wasVisible, entityId) => {
      const entity = scene.objects[entityId];
      if (entity) {
        entity.visible = wasVisible;
      }
    });
    floorPlanHiddenAboveRef.current.clear();

    let sectionedCount = 0;
    let hiddenCount = 0;
    let floorCount = 0;

    // Use a small tolerance for elevation comparisons
    const tolerance = 0.1;

    // Iterate through all entities (including non-visible to restore them if needed)
    for (const entityId in scene.objects) {
      const entity = scene.objects[entityId];
      if (!entity) continue;
      
      const aabb = entity.aabb;
      if (!aabb || aabb.length < 6) continue;

      const entityMinY = aabb[1];
      const entityMaxY = aabb[4];
      const entityCenterY = (entityMinY + entityMaxY) / 2;

      // Get metadata for this entity
      const metaObject = viewerRef.current?.metaScene?.metaObjects?.[entityId];
      
      // Skip IfcSpace entities (already handled separately)
      if (metaObject?.type === "IfcSpace") continue;

      // Determine if element belongs to this storey level
      // Element belongs to storey if its MAX Y is above minElevation (starts at or above floor)
      // AND its MIN Y is below maxElevation (doesn't start above the ceiling)
      const belongsToStorey = entityMaxY >= minElevation - tolerance && 
                               entityMinY < maxElevation + tolerance;

      // Also check: element must have significant presence in the storey range
      // At least part of the element should be within the storey bounds
      const isWithinStoreyRange = entityCenterY >= minElevation - tolerance && 
                                   entityCenterY < maxElevation + tolerance;

      if (!isWithinStoreyRange) {
        // Hide elements outside the current storey range
        if (entity.visible) {
          floorPlanHiddenAboveRef.current.set(entityId, true);
          entity.visible = false;
          hiddenCount++;
        }
        continue;
      }

      // Make sure element is visible if it belongs to storey
      if (!entity.visible && !floorPlanHiddenAboveRef.current.has(entityId)) {
        entity.visible = true;
      }

      // Check if this is a floor/slab element - hide them to avoid representation issues
      if (isFloorOrSlabType(metaObject)) {
        floorPlanHiddenAboveRef.current.set(entityId, entity.visible);
        entity.visible = false;
        floorCount++;
        continue;
      }

      // Check if this is a furniture element
      if (isFurnitureType(metaObject)) {
        // Save original color
        floorPlanSectionedColorsRef.current.set(entityId, entity.colorize ? [...entity.colorize] : [1, 1, 1, 1]);
        // Paint brown (furniture color)
        entity.colorize = [0.55, 0.35, 0.20, 1]; // Brown color for furniture
        continue;
      }

      // Check if this is a flow terminal (sanitary, electrical, etc.)
      if (metaObject?.type === "IfcFlowTerminal" || metaObject?.type === "IfcSanitaryTerminal") {
        floorPlanSectionedColorsRef.current.set(entityId, entity.colorize ? [...entity.colorize] : [1, 1, 1, 1]);
        entity.colorize = [0.6, 0.85, 0.95, 1]; // Light blue
        continue;
      }

      // Check if this is a door
      if (metaObject?.type === "IfcDoor") {
        floorPlanSectionedColorsRef.current.set(entityId, entity.colorize ? [...entity.colorize] : [1, 1, 1, 1]);
        entity.colorize = [0.85, 0.70, 0.55, 1]; // Light brown
        continue;
      }

      // Check if this is a window
      if (metaObject?.type === "IfcWindow") {
        floorPlanSectionedColorsRef.current.set(entityId, entity.colorize ? [...entity.colorize] : [1, 1, 1, 1]);
        entity.colorize = [1, 1, 1, 1]; // White
        continue;
      }

      // Check if the section plane cuts through this element
      // Element is sectioned if the section plane is between its min and max Y
      if (entityMinY < sectionHeight && entityMaxY > sectionHeight) {
        // Save original color
        floorPlanSectionedColorsRef.current.set(entityId, entity.colorize ? [...entity.colorize] : [1, 1, 1, 1]);
        // Paint black
        entity.colorize = [0.05, 0.05, 0.05, 1]; // Near-black color
        sectionedCount++;
      }
    }

    console.info("[XeokitViewer] Elements seccionats:", sectionedCount, "| Paviments:", floorCount, "| Elements ocultats:", hiddenCount);
  };

  // Restore sectioned elements colors
  const restoreSectionedElementsColors = () => {
    if (!viewerRef.current?.scene) return;

    const scene = viewerRef.current.scene;

    // Restore original colors
    floorPlanSectionedColorsRef.current.forEach((originalColor, entityId) => {
      const entity = scene.objects[entityId];
      if (entity) {
        entity.colorize = originalColor;
      }
    });

    console.info("[XeokitViewer] Colors restaurats:", floorPlanSectionedColorsRef.current.size);
    floorPlanSectionedColorsRef.current.clear();
    
    // Restore hidden elements above section
    floorPlanHiddenAboveRef.current.forEach((wasVisible, entityId) => {
      const entity = scene.objects[entityId];
      if (entity) {
        entity.visible = wasVisible;
      }
    });
    
    console.info("[XeokitViewer] Elements ocultats restaurats:", floorPlanHiddenAboveRef.current.size);
    floorPlanHiddenAboveRef.current.clear();
  };

  // Block orbit controls (for orthogonal mode)
  const blockOrbitControls = () => {
    if (!viewerRef.current) return;
    
    const cameraControl = viewerRef.current.cameraControl;
    // Disable orbit/rotate for floor plan mode
    cameraControl.pointerEnabled = true; // Keep pointer enabled for pan/zoom
    // @ts-ignore - navMode exists at runtime
    cameraControl.navMode = "planView"; // Plan view mode - disables orbit, allows pan/zoom
    
    console.info("[XeokitViewer] Controls d'orbita bloquejats (mode planView)");
  };

  // Restore orbit controls
  const restoreOrbitControls = () => {
    if (!viewerRef.current) return;
    
    const cameraControl = viewerRef.current.cameraControl;
    // @ts-ignore - navMode exists at runtime
    cameraControl.navMode = "orbit"; // Restore normal orbit mode
    
    console.info("[XeokitViewer] Controls d'orbita restaurats (mode orbit)");
  };

  // Get the elevation range between current storey and the next one above
  const getStoreyElevationRange = (storeyId: string): { minElevation: number; maxElevation: number; sectionHeight: number } => {
    const storey = storeys.find(s => s.id === storeyId);
    if (!storey) {
      return { minElevation: 0, maxElevation: 100, sectionHeight: 1.2 };
    }

    const currentIndex = storeys.findIndex(s => s.id === storeyId);
    const currentElevation = storey.elevation;
    
    // Find the next storey above (storeys are sorted by elevation)
    let nextStoreyElevation = currentElevation + 10; // Default 10m above if no next storey
    if (currentIndex < storeys.length - 1) {
      nextStoreyElevation = storeys[currentIndex + 1].elevation;
    }

    // Section height is always 1.20m above the current storey's elevation
    const sectionHeight = currentElevation + 1.2;
    
    return {
      minElevation: currentElevation,
      maxElevation: nextStoreyElevation,
      sectionHeight
    };
  };

  // Activate floor plan mode from dropdown (with cenital ortho view)
  const activateFloorPlanModeFromDropdown = () => {
    if (!viewerRef.current || !sectionPlanesRef.current) return;

    setFloorPlanMode(true);
    floorPlanModeRef.current = true;

    // Save current camera state
    const camera = viewerRef.current.scene.camera;
    savedCameraState.current = {
      eye: [...camera.eye],
      look: [...camera.look],
      up: [...camera.up],
      projection: camera.projection
    };

    // Hide IfcSpaces (zones and rooms) for cleaner floor plan view
    hideIfcSpacesForFloorPlan();

    // Block orbit controls for floor plan mode
    blockOrbitControls();

    // Switch to orthographic projection and top-down view
    camera.projection = "ortho";
    
    // Get model bounds to center the view (after hiding spaces)
    const scene = viewerRef.current.scene;
    const aabb = scene.getAABB(scene.visibleObjectIds);
    
    if (aabb) {
      const center = [
        (aabb[0] + aabb[3]) / 2,
        (aabb[1] + aabb[4]) / 2,
        (aabb[2] + aabb[5]) / 2
      ];
      
      // Position camera above the center, looking down (cenital view)
      camera.eye = [center[0], aabb[4] + 50, center[2]];
      camera.look = center;
      camera.up = [0, 0, -1]; // Z-axis pointing up in floor plan view
    }

    // If we have storeys and a selected one, section at that storey
    if (storeys.length > 0 && selectedStorey) {
      const { minElevation, maxElevation, sectionHeight: newSectionHeight } = getStoreyElevationRange(selectedStorey);
      
      // Create section plane at storey elevation + 1.2m
      handleSectionHeightChange(newSectionHeight);
      createSectionPlaneAtStorey(selectedStorey);
      
      // Paint sectioned elements black and hide elements outside the range
      paintSectionedElementsBlack(newSectionHeight, minElevation, maxElevation);
    } else {
      // Use current section height or mid-height
      handleSectionHeightChange(sectionHeight);
    }

    console.info("[XeokitViewer] Mode planta activat des del dropdown");
  };

  // Deactivate floor plan mode
  const deactivateFloorPlanMode = () => {
    if (!viewerRef.current) return;

    setFloorPlanMode(false);
    floorPlanModeRef.current = false;

    // Restore IfcSpaces visibility
    restoreIfcSpacesAfterFloorPlan();
    
    // Restore sectioned elements colors
    restoreSectionedElementsColors();
    
    // Restore orbit controls
    restoreOrbitControls();

    // Restore camera state
    if (savedCameraState.current) {
      const camera = viewerRef.current.scene.camera;
      camera.projection = savedCameraState.current.projection as any;
      camera.eye = savedCameraState.current.eye;
      camera.look = savedCameraState.current.look;
      camera.up = savedCameraState.current.up;
    }

    console.info("[XeokitViewer] Mode planta desactivat");
  };

  // Re-apply rooms visibility mode when model is ready
  useEffect(() => {
    if (modelReady) {
      const savedMode = localStorage.getItem("viewer-rooms-visibility-mode") as "show" | "only" | "hide" | "zones" | "peces" | null;
      const modeToApply = savedMode || "hide"; // Default to hide
      // Always apply the mode when model is ready to ensure synchronization
      setTimeout(() => {
        applyRoomsVisibilityMode(modeToApply);
      }, 600); // Slightly after edited elements mode
    }
  }, [modelReady]);

  // Secret key combination "PO" to capture thumbnail manually
  useEffect(() => {
    const handleKeyPress = async (event: KeyboardEvent) => {
      // Only listen when viewer is ready and we have a projectId
      if (!viewerRef.current || !projectId) return;
      
      const key = event.key.toLowerCase();
      
      // Clear timeout if exists
      if (secretKeyTimeoutRef.current) {
        clearTimeout(secretKeyTimeoutRef.current);
      }
      
      // Add key to sequence
      secretKeySequenceRef.current += key;
      
      // Check if sequence ends with "po"
      if (secretKeySequenceRef.current.endsWith("po")) {
        console.info("[XeokitViewer] 📸 Combinació secreta 'PO' detectada - Capturant thumbnail...");
        secretKeySequenceRef.current = "";
        
        // Capture thumbnail
        try {
          const thumbnailUrl = await captureAndUploadThumbnail(viewerRef.current, projectId);
          if (thumbnailUrl) {
            console.info("[XeokitViewer] 📸 ✓ Thumbnail capturat manualment:", thumbnailUrl);
            toast.success(t("capture_success") || "Imatge capturada correctament");
          } else {
            console.warn("[XeokitViewer] 📸 ⚠ No s'ha pogut capturar el thumbnail");
            toast.error(t("capture_error") || "Error en capturar imatge");
          }
        } catch (error) {
          console.error("[XeokitViewer] 📸 Error capturant thumbnail:", error);
          toast.error(t("capture_error") || "Error en capturar imatge");
        }
      }
      
      // Reset sequence after 1 second of no input
      secretKeyTimeoutRef.current = setTimeout(() => {
        secretKeySequenceRef.current = "";
      }, 1000);
    };
    
    window.addEventListener("keypress", handleKeyPress);
    
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      if (secretKeyTimeoutRef.current) {
        clearTimeout(secretKeyTimeoutRef.current);
      }
    };
  }, [projectId, captureAndUploadThumbnail, t]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set component as mounted
    isMountedRef.current = true;

    // Check WebGL support (WebGL2 preferred)
    const supportCanvas = document.createElement("canvas");
    const hasWebGL2 = !!supportCanvas.getContext("webgl2");
    hasWebGL2Ref.current = hasWebGL2; // Store for later use in model loading
    const gl =
      (hasWebGL2 ? supportCanvas.getContext("webgl2") : null) ||
      supportCanvas.getContext("webgl") ||
      supportCanvas.getContext("experimental-webgl");

    if (!gl) {
      setError(
        "El teu dispositiu no suporta WebGL. El visor 3D necessita un navegador amb WebGL activat."
      );
      console.error("[XeokitViewer] WebGL not supported");
      return;
    }

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    console.info("[XeokitViewer] WebGL support:", { hasWebGL2, isMobile });

    try {
      // Create viewer with enhanced quality settings (based on xkt_dtx_MAP example)
      // NOTE: dtx/sao/pbr rely on WebGL2 AND can cause "materialEmissive" shader errors on mobile devices.
      // Disable all advanced rendering features on mobile to prevent WebGL shader compilation failures.
      const enableAdvancedRendering = hasWebGL2 && !isMobile;
      
      const viewer = new Viewer({
        canvasId: "xeokit-canvas",
        transparent: true,
        preserveDrawingBuffer: true, // Required for screenshots/thumbnails
        readableGeometryEnabled: true, // Required for real section caps (capMaterial)
        saoEnabled: enableAdvancedRendering, // Screen space ambient occlusion - disabled on mobile
        dtxEnabled: enableAdvancedRendering, // Data texture model representation - disabled on mobile
        pbrEnabled: enableAdvancedRendering, // PBR materials - causes materialEmissive error on mobile
        logarithmicDepthBufferEnabled: false, // Disabled to allow edge enhancement with dtx
        colorTextureEnabled: !isMobile // Disable color textures on mobile to prevent shader issues
      });

      // Enable thick edges globally (like in xkt_dtx_MAP example) - but only on desktop
      if (!isMobile) {
        (viewer.scene as any).edges = true;
      }

      // Configure camera
      viewer.scene.camera.eye = [-37.1356047775136, 13.019223731456176, 58.51748229729708];
      viewer.scene.camera.look = [-21.930914776596467, 1.3515918520952024, 29.454670463302506];
      viewer.scene.camera.up = [0.15536164462465452, 0.9421651211030125, -0.2969640448883814];

      // Enable pan with middle mouse button (enabled by default in xeokit)
      viewer.cameraControl.panRightClick = false;

      // Initialize plugins siguiendo el ejemplo oficial
      const navCube = new NavCubePlugin(viewer, {
        canvasId: "navCubeCanvas",
        visible: true
      });

      // FastNavPlugin per navegació suau - IMPORTANT: en mòbils pot forçar shaders incompatibles.
      // Per això només l'activem quan hi ha WebGL2 i NO és mòbil.
      if (enableAdvancedRendering) {
        new FastNavPlugin(viewer, {
          hideEdges: true,           // Hide edges during navigation
          hideSAO: true,             // Hide SAO during navigation
          hideColorTexture: true,    // Hide color textures during navigation
          hidePBR: true,             // Hide PBR materials during navigation
          hideTransparentObjects: false,
          scaleCanvasResolution: false,
          scaleCanvasResolutionFactor: 0.5,
          delayBeforeRestore: true,
          delayBeforeRestoreSeconds: 0.4  // Delay before restoring full quality
        });
      }

      const xktLoader = new XKTLoaderPlugin(viewer);
      
      // Initialize IFC loader with CxConverter
      const ifcLoader = new CxConverterIFCLoaderPlugin(viewer);
      // @ts-ignore - setCxConverterModule exists in runtime but not in types
      ifcLoader.setCxConverterModule(CxConverter);

      // Initialize SectionPlanesPlugin
      const sectionPlanes = new SectionPlanesPlugin(viewer, {
        overviewVisible: false
      });

      // Initialize AnnotationsPlugin
      const annotations = new AnnotationsPlugin(viewer, {
        markerHTML: "<div class='annotation-marker' style='background-color: {{markerBGColor}};'>{{glyph}}</div>",
        labelHTML: "<div class='annotation-label'><div class='annotation-title'>{{title}}</div><div class='annotation-desc'>{{description}}</div></div>",
        values: {
          markerBGColor: "#ff0000",
          glyph: "A",
          title: "Annotation",
          description: "Click to view details"
        },
        surfaceOffset: 0.3
      });

      // Handle annotation marker hover - show/hide label (tooltip)
      annotations.on("markerMouseEnter", (annotation: any) => {
        annotation.setLabelShown(true);
      });

      annotations.on("markerMouseLeave", (annotation: any) => {
        annotation.setLabelShown(false);
      });

      // Handle annotation marker clicks - open detail modal
      annotations.on("markerClicked", async (annotation: any) => {
        // Get annotation data from database
        const annotationId = annotation.id;
        try {
          const { data, error } = await supabase
            .from('annotations')
            .select('*')
            .eq('annotation_id', annotationId)
            .single();

          if (error) throw error;

          if (data) {
            setSelectedAnnotationData(data);
            setShowAnnotationDetailModal(true);
          }
        } catch (error) {
          console.error("Error loading annotation details:", error);
        }
      });

      // Initialize DistanceMeasurementsPlugin for dimension measurements
      const distanceMeasurements = new DistanceMeasurementsPlugin(viewer, {
        defaultVisible: true,
        defaultOriginVisible: true,
        defaultTargetVisible: true,
        defaultWireVisible: true,
        defaultAxisVisible: true,
        defaultColor: "#00BBFF",
        zIndex: 10000
      });

      // Initialize mouse control for distance measurements with snapping
      const distanceMeasurementsMouseControl = new DistanceMeasurementsMouseControl(distanceMeasurements, {
        snapping: true
      });

      viewerRef.current = viewer;
      xktLoaderRef.current = xktLoader;
      ifcLoaderRef.current = ifcLoader;
      navCubeRef.current = navCube;
      sectionPlanesRef.current = sectionPlanes;
      annotationsRef.current = annotations;
      distanceMeasurementsRef.current = distanceMeasurements;
      distanceMeasurementsControlRef.current = distanceMeasurementsMouseControl;

      // Expose viewer instance globally for cross-layout modals (e.g. Documentation dropdown)
      // This is safe because it's read-only usage outside the viewer page.
      (window as any).xeokitViewer = viewer;

      // Initialize measurement modals
      initMeasurementModals();

      // Mark viewer as fully initialized
      setViewerInitialized(true);

      // Setup hover/picking interaction
      viewer.cameraControl.on("hover", async (pickResult: any) => {
        // Safety check: ensure component is still mounted and scene is valid
        if (!isMountedRef.current || !viewerRef.current?.scene) return;
        if (!pickResult || !pickResult.entity) return;

        // Get entity metadata to show name instead of GUID
        const metaObject = viewer.metaScene?.metaObjects?.[pickResult.entity.id];
        const entityName = metaObject?.name || metaObject?.type || pickResult.entity.id;

        console.log("[XeokitViewer] Hover:", entityName);

        if (!lastEntityRef.current || pickResult.entity.id !== lastEntityRef.current.id) {
          // Restore previous entity color
          if (lastEntityRef.current && lastColorizeRef.current) {
            lastEntityRef.current.colorize = lastColorizeRef.current;
          }

          // Save current entity and its color
          lastEntityRef.current = pickResult.entity;
          lastColorizeRef.current = pickResult.entity.colorize.slice();

          // Highlight current entity
          pickResult.entity.colorize = [0.0, 1.0, 0.0, 1.0];
          setHoveredEntity(entityName);

          // Try to get Marca parameter from PropertySets
          try {
            if (metaObject?.propertySets && metaObject.propertySets.length > 0) {
              let marcaValue: string | null = null;
              
              for (const pset of metaObject.propertySets) {
                if (pset?.properties) {
                  for (const prop of pset.properties) {
                    if (prop.name === 'Marca' && prop.value) {
                      marcaValue = String(prop.value);
                      break;
                    }
                  }
                }
                if (marcaValue) break;
              }
              
              setHoveredMarca(marcaValue);
            } else {
              setHoveredMarca(null);
            }
          } catch (err) {
            console.warn("[XeokitViewer] Error getting Marca parameter:", err);
            setHoveredMarca(null);
          }
        }
      });

      viewer.cameraControl.on("hoverOff", () => {
        // Safety check: ensure component is still mounted
        if (!isMountedRef.current) return;
        
        // Restore color when hover ends
        if (lastEntityRef.current && lastColorizeRef.current) {
          try {
            lastEntityRef.current.colorize = lastColorizeRef.current;
          } catch (e) {
            // Entity may have been destroyed, ignore
          }
        }

        lastEntityRef.current = null;
        lastColorizeRef.current = null;
        setHoveredEntity(null);
        setHoveredMarca(null);
      });

      // Setup right-click context menu
      const canvas = document.getElementById("xeokit-canvas") as HTMLCanvasElement;
      if (canvas) {
        canvas.addEventListener("contextmenu", (e: MouseEvent) => {
          e.preventDefault();
          
          // Safety check: ensure component is still mounted and scene is valid
          if (!isMountedRef.current || !viewerRef.current?.scene) return;
          // Allow context menu for both project and center contexts
          const targetId = projectId || centerId;
          if (!targetId) return;

          try {
            const pickResult = viewer.scene.pick({
              canvasPos: [e.offsetX, e.offsetY],
              pickSurface: true
            });

            if (pickResult && pickResult.entity) {
              pickedEntityRef.current = pickResult.entity;
              
              // Get entity metadata
              const metaObject = viewer.metaScene.metaObjects[pickResult.entity.id];
              const entityType = metaObject?.type || undefined;
              
              // Get world position for annotations
              const worldPos = pickResult.worldPos ? [
                pickResult.worldPos[0],
                pickResult.worldPos[1],
                pickResult.worldPos[2]
              ] as [number, number, number] : undefined;

              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                visible: true,
                entityId: String(pickResult.entity.id),
                entityType,
                worldPos
              });
            }
          } catch (err) {
            console.warn("[XeokitViewer] Error in contextmenu pick:", err);
          }
        });

        // Setup left-click for wall selection (Panel-XX detection), annotations, and quantification tooltip
        canvas.addEventListener("click", async (e: MouseEvent) => {
          // Safety check: ensure component is still mounted and scene is valid
          if (!isMountedRef.current || !viewerRef.current?.scene) return;
          
          try {
            const pickResult = viewer.scene.pick({
              canvasPos: [e.offsetX, e.offsetY],
              pickSurface: true
            });

            // Handle floor plan mode click - show element category modal
            if (floorPlanModeRef.current && pickResult && pickResult.entity) {
              const clickedEntityId = String(pickResult.entity.id);
              const metaModelsClick = viewer.metaScene?.metaModels;
              const modelIdsClick = Object.keys(metaModelsClick || {});
              const metaModelClick = modelIdsClick.length > 0 ? (metaModelsClick as any)[modelIdsClick[0]] : null;
              const metaObject = metaModelClick?.metaObjects?.[clickedEntityId] || 
                                 viewer.metaScene?.metaObjects?.[clickedEntityId];
              
              if (metaObject) {
                console.log("[XeokitViewer] Floor plan mode click - Category:", metaObject.type, "Name:", metaObject.name);
                setFloorPlanElementData({
                  entityId: clickedEntityId,
                  ifcType: metaObject.type || "Unknown",
                  name: metaObject.name || clickedEntityId,
                  propertySets: metaObject.propertySets
                });
                setShowFloorPlanElementModal(true);
                return;
              }
            }

            // Handle annotations mode - use ref to get current value
            if (annotationsModeRef.current && pickResult && pickResult.worldPos) {
              console.log("[XeokitViewer] Annotation mode click detected", pickResult);
              setPendingAnnotation({
                worldPos: [pickResult.worldPos[0], pickResult.worldPos[1], pickResult.worldPos[2]],
                entityId: pickResult.entity?.id ? String(pickResult.entity.id) : undefined
              });
              setShowAnnotationModal(true);
              return;
            }

            // Handle space properties modal when in spaces visibility mode (only, zones, peces)
            if (pickResult && pickResult.entity) {
              const savedRoomsMode = localStorage.getItem("viewer-rooms-visibility-mode");
              if (savedRoomsMode === "only" || savedRoomsMode === "zones" || savedRoomsMode === "peces") {
                const metaModelsClick = viewer.metaScene?.metaModels;
                const modelIdsClick = Object.keys(metaModelsClick || {});
                const metaModelClick = modelIdsClick.length > 0 ? (metaModelsClick as any)[modelIdsClick[0]] : null;
                const clickedEntityId = String(pickResult.entity.id);
                const metaObject = metaModelClick?.metaObjects?.[clickedEntityId] || 
                                   viewer.metaScene?.metaObjects?.[clickedEntityId];
                
                if (metaObject && metaObject.type === "IfcSpace") {
                  console.log("[XeokitViewer] Clicked on IfcSpace in spaces mode:", metaObject.name, metaObject);
                  setSelectedSpaceMetaObject(metaObject);
                  setSelectedSpaceEntityId(clickedEntityId);
                  setShowSpacePropertiesModal(true);
                  return;
                }
              }
            }

            // Handle quantification tooltip for edited elements (only when in highlight or only-edited mode)
            const entityIdStr = String(pickResult?.entity?.id);
            if (pickResult && pickResult.entity && highlightedElementIdsRef.current.has(entityIdStr)) {
              // Get metaObject correctly from metaModel structure
              const metaModelsClick = viewer.metaScene?.metaModels;
              const modelIdsClick = Object.keys(metaModelsClick || {});
              const metaModelClick = modelIdsClick.length > 0 ? (metaModelsClick as any)[modelIdsClick[0]] : null;
              const metaObject = metaModelClick?.metaObjects?.[entityIdStr];
              if (metaObject) {
                await showQuantificationTooltip(
                  entityIdStr,
                  metaObject,
                  e.clientX + 15,
                  e.clientY + 15
                );
                return;
              }
            }

            // Handle wall selection for panels
            if (pickResult && pickResult.entity && currentRoomRef.current) {
              const metaObject = viewer.metaScene.metaObjects[pickResult.entity.id];
              
              // Check if clicked entity is a wall
              if (metaObject && (metaObject.type === "IfcWall" || metaObject.type === "IfcWallStandardCase")) {
                checkAndHighlightPanelWall(String(pickResult.entity.id), currentRoomRef.current);
                return;
              }
            }

            // Handle general element click - show element info modal (only if distance measurements are not active AND element info is enabled)
            if (pickResult && pickResult.entity && !distanceMeasurementsActiveRef.current && elementInfoEnabledRef.current) {
              const clickedEntityId = String(pickResult.entity.id);
              const metaModelsGeneral = viewer.metaScene?.metaModels;
              const modelIdsGeneral = Object.keys(metaModelsGeneral || {});
              const metaModelGeneral = modelIdsGeneral.length > 0 ? (metaModelsGeneral as any)[modelIdsGeneral[0]] : null;
              const metaObject = metaModelGeneral?.metaObjects?.[clickedEntityId] || 
                                 viewer.metaScene?.metaObjects?.[clickedEntityId];
              
              if (metaObject) {
                // Get Marca parameter from PropertySets
                let marcaValue: string | null = null;
                if (metaObject.propertySets && metaObject.propertySets.length > 0) {
                  for (const pset of metaObject.propertySets) {
                    if (pset?.properties) {
                      for (const prop of pset.properties) {
                        if (prop.name === 'Marca' && prop.value) {
                          marcaValue = String(prop.value);
                          break;
                        }
                      }
                    }
                    if (marcaValue) break;
                  }
                }

                console.log("[XeokitViewer] Element click - showing info modal for:", metaObject.type, metaObject.name);
                setElementInfoData({
                  entityId: clickedEntityId,
                  ifcType: metaObject.type || "Unknown",
                  name: metaObject.name || clickedEntityId,
                  marca: marcaValue,
                  propertySets: metaObject.propertySets
                });
                setShowElementInfoModal(true);
              }
            }
          } catch (err) {
            console.warn("[XeokitViewer] Error in click pick:", err);
          }
        });
      }

      console.info("[XeokitViewer] Viewer inicialitzat correctament");

    } catch (err) {
      console.error("[XeokitViewer] Error inicialitzant viewer:", err);
      const details = err instanceof Error ? err.message : String(err);
      setError(`Error en inicialitzar el visor 3D${details ? `: ${details}` : ""}`);
    }

    return () => {
      console.info("[XeokitViewer] === INICI CLEANUP COMPLET ===");
      
      // Mark component as unmounted to prevent any async operations
      isMountedRef.current = false;
      isLoadingRef.current = false;
      isModelReadyRef.current = false;
      
      // Clear hover refs to prevent stale references
      lastEntityRef.current = null;
      lastColorizeRef.current = null;
      
      // Clear edited elements state
      editedElementsRef.current.clear();
      
      // 1. Clear U-gradient first
      if (viewerRef.current && uGradientActive) {
        try {
          clearUGradient(viewerRef.current);
          console.info("[XeokitViewer] ✓ U-gradient netejat");
        } catch (e) {
          console.error("[XeokitViewer] Error netejant U-gradient:", e);
        }
      }
      
      // 2. Remove legend from DOM
      const legend = document.getElementById("u-legend");
      if (legend) {
        legend.remove();
        console.info("[XeokitViewer] ✓ Llegenda eliminada");
      }
      
      // 3. Destroy all overlay models FIRST
      console.info("[XeokitViewer] Destruint overlay models...");
      for (const [overlayId, overlayModel] of overlayModelsRef.current.entries()) {
        try {
          overlayModel.destroy();
          console.info("[XeokitViewer] ✓ Overlay destruït:", overlayId);
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint overlay:", overlayId, e);
        }
      }
      overlayModelsRef.current.clear();
      
      // 4. Destroy main model
      if (currentModelRef.current) {
        try {
          currentModelRef.current.destroy();
          currentModelRef.current = null;
          console.info("[XeokitViewer] ✓ Model principal destruït");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint model principal:", e);
        }
      }
      
      // 5. Destroy all scene models (belt and braces)
      if (viewerRef.current?.scene) {
        const modelIds = Object.keys(viewerRef.current.scene.models);
        console.info("[XeokitViewer] Destruint models de la scene:", modelIds);
        modelIds.forEach(modelId => {
          try {
            const model = viewerRef.current!.scene.models[modelId];
            if (model) {
              model.destroy();
            }
          } catch (e) {
            console.warn("[XeokitViewer] Error destruint model de scene:", modelId, e);
          }
        });
      }
      
      // 6. Destroy distance measurements
      if (distanceMeasurementsControlRef.current) {
        try {
          distanceMeasurementsControlRef.current.destroy();
          distanceMeasurementsControlRef.current = null;
          console.info("[XeokitViewer] ✓ Distance Measurements Control destruït");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint Distance Measurements Control:", e);
        }
      }
      
      if (distanceMeasurementsRef.current) {
        try {
          distanceMeasurementsRef.current.destroy();
          distanceMeasurementsRef.current = null;
          console.info("[XeokitViewer] ✓ Distance Measurements destruïts");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint Distance Measurements:", e);
        }
      }
      
      // 7. Destroy section planes
      if (sectionPlanesRef.current) {
        try {
          sectionPlanesRef.current.destroy();
          sectionPlanesRef.current = null;
          console.info("[XeokitViewer] ✓ Section planes destruïts");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint section planes:", e);
        }
      }
      
      // 7. Destroy nav cube
      if (navCubeRef.current) {
        try {
          navCubeRef.current.destroy();
          navCubeRef.current = null;
          console.info("[XeokitViewer] ✓ NavCube destruït");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint NavCube:", e);
        }
      }
      
      // 8. Destroy loaders (CRITICAL for WASM cleanup)
      if (ifcLoaderRef.current) {
        try {
          ifcLoaderRef.current.destroy();
          ifcLoaderRef.current = null;
          console.info("[XeokitViewer] ✓ IFC Loader destruït");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint IFC Loader:", e);
        }
      }
      
      if (xktLoaderRef.current) {
        try {
          xktLoaderRef.current.destroy();
          xktLoaderRef.current = null;
          console.info("[XeokitViewer] ✓ XKT Loader destruït");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint XKT Loader:", e);
        }
      }
      
      // 9. Finally destroy viewer
      if (viewerRef.current) {
        try {
          // Clear global reference (used by non-viewer layout modals)
          if ((window as any).xeokitViewer === viewerRef.current) {
            (window as any).xeokitViewer = undefined;
          }

          viewerRef.current.destroy();
          viewerRef.current = null;
          console.info("[XeokitViewer] ✓ Viewer destruït");
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint viewer:", e);
        }
      }
      
      console.info("[XeokitViewer] === CLEANUP COMPLET FINALITZAT ===");
    };
  }, []);

  useEffect(() => {
    // Enhanced safety check - wait for viewer initialization
    if (!viewerInitialized || !viewerRef.current || !xktLoaderRef.current || !ifcLoaderRef.current) {
      console.warn("[XeokitViewer] LoadModel effect: esperant inicialització", {
        viewerInitialized,
        ifcUrl: !!ifcUrl,
        viewer: !!viewerRef.current,
        xktLoader: !!xktLoaderRef.current,
        ifcLoader: !!ifcLoaderRef.current
      });
      return;
    }

    // Si no hi ha ifcUrl, només netegem els models actuals
    if (!ifcUrl) {
      console.info("[XeokitViewer] No ifcUrl, netejant models actuals");
      if (currentModelRef.current) {
        try {
          currentModelRef.current.destroy();
          currentModelRef.current = null;
        } catch (e) {
          console.warn("[XeokitViewer] Error destruint model:", e);
        }
      }
      setModelReady(false);
      isModelReadyRef.current = false;
      return;
    }
    
    // Netejar query params de la URL si existeixen (per evitar problemes amb cache busting)
    const cleanUrl = ifcUrl.split('?')[0];
    
    // Prevent operations if component is unmounted
    if (!isMountedRef.current) {
      console.warn("[XeokitViewer] Component desmuntat, cancel·lant càrrega");
      return;
    }
    
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) {
      console.warn("[XeokitViewer] Càrrega ja en curs, ignorant nova sol·licitud");
      return;
    }

    const loadModel = async () => {
      // Double-check component is still mounted
      if (!isMountedRef.current) {
        console.warn("[XeokitViewer] Component desmuntat durant loadModel, cancel·lant");
        return;
      }
      
      isLoadingRef.current = true;
      isModelReadyRef.current = false;
      setModelReady(false);
      setLoading(true);
      setError(null);
      setLoadingProgress(0);
      setLoadingText("");
      setFileSize(undefined);
      setLoadedSize(undefined);

      try {
        console.info("[XeokitViewer] === INICI NETEJA I CÀRREGA NOVA ===");
        
        // Clear U-gradient first to release references
        if (uGradientActive && viewerRef.current) {
          console.info("[XeokitViewer] Netejant U-gradient abans de destruir models");
          try {
            clearUGradient(viewerRef.current);
            setUGradientActive(false);
          } catch (e) {
            console.warn("[XeokitViewer] Error netejant U-gradient:", e);
          }
        }
        
        // Force clear ALL previous models and resources
        if (viewerRef.current?.scene) {
          const scene = viewerRef.current.scene;
          
          // Destroy all models in the scene
          const modelIds = Object.keys(scene.models);
          console.info("[XeokitViewer] Destruint models antics:", modelIds);
          
          modelIds.forEach(modelId => {
            try {
              const model = scene.models[modelId];
              if (model) {
                console.info("[XeokitViewer] Destruint model:", modelId);
                model.destroy();
              }
            } catch (e) {
              console.warn("[XeokitViewer] Error destruint model:", modelId, e);
            }
          });
          
          // Clear all section planes
          if (sectionPlanesRef.current) {
            const planeIds = Object.keys(sectionPlanesRef.current.sectionPlanes);
            planeIds.forEach(planeId => {
              try {
                sectionPlanesRef.current?.destroySectionPlane(planeId);
              } catch (e) {
                console.warn("[XeokitViewer] Error destruint section plane:", planeId, e);
              }
            });
          }
          
          // Reset floor plan mode
          if (floorPlanMode) {
            setFloorPlanMode(false);
          }
          
          // Clear U gradient if active - FORCE amb modelId null per netejar tot
          if (uGradientActive || true) {  // Always clear to be safe
            try {
              clearUGradient(viewerRef.current, null);
              setUGradientActive(false);
              console.info("[XeokitViewer] U-gradient netejat");
            } catch (e) {
              console.warn("[XeokitViewer] Error netejant U-gradient:", e);
            }
          }
          
          // Remove legend from DOM if exists
          const legend = document.getElementById("u-legend");
          if (legend) {
            legend.remove();
            console.info("[XeokitViewer] Llegenda eliminada del DOM");
          }
          
          // Reset storeys
          setStoreys([]);
          setSelectedStorey("");
        }
        
        // Reset hover state
        lastEntityRef.current = null;
        lastColorizeRef.current = null;
        setHoveredEntity(null);
        
        currentModelRef.current = null;
        
        // Small delay to ensure cleanup is complete before loading
        await new Promise(resolve => setTimeout(resolve, 150));
        console.info("[XeokitViewer] Neteja completada, iniciant càrrega nova...");

        // Detect file extension - handle Lighthouse/IPFS URLs that have no extension
        let ext = cleanUrl.toLowerCase().split(".").pop() || "";
        
        // If the "extension" is too long or contains path separators, it's not a real extension
        // Also handle Lighthouse IPFS URLs which don't have extensions
        const isLighthouseUrl = cleanUrl.includes("lighthouse.storage") || cleanUrl.includes("/ipfs/");
        const isValidExtension = ext.length <= 4 && !ext.includes("/") && (ext === "ifc" || ext === "xkt");
        
        if (!isValidExtension || isLighthouseUrl) {
          // Assume IFC for Lighthouse/IPFS URLs or URLs without valid extensions
          ext = "ifc";
          console.info("[XeokitViewer] URL sense extensió detectada, assumint IFC:", cleanUrl);
        }
        
        const id = `model-${Date.now()}`;

        console.info("[XeokitViewer] Carregant model nou:", { id, src: cleanUrl, ext });

        // Load IFC file with conversion
        if (ext === "ifc") {
          // Safety check before loading
          if (!ifcLoaderRef.current) {
            throw new Error("IFC Loader no inicialitzat correctament");
          }

          const t0 = performance.now();
          
          const sceneModel = await ifcLoaderRef.current.load({
            src: cleanUrl,
            progressCallback: (progress: number) => {
              setLoadingProgress(progress);
              console.info(`[XeokitViewer] Progrés conversió IFC: ${progress.toFixed(1)}%`);
            },
            progressTextCallback: (text: string) => {
              setLoadingText(text);
              console.info(`[XeokitViewer] ${text}`);
            }
          });

          // Check if still mounted after async load
          if (!isMountedRef.current) {
            console.warn("[XeokitViewer] Component desmuntat durant càrrega IFC");
            return;
          }

          currentModelRef.current = sceneModel;
          const modelId = sceneModel.id;
          const t1 = performance.now();
          const loadTime = Math.floor(t1 - t0) / 1000.0;

          console.info("[XeokitViewer] ✓ Model IFC carregat", {
            modelId,
            loadTime: `${loadTime}s`
          });

          // Helper function to initialize materials with default emissive property
          // This prevents "materialEmissive" shader errors on mobile devices
          const initializeMaterialEmissive = (viewer: any) => {
            try {
              const scene = viewer?.scene;
              if (!scene) return;
              
              // Iterate through all models and their objects to set default emissive
              const models = scene.models;
              if (models) {
                Object.values(models).forEach((model: any) => {
                  // Some xeokit versions expose materials at model level
                  if (model.meshes) {
                    Object.values(model.meshes).forEach((mesh: any) => {
                      if (mesh.material && !mesh.material.emissive) {
                        mesh.material.emissive = [0, 0, 0];
                      }
                    });
                  }
                });
              }
              
              // Also check scene-level objects
              const objects = scene.objects;
              if (objects) {
                Object.values(objects).forEach((obj: any) => {
                  if (obj.material && !obj.material.emissive) {
                    obj.material.emissive = [0, 0, 0];
                  }
                  // Some objects have meshes with their own materials
                  if (obj.meshes) {
                    obj.meshes.forEach((mesh: any) => {
                      if (mesh.material && !mesh.material.emissive) {
                        mesh.material.emissive = [0, 0, 0];
                      }
                    });
                  }
                });
              }
              
              console.info("[XeokitViewer] ✓ Materials initialized with default emissive values");
            } catch (err) {
              console.warn("[XeokitViewer] Error initializing material emissive:", err);
            }
          };

          // Helper function to finalize model setup
          const finalizeModelSetup = async () => {
            if (!isMountedRef.current) return;

            // Initialize materials with default emissive to prevent shader errors on mobile
            initializeMaterialEmissive(viewerRef.current);

            // Wait for metadata to be available
            let metadataReady = false;
            let attempts = 0;
            const maxAttempts = 50;
            
            while (!metadataReady && attempts < maxAttempts && isMountedRef.current) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
              
              if (!isMountedRef.current) return;
              
              const metaModel = viewerRef.current?.metaScene?.metaModels?.[modelId];
              if (metaModel && Object.keys(metaModel).length > 0) {
                metadataReady = true;
                console.info("[XeokitViewer] ✓ Metadades disponibles després de", attempts * 100, "ms");
              }
            }
            
            if (!metadataReady) {
              console.warn("[XeokitViewer] ⚠ Metadades no disponibles després de", maxAttempts * 100, "ms");
            }

            // Fly to model
            if (viewerRef.current) {
              try {
                viewerRef.current.cameraFlight.flyTo(sceneModel);
                console.info("[XeokitViewer] Camera flight to model completat");
              } catch (e) {
                console.warn("[XeokitViewer] Error al fer flyTo:", e);
              }
            }

            // Extract storeys
            extractStoreys(modelId);

            // Re-initialize measurement modals
            try {
              initMeasurementModals();
              console.info("[XeokitViewer] ✓ Mesures reinicialitzades");
            } catch (e) {
              console.warn("[XeokitViewer] Error reinicialitzant mesures:", e);
            }

            // Dispatch model-loaded event
            window.dispatchEvent(new CustomEvent("model-loaded", { 
              detail: { model: sceneModel, modelId: modelId } 
            }));

            console.info("[XeokitViewer] === MODEL IFC CARREGAT I PREPARAT ===", {
              modelId,
              hasMetadata: !!viewerRef.current?.metaScene?.metaModels?.[modelId],
              metadataReady
            });

            // Guardar temps de càrrega a la base de dades
            if (projectId && loadTime > 0) {
              (async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) {
                    // Obtenir tipus de connexió si disponible
                    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
                    const connectionType = connection?.effectiveType || 'unknown';
                    
                    await supabase.from("project_load_times").insert({
                      project_id: projectId,
                      user_id: user.id,
                      load_time_seconds: loadTime,
                      connection_type: connectionType
                    });
                    console.info("[XeokitViewer] ✓ Temps de càrrega guardat:", loadTime, "s");
                  }
                } catch (err) {
                  console.warn("[XeokitViewer] Error guardant temps de càrrega:", err);
                }
              })();
            }

            // Auto-extract rooms
            setTimeout(async () => {
              if (isMountedRef.current && isModelReadyRef.current) {
                try {
                  const rooms = extractRoomsWithGeometry(modelId);
                  console.info("[XeokitViewer] ✓ Habitacions auto-extretes del IFC:", rooms.length);
                  
                  const { data: buildings } = await supabase
                    .from("buildings")
                    .select("id")
                    .eq("center_id", centerId)
                    .limit(1);

                  if (buildings && buildings.length > 0) {
                    const buildingId = buildings[0].id;
                    
                    const { data: levels } = await supabase
                      .from("levels")
                      .select("id, name")
                      .eq("building_id", buildingId);

                    if (levels) {
                      const { data: dbRooms } = await supabase
                        .from("rooms")
                        .select("id, name, custom_name, level_id, area, max_occupancy")
                        .in("level_id", levels.map(l => l.id));

                      if (dbRooms) {
                        const enrichedRooms = rooms.map(room => {
                          const dbRoom = dbRooms.find(dr => dr.name === room.name);
                          if (dbRoom) {
                            return {
                              ...room,
                              id: dbRoom.id,
                              customName: dbRoom.custom_name || undefined,
                              area: dbRoom.area || room.area,
                              maxOccupancy: dbRoom.max_occupancy || room.maxOccupancy
                            };
                          }
                          return room;
                        });
                        
                        setExtractedRooms(enrichedRooms);
                        window.dispatchEvent(new CustomEvent("rooms-extracted", { 
                          detail: { rooms: enrichedRooms } 
                        }));
                        return;
                      }
                    }
                  }
                  
                  setExtractedRooms(rooms);
                  window.dispatchEvent(new CustomEvent("rooms-extracted", { 
                    detail: { rooms } 
                  }));
                } catch (e) {
                  console.warn("[XeokitViewer] Error auto-extraient habitacions:", e);
                }
              }
            }, 1000);

            // Mark model as ready
            isModelReadyRef.current = true;
            setModelReady(true);
            setLoading(false);
            setLoadingProgress(0);
            setLoadingText("");
            isLoadingRef.current = false;

            // Enable edges on all entities based on edgesEnabled prop (like xkt_dtx_MAP example)
            setTimeout(() => {
              if (isMountedRef.current && viewerRef.current?.scene) {
                try {
                  const objects = viewerRef.current.scene.objects;
                  let edgeCount = 0;
                  for (const objectId in objects) {
                    const entity = objects[objectId];
                    if (entity) {
                      (entity as any).edges = edgesEnabled;
                      edgeCount++;
                    }
                  }
                  console.info("[XeokitViewer] ✓ Edges", edgesEnabled ? "enabled" : "disabled", "on", edgeCount, "entities");
                } catch (e) {
                  console.warn("[XeokitViewer] Error setting edges:", e);
                }
              }
            }, 300);

            // Create initial section plane
            setTimeout(() => {
              if (isMountedRef.current && sectionPlanesRef.current) {
                handleSectionHeightChange(sectionHeight);
              }
            }, 200);

            // Apply initial opacity
            setTimeout(() => {
              if (isMountedRef.current && isModelReadyRef.current) {
                applyOpacityToBaseModel(currentOpacityRef.current);
              }
            }, 100);

            // Capture thumbnail and count elements for project cards (IFC models)
            if (projectId && viewerRef.current) {
              const captureAndAnalyze = async () => {
                try {
                  // Esperar que el model estigui renderitzat completament
                  await new Promise(resolve => setTimeout(resolve, 2500));
                  
                  if (viewerRef.current && isMountedRef.current) {
                    // Capturar thumbnail
                    console.info("[XeokitViewer] IFC - Capturant thumbnail del projecte...");
                    const thumbnailUrl = await captureAndUploadThumbnail(viewerRef.current, projectId);
                    if (thumbnailUrl) {
                      console.info("[XeokitViewer] IFC - ✓ Thumbnail capturat i actualitzat:", thumbnailUrl);
                    } else {
                      console.warn("[XeokitViewer] IFC - ⚠ Thumbnail no capturat");
                    }
                    
                    // Comptar i guardar elements únics del model
                    console.info("[XeokitViewer] IFC - Comptant elements únics del model...");
                    const totalElements = await updateTotalModelElements(viewerRef.current, projectId, versionId);
                    if (totalElements > 0) {
                      console.info(`[XeokitViewer] IFC - ✓ ${totalElements} tipus d'elements detectats i guardats`);
                    }
                  }
                } catch (e) {
                  console.error("[XeokitViewer] IFC - Error en procés de thumbnail/elements:", e);
                }
              };
              
              captureAndAnalyze();
            }
          };

          // CxConverterIFCLoaderPlugin may not fire "loaded" event consistently
          // Try both: listen for event AND process after a delay
          let loadedHandled = false;
          
          sceneModel.on("loaded", () => {
            if (!loadedHandled) {
              loadedHandled = true;
              console.info("[XeokitViewer] Event 'loaded' rebut");
              finalizeModelSetup();
            }
          });

          // Also process after a short delay in case "loaded" event doesn't fire
          setTimeout(() => {
            if (!loadedHandled && isMountedRef.current) {
              loadedHandled = true;
              console.info("[XeokitViewer] Processant model sense event 'loaded' (fallback)");
              finalizeModelSetup();
            }
          }, 500);

          // Listen for error events
          sceneModel.on("error", (err: any) => {
            console.error("[XeokitViewer] ✗ Error carregant model IFC:", err);
            const errorMsg = err?.message || String(err);
            if (errorMsg.includes("memory access out of bounds")) {
              setError(t("viewer.memoryError"));
            } else {
              setError(`Error carregant/convertint model IFC: ${errorMsg}`);
            }
            setLoading(false);
            setLoadingProgress(0);
            setLoadingText("");
            isLoadingRef.current = false;
          });

        } else if (ext === "xkt") {
          // Safety check before loading
          if (!xktLoaderRef.current) {
            throw new Error("XKT Loader no inicialitzat correctament");
          }

          const t0 = performance.now();
          let xktData: ArrayBuffer;
          
          // Try to get from cache first
          const cachedData = await getCachedModel(cleanUrl);
          
          if (cachedData) {
            // Model found in cache - instant load!
            console.info("[XeokitViewer] ⚡ Model XKT carregat des de caché!");
            setLoadingText(language === "ca" ? "Carregant des de caché..." : "Cargando desde caché...");
            setLoadingProgress(100);
            xktData = cachedData;
          } else {
            // Download XKT file with real progress tracking
            setLoadingText(language === "ca" ? "Descarregant model XKT..." : "Descargando modelo XKT...");
            
            xktData = await new Promise<ArrayBuffer>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', cleanUrl, true);
              xhr.responseType = 'arraybuffer';
              
              xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                  const progress = (event.loaded / event.total) * 100;
                  setLoadingProgress(progress);
                  setFileSize(event.total);
                  setLoadedSize(event.loaded);
                }
              };
              
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  setLoadingText(language === "ca" ? "Processant model..." : "Procesando modelo...");
                  resolve(xhr.response);
                } else {
                  reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
              };
              
              xhr.onerror = () => reject(new Error("Error de xarxa descarregant XKT"));
              xhr.send();
            });
            
            // Save to cache for future loads (in background)
            cacheModel(cleanUrl, xktData, projectId, versionId).catch(err => {
              console.warn("[XeokitViewer] Error guardant model a caché:", err);
            });
          }
          
          setLoadingText(language === "ca" ? "Processant model..." : "Procesando modelo...");
          
          // Load XKT from ArrayBuffer with enhanced quality settings
          const sceneModel = xktLoaderRef.current.load({
            id,
            xkt: xktData,
            saoEnabled: hasWebGL2Ref.current,     // Screen space ambient occlusion - WebGL2 only
            edges: true,                          // Enable edges for better visual quality
            dtxEnabled: hasWebGL2Ref.current,     // Data texture for better performance - WebGL2 only
            pbrEnabled: hasWebGL2Ref.current      // PBR materials - WebGL2 only
          });

          currentModelRef.current = sceneModel;

          sceneModel.on("loaded", async () => {
            // Check if still mounted after async operation
            if (!isMountedRef.current) {
              console.warn("[XeokitViewer] Component desmuntat durant càrrega XKT");
              return;
            }
            
            const t1 = performance.now();
            const loadTime = Math.floor(t1 - t0) / 1000.0;
            
            console.info("[XeokitViewer] ✓ Model XKT carregat, esperant metadades...", {
              id,
              loadTime: `${loadTime}s`
            });

            // Initialize materials with default emissive to prevent shader errors on mobile
            try {
              const scene = viewerRef.current?.scene;
              if (scene) {
                // Iterate through all scene objects to set default emissive
                const objects = scene.objects;
                if (objects) {
                  Object.values(objects).forEach((obj: any) => {
                    if (obj.material && !obj.material.emissive) {
                      obj.material.emissive = [0, 0, 0];
                    }
                    if (obj.meshes) {
                      obj.meshes.forEach((mesh: any) => {
                        if (mesh.material && !mesh.material.emissive) {
                          mesh.material.emissive = [0, 0, 0];
                        }
                      });
                    }
                  });
                }
                console.info("[XeokitViewer] ✓ XKT Materials initialized with default emissive values");
              }
            } catch (err) {
              console.warn("[XeokitViewer] Error initializing XKT material emissive:", err);
            }

            // CRITICAL: Wait for metadata to be fully available
            let metadataReady = false;
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            while (!metadataReady && attempts < maxAttempts && isMountedRef.current) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
              
              // Check again after await
              if (!isMountedRef.current) {
                console.warn("[XeokitViewer] Component desmuntat durant espera de metadades XKT");
                return;
              }
              
              const metaModel = viewerRef.current?.metaScene?.metaModels?.[id];
              if (metaModel) {
                // Check if metaModel has actual objects/data
                const hasData = Object.keys(metaModel).length > 0;
                if (hasData) {
                  metadataReady = true;
                  console.info("[XeokitViewer] ✓ Metadades disponibles després de", attempts * 100, "ms");
                }
              }
            }
            
            if (!metadataReady) {
              console.warn("[XeokitViewer] ⚠ Metadades no disponibles després de", maxAttempts * 100, "ms");
            }

            // Fly to model
            if (viewerRef.current) {
              try {
                viewerRef.current.cameraFlight.flyTo(sceneModel);
              } catch (e) {
                console.warn("[XeokitViewer] Error al fer flyTo:", e);
              }
            }

            // Extract storeys from metaScene
            extractStoreys(id);

            // Re-initialize measurement modals after model load
            try {
              initMeasurementModals();
              console.info("[XeokitViewer] ✓ Mesures reinicialitzades després de càrrega del model XKT");
            } catch (e) {
              console.warn("[XeokitViewer] Error reinicialitzant mesures:", e);
            }

            // Dispatch event for tree view
            window.dispatchEvent(new CustomEvent("model-loaded", { 
              detail: { model: sceneModel, modelId: id } 
            }));

            console.info("[XeokitViewer] === MODEL XKT CARREGAT I PREPARAT ===", {
              modelId: id,
              hasMetadata: !!viewerRef.current?.metaScene?.metaModels?.[id],
              metadataReady,
              storeysCount: storeys.length
            });

            // Mark model as ready ONLY after metadata is confirmed
            isModelReadyRef.current = true;
            setModelReady(true);
            
            setLoading(false);
            isLoadingRef.current = false;

            // Create initial section plane
            setTimeout(() => {
              if (isMountedRef.current && sectionPlanesRef.current) {
                handleSectionHeightChange(sectionHeight);
              }
            }, 200);

            // Apply initial opacity to base model
            setTimeout(() => {
              if (isMountedRef.current && isModelReadyRef.current) {
                applyOpacityToBaseModel(currentOpacityRef.current);
              }
            }, 100);

            // Restore U-gradient state if it was active
            if (uGradientState.active && viewerRef.current && isMountedRef.current) {
              console.info("[XeokitViewer] Restaurant estat del U-gradient després de càrrega del model XKT");
              setTimeout(async () => {
                if (viewerRef.current && isMountedRef.current && isModelReadyRef.current) {
                  try {
                    await applyUGradientToWalls(
                      viewerRef.current, 
                      null, 
                      uGradientState.minValue, 
                      uGradientState.maxValue, 
                      uGradientState.types || ['wall']
                    );
                    setUGradientActive(true);
                    console.info("[XeokitViewer] ✓ U-gradient restaurat");
                  } catch (e) {
                    console.error("[XeokitViewer] Error restaurant U-gradient:", e);
                  }
                }
              }, 500);
            }

            // Capture thumbnail and count elements for project cards
            if (projectId && viewerRef.current && !thumbnailCapturedRef.current) {
              thumbnailCapturedRef.current = true;
              
              const checkAndCaptureData = async () => {
                try {
                  const { data: projectData } = await supabase
                    .from('projects')
                    .select('thumbnail_url, total_model_elements')
                    .eq('id', projectId)
                    .single();
                  
                  // Esperar que el model estigui completament renderitzat
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  
                  if (viewerRef.current && isMountedRef.current) {
                    // Capturar thumbnail si no existeix
                    if (!projectData?.thumbnail_url) {
                      console.info("[XeokitViewer] Capturant thumbnail del projecte...");
                      const thumbnailUrl = await captureAndUploadThumbnail(viewerRef.current, projectId);
                      if (thumbnailUrl) {
                        console.info("[XeokitViewer] ✓ Thumbnail capturat i pujat:", thumbnailUrl);
                      } else {
                        console.warn("[XeokitViewer] ⚠ Thumbnail no capturat");
                      }
                    } else {
                      console.info("[XeokitViewer] Projecte ja té thumbnail, saltant captura");
                    }
                    
                    // Comptar i guardar elements únics del model (sempre actualitzar)
                    console.info("[XeokitViewer] XKT - Comptant elements únics del model...");
                    const totalElements = await updateTotalModelElements(viewerRef.current, projectId, versionId);
                    if (totalElements > 0) {
                      console.info(`[XeokitViewer] XKT - ✓ ${totalElements} tipus d'elements detectats i guardats`);
                    }
                  }
                } catch (e) {
                  console.error("[XeokitViewer] Error en procés de thumbnail/elements:", e);
                }
              };
              
              checkAndCaptureData();
            }
          });

          sceneModel.on("error", (err: any) => {
            console.error("[XeokitViewer] ✗ Error carregant model:", err);
            setError(`Error carregant model: ${String(err)}`);
            setLoading(false);
            isLoadingRef.current = false;
          });

        } else {
          setError(`Format no suportat: .${ext}. Només es suporten arxius IFC i XKT.`);
          setLoading(false);
          isLoadingRef.current = false;
        }

      } catch (err: any) {
        console.error("[XeokitViewer] Error general:", err);
        const errorMsg = err?.message || String(err);
        if (errorMsg.includes("memory access out of bounds")) {
          setError(t("viewer.memoryError"));
        } else {
          setError(errorMsg || t("viewer.noModel"));
        }
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ifcUrl, viewerInitialized]); // Note: `t` removed to prevent model reload on language change

  // Extract rooms from metaScene (IfcSpace entities) with geometry data
  const extractRoomsWithGeometry = (modelId: string): Array<{ id: string; name: string; level: string; area: number; maxOccupancy?: number; aabb?: number[] }> => {
    console.info("[XeokitViewer] Extracting rooms with geometry from model:", modelId);
    const rooms: Array<{ id: string; name: string; level: string; area: number; maxOccupancy?: number; aabb?: number[] }> = [];
    
    if (!viewerRef.current?.metaScene) {
      console.warn("[XeokitViewer] No metaScene available");
      return rooms;
    }

    const metaModel = viewerRef.current.metaScene.metaModels[modelId];
    if (!metaModel) {
      console.warn("[XeokitViewer] No metaModel found for:", modelId);
      return rooms;
    }

    try {
      // Find all IfcSpace entities
      const metaObjects = metaModel.rootMetaObject?.children || [];
      
      const processMetaObject = (metaObj: any, parentStorey?: string) => {
        if (!metaObj) return;
        
        // Check if this is a storey (IfcBuildingStorey)
        let currentStorey = parentStorey;
        if (metaObj.type === "IfcBuildingStorey") {
          currentStorey = metaObj.name || metaObj.id;
          console.info("[XeokitViewer] Found storey:", currentStorey);
        }
        
        // Check if this is a space (room)
        if (metaObj.type === "IfcSpace") {
          // Try to get LongName first, fallback to Name
          let roomName = metaObj.name || metaObj.id || "Unknown";
          let area = 0;
          let maxOccupancy: number | undefined;
          
          if (metaObj.propertySetIds) {
            metaObj.propertySetIds.forEach((propSetId: string) => {
              const propSet = metaModel.propertySets?.[propSetId];
              if (propSet?.properties) {
                propSet.properties.forEach((prop: any) => {
                  // Decode IFC special characters (e.g., \X\F3 = ó)
                  const decodedName = prop.name?.replace(/\\X\\([0-9A-F]{2})/g, (match: string, hex: string) => {
                    return String.fromCharCode(parseInt(hex, 16));
                  }) || prop.name;
                  
                  const decodedValue = typeof prop.value === 'string' 
                    ? prop.value.replace(/\\X\\([0-9A-F]{2})/g, (match: string, hex: string) => {
                        return String.fromCharCode(parseInt(hex, 16));
                      })
                    : prop.value;

                  // Get room name - try multiple property names including Spanish
                  if ((decodedName === "LongName" || decodedName === "Long Name" || 
                       decodedName === "Nombre" || decodedName === "Name") && decodedValue) {
                    roomName = decodedValue;
                  }
                  // Get area - try different property names including Spanish
                  if ((decodedName === "NetFloorArea" || decodedName === "Area" || 
                       decodedName === "GrossFloorArea" || decodedName === "AreaWithMaximalHeight" ||
                       decodedName === "Superficie" || decodedName === "AreaNet") && decodedValue) {
                    const parsedArea = parseFloat(decodedValue);
                    if (!isNaN(parsedArea) && parsedArea > 0) {
                      area = parsedArea;
                    }
                  }
                  // Get occupancy - try multiple property names including Spanish (with and without accent)
                  if ((decodedName === "Occupancy" || decodedName === "MaxOccupancy" || 
                       decodedName === "OccupantNumber" || decodedName === "Ocupación" ||
                       decodedName === "Ocupacion") && decodedValue) {
                    const parsedOccupancy = parseInt(decodedValue);
                    if (!isNaN(parsedOccupancy)) {
                      maxOccupancy = parsedOccupancy;
                    }
                  }
                });
              }
            });
          }
          
          // If no area in properties, try to get from entity AABB
          if (area === 0 && viewerRef.current?.scene) {
            const entity = viewerRef.current.scene.objects[metaObj.id];
            if (entity?.aabb) {
              const aabb = entity.aabb;
              const width = Math.abs(aabb[3] - aabb[0]);
              const depth = Math.abs(aabb[5] - aabb[2]);
              area = width * depth;
            }
          }
          
          const storey = currentStorey || "Unknown Level";
          
          // Get room AABB for fly-to functionality
          let roomAabb: number[] | undefined;
          if (viewerRef.current?.scene) {
            const entity = viewerRef.current.scene.objects[metaObj.id];
            if (entity?.aabb) {
              roomAabb = entity.aabb;
            }
          }
          
          rooms.push({
            id: metaObj.id,
            name: roomName,
            level: storey,
            area: area,
            maxOccupancy: maxOccupancy,
            aabb: roomAabb
          });
          
          console.info("[XeokitViewer] Found room:", { id: metaObj.id, name: roomName, level: storey, area, maxOccupancy, hasAabb: !!roomAabb });
        }
        
        // Process children recursively
        if (metaObj.children) {
          metaObj.children.forEach((child: any) => processMetaObject(child, currentStorey));
        }
      };
      
      metaObjects.forEach((metaObj: any) => processMetaObject(metaObj));
      
      console.info("[XeokitViewer] Total rooms extracted:", rooms.length);
    } catch (error) {
      console.error("[XeokitViewer] Error extracting rooms:", error);
    }
    
    return rooms;
  };

  const extractStoreys = (modelId: string) => {
    if (!viewerRef.current?.metaScene) return;

    const metaModel = viewerRef.current.metaScene.metaModels[modelId];
    if (!metaModel) {
      console.warn("[XeokitViewer] No s'ha trobat el metaModel per:", modelId);
      return;
    }

    const storeysFound: Array<{ id: string; name: string; elevation: number; aabb: number[] }> = [];
    const scene = viewerRef.current.scene;
    const processedIds = new Set<string>();

    // Helper to check if a metaObject is a storey (building level)
    const isStoreyType = (metaObj: any): boolean => {
      if (!metaObj) return false;
      
      // Check by IFC type (can be "IfcBuildingStorey" or variations)
      const type = (metaObj.type || "").toLowerCase();
      if (type.includes("buildingstorey") || type.includes("storey") || type.includes("level")) {
        return true;
      }
      
      // Also check by name pattern - some models name them "Nivel X" or "Planta X"
      const name = (metaObj.name || "").toLowerCase();
      if (name.startsWith("nivel") || name.startsWith("planta") || name.startsWith("level") || 
          name.startsWith("storey") || name.startsWith("floor") || name.startsWith("piso")) {
        // But only if it's a container type (has children and no geometry itself)
        if (metaObj.children && metaObj.children.length > 0) {
          return true;
        }
      }
      
      return false;
    };

    // Recursive function to find storeys in the hierarchy
    const processMetaObject = (metaObj: any) => {
      if (!metaObj || processedIds.has(metaObj.id)) return;
      processedIds.add(metaObj.id);

      if (isStoreyType(metaObj)) {
        // Get all entity IDs that belong to this storey
        const storeyEntityIds: string[] = [];
        const collectEntityIds = (obj: any) => {
          if (scene.objects[obj.id]) {
            storeyEntityIds.push(obj.id);
          }
          if (obj.children) {
            obj.children.forEach((child: any) => collectEntityIds(child));
          }
        };
        collectEntityIds(metaObj);

        // Get AABB for this specific storey
        const aabb = scene.getAABB(storeyEntityIds);
        const elevation = aabb ? aabb[1] : 0; // Y min from bounding box
        
        // Use the name, fallback to "Planta X"
        let storeyName = metaObj.name || `Planta ${storeysFound.length + 1}`;
        
        console.info("[XeokitViewer] Storey trobat:", { 
          id: metaObj.id, 
          name: storeyName, 
          type: metaObj.type,
          elevation,
          entityCount: storeyEntityIds.length
        });
        
        storeysFound.push({
          id: metaObj.id,
          name: storeyName,
          elevation,
          aabb: aabb || [0, 0, 0, 0, 0, 0]
        });
      }

      // Process children recursively
      if (metaObj.children) {
        metaObj.children.forEach((child: any) => processMetaObject(child));
      }
    };

    // Method 1: Iterate through metaObjects dictionary
    const metaObjects = viewerRef.current.metaScene.metaObjects;
    for (const metaObjectId in metaObjects) {
      const metaObject = metaObjects[metaObjectId];
      if (isStoreyType(metaObject) && !processedIds.has(metaObject.id)) {
        processMetaObject(metaObject);
      }
    }

    // Method 2: Also traverse from rootMetaObject (some models structure differently)
    if (storeysFound.length === 0 && metaModel.rootMetaObject) {
      console.info("[XeokitViewer] Cap storey trobat via metaObjects, provant recorregut recursiu...");
      const rootChildren = metaModel.rootMetaObject.children || [];
      rootChildren.forEach((child: any) => processMetaObject(child));
    }

    // Log all types found for debugging if no storeys found
    if (storeysFound.length === 0) {
      const allTypes = new Set<string>();
      for (const metaObjectId in metaObjects) {
        const metaObject = metaObjects[metaObjectId];
        if (metaObject.type) {
          allTypes.add(metaObject.type);
        }
      }
      console.warn("[XeokitViewer] No s'han trobat storeys. Tipus disponibles al model:", Array.from(allTypes));
    }

    // Sort by elevation
    storeysFound.sort((a, b) => a.elevation - b.elevation);
    
    console.info("[XeokitViewer] Plantes trobades:", storeysFound);
    setStoreys(storeysFound);
    
    if (storeysFound.length > 0) {
      setSelectedStorey(storeysFound[0].id);
      
      // Calculate slider range based on storeys AND model AABB for true min/max
      const storeyMinElevation = storeysFound[0].elevation;
      const storeyMaxElevation = storeysFound[storeysFound.length - 1].elevation;
      
      // Also get model AABB to capture elements below lowest storey
      let modelMinY = storeyMinElevation;
      let modelMaxY = storeyMaxElevation;
      if (viewerRef.current) {
        const scene = viewerRef.current.scene;
        const aabb = scene.getAABB(scene.visibleObjectIds);
        if (aabb && aabb.length === 6) {
          modelMinY = Math.min(storeyMinElevation, aabb[1]);
          modelMaxY = Math.max(storeyMaxElevation, aabb[4]);
        }
      }
      
      // Add 2 meters to each extreme
      const calculatedMax = modelMaxY + 2 + 3; // +2m margin + 3m above highest point
      const calculatedMin = modelMinY - 2; // Allow negative values
      setSliderMin(calculatedMin);
      setSliderMax(calculatedMax);
      
      // Set initial section height to maximum (no section cut by default)
      setSectionHeight(calculatedMax);
      
      console.info("[XeokitViewer] Rang del slider actualitzat:", {
        storeyMin: storeyMinElevation,
        storeyMax: storeyMaxElevation,
        modelMin: modelMinY,
        modelMax: modelMaxY,
        calculatedMin,
        calculatedMax,
        defaultHeight: calculatedMax
      });
    } else {
      // If no storeys found, use model AABB
      if (viewerRef.current) {
        const scene = viewerRef.current.scene;
        const aabb = scene.getAABB(scene.visibleObjectIds);
        if (aabb && aabb.length === 6) {
          const minY = aabb[1];
          const maxY = aabb[4];
          
          // Add 2 meters to each extreme
          const calculatedMax = maxY + 2;
          const calculatedMin = minY - 2; // Allow negative values
          setSliderMin(calculatedMin);
          setSliderMax(calculatedMax);
          
          // Set initial section height to maximum (no section cut by default)
          setSectionHeight(calculatedMax);
          
          console.info("[XeokitViewer] Rang del slider basat en AABB del model:", {
            min: minY - 2,
            max: calculatedMax,
            defaultHeight: calculatedMax
          });
        }
      }
    }
  };

  const toggleFloorPlanMode = () => {
    if (!viewerRef.current || !sectionPlanesRef.current) return;

    const newMode = !floorPlanMode;
    setFloorPlanMode(newMode);

    if (newMode) {
      // Save current camera state
      const camera = viewerRef.current.scene.camera;
      savedCameraState.current = {
        eye: [...camera.eye],
        look: [...camera.look],
        up: [...camera.up],
        projection: camera.projection
      };

      // Switch to orthographic projection and top-down view
      camera.projection = "ortho";
      
      // Get model bounds to center the view
      const scene = viewerRef.current.scene;
      const aabb = scene.getAABB(scene.visibleObjectIds);
      
      if (aabb) {
        const center = [
          (aabb[0] + aabb[3]) / 2,
          (aabb[1] + aabb[4]) / 2,
          (aabb[2] + aabb[5]) / 2
        ];
        
        // Position camera above the center, looking down
        camera.eye = [center[0], aabb[4] + 50, center[2]];
        camera.look = center;
        camera.up = [0, 0, -1]; // Z-axis pointing up in floor plan view
      }

      // Ensure section plane is created with current height
      handleSectionHeightChange(sectionHeight);
    } else {
      // Restore camera state
      if (savedCameraState.current) {
        const camera = viewerRef.current.scene.camera;
        camera.projection = savedCameraState.current.projection as any;
        camera.eye = savedCameraState.current.eye;
        camera.look = savedCameraState.current.look;
        camera.up = savedCameraState.current.up;
      }
      
      // Section plane stays active in 3D mode - don't remove it
    }
  };

  const createSectionPlaneAtStorey = (storeyId: string) => {
    if (!sectionPlanesRef.current || !viewerRef.current) return;

    const storey = storeys.find(s => s.id === storeyId);
    if (!storey) return;

    // Center camera on this storey's AABB
    const aabb = storey.aabb;
    if (aabb) {
      const camera = viewerRef.current.camera;
      const centerX = (aabb[0] + aabb[3]) / 2;
      const centerZ = (aabb[2] + aabb[5]) / 2;
      const sizeX = aabb[3] - aabb[0];
      const sizeZ = aabb[5] - aabb[2];
      const maxSize = Math.max(sizeX, sizeZ);
      
      // Position camera above the center, looking down
      camera.eye = [centerX, storey.elevation + 50, centerZ];
      camera.look = [centerX, storey.elevation, centerZ];
      camera.up = [0, 0, -1];
      
      // Adjust zoom to fit the storey
      if (camera.projection === "ortho") {
        camera.ortho.scale = maxSize * 0.8;
      }
    }

    console.info("[XeokitViewer] Càmera centrada en planta:", storey.name);
  };

  const handleSectionHeightChange = (newHeight: number) => {
    setSectionHeight(newHeight);
    
    if (!viewerRef.current || !sectionPlanesRef.current) {
      return;
    }

    const scene = viewerRef.current.scene;

    // Create section plane if it doesn't exist
    let existingPlane = sectionPlanesRef.current.sectionPlanes["sectionPlane"];
    if (!existingPlane) {
      sectionPlanesRef.current.createSectionPlane({
        id: "sectionPlane",
        pos: [0, newHeight, 0],
        dir: [0, -1, 0] // Pointing down
      });
      console.info("[XeokitViewer] Pla de secció creat a:", newHeight);
    } else {
      // Update existing section plane position
      existingPlane.pos = [0, newHeight, 0];
      console.info("[XeokitViewer] Alçada de secció actualitzada a:", newHeight);
    }

    // Enable backfaces on all entities when section plane is active
    // This makes the interior faces visible when cutting through geometry
    enableBackfacesForSectionCut(newHeight);
  };

  // Update visuals for section cuts.
  // - Enables true "caps" only on intersection areas using SceneModelEntity.capMaterial (requires readableGeometryEnabled)
  // - Optionally enables SceneModel.backfaces so interiors don't disappear
  const enableBackfacesForSectionCut = (height: number) => {
    if (!viewerRef.current?.scene) return;

    const scene = viewerRef.current.scene as any;
    const isSectionActive = height < sliderMax - 0.1;

    // Cleanup from previous approach (no longer used)
    if (sectionFillMeshRef.current) {
      try {
        sectionFillMeshRef.current.destroy();
      } catch {
        // ignore
      }
      sectionFillMeshRef.current = null;
    }

    try {
      // Lazily create a cap material
      if (!sectionCapMaterialRef.current) {
        sectionCapMaterialRef.current = new PhongMaterial(scene, {
          diffuse: [0.85, 0.84, 0.82],
          emissive: [0.02, 0.02, 0.02],
          alpha: 1.0,
          backfaces: true
        });
      }

      const capMaterial = sectionCapMaterialRef.current;
      const opacityThreshold = 0.7;

      const models = scene.models || {};
      const modelIds = Object.keys(models);

      modelIds.forEach((modelId) => {
        const m = models[modelId] as any;

        // 1) Backfaces at model level
        if (m && typeof m.backfaces !== "undefined") {
          m.backfaces = isSectionActive;
        }

        // 2) True section caps on intersection only
        const objects = m?.objects || {};
        for (const objectId in objects) {
          const obj = objects[objectId] as any;
          const opacity = typeof obj?.opacity === "number" ? obj.opacity : 1.0;
          obj.capMaterial = isSectionActive && opacity >= opacityThreshold ? capMaterial : null;
        }
      });

      console.info("[XeokitViewer] section cut visuals", {
        isSectionActive,
        modelCount: modelIds.length,
        readableGeometryEnabled: !!scene.readableGeometryEnabled
      });
    } catch (e) {
      console.warn("[XeokitViewer] Error configurant secció/caps:", e);
    }
  };

  // Fly to room with animation, focusing on Panel-XX wall if found
  const flyToRoom = (room: { id: string; name: string; level: string; area: number; aabb?: number[] }) => {
    if (!viewerRef.current || !room.aabb) {
      console.warn("[XeokitViewer] Cannot fly to room: no viewer or AABB", room);
      return;
    }

    const aabb = room.aabb;
    const floorY = aabb[1]; // min Y of the room
    const targetHeight = floorY + 1.7; // 1.70m above floor

    // Try to find the Panel-XX wall
    const panelWall = findPanelWallInRoom(room);
    
    let eye: number[], look: number[], up: number[] = [0, 1, 0];

    if (panelWall) {
      // Calculate wall center and normal to look at it frontally
      const wallAABB = panelWall.aabb;
      const wallCenter = [
        (wallAABB[0] + wallAABB[3]) / 2,
        targetHeight, // At eye level
        (wallAABB[2] + wallAABB[5]) / 2
      ];

      // Calculate wall dimensions to determine orientation
      const widthX = wallAABB[3] - wallAABB[0];
      const widthZ = wallAABB[5] - wallAABB[2];
      
      // Determine wall normal direction (simplified: perpendicular to longest dimension)
      let offsetX = 0, offsetZ = 0;
      const viewDistance = 3.0; // 3m away from wall
      
      if (widthX > widthZ) {
        // Wall oriented along X axis, normal along Z
        offsetZ = viewDistance;
      } else {
        // Wall oriented along Z axis, normal along X
        offsetX = viewDistance;
      }

      // Position camera at viewing distance from wall center
      eye = [wallCenter[0] + offsetX, targetHeight, wallCenter[2] + offsetZ];
      look = wallCenter as number[];

      console.info("[XeokitViewer] Flying to Panel wall:", {
        name: room.name,
        wallId: panelWall.id,
        wallCenter,
        eye,
        look,
        targetHeight
      });
    } else {
      // Fallback: fly to room center
      const center = [
        (aabb[0] + aabb[3]) / 2,
        (aabb[1] + aabb[4]) / 2,
        (aabb[2] + aabb[5]) / 2
      ];

      eye = [center[0], targetHeight, center[2] + 3];
      look = [center[0], targetHeight, center[2]];

      console.info("[XeokitViewer] Panel wall not found, flying to room center:", {
        name: room.name,
        center,
        eye,
        look
      });
    }

    // Animate camera with duration
    viewerRef.current.cameraFlight.flyTo({
      eye,
      look,
      up,
      duration: 1.5, // 1.5 seconds animation
      projection: "perspective"
    }, () => {
      console.info("[XeokitViewer] ✓ Arrived at room:", room.name);
    });

    // Find and highlight walls with Panel-XX marker
    findAndHighlightPanelWalls(room);
  };

  // Find the Panel-XX wall in the room
  const findPanelWallInRoom = (room: { id: string; name: string }): { id: string; aabb: number[] } | null => {
    if (!viewerRef.current || !currentModelRef.current) return null;

    const metaScene = viewerRef.current.metaScene;
    const scene = viewerRef.current.scene;
    
    if (!metaScene) return null;

    const modelId = currentModelRef.current.id;
    const metaModel = metaScene.metaModels[modelId];
    
    if (!metaModel) return null;

    // Extract room number from room name
    const roomNumberMatch = room.name.match(/\d+/);
    const roomNumber = roomNumberMatch ? roomNumberMatch[0] : null;

    if (!roomNumber) return null;

    const panelMarker = `Panel-${roomNumber}`;

    // Find room meta object
    const roomMetaObject = metaScene.metaObjects[room.id];
    if (!roomMetaObject) return null;

    // Helper to check if metaObject is a child of room
    const isChildOfRoom = (metaObj: any, roomMetaObj: any): boolean => {
      let current = metaObj;
      while (current) {
        if (current.id === roomMetaObj.id) return true;
        current = current.parent;
      }
      return false;
    };

    // Search for wall with the matching Marca parameter
    const metaObjects = metaScene.metaObjects;
    for (const metaObjectId in metaObjects) {
      const metaObject = metaObjects[metaObjectId];
      
      if (metaObject.type === "IfcWall" || metaObject.type === "IfcWallStandardCase") {
        if (isChildOfRoom(metaObject, roomMetaObject)) {
          // @ts-ignore
          if (metaObject.propertySetIds) {
            // @ts-ignore
            for (const propSetId of metaObject.propertySetIds) {
              const propSet = metaModel.propertySets?.[propSetId];
              if (propSet?.properties) {
                for (const prop of propSet.properties) {
                  if (prop.name === "Marca" && prop.value === panelMarker) {
                    // Get entity AABB
                    const entity = scene.objects[metaObject.id];
                    if (entity && entity.aabb) {
                      return { id: metaObject.id, aabb: entity.aabb };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return null;
  };

  // Find walls with Marca = "Panel-XX" in the room
  const findAndHighlightPanelWalls = (room: { id: string; name: string }) => {
    if (!viewerRef.current || !currentModelRef.current) return;

    const metaScene = viewerRef.current.metaScene;
    const scene = viewerRef.current.scene;
    
    if (!metaScene) return;

    const modelId = currentModelRef.current.id;
    const metaModel = metaScene.metaModels[modelId];
    
    if (!metaModel) return;

    // Extract room number from room name (assuming format contains a number)
    const roomNumberMatch = room.name.match(/\d+/);
    const roomNumber = roomNumberMatch ? roomNumberMatch[0] : null;

    if (!roomNumber) {
      console.warn("[XeokitViewer] Could not extract room number from:", room.name);
      return;
    }

    const panelMarker = `Panel-${roomNumber}`;
    console.info("[XeokitViewer] Looking for walls with Marca:", panelMarker);

    // Find room meta object
    const roomMetaObject = metaScene.metaObjects[room.id];
    if (!roomMetaObject) return;

    // Helper to check if metaObject is a child of room
    const isChildOfRoom = (metaObj: any, roomMetaObj: any): boolean => {
      let current = metaObj;
      while (current) {
        if (current.id === roomMetaObj.id) return true;
        current = current.parent;
      }
      return false;
    };

    // Search for walls with the matching Marca parameter
    const metaObjects = metaScene.metaObjects;
    for (const metaObjectId in metaObjects) {
      const metaObject = metaObjects[metaObjectId];
      
      // Check if it's a wall type
      if (metaObject.type === "IfcWall" || metaObject.type === "IfcWallStandardCase") {
        // Check if wall is child of this room (or nearby)
        if (isChildOfRoom(metaObject, roomMetaObject)) {
          // Check properties for "Marca" parameter
          // @ts-ignore - propertySetIds exists at runtime but not in types
          if (metaObject.propertySetIds) {
            // @ts-ignore
            for (const propSetId of metaObject.propertySetIds) {
              const propSet = metaModel.propertySets?.[propSetId];
              if (propSet?.properties) {
                for (const prop of propSet.properties) {
                  if (prop.name === "Marca" && prop.value === panelMarker) {
                    console.info("[XeokitViewer] ✓ Found wall with Marca:", panelMarker, metaObject.id);
                    
                    // Get the scene entity and colorize it red
                    const entity = scene.objects[metaObject.id];
                    if (entity) {
                      // Store in selected walls
                      if (!selectedWallsRef.current.has(metaObject.id)) {
                        selectedWallsRef.current.add(metaObject.id);
                      }
                      
                      // Colorize in exact red
                      entity.colorize = [1.0, 0.0, 0.0, 1.0];
                      console.info("[XeokitViewer] ✓ Wall colorized red:", metaObject.id);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  // Handle room click from navigator
  const handleRoomNavigatorClick = (room: { id: string; name: string; level: string; area: number; aabb?: number[] }) => {
    console.info("[XeokitViewer] Room selected from navigator:", room.name);
    currentRoomRef.current = { id: room.id, name: room.name };
    flyToRoom(room);
  };

  // Check if a clicked wall has the Panel-XX marker and highlight it
  const checkAndHighlightPanelWall = (entityId: string, room: { id: string; name: string }) => {
    if (!viewerRef.current || !currentModelRef.current) return;

    const metaScene = viewerRef.current.metaScene;
    const scene = viewerRef.current.scene;
    
    if (!metaScene) return;

    const modelId = currentModelRef.current.id;
    const metaModel = metaScene.metaModels[modelId];
    
    if (!metaModel) return;

    // Extract room number from room name
    const roomNumberMatch = room.name.match(/\d+/);
    const roomNumber = roomNumberMatch ? roomNumberMatch[0] : null;

    if (!roomNumber) {
      console.warn("[XeokitViewer] Could not extract room number from:", room.name);
      return;
    }

    const panelMarker = `Panel-${roomNumber}`;
    const metaObject = metaScene.metaObjects[entityId];
    
    if (!metaObject) return;

    // Check if wall has the matching Marca parameter
    // @ts-ignore - propertySetIds exists at runtime but not in types
    if (metaObject.propertySetIds) {
      // @ts-ignore
      for (const propSetId of metaObject.propertySetIds) {
        const propSet = metaModel.propertySets?.[propSetId];
        if (propSet?.properties) {
          for (const prop of propSet.properties) {
            if (prop.name === "Marca" && prop.value === panelMarker) {
              console.info("[XeokitViewer] ✓ Clicked wall with matching Marca:", panelMarker);
              
              // Get the scene entity and colorize it red
              const entity = scene.objects[entityId];
              if (entity) {
                // Toggle selection
                if (selectedWallsRef.current.has(entityId)) {
                  // Already selected - restore original color (white/default)
                  selectedWallsRef.current.delete(entityId);
                  entity.colorize = [1.0, 1.0, 1.0, 1.0]; // White (default)
                  console.info("[XeokitViewer] Wall deselected:", entityId);
                } else {
                  // Not selected - highlight in red
                  selectedWallsRef.current.add(entityId);
                  entity.colorize = [1.0, 0.0, 0.0, 1.0]; // Red
                  console.info("[XeokitViewer] ✓ Wall highlighted in red:", entityId);
                }
              }
              return;
            }
          }
        }
      }
    }
    
    console.info("[XeokitViewer] Clicked wall does not have matching Panel marker");
  };

  const toggleUGradient = async () => {
    if (!viewerRef.current) {
      console.warn("[XeokitViewer] toggleUGradient: viewer no disponible");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    if (!isModelReadyRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] toggleUGradient: model no està llest");
      alert(t("viewer.loadModelFirst"));
      return;
    }

    // Verify metadata is available
    const modelId = currentModelRef.current.id;
    const metaModel = viewerRef.current?.metaScene?.metaModels?.[modelId];
    if (!metaModel || Object.keys(metaModel).length === 0) {
      console.warn("[XeokitViewer] toggleUGradient: metadades no disponibles");
      alert(t("viewer.loadModelFirst"));
      return;
    }

    if (uGradientActive) {
      clearUGradient(viewerRef.current, null);
      setUGradientActive(false);
      setUGradientState({ active: false, minValue: 0, maxValue: 5 });
      console.info("[XeokitViewer] Gradient UUU desactivat");
    } else {
      console.info("[XeokitViewer] Activant gradient UUU...");
      const minValue = 0.0;
      const maxValue = 5.0;
      const types = ['wall'];
      const result = await applyUGradientToWalls(viewerRef.current, null, minValue, maxValue, types);
      setUGradientActive(true);
      setUGradientState({ 
        active: true, 
        modelId: currentModelRef.current?.id,
        minValue, 
        maxValue, 
        types 
      });
      console.info("[XeokitViewer] Gradient UUU activat:", result);
    }
  };

  // Measurements functions
  const openMeasurementsWalls = () => {
    if (!viewerRef.current || !isModelReadyRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] openMeasurementsWalls: model no està llest");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    // Verify metadata is available
    const modelId = currentModelRef.current.id;
    const metaModel = viewerRef.current?.metaScene?.metaModels?.[modelId];
    if (!metaModel || Object.keys(metaModel).length === 0) {
      console.warn("[XeokitViewer] openMeasurementsWalls: metadades no disponibles");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    console.info("[XeokitViewer] Obrint mesures de murs");
    try {
      showWallsMeasurements(viewerRef.current, exteriorTemperature);
    } catch (error) {
      console.error("[XeokitViewer] Error obrint mesures de murs:", error);
      alert("Error obrint mesures de murs");
    }
  };

  const openMeasurementsDoors = () => {
    if (!viewerRef.current || !isModelReadyRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] openMeasurementsDoors: model no està llest");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    // Verify metadata is available
    const modelId = currentModelRef.current.id;
    const metaModel = viewerRef.current?.metaScene?.metaModels?.[modelId];
    if (!metaModel || Object.keys(metaModel).length === 0) {
      console.warn("[XeokitViewer] openMeasurementsDoors: metadades no disponibles");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    console.info("[XeokitViewer] Obrint mesures de portes");
    try {
      showDoorsMeasurements(viewerRef.current, exteriorTemperature);
    } catch (error) {
      console.error("[XeokitViewer] Error obrint mesures de portes:", error);
      alert("Error obrint mesures de portes");
    }
  };

  const openMeasurementsWindows = () => {
    if (!viewerRef.current || !isModelReadyRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] openMeasurementsWindows: model no està llest");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    // Verify metadata is available
    const modelId = currentModelRef.current.id;
    const metaModel = viewerRef.current?.metaScene?.metaModels?.[modelId];
    if (!metaModel || Object.keys(metaModel).length === 0) {
      console.warn("[XeokitViewer] openMeasurementsWindows: metadades no disponibles");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    console.info("[XeokitViewer] Obrint mesures de finestres");
    try {
      showWindowsMeasurements(viewerRef.current, exteriorTemperature);
    } catch (error) {
      console.error("[XeokitViewer] Error obrint mesures de finestres:", error);
      alert("Error obrint mesures de finestres");
    }
  };

  const openMeasurementsFloor = () => {
    if (!viewerRef.current || !isModelReadyRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] openMeasurementsFloor: model no està llest");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    // Verify metadata is available
    const modelId = currentModelRef.current.id;
    const metaModel = viewerRef.current?.metaScene?.metaModels?.[modelId];
    if (!metaModel || Object.keys(metaModel).length === 0) {
      console.warn("[XeokitViewer] openMeasurementsFloor: metadades no disponibles");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    console.info("[XeokitViewer] Obrint mesures de sostres");
    try {
      showFloorMeasurements(viewerRef.current, exteriorTemperature);
    } catch (error) {
      console.error("[XeokitViewer] Error obrint mesures de sostres:", error);
      alert("Error obrint mesures de sostres");
    }
  };

  const openMeasurementsGlobal = () => {
    if (!viewerRef.current || !isModelReadyRef.current || !currentModelRef.current) {
      console.warn("[XeokitViewer] openMeasurementsGlobal: model no està llest");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    // Verify metadata is available
    const modelId = currentModelRef.current.id;
    const metaModel = viewerRef.current?.metaScene?.metaModels?.[modelId];
    if (!metaModel || Object.keys(metaModel).length === 0) {
      console.warn("[XeokitViewer] openMeasurementsGlobal: metadades no disponibles");
      alert(t("viewer.loadModelFirst"));
      return;
    }
    
    console.info("[XeokitViewer] Obrint mesures globals");
    try {
      showGlobalMeasurements(viewerRef.current, exteriorTemperature);
    } catch (error) {
      console.error("[XeokitViewer] Error obrint mesures globals:", error);
      alert("Error obrint mesures globals");
    }
  };

  const handleStoreyChange = (storeyId: string) => {
    setSelectedStorey(storeyId);
    if (floorPlanMode) {
      // Get elevation range for this storey
      const { minElevation, maxElevation, sectionHeight: newSectionHeight } = getStoreyElevationRange(storeyId);
      
      // Update section plane
      handleSectionHeightChange(newSectionHeight);
      
      // Center camera on storey
      createSectionPlaneAtStorey(storeyId);
      
      // Paint sectioned elements black and hide elements outside the range
      paintSectionedElementsBlack(newSectionHeight, minElevation, maxElevation);
    }
  };

  // Load existing annotations from database
  const loadAnnotations = async () => {
    // Support both project and center contexts
    const targetId = projectId || centerId;
    if (!targetId || !annotationsRef.current) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query by project_id if projectId exists, otherwise by center_id
      let query = supabase.from('annotations').select('*');
      if (projectId) {
        query = query.eq('project_id', projectId);
      } else if (centerId) {
        query = query.eq('center_id', centerId).eq('user_id', user.id);
      }

      const { data: annotations, error } = await query;

      if (error) throw error;

      if (annotations) {
        // Clear existing annotations that are not in the database
        const currentAnnotations = annotationsRef.current.annotations;
        const dbAnnotationIds = new Set(annotations.map(a => a.annotation_id));
        
        Object.keys(currentAnnotations).forEach(id => {
          if (!dbAnnotationIds.has(id)) {
            annotationsRef.current?.destroyAnnotation(id);
          }
        });

        // Create or update annotations from database
        annotations.forEach((annotation, index) => {
          // Get primary image URL based on primary_image_index
          const primaryImageUrl = annotation.primary_image_index === 1 ? annotation.image_url :
                                 annotation.primary_image_index === 2 ? annotation.image_url_2 :
                                 annotation.primary_image_index === 3 ? annotation.image_url_3 :
                                 annotation.image_url;
          
          const annotationType = (annotation.annotation_type || 'info') as AnnotationType;
          const typeConfig = getAnnotationTypeConfig(annotationType);
          
          // If annotation already exists, destroy it first to update it
          if (loadedAnnotations.has(annotation.annotation_id)) {
            annotationsRef.current?.destroyAnnotation(annotation.annotation_id);
            setLoadedAnnotations(prev => {
              const newSet = new Set(prev);
              newSet.delete(annotation.annotation_id);
              return newSet;
            });
          }
          
          annotationsRef.current?.createAnnotation({
            id: annotation.annotation_id,
            worldPos: annotation.world_pos as [number, number, number],
            occludable: true,
            markerShown: true,
            labelShown: false,
            values: {
              markerBGColor: typeConfig.bgColor.replace('bg-', ''),
              glyph: typeConfig.type === 'info' ? 'ℹ' : 
                     typeConfig.type === 'alert' ? '⚠' : 
                     typeConfig.type === 'task' ? '✓' : '🔍',
              title: annotation.title,
              description: annotation.description || "Sense descripció"
            }
          });
          setLoadedAnnotations(prev => new Set([...prev, annotation.annotation_id]));
        });

        annotationCounter.current = annotations.length + 1;
        console.log(`[XeokitViewer] Carregades ${annotations.length} anotacions`);
      }
    } catch (error) {
      console.error('[XeokitViewer] Error loading annotations:', error);
    }
  };

  // Load annotations and ensure they are shown
  const loadAnnotationsAndShow = async () => {
    // Support both project and center contexts
    const targetId = projectId || centerId;
    if (!targetId || !annotationsRef.current) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query by project_id if projectId exists, otherwise by center_id
      let query = supabase.from('annotations').select('*');
      if (projectId) {
        query = query.eq('project_id', projectId);
      } else if (centerId) {
        query = query.eq('center_id', centerId).eq('user_id', user.id);
      }

      const { data: annotations, error } = await query;

      if (error) throw error;

      if (annotations && annotations.length > 0) {
        // Clear existing annotations that are not in the database
        const currentAnnotations = annotationsRef.current.annotations;
        const dbAnnotationIds = new Set(annotations.map(a => a.annotation_id));
        
        Object.keys(currentAnnotations).forEach(id => {
          if (!dbAnnotationIds.has(id)) {
            annotationsRef.current?.destroyAnnotation(id);
          }
        });

        // Icon glyphs for annotation types
        const iconGlyphs: Record<string, string> = {
          'info': 'ℹ',
          'alert': '⚠',
          'task': '✓',
          'review': '🔍'
        };
        
        // Color map for annotation types
        const colorMap: Record<string, string> = {
          'info': '#3b82f6',
          'alert': '#f59e0b',
          'task': '#22c55e',
          'review': '#a855f7'
        };

        // Create annotations from database with markers shown
        annotations.forEach((annotation, index) => {
          const existingAnnotation = annotationsRef.current?.annotations[annotation.annotation_id];
          
          if (existingAnnotation) {
            // Annotation already exists, just show marker
            existingAnnotation.setMarkerShown(true);
            existingAnnotation.setLabelShown(false);
          } else {
            // Get primary image URL based on primary_image_index
            const primaryImageUrl = annotation.primary_image_index === 1 ? annotation.image_url :
                                   annotation.primary_image_index === 2 ? annotation.image_url_2 :
                                   annotation.primary_image_index === 3 ? annotation.image_url_3 :
                                   annotation.image_url;
            
            // Get type-specific styling
            const annotationType = (annotation as any).annotation_type || 'info';
            const bgColor = colorMap[annotationType] || '#3b82f6';
            const glyph = iconGlyphs[annotationType] || `${index + 1}`;
            
            annotationsRef.current?.createAnnotation({
              id: annotation.annotation_id,
              worldPos: annotation.world_pos as [number, number, number],
              occludable: true,
              markerShown: true,
              labelShown: false,
              values: {
                markerBGColor: bgColor,
                glyph: glyph,
                title: annotation.title,
                description: annotation.description || "Sense descripció"
              }
            });
            setLoadedAnnotations(prev => new Set([...prev, annotation.annotation_id]));
          }
        });

        annotationCounter.current = annotations.length + 1;
        console.log(`[XeokitViewer] Mostrades ${annotations.length} anotacions`);
      } else {
        console.log('[XeokitViewer] No hi ha anotacions per mostrar');
      }
    } catch (error) {
      console.error('[XeokitViewer] Error loading annotations:', error);
    }
  };

  const toggleAnnotationsMode = async () => {
    const newMode = !annotationsMode;
    setAnnotationsMode(newMode);
    annotationsModeRef.current = newMode; // Update ref
    
    if (newMode) {
      // Load existing annotations when activating
      await loadAnnotations();
      toast.success("Mode d'anotacions activat. Feu clic al model per crear una anotació.");
    } else {
      // Hide all annotations when deactivating
      if (annotationsRef.current) {
        const annotations = annotationsRef.current.annotations;
        Object.keys(annotations).forEach(id => {
          const annotation = annotations[id];
          if (annotation) {
            annotation.setMarkerShown(false);
            annotation.setLabelShown(false);
          }
        });
      }
      toast.info("Mode d'anotacions desactivat.");
    }
  };

  // Show annotations when mode is active
  useEffect(() => {
    if (annotationsRef.current && annotationsMode) {
      const annotations = annotationsRef.current.annotations;
      Object.keys(annotations).forEach(id => {
        const annotation = annotations[id];
        if (annotation) {
          annotation.setMarkerShown(true);
          annotation.setLabelShown(false); // Ensure labels are hidden by default
        }
      });
    }
  }, [annotationsMode]);

  // Keep labels hidden when annotation modal opens/closes
  useEffect(() => {
    if (annotationsRef.current && annotationsMode) {
      const annotations = annotationsRef.current.annotations;
      Object.keys(annotations).forEach(id => {
        const annotation = annotations[id];
        if (annotation) {
          // Always keep labels hidden
          annotation.setLabelShown(false);
        }
      });
    }
  }, [showAnnotationModal, annotationsMode]);

  const handleSaveAnnotation = async (data: { 
    title: string; 
    description: string;
    annotationType: AnnotationType;
    imageUrl?: string;
    imageUrl2?: string;
    imageUrl3?: string;
    primaryImageIndex: number;
  }) => {
    // Support both project and center contexts
    const targetId = projectId || centerId;
    if (!pendingAnnotation || !targetId || !ifcUrl) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Has d'iniciar sessió per crear anotacions");
        return;
      }

      // Get primary image URL
      const primaryImageUrl = data.primaryImageIndex === 1 ? data.imageUrl : 
                             data.primaryImageIndex === 2 ? data.imageUrl2 : 
                             data.imageUrl3;

      // Get type config for color
      const typeConfig = getAnnotationTypeConfig(data.annotationType);
      const markerColor = typeConfig.bgColor.replace('bg-', '');
      const colorMap: Record<string, string> = {
        'blue-500': '#3b82f6',
        'amber-500': '#f59e0b',
        'green-500': '#22c55e',
        'purple-500': '#a855f7'
      };
      const bgColor = colorMap[markerColor] || '#3b82f6';

      // Create annotation in database
      const insertData: any = {
        user_id: user.id,
        model_id: ifcUrl,
        annotation_id: `annotation-${annotationCounter.current}`,
        title: data.title,
        description: data.description,
        annotation_type: data.annotationType,
        image_url: data.imageUrl,
        image_url_2: data.imageUrl2,
        image_url_3: data.imageUrl3,
        primary_image_index: data.primaryImageIndex,
        world_pos: pendingAnnotation.worldPos,
        entity_id: pendingAnnotation.entityId
      };

      // Set the appropriate ID field
      if (projectId) {
        insertData.project_id = projectId;
        insertData.center_id = projectId; // Keep center_id for backwards compatibility
      } else if (centerId) {
        insertData.center_id = centerId;
      }

      const { error } = await supabase
        .from('annotations')
        .insert(insertData);

      if (error) throw error;

      // Get icon glyph based on type
      const iconGlyphs: Record<AnnotationType, string> = {
        'info': 'ℹ',
        'alert': '⚠',
        'task': '✓',
        'review': '🔍'
      };

      // Create visual annotation in viewer
      if (annotationsRef.current) {
        const annotationId = `annotation-${annotationCounter.current}`;
        annotationsRef.current.createAnnotation({
          id: annotationId,
          worldPos: pendingAnnotation.worldPos,
          occludable: true,
          markerShown: true,
          labelShown: false,
          values: {
            glyph: iconGlyphs[data.annotationType] || `${annotationCounter.current}`,
            title: data.title,
            description: data.description || "Sense descripció",
            markerBGColor: bgColor
          }
        });

        annotationCounter.current++;
        setLoadedAnnotations(prev => new Set([...prev, annotationId]));
      }

      setPendingAnnotation(null);
      toast.success("Anotació creada correctament");
    } catch (error) {
      console.error("Error creating annotation:", error);
      toast.error("Error al crear l'anotació");
    }
  };

  return (
    <div className="relative w-full h-full bg-muted/50">
      {/* Canvas container - only show when model is ready or when we have an IFC to load */}
      <div 
        ref={containerRef} 
        className={`w-full h-full transition-opacity duration-500 ${
          modelReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <canvas
          id="xeokit-canvas"
          className="w-full h-full"
        />
        <canvas
          id="navCubeCanvas"
          className="absolute bottom-4 right-4"
          style={{ width: "250px", height: "250px" }}
        />
      </div>

      {/* Left side controls - organized horizontally */}
      <div className="absolute top-4 left-4 z-10 flex flex-row gap-2">
        {showViewTree && <ModelTreeView viewer={viewerRef.current} currentModel={currentModelRef.current} />}
        {/* RoomsNavigator només es mostra en context de centres (centerId sense projectId) */}
        {!projectId && centerId && (
          <RoomsNavigator rooms={extractedRooms} onRoomClick={handleRoomNavigatorClick} city={city} country={country} />
        )}
        
        {ifcUrl && (projectId || centerId) && showAnnotations && (
          <>
            <Button
              onClick={toggleAnnotationsMode}
              variant={annotationsMode ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <MessageSquarePlus className="h-4 w-4" />
              {annotationsMode ? "Anotacions ON" : "Anotacions"}
            </Button>
            
            <Button
              onClick={() => setShowAnnotationsListModal(true)}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Anotacions
            </Button>

            <Button
              onClick={() => setShowRequestsListModal(true)}
              variant="default"
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <FileText className="h-4 w-4" />
              Peticions
            </Button>

            <Button
              onClick={() => setShowOffersListModal(true)}
              variant="default"
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="h-4 w-4" />
              Ofertes
            </Button>
          </>
        )}
      </div>
      
      {/* Floor Plan Controls */}
      {ifcUrl && showToggle3D && (
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              onClick={toggleFloorPlanMode}
              variant={floorPlanMode ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <Building2 className="h-4 w-4" />
              {floorPlanMode ? "Vista 3D" : "Mostrar Planta"}
            </Button>
          </div>

          {showMeasurements && (
            <div className="flex gap-2 flex-wrap max-w-[420px]">
              <Button
              onClick={toggleUGradient}
              variant={uGradientActive ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <Palette className="h-4 w-4" />
              {uGradientActive ? t("viewer.hideTransmittance") : t("viewer.showTransmittance")}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={openMeasurementsGlobal}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {t("viewer.global")}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={openMeasurementsWalls}
              className="gap-2"
            >
              <Cuboid className="h-4 w-4" />
              {t("viewer.walls")}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={openMeasurementsFloor}
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              {t("viewer.floors")}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={openMeasurementsDoors}
              className="gap-2"
            >
              <DoorOpen className="h-4 w-4" />
              {t("viewer.doors")}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={openMeasurementsWindows}
              className="gap-2"
            >
              <SquareDashed className="h-4 w-4" />
                {t("viewer.windows")}
              </Button>
            </div>
          )}
          
          {floorPlanMode && storeys.length > 0 && (
            <Select value={selectedStorey} onValueChange={handleStoreyChange}>
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="Selecciona una planta" />
              </SelectTrigger>
              <SelectContent>
                {storeys.map((storey) => (
                  <SelectItem key={storey.id} value={storey.id}>
                    {storey.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      
      {/* Budget legend - only shown when accepted-budget mode is active */}
      {modelReady && showSliders && editedElementsMode === "accepted-budget" && (
        <div className="absolute bottom-[140px] left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg z-10">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground mb-2">Llegenda</h4>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(153, 242, 179)' }} />
              <span className="text-xs text-foreground">Elements amb pressupost acceptat</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(255, 204, 128)' }} />
              <span className="text-xs text-foreground">Elements amb pressupost pendent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(180, 180, 180)' }} />
              <span className="text-xs text-foreground">Elements sense pressupost demanat</span>
            </div>
          </div>
        </div>
      )}

      {/* Section height slider - always shown when model is ready */}
      {modelReady && showSliders && showSectionSlider !== false && (
        <SectionHeightSlider
          value={sectionHeight}
          onChange={handleSectionHeightChange}
          min={sliderMin}
          max={sliderMax}
          step={0.05}
        />
      )}

      {/* Hovered entity info - positioned after sliders */}
      {hoveredEntity && (
        <div className="absolute top-4 left-[220px] bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg min-w-[300px]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">
              {t("viewer.hoveredEntity")}: <span className="font-mono text-primary">{hoveredEntity}</span>
            </p>
            {hoveredMarca && (
              <p className="text-xs font-medium text-foreground">
                Marca: <span className="font-mono text-accent">{hoveredMarca}</span>
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Loading overlay - shown when loading OR when we have a URL but model isn't ready yet */}
      {(loading || (ifcUrl && !modelReady && !error)) && (
        <ModelLoadingOverlay
          projectName={projectName}
          loadingText={loadingText}
          loadingProgress={loadingProgress}
          fileSize={fileSize}
          loadedSize={loadedSize}
        />
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>{error}</p>
                <details className="text-xs mt-2">
                  <summary className="cursor-pointer">Informació tècnica</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
                </details>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {/* Empty state removed - no message needed when no model is loaded */}
      
      {/* Annotation Modal */}
      <AnnotationModal
        open={showAnnotationModal}
        onClose={() => {
          setShowAnnotationModal(false);
          setPendingAnnotation(null);
        }}
        onSave={handleSaveAnnotation}
        worldPos={pendingAnnotation?.worldPos || [0, 0, 0]}
        entityId={pendingAnnotation?.entityId}
      />

      {/* Annotation Detail Modal */}
      {selectedAnnotationData && (
        <AnnotationDetailModal
          open={showAnnotationDetailModal}
          onClose={() => {
            setShowAnnotationDetailModal(false);
            setSelectedAnnotationData(null);
          }}
          annotation={selectedAnnotationData}
          onUpdate={() => {
            setShowAnnotationDetailModal(false);
            setSelectedAnnotationData(null);
            // Reload annotations
            if (annotationsMode && centerId && ifcUrl) {
              loadAnnotations();
            }
          }}
          onDelete={() => {
            // Destroy the annotation marker from viewer
            if (selectedAnnotationData?.annotation_id && annotationsRef.current) {
              annotationsRef.current.destroyAnnotation(selectedAnnotationData.annotation_id);
              setLoadedAnnotations(prev => {
                const newSet = new Set(prev);
                newSet.delete(selectedAnnotationData.annotation_id);
                return newSet;
              });
            }
            setShowAnnotationDetailModal(false);
            setSelectedAnnotationData(null);
            // Reload annotations to sync state
            if (annotationsMode && centerId && ifcUrl) {
              loadAnnotations();
            }
          }}
        />
      )}

      {/* Annotations List Modal */}
      {centerId && (
        <AnnotationsListModal
          open={showAnnotationsListModal}
          onClose={() => setShowAnnotationsListModal(false)}
          centerId={centerId}
          showOnlyRequests={false}
        />
      )}

      {/* Requests List Modal */}
      {centerId && (
        <AnnotationsListModal
          open={showRequestsListModal}
          onClose={() => setShowRequestsListModal(false)}
          centerId={centerId}
          showOnlyRequests={true}
        />
      )}

      {/* Offers List Modal */}
      {centerId && (
        <OffersListModal
          open={showOffersListModal}
          onClose={() => setShowOffersListModal(false)}
          centerId={centerId}
        />
      )}

      {/* Context menu */}
      {contextMenu?.visible && (
        <ViewerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          visible={contextMenu.visible}
          onClose={() => setContextMenu(null)}
          isEditDisabled={isProjectShared}
          onAddNote={() => {
            if (contextMenu && contextMenu.worldPos) {
              // Open annotation modal with the position from context menu
              setPendingAnnotation({
                worldPos: contextMenu.worldPos,
                entityId: contextMenu.entityId
              });
              setShowAnnotationModal(true);
              setContextMenu(null);
            } else if (contextMenu && onContextMenuAddNote && viewerRef.current) {
              // Fallback to old behavior if no worldPos
              const camera = viewerRef.current.camera;
              onContextMenuAddNote({
                entityId: contextMenu.entityId,
                entityType: contextMenu.entityType,
                camera: {
                  eye: camera.eye,
                  look: camera.look,
                  up: camera.up
                }
              });
            }
          }}
          onEditDescription={() => {
            if (contextMenu && viewerRef.current && pickedEntityRef.current) {
              // Get the metaObject for this entity
              const metaObject = viewerRef.current.metaScene.metaObjects[contextMenu.entityId];
              if (metaObject) {
                const ifcCategory = metaObject.type || "Unknown";
                
                // Get the nice type name
                const getNiceTypeName = (mo: any): string => {
                  if (!mo) return "Desconegut";
                  const BAD = new Set(["ifcproduct", "ifcelement", "ifcbuildingelement"]);
                  const base = String(mo?.type || "").toLowerCase();
                  if (base && !BAD.has(base) && !base.startsWith("ifc")) return mo.type;
                  
                  const candidates: Array<{ s: string; score: number }> = [];
                  const add = (raw: any, score = 1) => {
                    const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
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
                        const nk = (prop?.name ?? prop?.Name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-\.]/g, "");
                        if (nk.includes("type") || nk === "reference" || nk === "typename" || nk === "familyandtype" || nk === "familytype") {
                          add(prop?.value ?? prop?.Value ?? prop, 6);
                        }
                      }
                    }
                  }
                  
                  const nameMaybe = typeof p.Name === "string" ? p.Name.trim() : "";
                  if (nameMaybe && !nameMaybe.toLowerCase().startsWith("ifc")) add(nameMaybe, 5);
                  
                  if (candidates.length) {
                    candidates.sort((a, b) => (b.score - a.score) || (b.s.length - a.s.length));
                    return candidates[0].s;
                  }
                  return mo.type || "Desconegut";
                };
                
                // Get the nice type name (without ifcCategory prefix)
                const typeName = getNiceTypeName(metaObject);
                
                console.log("[XeokitViewer] Opening EditTypeSheet for:", { ifcCategory, typeName });
                setEditTypeSheetData({ ifcCategory, typeName });
                setShowEditTypeSheet(true);
              }
            }
          }}
          onIsolateElement={() => {
            if (pickedEntityRef.current && viewerRef.current) {
              const scene = viewerRef.current.scene;
              Object.values(scene.objects).forEach((obj: any) => {
                obj.visible = obj.id === pickedEntityRef.current.id;
              });
            }
          }}
          onHideElement={() => {
            if (pickedEntityRef.current) {
              pickedEntityRef.current.visible = false;
            }
          }}
          onShowAll={() => {
            if (viewerRef.current) {
              const scene = viewerRef.current.scene;
              Object.values(scene.objects).forEach((obj: any) => {
                obj.visible = true;
              });
            }
          }}
          annotationsVisible={annotationsVisible}
          onToggleAnnotations={async () => {
            const newVisible = !annotationsVisible;
            setAnnotationsVisible(newVisible);
            localStorage.setItem("viewer-annotations-visible", String(newVisible));
            
            if (newVisible && centerId && annotationsRef.current) {
              await loadAnnotationsAndShow();
              toast.success("Notes mostrades al visor");
            } else if (!newVisible && annotationsRef.current) {
              const annotations = annotationsRef.current.annotations;
              Object.keys(annotations).forEach(id => {
                const annotation = annotations[id];
                if (annotation) {
                  annotation.setMarkerShown(false);
                  annotation.setLabelShown(false);
                }
              });
              toast.info("Notes ocultades");
            }
          }}
          distanceMeasurementsActive={distanceMeasurementsActive}
          distanceMeasurementsVisible={distanceMeasurementsVisible}
          onToggleDistanceMeasurements={() => {
            const newActive = !distanceMeasurementsActive;
            setDistanceMeasurementsActive(newActive);
            if (distanceMeasurementsControlRef.current) {
              if (newActive) {
                distanceMeasurementsControlRef.current.activate();
                toast.success("Mode acotació activat - Fes clic per acotar (RR per esborrar l'última)");
              } else {
                distanceMeasurementsControlRef.current.deactivate();
                // Esborrar totes les cotes quan es desactiva
                if (distanceMeasurementsRef.current) {
                  distanceMeasurementsRef.current.clear();
                }
                toast.info("Mode acotació desactivat - Acotacions eliminades");
              }
            }
          }}
          onClearDistanceMeasurements={() => {
            if (distanceMeasurementsRef.current) {
              distanceMeasurementsRef.current.clear();
              toast.info("Acotacions eliminades");
            }
          }}
          elementInfoEnabled={elementInfoEnabled}
          onToggleElementInfo={() => {
            const newEnabled = !elementInfoEnabled;
            setElementInfoEnabled(newEnabled);
            localStorage.setItem("viewer-element-info-enabled", String(newEnabled));
            if (newEnabled) {
              toast.success("Info d'element activada");
            } else {
              toast.info("Info d'element desactivada");
            }
          }}
        />
      )}
      
      {/* Edit Type Sheet from context menu */}
      {showEditTypeSheet && editTypeSheetData && (
        <EditTypeSheet
          open={showEditTypeSheet}
          onOpenChange={setShowEditTypeSheet}
          centerId={centerId}
          projectId={projectId}
          versionId={versionId}
          ifcCategory={editTypeSheetData.ifcCategory}
          typeName={editTypeSheetData.typeName}
          onSave={() => {
            // Dispatch event to refresh measurements if needed
            window.dispatchEvent(new CustomEvent("element-config-updated"));
            
            // If currently in highlight mode, re-apply to update visual colors immediately
            if (editedElementsMode !== "normal") {
              setTimeout(() => {
                applyEditedElementsMode(editedElementsMode);
              }, 100);
            }
            
            // Clear cache so next click fetches updated data
            editedConfigsCacheRef.current.clear();
          }}
          viewer={viewerRef.current}
        />
      )}
      
      {/* Quantification Tooltip for edited elements */}
      <QuantificationTooltip
        data={quantificationTooltip.data}
        position={quantificationTooltip.position}
        onClose={() => setQuantificationTooltip({ data: null, position: null })}
      />

      {/* Space Properties Modal - shown when clicking on IfcSpace in "only spaces" mode */}
      <SpacePropertiesModal
        open={showSpacePropertiesModal}
        onClose={() => {
          setShowSpacePropertiesModal(false);
          setSelectedSpaceMetaObject(null);
          setSelectedSpaceEntityId("");
        }}
        metaObject={selectedSpaceMetaObject}
        entityId={selectedSpaceEntityId}
        projectId={projectId}
        metaModel={(() => {
          const viewer = (window as any).xeokitViewer;
          const metaModels = viewer?.metaScene?.metaModels;
          const modelIds = Object.keys(metaModels || {});
          return modelIds.length > 0 ? (metaModels as any)[modelIds[0]] : null;
        })()}
      />
      <FloorPlanElementModal
        open={showFloorPlanElementModal}
        onOpenChange={(open) => {
          setShowFloorPlanElementModal(open);
          if (!open) setFloorPlanElementData(null);
        }}
        elementData={floorPlanElementData}
        isEditDisabled={isProjectShared}
        onEditElement={() => {
          if (floorPlanElementData) {
            const ifcCategory = floorPlanElementData.ifcType || "Unknown";
            const typeName = floorPlanElementData.name || "Desconegut";
            console.log("[XeokitViewer] Opening EditTypeSheet from FloorPlanElementModal:", { ifcCategory, typeName });
            setEditTypeSheetData({ ifcCategory, typeName });
            setShowEditTypeSheet(true);
          }
        }}
      />

      {/* Element Info Modal - shown when clicking on any element */}
      <ElementInfoModal
        open={showElementInfoModal}
        onOpenChange={(open) => {
          setShowElementInfoModal(open);
          if (!open) setElementInfoData(null);
        }}
        elementData={elementInfoData}
        isEditDisabled={isProjectShared}
        onEditElement={() => {
          if (elementInfoData) {
            const ifcCategory = elementInfoData.ifcType || "Unknown";
            const typeName = elementInfoData.name || "Desconegut";
            console.log("[XeokitViewer] Opening EditTypeSheet from ElementInfoModal:", { ifcCategory, typeName });
            setEditTypeSheetData({ ifcCategory, typeName });
            setShowEditTypeSheet(true);
          }
        }}
      />

      {/* No Spaces Modal removed - no longer showing this message */}

      {/* Chapter Filter Modal - shown when chapter filter feature is used (Estructura, Envolvent, Interiors) */}
      {showChapterFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 relative">
            <button
              onClick={() => {
                setShowChapterFilterModal(false);
                if (chapterFilterType === "success") {
                  restoreFromChapterFilterMode();
                }
              }}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Tancar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="p-6">
              {chapterFilterType === "no-elements" ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                      <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{chapterFilterInfo.name} no definida</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    No s'ha trobat cap element assignat a {chapterFilterInfo.name.toLowerCase()}.
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Per resoldre-ho, cal editar els elements del model i assignar-los al capítol{" "}
                    <strong className="text-foreground">{chapterFilterInfo.code} - {chapterFilterInfo.name}</strong>.
                  </p>
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => setShowChapterFilterModal(false)}
                      variant="outline"
                      className="px-6"
                    >
                      Entesos
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="p-2 rounded-full"
                      style={{ backgroundColor: `rgba(${Math.round(chapterFilterInfo.color[0] * 255)}, ${Math.round(chapterFilterInfo.color[1] * 255)}, ${Math.round(chapterFilterInfo.color[2] * 255)}, 0.2)` }}
                    >
                      <Building2 
                        className="h-6 w-6" 
                        style={{ color: `rgb(${Math.round(chapterFilterInfo.color[0] * 255)}, ${Math.round(chapterFilterInfo.color[1] * 255)}, ${Math.round(chapterFilterInfo.color[2] * 255)})` }}
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{chapterFilterInfo.name} (capítol {chapterFilterInfo.code})</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    S'han destacat <strong className="text-foreground">{chapterFilterElementCount} elements</strong> assignats a {chapterFilterInfo.name.toLowerCase()} (capítol {chapterFilterInfo.code}).
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button 
                      onClick={() => {
                        setShowChapterFilterModal(false);
                        restoreFromChapterFilterMode();
                      }}
                      variant="outline"
                      className="px-6"
                    >
                      Restaurar vista
                    </Button>
                    <Button 
                      onClick={() => setShowChapterFilterModal(false)}
                      className="px-6"
                    >
                      Mantenir vista
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

XeokitViewer.displayName = "XeokitViewer";

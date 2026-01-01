import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  GripVertical, 
  FileDown, 
  User, 
  MapPin, 
  Hammer, 
  Calculator, 
  Euro, 
  Loader2,
  Check,
  AlertCircle,
  X,
  Users,
  Building2,
  FileStack,
  Database,
  Settings,
  LayoutGrid,
  FileText,
  Scale
} from "lucide-react";
import { useBudgetChapterTranslations } from "@/hooks/useBudgetChapterTranslations";
import { useUISettings } from "@/hooks/useUISettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { BUDGET_CHAPTERS } from "@/data/budgetChapters";
import { PDFCoverConfigModal, CoverConfig } from "./PDFCoverConfigModal";
import { DocumentationProgressModal, LoadingStep } from "./DocumentationProgressModal";
import { getSpecificationsStructure } from "@/data/specificationsTranslations";
import { generateProjectPDF } from "@/lib/pdfGenerator";
import { captureEmplacamentMap, captureSituacioMap, utmToLatLon } from "@/lib/mapCapture";
import { toast } from "sonner";

// Types for loaded data
interface OwnerData {
  ownerType: "individual" | "couple" | "company" | null;
  formData: Record<string, string>;
  hasData: boolean;
}

interface LocationData {
  cadastralReference: string | null;
  street: string | null;
  streetNumber: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  utmX: number | null;
  utmY: number | null;
  utmZone: string | null;
  hasData: boolean;
}

interface WorksData {
  currentState: string | null;
  worksDescription: string | null;
  actionZone: string | null;
  hasData: boolean;
}

// GraphicFile interface removed - documentació gràfica ara es gestiona via annexos

interface MeasurementItem {
  id: string;
  fullCode: string;
  typeName: string;
  customName: string | null;
  description: string | null;
  measuredValue: number | null;
  preferredUnit: string;
  isManual: boolean;
  elementCount: number | null;
}

interface MeasurementChapter {
  code: string;
  name: string;
  subchapters: MeasurementSubchapter[];
}

interface MeasurementSubchapter {
  code: string;
  name: string;
  subsubchapters: MeasurementSubsubchapter[];
}

interface MeasurementSubsubchapter {
  code: string;
  name: string;
  items: MeasurementItem[];
}

interface BudgetLine {
  zonaPlanta: string;
  superficie: number;
  modulBasic: number;
  cg: number;
  ct: number;
  cq: number;
  cu: number;
  pressupost: number;
}

interface PercentageBudgetLine {
  chapterCode: string;
  chapterName: string;
  percentage: number;
  pressupost: number;
}

interface BudgetData {
  budgetType: "justified" | "unjustified" | "percentage" | null;
  pemJustified: number | null;
  pemUnjustified: number | null;
  budgetLines: BudgetLine[];
  percentageLines: PercentageBudgetLine[];
  superficieTotal: number;
  builtAreaTotal: number;
  euroPerM2: number;
  pr: number;
  coeficientPPr: number;
  pem: number;
  hasData: boolean;
}

// Surface Areas interfaces
interface UsefulAreaItem {
  id: string;
  level: string;
  name: string;
  reference: string;
  area: number;
}

interface BuiltAreaItem {
  id: string;
  level: string;
  name: string;
  computation: number;
  area: number;
}

interface SurfaceAreasData {
  usefulAreas: UsefulAreaItem[];
  builtAreas: BuiltAreaItem[];
  levelCustomNames: { ifcLevel: string; customName: string }[];
  totalUsefulArea: number;
  totalBuiltArea: number;
  totalComputedArea: number;
  hasData: boolean;
}

interface AnnexSection {
  id: string;
  name: string;
  isDocumentSection: boolean;
  files: { id: string; fileName: string; fileUrl: string }[];
}

interface SpecificationsSection {
  id: string;
  title: string;
  content: string;
}

interface SpecificationsChapter {
  id: string;
  code: string;
  title: string;
  sections: SpecificationsSection[];
}

interface SpecificationsData {
  chapters: SpecificationsChapter[];
  hasData: boolean;
}

interface NormativaData {
  cadastralReference: string | null;
  street: string | null;
  city: string | null;
  province: string | null;
  autonomousCommunity: string | null;
  classificacio?: {
    codi: string;
    descripcio: string;
    tipus: string;
  };
  qualificacio?: {
    codi: string;
    clau: string;
    descripcio: string;
    zona: string;
  };
  sector?: {
    nom: string;
    tipus: string;
  };
  hasData: boolean;
}

interface DocumentSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  data?: any;
  hasData: boolean;
  summary: string;
  isAnnexSection?: boolean;
  annexSectionId?: string;
}

interface SortableItemProps {
  section: DocumentSection;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
}

const SortableItem = ({ section, isSelected, onToggleSelection }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelection(section.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-card border rounded-lg select-none transition-all ${
        isDragging 
          ? "opacity-50 shadow-lg ring-2 ring-[#6b7c4c] border-[#6b7c4c]" 
          : !isSelected
            ? "border-muted/50 bg-muted/20 opacity-60"
            : section.hasData 
              ? "border-[#6b7c4c]/30 hover:border-[#6b7c4c]/60 hover:bg-[#6b7c4c]/5" 
              : "border-amber-300/50 hover:border-amber-400 bg-amber-50/30"
      }`}
    >
      <div 
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div onClick={handleCheckboxClick} className="cursor-pointer flex-shrink-0">
        <Checkbox 
          checked={isSelected} 
          className="h-4 w-4 data-[state=checked]:bg-[#6b7c4c] data-[state=checked]:border-[#6b7c4c]"
        />
      </div>
      <div className={`p-1.5 rounded-md flex-shrink-0 ${section.hasData ? "bg-[#6b7c4c]/10" : "bg-amber-100"}`}>
        <div className={`${section.hasData ? "text-[#6b7c4c]" : "text-amber-600"} [&>svg]:w-4 [&>svg]:h-4`}>
          {section.icon}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={`font-medium text-sm ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
          {section.label}
        </span>
        <span className={`text-xs truncate ${section.hasData ? "text-muted-foreground" : "text-amber-600"}`}>
          — {section.summary}
        </span>
      </div>
      {section.hasData ? (
        <Check className="w-4 h-4 text-[#6b7c4c] flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      )}
    </div>
  );
};

interface GenerateDocumentationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  documentationId?: string;
  documentationName?: string;
}

export const GenerateDocumentationModal = ({
  open,
  onOpenChange,
  projectId,
  documentationId,
  documentationName,
}: GenerateDocumentationModalProps) => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<DocumentSection[]>([]);
  const [baseSections, setBaseSections] = useState<DocumentSection[]>([]); // Store base sections without ordering
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [showCoverConfig, setShowCoverConfig] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const { getTranslatedName } = useBudgetChapterTranslations();
  const { settings: uiSettings } = useUISettings();
  const { language } = useLanguage();
  
  // Documentation type selection
  const [projectDocumentations, setProjectDocumentations] = useState<{
    id: string;
    project_type_id: string;
    display_order: number;
    project_type?: { id: string; name_ca: string; name_es: string };
  }[]>([]);
  const [selectedDocumentationType, setSelectedDocumentationType] = useState<string>(documentationId || "");
  
  // Loading progress states
  const [showProgress, setShowProgress] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([]);
  const [currentLoadingStep, setCurrentLoadingStep] = useState<string | null>(null);

  // Get chapter names
  const getChapterName = (code: string): string => {
    const chapter = BUDGET_CHAPTERS.find(c => c.code === code);
    return chapter?.name || `Capítol ${code}`;
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved order and selections from database (per documentation type)
  const loadSavedOrderAndSelections = async (loadedSections: DocumentSection[], docTypeId?: string) => {
    try {
      let query = supabase
        .from("project_documentation_order")
        .select("section_order, selected_sections")
        .eq("project_id", projectId);
      
      // Filter by documentation type if provided
      if (docTypeId) {
        query = query.eq("documentation_type_id", docTypeId);
      } else {
        query = query.is("documentation_type_id", null);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      let orderedSections = loadedSections;
      
      if (data?.section_order && data.section_order.length > 0) {
        // Reorder sections based on saved order
        const reorderedSections: DocumentSection[] = [];
        const sectionMap = new Map(loadedSections.map(s => [s.id, s]));
        
        // Add sections in saved order
        for (const id of data.section_order) {
          const section = sectionMap.get(id);
          if (section) {
            reorderedSections.push(section);
            sectionMap.delete(id);
          }
        }
        
        // Add any new sections that weren't in the saved order
        for (const section of sectionMap.values()) {
          reorderedSections.push(section);
        }
        
        orderedSections = reorderedSections;
      }
      
      // Load saved selections or default to all sections with data
      if (data?.selected_sections && Array.isArray(data.selected_sections)) {
        setSelectedSections(new Set(data.selected_sections as string[]));
      } else {
        // Default: select all sections that have data
        const defaultSelected = new Set(loadedSections.filter(s => s.hasData).map(s => s.id));
        setSelectedSections(defaultSelected);
      }
      
      return orderedSections;
    } catch (error) {
      console.error("Error loading saved order and selections:", error);
      // Default: select all sections that have data
      const defaultSelected = new Set(loadedSections.filter(s => s.hasData).map(s => s.id));
      setSelectedSections(defaultSelected);
      return loadedSections;
    }
  };

  // Save order and selections to database (per documentation type)
  const saveOrderAndSelections = async (orderedSections: DocumentSection[], selected: Set<string>, docTypeId?: string) => {
    try {
      const sectionOrder = orderedSections.map(s => s.id);
      const selectedArray = Array.from(selected);
      
      // Use upsert with proper handling - first check if record exists
      const { data: existingData } = await supabase
        .from("project_documentation_order")
        .select("id")
        .eq("project_id", projectId)
        .eq("documentation_type_id", docTypeId || '')
        .maybeSingle();
      
      if (existingData) {
        // Update existing record
        const { error } = await supabase
          .from("project_documentation_order")
          .update({
            section_order: sectionOrder,
            selected_sections: selectedArray,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingData.id);
        
        if (error) throw error;
      } else {
        // Check for null documentation_type_id case
        const { data: nullData } = await supabase
          .from("project_documentation_order")
          .select("id")
          .eq("project_id", projectId)
          .is("documentation_type_id", null)
          .maybeSingle();
        
        if (!docTypeId && nullData) {
          // Update existing null record
          const { error } = await supabase
            .from("project_documentation_order")
            .update({
              section_order: sectionOrder,
              selected_sections: selectedArray,
              updated_at: new Date().toISOString()
            })
            .eq("id", nullData.id);
          
          if (error) throw error;
        } else {
          // Insert new record
          const { error } = await supabase
            .from("project_documentation_order")
            .insert({
              project_id: projectId,
              section_order: sectionOrder,
              selected_sections: selectedArray,
              documentation_type_id: docTypeId || null
            });
          
          if (error) throw error;
        }
      }
    } catch (error) {
      console.error("Error saving order and selections:", error);
    }
  };

  // Toggle section selection
  const toggleSectionSelection = (sectionId: string) => {
    setSelectedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      // Save to database with current documentation type
      saveOrderAndSelections(sections, newSet, selectedDocumentationType || undefined);
      return newSet;
    });
  };

  // Load project documentations
  const loadProjectDocumentations = async () => {
    try {
      const { data, error } = await supabase
        .from("project_documentations")
        .select(`
          id,
          project_type_id,
          display_order,
          project_type:project_types(id, name_ca, name_es)
        `)
        .eq("project_id", projectId)
        .order("display_order");

      if (error) {
        console.error("Error loading project documentations:", error);
        return;
      }

      let transformedData = (data || []).map(doc => ({
        id: doc.id,
        project_type_id: doc.project_type_id,
        display_order: doc.display_order,
        project_type: doc.project_type as { id: string; name_ca: string; name_es: string } | undefined
      }));

      // Si no hi ha documentacions definides, intentem recuperar el project_type del projecte
      if (transformedData.length === 0) {
        const { data: projectData } = await supabase
          .from("projects")
          .select("project_type")
          .eq("id", projectId)
          .single();

        if (projectData?.project_type) {
          // Buscar el project_type a la taula project_types
          const { data: projectTypeData } = await supabase
            .from("project_types")
            .select("id, name_ca, name_es")
            .eq("id", projectData.project_type)
            .single();

          if (projectTypeData) {
            // Crear automàticament una documentació per a aquest projecte
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: newDoc, error: insertError } = await supabase
                .from("project_documentations")
                .insert({
                  project_id: projectId,
                  project_type_id: projectTypeData.id,
                  display_order: 1,
                  created_by: user.id
                })
                .select(`
                  id,
                  project_type_id,
                  display_order
                `)
                .single();

              if (!insertError && newDoc) {
                transformedData = [{
                  id: newDoc.id,
                  project_type_id: newDoc.project_type_id,
                  display_order: newDoc.display_order,
                  project_type: projectTypeData
                }];
              }
            }
          }
        }
      }

      setProjectDocumentations(transformedData);
      
      // If documentationId is passed, use it, otherwise select first one
      if (documentationId) {
        setSelectedDocumentationType(documentationId);
      } else if (transformedData.length > 0) {
        setSelectedDocumentationType(transformedData[0].id);
      }
    } catch (error) {
      console.error("Error loading project documentations:", error);
    }
  };

  useEffect(() => {
    if (open && projectId) {
      loadProjectDocumentations();
      loadAllData();
    } else {
      // Reset progress when closing
      setShowProgress(false);
      setLoadingSteps([]);
      setCurrentLoadingStep(null);
      setSelectedDocumentationType(documentationId || "");
    }
  }, [open, projectId]);

  // Reload order and selections when documentation type changes
  useEffect(() => {
    if (!loading && baseSections.length > 0) {
      const reloadOrderForDocType = async () => {
        // Use baseSections to reorder from scratch for this documentation type
        const orderedSections = await loadSavedOrderAndSelections(baseSections, selectedDocumentationType || undefined);
        setSections(orderedSections);
      };
      reloadOrderForDocType();
    }
  }, [selectedDocumentationType]);
  const initializeLoadingSteps = (): LoadingStep[] => [
    { id: "project", label: language === 'ca' ? "Carregant dades del projecte" : "Cargando datos del proyecto", status: "pending", icon: <Database className="h-4 w-4" /> },
    { id: "owner", label: language === 'ca' ? "Carregant dades del propietari" : "Cargando datos del propietario", status: "pending", icon: <User className="h-4 w-4" /> },
    { id: "location", label: language === 'ca' ? "Carregant emplaçament" : "Cargando emplazamiento", status: "pending", icon: <MapPin className="h-4 w-4" /> },
    { id: "normativa", label: language === 'ca' ? "Carregant normativa urbanística" : "Cargando normativa urbanística", status: "pending", icon: <Scale className="h-4 w-4" /> },
    { id: "works", label: language === 'ca' ? "Carregant descripció de les obres" : "Cargando descripción de las obras", status: "pending", icon: <Hammer className="h-4 w-4" /> },
    { id: "surfaces", label: language === 'ca' ? "Carregant quadre de superfícies" : "Cargando cuadro de superficies", status: "pending", icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "measurements", label: language === 'ca' ? "Carregant amidaments" : "Cargando mediciones", status: "pending", icon: <Calculator className="h-4 w-4" /> },
    { id: "budget", label: language === 'ca' ? "Carregant pressupost" : "Cargando presupuesto", status: "pending", icon: <Euro className="h-4 w-4" /> },
    { id: "specifications", label: language === 'ca' ? "Carregant plec de condicions" : "Cargando pliego de condiciones", status: "pending", icon: <FileText className="h-4 w-4" /> },
    { id: "annexes", label: language === 'ca' ? "Carregant annexos" : "Cargando anexos", status: "pending", icon: <FileStack className="h-4 w-4" /> },
    { id: "order", label: language === 'ca' ? "Aplicant ordre guardat" : "Aplicando orden guardado", status: "pending", icon: <Settings className="h-4 w-4" /> },
  ];

  const updateStepStatus = (stepId: string, status: LoadingStep["status"]) => {
    setLoadingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
    if (status === "loading") {
      setCurrentLoadingStep(stepId);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setShowProgress(true);
    
    // Initialize steps
    const steps = initializeLoadingSteps();
    setLoadingSteps(steps);
    
    try {
      // Step 1: Project data
      updateStepStatus("project", "loading");
      const projectResult = await supabase
        .from("projects")
        .select("name, cadastral_reference, street, street_number, postal_code, city, province, utm_x, utm_y, utm_zone")
        .eq("id", projectId)
        .single();
      updateStepStatus("project", "completed");

      // Set project name
      if (projectResult.data?.name) {
        setProjectName(projectResult.data.name);
      }

      // Step 2: Owner data
      updateStepStatus("owner", "loading");
      const ownerResult = await supabase
        .from("project_owner_data")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      updateStepStatus("owner", "completed");

      // Step 3: Location (already loaded with project)
      updateStepStatus("location", "loading");
      await new Promise(resolve => setTimeout(resolve, 150)); // Small delay for visual feedback
      updateStepStatus("location", "completed");

      // Step 4: Normativa urbanística (query WFS if Catalunya)
      updateStepStatus("normativa", "loading");
      let normativaResult: { data: any; error: any } = { data: null, error: null };
      const projectData = projectResult.data;
      if (projectData?.utm_x && projectData?.utm_y && projectData?.utm_zone) {
        // Detect autonomous community
        let ccaa = "";
        if (projectData.utm_zone === "31N" && 
            projectData.utm_x >= 260000 && projectData.utm_x <= 530000 && 
            projectData.utm_y >= 4490000 && projectData.utm_y <= 4750000) {
          ccaa = "Catalunya";
        }
        
        if (ccaa === "Catalunya") {
          try {
            const { utmToLatLon } = await import("@/lib/geoUtils");
            const latLon = utmToLatLon(projectData.utm_x, projectData.utm_y, projectData.utm_zone);
            const { data, error } = await supabase.functions.invoke("urbanisme-lookup", {
              body: { 
                lat: latLon.latitude, 
                lon: latLon.longitude, 
                ccaa, 
                cadastralRef: projectData.cadastral_reference 
              }
            });
            normativaResult = { data: { ...data, ccaa, projectData }, error };
          } catch (err) {
            console.error("Error loading normativa:", err);
          }
        }
      }
      updateStepStatus("normativa", "completed");

      // Step 5: Works description
      updateStepStatus("works", "loading");
      const worksResult = await supabase
        .from("project_works_description")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      updateStepStatus("works", "completed");

      // Step 5: Surface Areas
      updateStepStatus("surfaces", "loading");
      const surfaceAreasResult = await supabase
        .from("project_surface_areas")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      updateStepStatus("surfaces", "completed");

      // Step 6: Measurements
      updateStepStatus("measurements", "loading");
      const measurementsResult = await supabase
        .from("element_type_configs")
        .select("id, type_name, custom_name, full_code, measured_value, preferred_unit, description, is_manual, element_count")
        .eq("project_id", projectId)
        .not("full_code", "is", null)
        .order("full_code");
      updateStepStatus("measurements", "completed");

      // Step 6: Budget
      updateStepStatus("budget", "loading");
      const [budgetResult, budgetLinesResult, percentageLinesResult] = await Promise.all([
        supabase.from("project_budget_documentation").select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("project_budget_lines").select("*").eq("project_id", projectId).order("display_order"),
        supabase.from("project_budget_percentage_lines").select("*").eq("project_id", projectId).order("display_order"),
      ]);
      updateStepStatus("budget", "completed");

      // Step 8: Specifications
      updateStepStatus("specifications", "loading");
      const specificationsResult = await supabase
        .from("project_specifications" as any)
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      updateStepStatus("specifications", "completed");

      // Step 9: Annexes
      updateStepStatus("annexes", "loading");
      const [annexSectionsResult, annexFilesResult, graphicResult] = await Promise.all([
        supabase.from("project_annexes_sections").select("*").eq("project_id", projectId).order("display_order"),
        supabase.from("project_annexes_files").select("*").eq("project_id", projectId),
        supabase.from("project_graphic_documentation").select("*").eq("project_id", projectId).order("display_order"),
      ]);
      updateStepStatus("annexes", "completed");

      // Process owner data
      const ownerData = processOwnerData(ownerResult.data);
      
      // Extract owner name for PDF
      if (ownerData.hasData) {
        if (ownerData.ownerType === "individual") {
          const nom = ownerData.formData.nom || "";
          const cognoms = ownerData.formData.cognoms || "";
          setOwnerName(`${nom} ${cognoms}`.trim());
        } else if (ownerData.ownerType === "couple") {
          const nom1 = ownerData.formData.nom || "";
          const nom2 = ownerData.formData.nom_2 || "";
          setOwnerName(nom2 ? `${nom1} i ${nom2}` : nom1);
        } else if (ownerData.ownerType === "company") {
          setOwnerName(ownerData.formData.rao_social || "");
        }
      }
      
      // Process location data
      const locationData = processLocationData(projectResult.data);
      
      // Extract location address for PDF
      if (locationData.hasData) {
        const parts = [];
        if (locationData.street) parts.push(locationData.street);
        if (locationData.streetNumber) parts.push(locationData.streetNumber);
        if (locationData.city) parts.push(locationData.city);
        setLocationAddress(parts.join(", "));
      }
      
      // Process normativa data
      const normativaData = processNormativaData(normativaResult.data, projectResult.data);
      
      // Process works data
      const worksData = processWorksData(worksResult.data);
      
      // Process surface areas
      const surfaceAreasData = processSurfaceAreasData(surfaceAreasResult.data);
      
      // Process measurements
      const measurements = processMeasurementsData(measurementsResult.data || []);
      
      // Process budget with percentage data
      const budgetData = processBudgetData(budgetResult.data, budgetLinesResult.data || [], percentageLinesResult.data || [], surfaceAreasData.totalComputedArea);
      
      // Process specifications
      const specificationsData = processSpecificationsData(specificationsResult.data);
      
      // Process annexes - all are now document sections
      const annexes = processAnnexesData(annexSectionsResult.data || [], annexFilesResult.data || []);
      const documentSectionAnnexes = annexes.filter(a => a.files.length > 0);

      // Build sections with data
      const newSections: DocumentSection[] = [
        {
          id: "owner",
          label: language === 'ca' ? "Propietari/a - Promotor/a" : "Propietario/a - Promotor/a",
          icon: <User className="w-4 h-4" />,
          data: ownerData,
          hasData: ownerData.hasData,
          summary: getOwnerSummary(ownerData)
        },
        {
          id: "location",
          label: language === 'ca' ? "Emplaçament i situació" : "Emplazamiento y situación",
          icon: <MapPin className="w-4 h-4" />,
          data: locationData,
          hasData: locationData.hasData,
          summary: getLocationSummary(locationData)
        },
        {
          id: "normativa",
          label: language === 'ca' ? "Normativa urbanística" : "Normativa urbanística",
          icon: <Scale className="w-4 h-4" />,
          data: normativaData,
          hasData: normativaData.hasData,
          summary: getNormativaSummary(normativaData)
        },
        {
          id: "works",
          label: language === 'ca' ? "Descripció de les obres" : "Descripción de las obras",
          icon: <Hammer className="w-4 h-4" />,
          data: worksData,
          hasData: worksData.hasData,
          summary: getWorksSummary(worksData)
        },
        {
          id: "surfaces",
          label: language === 'ca' ? "Quadre de superfícies" : "Cuadro de superficies",
          icon: <LayoutGrid className="w-4 h-4" />,
          data: surfaceAreasData,
          hasData: surfaceAreasData.hasData,
          summary: getSurfaceAreasSummary(surfaceAreasData)
        },
        {
          id: "measurements",
          label: language === 'ca' ? "Amidaments" : "Mediciones",
          icon: <Calculator className="w-4 h-4" />,
          data: measurements,
          hasData: measurements.length > 0,
          summary: getMeasurementsSummary(measurements)
        },
        {
          id: "budget",
          label: language === 'ca' ? "Pressupost" : "Presupuesto",
          icon: <Euro className="w-4 h-4" />,
          data: budgetData,
          hasData: budgetData.hasData,
          summary: getBudgetSummary(budgetData)
        },
        {
          id: "specifications",
          label: language === 'ca' ? "Plec de condicions" : "Pliego de condiciones",
          icon: <FileText className="w-4 h-4" />,
          data: specificationsData,
          hasData: specificationsData.hasData,
          summary: getSpecificationsSummary(specificationsData)
        },
        // All annex sections are now independent document sections
        ...documentSectionAnnexes.map(annexSection => ({
          id: `annex-section-${annexSection.id}`,
          label: annexSection.name,
          icon: <FileStack className="w-4 h-4" />,
          data: annexSection,
          hasData: annexSection.files.length > 0,
          summary: language === 'ca' 
            ? `${annexSection.files.length} arxiu${annexSection.files.length > 1 ? 's' : ''} PDF`
            : `${annexSection.files.length} archivo${annexSection.files.length > 1 ? 's' : ''} PDF`,
          isAnnexSection: true,
          annexSectionId: annexSection.id
        }))
      ];

      // Store base sections (without ordering) for later reordering when doc type changes
      setBaseSections(newSections);

      // Step 8: Apply saved order and load selections for the selected documentation type
      updateStepStatus("order", "loading");
      const orderedSections = await loadSavedOrderAndSelections(newSections, selectedDocumentationType || undefined);
      updateStepStatus("order", "completed");
      
      setSections(orderedSections);
      
      // Small delay before closing progress modal for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      setShowProgress(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setShowProgress(false);
    } finally {
      setLoading(false);
    }
  };

  // Data processing functions
  const processOwnerData = (data: any): OwnerData => {
    if (!data) {
      return { ownerType: null, formData: {}, hasData: false };
    }
    const formData = (data.form_data || {}) as Record<string, string>;
    const ownerType = data.owner_type as "individual" | "couple" | "company";
    
    // Check if has meaningful data
    let hasData = false;
    if (ownerType === "individual") {
      hasData = !!(formData.nom || formData.cognoms || formData.dni);
    } else if (ownerType === "couple") {
      hasData = !!(formData.nom || formData.nom_2);
    } else if (ownerType === "company") {
      hasData = !!(formData.rao_social || formData.nif_empresa);
    }
    
    return { ownerType, formData, hasData };
  };

  const processLocationData = (data: any): LocationData => {
    if (!data) {
      return { cadastralReference: null, street: null, streetNumber: null, postalCode: null, city: null, province: null, utmX: null, utmY: null, utmZone: null, hasData: false };
    }
    const hasData = !!(data.cadastral_reference && data.city);
    return {
      cadastralReference: data.cadastral_reference,
      street: data.street,
      streetNumber: data.street_number,
      postalCode: data.postal_code,
      city: data.city,
      province: data.province,
      utmX: data.utm_x,
      utmY: data.utm_y,
      utmZone: data.utm_zone,
      hasData
    };
  };

  const processWorksData = (data: any): WorksData => {
    if (!data) {
      return { currentState: null, worksDescription: null, actionZone: null, hasData: false };
    }
    const hasData = !!(data.current_state || data.works_description || data.action_zone);
    return {
      currentState: data.current_state,
      worksDescription: data.works_description,
      actionZone: data.action_zone,
      hasData
    };
  };

  // processGraphicData removed - no longer needed

  const processMeasurementsData = (data: any[]): MeasurementChapter[] => {
    if (!data || data.length === 0) return [];

    // Group by chapter, subchapter, subsubchapter using the actual code structure
    // Codes are in format: XX.YY.ZZ.NN (e.g., "20.10.10.01")
    const chapters: Map<string, MeasurementChapter> = new Map();

    data.forEach(item => {
      if (!item.full_code) return;
      
      // Split the code by dots to get each level correctly
      const codeParts = item.full_code.split('.');
      if (codeParts.length < 3) return; // Need at least chapter.subchapter.subsubchapter
      
      const chapterCode = codeParts[0]; // e.g., "20"
      const subchapterCode = `${codeParts[0]}.${codeParts[1]}`; // e.g., "20.10"
      const subsubchapterCode = `${codeParts[0]}.${codeParts[1]}.${codeParts[2]}`; // e.g., "20.10.10"

      if (!chapters.has(chapterCode)) {
        chapters.set(chapterCode, {
          code: chapterCode,
          name: getChapterName(chapterCode),
          subchapters: []
        });
      }

      const chapter = chapters.get(chapterCode)!;
      let subchapter = chapter.subchapters.find(s => s.code === subchapterCode);
      
      if (!subchapter) {
        subchapter = {
          code: subchapterCode,
          name: getTranslatedName(subchapterCode, `Subcapítol ${subchapterCode}`),
          subsubchapters: []
        };
        chapter.subchapters.push(subchapter);
      }

      let subsubchapter = subchapter.subsubchapters.find(s => s.code === subsubchapterCode);
      
      if (!subsubchapter) {
        subsubchapter = {
          code: subsubchapterCode,
          name: getTranslatedName(subsubchapterCode, `Partida ${subsubchapterCode}`),
          items: []
        };
        subchapter.subsubchapters.push(subsubchapter);
      }

      subsubchapter.items.push({
        id: item.id,
        fullCode: item.full_code,
        typeName: item.type_name,
        customName: item.custom_name,
        description: item.description,
        measuredValue: item.measured_value,
        preferredUnit: item.preferred_unit,
        isManual: item.is_manual || false,
        elementCount: item.element_count
      });
    });

    return Array.from(chapters.values()).sort((a, b) => a.code.localeCompare(b.code));
  };

  const processBudgetData = (data: any, linesData: any[], percentageLinesData: any[] = [], builtAreaTotal: number = 0): BudgetData => {
    const emptyBudget: BudgetData = { 
      budgetType: null, 
      pemJustified: null, 
      pemUnjustified: null, 
      budgetLines: [],
      percentageLines: [],
      superficieTotal: 0,
      builtAreaTotal: 0,
      euroPerM2: 0,
      pr: 0,
      coeficientPPr: 1,
      pem: 0,
      hasData: false 
    };
    
    if (!data) {
      return emptyBudget;
    }
    
    // Process budget lines
    const budgetLines: BudgetLine[] = linesData.map(line => {
      const superficie = Number(line.superficie) || 0;
      const modulBasic = Number(line.modul_basic) || 0;
      const cg = Number(line.cg) || 1;
      const ct = Number(line.ct) || 1;
      const cq = Number(line.cq) || 1;
      const cu = Number(line.cu) || 1;
      const pressupost = superficie * modulBasic * cg * ct * cq * cu;
      
      return {
        zonaPlanta: line.zona_planta || '',
        superficie,
        modulBasic,
        cg,
        ct,
        cq,
        cu,
        pressupost
      };
    });

    // Process percentage lines
    const euroPerM2 = Number(data.euro_per_m2) || 0;
    const percentagePEM = euroPerM2 * builtAreaTotal;
    const percentageLines: PercentageBudgetLine[] = percentageLinesData.map(line => ({
      chapterCode: line.chapter_code,
      chapterName: line.chapter_name,
      percentage: Number(line.percentage) || 0,
      pressupost: (Number(line.percentage) / 100) * percentagePEM
    }));
    
    const superficieTotal = budgetLines.reduce((sum, line) => sum + line.superficie, 0);
    const pr = budgetLines.reduce((sum, line) => sum + line.pressupost, 0);
    const coeficientPPr = Number(data.coeficient_p_pr) || 1;
    const pem = data.budget_type === "percentage" ? percentagePEM : pr * coeficientPPr;
    
    const hasData = budgetLines.length > 0 || percentageLines.length > 0 || !!(data.pem_unjustified) || euroPerM2 > 0;
    
    return {
      budgetType: data.budget_type as "justified" | "unjustified" | "percentage",
      pemJustified: pem > 0 ? pem : null,
      pemUnjustified: data.pem_unjustified ? Number(data.pem_unjustified) : null,
      budgetLines,
      percentageLines,
      superficieTotal,
      builtAreaTotal,
      euroPerM2,
      pr,
      coeficientPPr,
      pem,
      hasData
    };
  };

  const processAnnexesData = (sectionsData: any[], filesData: any[]): AnnexSection[] => {
    return sectionsData.map(section => ({
      id: section.id,
      name: section.name,
      isDocumentSection: section.is_document_section ?? false,
      files: filesData
        .filter(f => f.section_id === section.id)
        .map(f => ({
          id: f.id,
          fileName: f.file_name,
          fileUrl: f.file_url
        }))
    }));
  };

  const processSurfaceAreasData = (data: any): SurfaceAreasData => {
    const emptyData: SurfaceAreasData = {
      usefulAreas: [],
      builtAreas: [],
      levelCustomNames: [],
      totalUsefulArea: 0,
      totalBuiltArea: 0,
      totalComputedArea: 0,
      hasData: false
    };
    
    if (!data || !data.surface_data) {
      return emptyData;
    }
    
    const surfaceData = data.surface_data as any;
    
    const usefulAreas: UsefulAreaItem[] = (surfaceData.useful_areas || [])
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((item: any) => ({
        id: item.id,
        level: item.level || '',
        name: item.name || '',
        reference: item.reference || '',
        area: Number(item.area) || 0
      }));
    
    const builtAreas: BuiltAreaItem[] = (surfaceData.built_areas || [])
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((item: any) => ({
        id: item.id,
        level: item.level || '',
        name: item.name || '',
        computation: Number(item.computation) || 100,
        area: Number(item.area) || 0
      }));
    
    const levelCustomNames = surfaceData.level_custom_names || [];
    
    const totalUsefulArea = usefulAreas.reduce((sum, item) => sum + item.area, 0);
    const totalBuiltArea = builtAreas.reduce((sum, item) => sum + item.area, 0);
    const totalComputedArea = builtAreas.reduce((sum, item) => sum + (item.area * item.computation / 100), 0);
    
    return {
      usefulAreas,
      builtAreas,
      levelCustomNames,
      totalUsefulArea,
      totalBuiltArea,
      totalComputedArea,
      hasData: usefulAreas.length > 0 || builtAreas.length > 0
    };
  };

  const processSpecificationsData = (data: any): SpecificationsData => {
    // Use the language-specific default structure as base, merge with saved data if available
    const base = getSpecificationsStructure(language === 'es' ? 'es' : 'ca');

    const chapters: SpecificationsChapter[] = base.map((ch: any) => ({
      id: ch.id,
      code: ch.code,
      title: ch.title,
      sections: (ch.sections || []).map((section: any) => ({
        id: section.id,
        title: section.title,
        content: section.content,
      })),
    }));

    // If there's saved data, override the default content (except legacy rows saved with Catalan defaults)
    const savedData = data?.specifications_data as Record<string, Record<string, string>> | undefined;

    const isLegacyCatalanDefaults =
      language === "es" &&
      !!savedData &&
      getSpecificationsStructure("ca").every((ch: any) =>
        (ch.sections || []).every((s: any) => savedData?.[ch.id]?.[s.id] === s.content)
      );

    if (savedData && !isLegacyCatalanDefaults) {
      chapters.forEach((chapter) => {
        const chapterData = savedData[chapter.id];
        if (chapterData) {
          chapter.sections.forEach((section) => {
            if (chapterData[section.id] !== undefined) {
              section.content = chapterData[section.id];
            }
          });
        }
      });
    }

    // Always has data because we include default content
    return {
      chapters,
      hasData: true
    };
  };

  const processNormativaData = (wfsData: any, projectData: any): NormativaData => {
    const emptyData: NormativaData = {
      cadastralReference: projectData?.cadastral_reference || null,
      street: projectData?.street || null,
      city: projectData?.city || null,
      province: projectData?.province || null,
      autonomousCommunity: null,
      hasData: false
    };

    if (!wfsData || !wfsData.success) {
      return emptyData;
    }

    return {
      cadastralReference: projectData?.cadastral_reference || null,
      street: projectData?.street || null,
      city: projectData?.city || null,
      province: projectData?.province || null,
      autonomousCommunity: wfsData.ccaa || null,
      classificacio: wfsData.classificacio,
      qualificacio: wfsData.qualificacio,
      sector: wfsData.sector,
      hasData: !!(wfsData.classificacio || wfsData.qualificacio)
    };
  };

  // Summary generation functions
  const getOwnerSummary = (data: OwnerData): string => {
    if (!data.hasData) return language === 'ca' ? "Sense dades del propietari" : "Sin datos del propietario";
    
    if (data.ownerType === "individual") {
      const nom = data.formData.nom || "";
      const cognoms = data.formData.cognoms || "";
      const name = `${nom} ${cognoms}`.trim();
      return name 
        ? (language === 'ca' ? `Una persona: ${name}` : `Una persona: ${name}`)
        : (language === 'ca' ? "Una persona (dades parcials)" : "Una persona (datos parciales)");
    } else if (data.ownerType === "couple") {
      const nom1 = data.formData.nom || "";
      const nom2 = data.formData.nom_2 || "";
      const names = nom2 ? `${nom1} ${language === 'ca' ? 'i' : 'y'} ${nom2}` : nom1;
      return names 
        ? (language === 'ca' ? `Dues persones: ${names}` : `Dos personas: ${names}`)
        : (language === 'ca' ? "Dues persones (dades parcials)" : "Dos personas (datos parciales)");
    } else if (data.ownerType === "company") {
      const company = data.formData.rao_social || (language === 'ca' ? "(dades parcials)" : "(datos parciales)");
      return language === 'ca' ? `Empresa: ${company}` : `Empresa: ${company}`;
    }
    return language === 'ca' ? "Sense dades" : "Sin datos";
  };

  const getLocationSummary = (data: LocationData): string => {
    if (!data.hasData) return language === 'ca' ? "Sense referència cadastral" : "Sin referencia catastral";
    const parts = [];
    if (data.cadastralReference) parts.push(`Ref: ${data.cadastralReference.substring(0, 14)}...`);
    if (data.city) parts.push(data.city);
    return parts.join(" • ") || (language === 'ca' ? "Dades parcials" : "Datos parciales");
  };

  const getWorksSummary = (data: WorksData): string => {
    if (!data.hasData) return language === 'ca' ? "Sense descripció de les obres" : "Sin descripción de las obras";
    const parts = [];
    if (data.currentState) parts.push(language === 'ca' ? "Estat actual ✓" : "Estado actual ✓");
    if (data.worksDescription) parts.push(language === 'ca' ? "Descripció ✓" : "Descripción ✓");
    if (data.actionZone) parts.push(language === 'ca' ? "Zona actuació ✓" : "Zona actuación ✓");
    return parts.join(" • ") || (language === 'ca' ? "Dades parcials" : "Datos parciales");
  };

  const getSurfaceAreasSummary = (data: SurfaceAreasData): string => {
    if (!data.hasData) return language === 'ca' ? "Sense quadre de superfícies" : "Sin cuadro de superficies";
    const parts = [];
    if (data.usefulAreas.length > 0) parts.push(language === 'ca' 
      ? `${data.usefulAreas.length} superfícies útils`
      : `${data.usefulAreas.length} superficies útiles`);
    if (data.builtAreas.length > 0) parts.push(language === 'ca'
      ? `${data.builtAreas.length} superfícies construïdes`
      : `${data.builtAreas.length} superficies construidas`);
    return parts.join(" • ") || (language === 'ca' ? "Dades parcials" : "Datos parciales");
  };

  const getNormativaSummary = (data: NormativaData): string => {
    if (!data.hasData) return language === 'ca' ? "Sense dades urbanístiques" : "Sin datos urbanísticos";
    const parts = [];
    if (data.classificacio?.codi) parts.push(language === 'ca' 
      ? `Classificació: ${data.classificacio.codi}`
      : `Clasificación: ${data.classificacio.codi}`);
    if (data.qualificacio?.clau) parts.push(language === 'ca'
      ? `Qualificació: ${data.qualificacio.clau}`
      : `Calificación: ${data.qualificacio.clau}`);
    return parts.join(" • ") || (language === 'ca' ? "Dades parcials" : "Datos parciales");
  };

  const getMeasurementsSummary = (chapters: MeasurementChapter[]): string => {
    if (chapters.length === 0) return language === 'ca' ? "Sense partides editades" : "Sin partidas editadas";
    const totalItems = chapters.reduce((acc, ch) => 
      acc + ch.subchapters.reduce((acc2, sub) => 
        acc2 + sub.subsubchapters.reduce((acc3, subsub) => acc3 + subsub.items.length, 0), 0), 0);
    return language === 'ca'
      ? `${chapters.length} capítol${chapters.length > 1 ? "s" : ""} • ${totalItems} partid${totalItems > 1 ? "es" : "a"}`
      : `${chapters.length} capítulo${chapters.length > 1 ? "s" : ""} • ${totalItems} partida${totalItems > 1 ? "s" : ""}`;
  };

  const getBudgetSummary = (data: BudgetData): string => {
    if (!data.hasData) return language === 'ca' ? "Sense pressupost definit" : "Sin presupuesto definido";
    if (data.budgetType === "justified" && data.pemJustified) {
      return `PEM ${language === 'ca' ? 'Justificat' : 'Justificado'}: ${data.pemJustified.toLocaleString("ca-ES", { minimumFractionDigits: 2 })} €`;
    }
    if (data.budgetType === "unjustified" && data.pemUnjustified) {
      return `PEM: ${data.pemUnjustified.toLocaleString("ca-ES", { minimumFractionDigits: 2 })} €`;
    }
    return language === 'ca' ? "Tipus seleccionat però sense import" : "Tipo seleccionado pero sin importe";
  };

  const getSpecificationsSummary = (data: SpecificationsData): string => {
    if (!data.hasData) return language === 'ca' ? "Sense plec de condicions" : "Sin pliego de condiciones";
    const chaptersWithContent = data.chapters.filter(ch => ch.sections.length > 0).length;
    const totalSections = data.chapters.reduce((acc, ch) => acc + ch.sections.length, 0);
    if (totalSections === 0) {
      return language === 'ca' ? "8 capítols estàndard disponibles" : "8 capítulos estándar disponibles";
    }
    return language === 'ca'
      ? `${chaptersWithContent} capítol${chaptersWithContent !== 1 ? "s" : ""} modificat${chaptersWithContent !== 1 ? "s" : ""}`
      : `${chaptersWithContent} capítulo${chaptersWithContent !== 1 ? "s" : ""} modificado${chaptersWithContent !== 1 ? "s" : ""}`;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save order and selections automatically with current documentation type
        saveOrderAndSelections(newItems, selectedSections, selectedDocumentationType || undefined);
        
        return newItems;
      });
    }
  };

  const handleGeneratePDF = () => {
    setShowCoverConfig(true);
  };

  const handleCoverConfigGenerate = async (config: CoverConfig, isDraft: boolean) => {
    setGenerating(true);
    try {
      // Capture map images if location data available
      let mapImages: { emplacament?: string; situacio?: string } = {};
      const locationSection = sections.find((s) => s.id === "location");
      const locationData = locationSection?.data as LocationData | undefined;

      const coords = await (async (): Promise<{ lat: number; lon: number } | null> => {
        if (locationData?.utmX && locationData?.utmY) {
          return utmToLatLon(locationData.utmX, locationData.utmY, locationData.utmZone);
        }

        const cadastralReference = locationData?.cadastralReference;
        if (!cadastralReference) return null;

        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "cadastre-lookup",
          { body: { cadastralReference } }
        );

        if (fnError) {
          console.error("Error obtenint coordenades del cadastre:", fnError);
          return null;
        }

        const lat = Number(fnData?.data?.latitude ?? 0);
        const lon = Number(fnData?.data?.longitude ?? 0);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) return null;

        return { lat, lon };
      })();

      if (coords) {
        console.log("Capturing maps for coordinates:", coords);
        const [emplacament, situacio] = await Promise.all([
          captureEmplacamentMap(coords.lat, coords.lon),
          captureSituacioMap(coords.lat, coords.lon),
        ]);
        if (emplacament) mapImages.emplacament = emplacament;
        if (situacio) mapImages.situacio = situacio;
        console.log("Map images captured:", { hasEmplacament: !!emplacament, hasSituacio: !!situacio });
      } else {
        toast.warning(language === 'ca' 
          ? "No s'han pogut obtenir coordenades per generar els plànols."
          : "No se han podido obtener coordenadas para generar los planos.");
      }

      // Filter sections to only include selected ones
      const sectionsToInclude = sections.filter(s => selectedSections.has(s.id));
      
      const pdfBlob = await generateProjectPDF({
        coverConfig: config,
        sections: sectionsToInclude,
        date: new Date(),
        mapImages,
        isDraft,
        watermarkText: config.watermarkText,
        colorTheme: config.colorTheme,
        includeTocLinks: config.includeTocLinks,
        projectId,
        enableQrCode: uiSettings.pdf_qr_code_enabled,
        language, // Pass user's profile language to PDF generator
      });
      
      // Generate file name - keep accents for display, clean for storage
      const draftSuffix = isDraft ? "_BORRADOR" : "";
      const documentationTypeName = getSelectedDocumentationName() || "Document";
      const docTypeSuffix = documentationTypeName ? `_${documentationTypeName.replace(/[^a-zA-Z0-9áàéèíïóòúüçñ]/gi, "_")}` : "";
      const fileName = `${config.title.replace(/[^a-zA-Z0-9]/g, "_")}${docTypeSuffix}${draftSuffix}_${new Date().toISOString().split("T")[0]}.pdf`;
      
      // Clean file name for storage (remove accents and special characters)
      const cleanForStorage = (str: string): string => {
        return str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // Remove accents
          .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
          .replace(/_+/g, "_") // Replace multiple underscores with single
          .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
      };
      const storageFileName = cleanForStorage(fileName);
      
      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Save to storage and database (only for non-draft)
      if (!isDraft) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const userId = userData.user.id;
            const storagePath = `${userId}/${projectId}/${Date.now()}_${storageFileName}`;
            
            // Upload to storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("generated-documentation")
              .upload(storagePath, pdfBlob, {
                contentType: "application/pdf",
                cacheControl: "3600",
              });
            
            if (uploadError) {
              console.error("Error uploading PDF:", uploadError);
              toast.warning(language === 'ca' ? "PDF descarregat però no s'ha pogut guardar al registre" : "PDF descargado pero no se ha podido guardar en el registro");
            } else {
              // Get public URL
              const { data: urlData } = supabase.storage
                .from("generated-documentation")
                .getPublicUrl(storagePath);
              
              // Save to database with document title
              const { error: dbError } = await supabase
                .from("generated_documentation")
                .insert({
                  project_id: projectId,
                  documentation_type_id: selectedDocumentationType || null,
                  documentation_type_name: documentationTypeName,
                  title: config.title, // Store the document title from PDF configuration
                  file_url: urlData.publicUrl,
                  file_name: fileName,
                  file_size: pdfBlob.size,
                  created_by: userId,
                });
              
              if (dbError) {
                console.error("Error saving to database:", dbError);
              } else {
                console.log("PDF saved to registry successfully");
              }
            }
          }
        } catch (saveError) {
          console.error("Error saving PDF:", saveError);
          // Don't show error to user since the PDF was already downloaded
        }
      }
      
      toast.success(isDraft 
        ? (language === 'ca' ? "Borrador generat correctament" : "Borrador generado correctamente") 
        : (language === 'ca' ? "PDF generat correctament" : "PDF generado correctamente"));
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(language === 'ca' ? "Error generant el PDF" : "Error generando el PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const completedSections = sections.filter(s => s.hasData).length;
  const selectedCount = selectedSections.size;
  const totalSections = sections.length;
  
  // Get selected documentation name
  const getSelectedDocumentationName = () => {
    if (!selectedDocumentationType) return null;
    const doc = projectDocumentations.find(d => d.id === selectedDocumentationType);
    return doc?.project_type?.name_ca || null;
  };

  return (
    <>
      {/* Progress modal for initial loading */}
      <DocumentationProgressModal
        open={showProgress}
        steps={loadingSteps}
        currentStep={currentLoadingStep}
      />
      
      <PDFCoverConfigModal
        open={showCoverConfig}
        onOpenChange={setShowCoverConfig}
        projectId={projectId}
        projectName={projectName}
        ownerName={ownerName}
        locationAddress={locationAddress}
        projectTypeName={getSelectedDocumentationName() || undefined}
        onGenerate={handleCoverConfigGenerate}
      />
      <Dialog open={open && !showProgress} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-4 text-xl">
              <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
                <FileDown className="h-6 w-6 text-[#6b7c4c]" />
              </div>
              <div className="flex-1">
                <span className="block text-[#6b7c4c]">
                  {language === 'ca' ? 'Generar documentació' : 'Generar documentación'}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedCount} {language === 'ca' ? 'seleccionats' : 'seleccionados'} • {completedSections}/{totalSections} {language === 'ca' ? 'amb dades' : 'con datos'}
                </span>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">
                {language === 'ca' ? "Tipus d'obra o document:" : "Tipo de obra o documento:"}
              </Label>
              {projectDocumentations.length > 0 ? (
                <Select 
                  value={selectedDocumentationType} 
                  onValueChange={setSelectedDocumentationType}
                >
                  <SelectTrigger className="w-[280px] bg-background border-border">
                    <SelectValue placeholder={language === 'ca' ? "Selecciona tipus..." : "Selecciona tipo..."} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border z-[100]">
                    {projectDocumentations.map((doc, index) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {index + 1}
                          </span>
                          <span>
                            {(language === 'ca' ? doc.project_type?.name_ca : doc.project_type?.name_es) || doc.project_type?.name_ca || (language === 'ca' ? 'Sense tipus' : 'Sin tipo')}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-amber-600 italic">
                  {language === 'ca' ? 'Cap tipus definit' : 'Ningún tipo definido'}
                </span>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">
            {language === 'ca' ? 'Modal per generar la documentació del projecte' : 'Modal para generar la documentación del proyecto'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
            <p className="text-base text-muted-foreground">
              {language === 'ca' ? 'Avaluant dades del projecte...' : 'Evaluando datos del proyecto...'}
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="p-6">
              <p className="text-sm text-muted-foreground mb-4">
                {language === 'ca' 
                  ? "Marca els apartats que vols incloure al PDF i arrossega'ls per definir l'ordre. Els apartats en verd tenen dades completes."
                  : "Marca los apartados que quieres incluir en el PDF y arrástralos para definir el orden. Los apartados en verde tienen datos completos."}
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {sections.map((section) => (
                      <SortableItem 
                        key={section.id} 
                        section={section}
                        isSelected={selectedSections.has(section.id)}
                        onToggleSelection={toggleSectionSelection}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </ScrollArea>
        )}

        <div className="px-8 py-4 border-t bg-muted/30 flex justify-between">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            {language === 'ca' ? "Cancel·lar" : "Cancelar"}
          </Button>
          <Button
            onClick={handleGeneratePDF}
            disabled={loading || generating || selectedCount === 0}
            className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            {generating 
              ? (language === 'ca' ? "Generant..." : "Generando...") 
              : (language === 'ca' ? "Generar PDF (1/2)" : "Generar PDF (1/2)")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { FileText, Loader2, Save, Building, MapPinned, Hammer, X, Sparkles, LogOut, ChevronDown, ChevronRight, ListChecks, Eye, EyeOff, Info, Pencil, Lightbulb, CheckCircle2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserCredits } from "@/hooks/useUserCredits";
import { CreditConfirmationModal, getCreditConfirmationDisabled } from "@/components/credits/CreditConfirmationModal";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { BUDGET_CHAPTERS } from "@/data/budgetChapters";
import { useBudgetChapterTranslations } from "@/hooks/useBudgetChapterTranslations";
import { 
  TECHNICAL_DESCRIPTION_TEMPLATES, 
  generateTechnicalPromptData,
  ChapterItemsForAI 
} from "@/data/technicalDescriptionTemplates";
import { parseMarkdownBold, hasMarkdownBold } from "@/lib/markdownUtils";

// Component to render text with markdown bold formatting
const FormattedTextPreview = ({ text, className = "" }: { text: string; className?: string }) => {
  if (!text) return null;
  
  // Split by newlines and render each line
  const lines = text.split('\n');
  
  return (
    <div className={className}>
      {lines.map((line, index) => (
        <p key={index} className="mb-1 last:mb-0">
          {parseMarkdownBold(line)}
        </p>
      ))}
    </div>
  );
};

interface WorksDescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface WorksData {
  current_state: string;
  works_description: string;
  action_zone: string;
}

interface ElementTypeConfig {
  id: string;
  type_name: string;
  custom_name: string | null;
  full_code: string | null;
  chapter_id: string | null;
  description: string | null;
}

interface GroupedItems {
  [chapterCode: string]: {
    chapterName: string;
    items: ElementTypeConfig[];
  };
}

export const WorksDescriptionModal = ({
  open,
  onOpenChange,
  projectId,
}: WorksDescriptionModalProps) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({
    current_state: false,
    works_description: false,
    action_zone: false,
  });
  const [worksData, setWorksData] = useState<WorksData>({
    current_state: "",
    works_description: "",
    action_zone: "",
  });
  const [existingId, setExistingId] = useState<string | null>(null);
  const [elementConfigs, setElementConfigs] = useState<ElementTypeConfig[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [pendingAIField, setPendingAIField] = useState<'current_state' | 'works_description' | 'action_zone' | null>(null);
  const { canGenerateAIMemory, deductCreditsForAIMemory, config, credits, shouldSkipCredits, userId, refreshCredits } = useUserCredits();
  const { getTranslatedName } = useBudgetChapterTranslations();

  const togglePreview = (field: string) => {
    setPreviewMode(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Get chapter names from BUDGET_CHAPTERS
  const chapterNames = useMemo(() => {
    const names: Record<string, string> = {};
    BUDGET_CHAPTERS.forEach(chapter => {
      names[chapter.code] = chapter.name;
    });
    return names;
  }, []);

  // Group items by first-level chapter code (10, 20, 30, etc.)
  const groupedItems = useMemo((): GroupedItems => {
    const groups: GroupedItems = {};
    
    elementConfigs.forEach(item => {
      if (!item.full_code) return;
      
      // Extract first level code (first 2 digits)
      const firstLevelCode = item.full_code.substring(0, 2);
      
      if (!groups[firstLevelCode]) {
        groups[firstLevelCode] = {
          chapterName: chapterNames[firstLevelCode] || `Capítol ${firstLevelCode}`,
          items: []
        };
      }
      
      groups[firstLevelCode].items.push(item);
    });

    // Sort items within each chapter by full_code
    Object.keys(groups).forEach(key => {
      groups[key].items.sort((a, b) => (a.full_code || '').localeCompare(b.full_code || ''));
    });

    return groups;
  }, [elementConfigs, chapterNames]);

  // Prepare technical data for AI generation
  const prepareTechnicalDataForAI = useMemo(() => {
    if (selectedItems.size === 0) return null;

    const selectedConfigs = elementConfigs.filter(item => selectedItems.has(item.id));
    
    // Group selected items by chapter for AI
    const chapterItemsForAI: ChapterItemsForAI[] = [];
    const groupedSelected: Record<string, ElementTypeConfig[]> = {};
    
    selectedConfigs.forEach(item => {
      if (!item.full_code) return;
      const chapterCode = item.full_code.substring(0, 2);
      if (!groupedSelected[chapterCode]) {
        groupedSelected[chapterCode] = [];
      }
      groupedSelected[chapterCode].push(item);
    });

    // Convert to ChapterItemsForAI format
    Object.keys(groupedSelected).sort().forEach(chapterCode => {
      const items = groupedSelected[chapterCode];
      chapterItemsForAI.push({
        chapterCode,
        chapterName: chapterNames[chapterCode] || `Capítol ${chapterCode}`,
        items: items.map(item => ({
          code: item.full_code || '',
          name: item.custom_name || getTranslatedName(item.full_code || '', item.type_name),
          description: item.description || undefined
        }))
      });
    });

    return generateTechnicalPromptData(chapterItemsForAI);
  }, [selectedItems, elementConfigs, chapterNames, getTranslatedName]);

  // Generate a simple preview text from selected items (for display purposes only)
  const generatePreviewText = useMemo(() => {
    if (selectedItems.size === 0) return "";

    const selectedConfigs = elementConfigs.filter(item => selectedItems.has(item.id));
    
    // Group selected items by chapter
    const groupedSelected: Record<string, ElementTypeConfig[]> = {};
    
    selectedConfigs.forEach(item => {
      if (!item.full_code) return;
      const chapterCode = item.full_code.substring(0, 2);
      if (!groupedSelected[chapterCode]) {
        groupedSelected[chapterCode] = [];
      }
      groupedSelected[chapterCode].push(item);
    });

    // Sort chapters
    const sortedChapters = Object.keys(groupedSelected).sort();

    // Generate preview text with language support
    const partLabel = language === "ca" ? "partides" : "partidas";
    const chapterLabel = language === "ca" ? "Capítol" : "Capítulo";
    
    let text = language === "ca" 
      ? "📝 Partides seleccionades per generar la descripció tècnica:\n\n"
      : "📝 Partidas seleccionadas para generar la descripción técnica:\n\n";
    
    sortedChapters.forEach((chapterCode) => {
      const defaultName = `${chapterLabel} ${chapterCode}`;
      const chapterName = chapterNames[chapterCode] || defaultName;
      const items = groupedSelected[chapterCode];
      text += `▸ ${chapterName} (${items.length} ${partLabel})\n`;
    });
    
    text += language === "ca"
      ? "\n💡 Prem 'Generar descripció tècnica' per crear el text professional."
      : "\n💡 Pulsa 'Generar descripción técnica' para crear el texto profesional.";

    return text;
  }, [selectedItems, elementConfigs, chapterNames, language]);

  useEffect(() => {
    if (open && projectId) {
      loadWorksData();
      loadElementConfigs();
    }
  }, [open, projectId]);

  // Update preview when selections change (only if no existing description)
  useEffect(() => {
    if (selectedItems.size > 0 && !worksData.works_description.includes("ENDERROCS") && 
        !worksData.works_description.includes("MOVIMENT") &&
        !worksData.works_description.includes("FONAMENTACIÓ") &&
        !worksData.works_description.includes("FAÇANES")) {
      setWorksData(prev => ({
        ...prev,
        works_description: generatePreviewText
      }));
    }
  }, [generatePreviewText, selectedItems]);

  const loadWorksData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_works_description")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWorksData({
          current_state: data.current_state || "",
          works_description: data.works_description || "",
          action_zone: data.action_zone || "",
        });
        setExistingId(data.id);
      } else {
        setWorksData({
          current_state: "",
          works_description: "",
          action_zone: "",
        });
        setExistingId(null);
      }
    } catch (error) {
      console.error("Error loading works data:", error);
      toast.error(language === "ca" ? "Error carregant les dades" : "Error cargando los datos");
    } finally {
      setLoading(false);
    }
  };

  const loadElementConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("element_type_configs")
        .select("id, type_name, custom_name, full_code, chapter_id, description")
        .eq("project_id", projectId)
        .not("full_code", "is", null)
        .order("full_code");

      if (error) throw error;
      setElementConfigs(data || []);
    } catch (error) {
      console.error("Error loading element configs:", error);
    }
  };

  const handleSave = async (closeAfter: boolean = false) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticat");

      if (existingId) {
        const { error } = await supabase
          .from("project_works_description")
          .update({
            current_state: worksData.current_state,
            works_description: worksData.works_description,
            action_zone: worksData.action_zone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("project_works_description")
          .insert({
            project_id: projectId,
            current_state: worksData.current_state,
            works_description: worksData.works_description,
            action_zone: worksData.action_zone,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        setExistingId(data.id);
      }

      toast.success(language === "ca" ? "Dades guardades correctament" : "Datos guardados correctamente");
      
      if (closeAfter) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving works data:", error);
      toast.error(language === "ca" ? "Error guardant les dades" : "Error guardando los datos");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAI = async (fieldType: 'current_state' | 'works_description' | 'action_zone') => {
    // For works_description, we need selected items
    if (fieldType === 'works_description') {
      if (selectedItems.size === 0 || !prepareTechnicalDataForAI) {
        toast.error(language === "ca" ? "Selecciona primer les partides que vols incloure" : "Selecciona primero las partidas que quieres incluir");
        return;
      }
    } else {
      const fieldValue = worksData[fieldType];
      if (!fieldValue || fieldValue.trim().length === 0) {
        toast.error(language === "ca" ? "Escriu primer les teves idees o notes al camp" : "Escribe primero tus ideas o notas en el campo");
        return;
      }
    }

    // Si és usuari demo sense lògica de crèdits, executar directament
    if (shouldSkipCredits) {
      executeAIGeneration(fieldType);
      return;
    }

    if (!canGenerateAIMemory()) {
      // Show purchase modal instead of just toast
      setShowPurchaseModal(true);
      return;
    }

    // Check if confirmation is disabled
    if (getCreditConfirmationDisabled("ai_works_description")) {
      executeAIGeneration(fieldType);
    } else {
      setPendingAIField(fieldType);
      setShowCreditConfirmation(true);
    }
  };

  const executeAIGeneration = async (fieldType: 'current_state' | 'works_description' | 'action_zone') => {
    setGeneratingAI(fieldType);

    try {
      const requestBody: any = { fieldType, language };
      
      if (fieldType === 'works_description') {
        // Send technical data for works description
        requestBody.technicalData = prepareTechnicalDataForAI;
      } else {
        // Send prompt for other fields
        requestBody.prompt = worksData[fieldType];
      }

      const { data, error } = await supabase.functions.invoke('generate-memory-description', {
        body: requestBody
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.generatedText) {
        const deducted = await deductCreditsForAIMemory(projectId, projectId);
        
        if (deducted) {
          setWorksData(prev => ({
            ...prev,
            [fieldType]: data.generatedText
          }));
          toast.success(language === "ca" ? "Text generat correctament" : "Texto generado correctamente");
        }
      }
    } catch (error) {
      console.error("Error generating AI text:", error);
      toast.error(language === "ca" ? "Error generant el text amb IA" : "Error generando el texto con IA");
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const toggleChapter = (chapterCode: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterCode)) {
        newSet.delete(chapterCode);
      } else {
        newSet.add(chapterCode);
      }
      return newSet;
    });
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleAllChapterItems = (chapterCode: string, select: boolean) => {
    const chapterItems = groupedItems[chapterCode]?.items || [];
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      chapterItems.forEach(item => {
        if (select) {
          newSet.add(item.id);
        } else {
          newSet.delete(item.id);
        }
      });
      return newSet;
    });
  };

  const isChapterPartiallySelected = (chapterCode: string): boolean => {
    const chapterItems = groupedItems[chapterCode]?.items || [];
    const selectedCount = chapterItems.filter(item => selectedItems.has(item.id)).length;
    return selectedCount > 0 && selectedCount < chapterItems.length;
  };

  const isChapterFullySelected = (chapterCode: string): boolean => {
    const chapterItems = groupedItems[chapterCode]?.items || [];
    return chapterItems.length > 0 && chapterItems.every(item => selectedItems.has(item.id));
  };

  const labelClasses = "text-sm font-semibold text-foreground mb-2 flex items-center gap-2";
  const sortedChapterCodes = Object.keys(groupedItems).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
              <FileText className="h-6 w-6 text-[#6b7c4c]" />
            </div>
            <div className="flex-1">
              <span className="block text-[#6b7c4c]">
                {language === "ca" ? "Descripció de les obres" : "Descripción de las obras"}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {language === "ca" ? "Estat actual, descripció i zona d'actuació" : "Estado actual, descripción y zona de actuación"}
              </span>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    type="button"
                    className="p-2 rounded-full bg-[#6b7c4c]/10 hover:bg-[#6b7c4c]/20 transition-colors"
                  >
                    <Info className="h-5 w-5 text-[#6b7c4c]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  align="end" 
                  className="max-w-sm p-0 overflow-hidden"
                  sideOffset={8}
                >
                  <div className="bg-gradient-to-br from-[#6b7c4c]/10 to-[#6b7c4c]/5 p-4 space-y-3">
                    <p className="font-semibold text-sm text-[#6b7c4c] flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      {language === "ca" ? "Com utilitzar aquest formulari?" : "¿Cómo usar este formulario?"}
                    </p>
                    
                    <div className="space-y-2.5">
                      {/* Option 1: Manual */}
                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60">
                        <div className="p-1.5 rounded-md bg-blue-500/10 shrink-0">
                          <Pencil className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">
                            {language === "ca" ? "Opció 1: Manual" : "Opción 1: Manual"}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {language === "ca" 
                              ? "Escriu directament el text complet als camps." 
                              : "Escribe directamente el texto completo en los campos."}
                          </p>
                        </div>
                      </div>
                      
                      {/* Option 2: AI */}
                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60">
                        <div className="p-1.5 rounded-md bg-purple-500/10 shrink-0">
                          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">
                            {language === "ca" ? "Opció 2: Amb IA" : "Opción 2: Con IA"}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {language === "ca" 
                              ? "Escriu les idees principals i prem el botó IA per generar el text." 
                              : "Escribe las ideas principales y pulsa el botón IA para generar el texto."}
                          </p>
                        </div>
                      </div>
                      
                      {/* Reminder */}
                      <div className="flex items-start gap-2 pt-1 border-t border-[#6b7c4c]/10">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#6b7c4c] shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                          {language === "ca" 
                            ? "El text final és sempre responsabilitat del tècnic sotasignant." 
                            : "El texto final es siempre responsabilidad del técnico firmante."}
                        </p>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "ca" ? "Modal per descriure les obres del projecte" : "Modal para describir las obras del proyecto"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
            <p className="text-base text-muted-foreground">
              {language === "ca" ? "Carregant dades..." : "Cargando datos..."}
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="p-8 space-y-6">
              {/* Estat actual */}
              <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className={labelClasses}>
                    <Building className="h-4 w-4 text-[#6b7c4c]" />
                    {language === "ca" ? "Estat actual" : "Estado actual"}
                  </Label>
                  <div className="flex gap-2">
                    {hasMarkdownBold(worksData.current_state) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePreview('current_state')}
                        className="text-xs"
                      >
                        {previewMode.current_state ? (
                          <><EyeOff className="h-3 w-3 mr-1" /> {language === "ca" ? "Editar" : "Editar"}</>
                        ) : (
                          <><Eye className="h-3 w-3 mr-1" /> {language === "ca" ? "Previsualitzar" : "Previsualizar"}</>
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateAI('current_state')}
                      disabled={generatingAI !== null || !worksData.current_state.trim()}
                      className="text-xs border-[#6b7c4c]/30 hover:bg-[#6b7c4c]/10 hover:border-[#6b7c4c]"
                    >
                      {generatingAI === 'current_state' ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      {language === "ca" ? "Redactar amb IA" : "Redactar con IA"}
                    </Button>
                  </div>
                </div>
                {previewMode.current_state ? (
                  <div className="min-h-[120px] p-3 bg-muted/50 rounded-md border text-base leading-relaxed">
                    <FormattedTextPreview text={worksData.current_state} />
                  </div>
                ) : (
                  <Textarea
                    value={worksData.current_state}
                    onChange={(e) => setWorksData({ ...worksData, current_state: e.target.value })}
                    placeholder={language === "ca" ? "Escriu les teves idees o notes sobre l'estat actual... Després prem 'Redactar amb IA' per obtenir un text professional." : "Escribe tus ideas o notas sobre el estado actual... Después pulsa 'Redactar con IA' para obtener un texto profesional."}
                    rows={5}
                    className="resize-none text-base"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  💡 {language === "ca" ? `Escriu les teves notes i prem el botó IA per generar un text professional (${config.creditsPerAiMemory} crèdit)` : `Escribe tus notas y pulsa el botón IA para generar un texto profesional (${config.creditsPerAiMemory} crédito)`}
                </p>
              </div>

              {/* Selector de partides */}
              {sortedChapterCodes.length > 0 && (
                <div className="bg-card border-2 border-blue-500/20 rounded-xl p-6">
                  <Label className={labelClasses}>
                    <ListChecks className="h-4 w-4 text-blue-500" />
                    {language === "ca" ? "Selecciona les partides per incloure a la descripció" : "Selecciona las partidas para incluir en la descripción"}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-4">
                    {language === "ca" ? "Selecciona les partides del pressupost que vols incloure. El text es generarà automàticament." : "Selecciona las partidas del presupuesto que quieres incluir. El texto se generará automáticamente."}
                  </p>
                  
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {sortedChapterCodes.map(chapterCode => {
                      const chapter = groupedItems[chapterCode];
                      const isExpanded = expandedChapters.has(chapterCode);
                      const isFullySelected = isChapterFullySelected(chapterCode);
                      const isPartiallySelected = isChapterPartiallySelected(chapterCode);

                      return (
                        <Collapsible
                          key={chapterCode}
                          open={isExpanded}
                          onOpenChange={() => toggleChapter(chapterCode)}
                        >
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            <Checkbox
                              checked={isFullySelected}
                              ref={(el) => {
                                if (el) {
                                  (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isPartiallySelected;
                                }
                              }}
                              onCheckedChange={(checked) => {
                                toggleAllChapterItems(chapterCode, checked === true);
                              }}
                              className="border-[#6b7c4c] data-[state=checked]:bg-[#6b7c4c]"
                            />
                            <CollapsibleTrigger asChild>
                              <button className="flex-1 flex items-center gap-2 text-left text-sm font-medium">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-mono text-[#6b7c4c]">{chapterCode}</span>
                                <span className="truncate">{chapter.chapterName}</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  ({chapter.items.filter(i => selectedItems.has(i.id)).length}/{chapter.items.length})
                                </span>
                              </button>
                            </CollapsibleTrigger>
                          </div>
                          
                          <CollapsibleContent>
                            <div className="ml-6 mt-1 space-y-1 border-l-2 border-[#6b7c4c]/20 pl-4">
                              {chapter.items.map(item => {
                                const itemName = item.custom_name || item.type_name;
                                const translatedName = item.full_code ? getTranslatedName(item.full_code, itemName) : itemName;
                                
                                return (
                                  <label
                                    key={item.id}
                                    className="flex items-start gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer text-sm"
                                  >
                                    <Checkbox
                                      checked={selectedItems.has(item.id)}
                                      onCheckedChange={() => toggleItemSelection(item.id)}
                                      className="mt-0.5 border-[#6b7c4c] data-[state=checked]:bg-[#6b7c4c]"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <span className="font-mono text-xs text-muted-foreground mr-2">
                                        {item.full_code}
                                      </span>
                                      <span className="text-foreground">{translatedName}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Descripció de les obres a realitzar */}
              <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className={labelClasses}>
                    <Hammer className="h-4 w-4 text-[#6b7c4c]" />
                    {language === "ca" ? "Descripció de les obres a realitzar" : "Descripción de las obras a realizar"}
                  </Label>
                <div className="flex gap-2">
                    {hasMarkdownBold(worksData.works_description) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePreview('works_description')}
                        className="text-xs"
                      >
                        {previewMode.works_description ? (
                          <><EyeOff className="h-3 w-3 mr-1" /> {language === "ca" ? "Editar" : "Editar"}</>
                        ) : (
                          <><Eye className="h-3 w-3 mr-1" /> {language === "ca" ? "Previsualitzar" : "Previsualizar"}</>
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => handleGenerateAI('works_description')}
                      disabled={generatingAI !== null || selectedItems.size === 0}
                      className="text-xs bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
                    >
                      {generatingAI === 'works_description' ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      {language === "ca" ? "Generar descripció tècnica" : "Generar descripción técnica"}
                    </Button>
                  </div>
                </div>
                {previewMode.works_description ? (
                  <div className="min-h-[288px] p-3 bg-muted/50 rounded-md border text-base leading-relaxed overflow-auto max-h-[400px]">
                    <FormattedTextPreview text={worksData.works_description} />
                  </div>
                ) : (
                  <Textarea
                    value={worksData.works_description}
                    onChange={(e) => setWorksData({ ...worksData, works_description: e.target.value })}
                    placeholder={language === "ca" ? "Selecciona partides a dalt i prem 'Generar descripció tècnica' per crear un text professional de procés constructiu..." : "Selecciona partidas arriba y pulsa 'Generar descripción técnica' para crear un texto profesional de proceso constructivo..."}
                    rows={12}
                    className="resize-none text-base"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  💡 {language === "ca" ? `Selecciona les partides i genera automàticament una descripció tècnica del procés constructiu (${config.creditsPerAiMemory} crèdit)` : `Selecciona las partidas y genera automáticamente una descripción técnica del proceso constructivo (${config.creditsPerAiMemory} crédito)`}
                </p>
              </div>

              {/* Zona on s'actua */}
              <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className={labelClasses}>
                    <MapPinned className="h-4 w-4 text-[#6b7c4c]" />
                    {language === "ca" ? "Zona on s'actua" : "Zona donde se actúa"}
                  </Label>
                  <div className="flex gap-2">
                    {hasMarkdownBold(worksData.action_zone) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePreview('action_zone')}
                        className="text-xs"
                      >
                        {previewMode.action_zone ? (
                          <><EyeOff className="h-3 w-3 mr-1" /> {language === "ca" ? "Editar" : "Editar"}</>
                        ) : (
                          <><Eye className="h-3 w-3 mr-1" /> {language === "ca" ? "Previsualitzar" : "Previsualizar"}</>
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateAI('action_zone')}
                      disabled={generatingAI !== null || !worksData.action_zone.trim()}
                      className="text-xs border-[#6b7c4c]/30 hover:bg-[#6b7c4c]/10 hover:border-[#6b7c4c]"
                    >
                      {generatingAI === 'action_zone' ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      {language === "ca" ? "Redactar amb IA" : "Redactar con IA"}
                    </Button>
                  </div>
                </div>
                {previewMode.action_zone ? (
                  <div className="min-h-[96px] p-3 bg-muted/50 rounded-md border text-base leading-relaxed">
                    <FormattedTextPreview text={worksData.action_zone} />
                  </div>
                ) : (
                  <Textarea
                    value={worksData.action_zone}
                    onChange={(e) => setWorksData({ ...worksData, action_zone: e.target.value })}
                    placeholder={language === "ca" ? "Escriu les teves idees sobre la zona d'actuació..." : "Escribe tus ideas sobre la zona de actuación..."}
                    rows={4}
                    className="resize-none text-base"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  💡 {language === "ca" ? `Escriu les teves notes i prem el botó IA per generar un text professional (${config.creditsPerAiMemory} crèdit)` : `Escribe tus notas y pulsa el botón IA para generar un texto profesional (${config.creditsPerAiMemory} crédito)`}
                </p>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* Footer amb 3 botons */}
        <div className="px-8 py-4 border-t bg-muted/30 flex justify-between">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            {language === "ca" ? "Cancel·lar" : "Cancelar"}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || loading}
              className="border-[#6b7c4c]/30 text-[#6b7c4c] hover:bg-[#6b7c4c]/10 hover:border-[#6b7c4c]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {language === "ca" ? "Guardar" : "Guardar"}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || loading}
              className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              {language === "ca" ? "Guardar i sortir" : "Guardar y salir"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Modal de confirmació de crèdits */}
      <CreditConfirmationModal
        open={showCreditConfirmation}
        onOpenChange={setShowCreditConfirmation}
        actionType="ai_works_description"
        creditCost={config.creditsPerAiMemory}
        currentCredits={credits}
        onConfirm={() => {
          if (pendingAIField) {
            executeAIGeneration(pendingAIField);
          }
          setPendingAIField(null);
        }}
        onCancel={() => setPendingAIField(null)}
      />

      {/* Modal de crèdits insuficients */}
      <InsufficientCreditsModal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        requiredCredits={config.creditsPerAiMemory}
        currentCredits={credits}
        userId={userId || ""}
        onPurchaseSuccess={() => {
          refreshCredits();
          setShowPurchaseModal(false);
        }}
      />
    </Dialog>
  );
};

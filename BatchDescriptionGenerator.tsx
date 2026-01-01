import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, CheckSquare, Square, Info, Layers, Coins } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserCredits } from "@/hooks/useUserCredits";
import { CreditConfirmationModal, getCreditConfirmationDisabled } from "@/components/credits/CreditConfirmationModal";
import { useLanguage } from "@/contexts/LanguageContext";

interface PartidaForBatch {
  id: string;
  code: string;
  name: string;
  measured_value: number;
  unit: string;
  ifc_category: string;
  description: string | null;
  custom_name: string | null;
  type_name: string;
}

interface BatchTemplate {
  id: string;
  subsubchapter_code: string;
  template_text: string;
  description: string | null;
  is_active: boolean;
}

interface BatchDescriptionGeneratorProps {
  subsubchapterCode: string;
  partides: PartidaForBatch[];
  isLocked: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onDescriptionsGenerated: (updates: { id: string; description: string }[]) => void;
  onTemplateStatusChange?: (hasTemplate: boolean) => void;
}

export const BatchDescriptionGenerator = ({
  subsubchapterCode,
  partides,
  isLocked,
  selectedIds,
  onSelectionChange,
  onDescriptionsGenerated,
  onTemplateStatusChange
}: BatchDescriptionGeneratorProps) => {
  const [template, setTemplate] = useState<BatchTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  
  const { credits, shouldSkipCredits, config } = useUserCredits();
  const { language } = useLanguage();

  // Carregar la plantilla per aquest sub-subcapítol
  useEffect(() => {
    const loadTemplate = async () => {
      const { data, error } = await supabase
        .from("batch_description_templates")
        .select("*")
        .eq("subsubchapter_code", subsubchapterCode)
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) {
        setTemplate(data);
        onTemplateStatusChange?.(true);
      } else {
        setTemplate(null);
        onTemplateStatusChange?.(false);
      }
    };

    if (subsubchapterCode) {
      loadTemplate();
    }
  }, [subsubchapterCode, onTemplateStatusChange]);

  // Si no hi ha plantilla configurada, no mostrar res
  if (!template || isLocked) {
    return null;
  }

  const selectAll = () => {
    onSelectionChange(new Set(partides.map(p => p.id)));
  };

  const deselectAll = () => {
    onSelectionChange(new Set());
  };

  const creditCostPerItem = config.creditsPerAiDescription;
  const totalCreditCost = creditCostPerItem * selectedIds.size;

  const handleGenerateClick = () => {
    if (selectedIds.size < 2) {
      toast.error("Selecciona almenys 2 partides per a generació conjunta");
      return;
    }
    
    if (shouldSkipCredits || getCreditConfirmationDisabled("ai_budget_description")) {
      executeGeneration();
    } else {
      setShowCreditConfirmation(true);
    }
  };

  const executeGeneration = async () => {
    if (selectedIds.size === 0 || !template) return;
    
    setGenerating(true);
    
    try {
      const selectedPartides = partides.filter(p => selectedIds.has(p.id));
      
      // IMPORTANT: Incloure la descripció existent perquè la IA la pugui llegir
      const partidesData = selectedPartides.map(p => ({
        id: p.id,
        code: p.code,
        name: p.custom_name || p.type_name,
        measured_value: p.measured_value,
        unit: p.unit,
        ifc_category: p.ifc_category,
        description: p.description, // Descripció curta existent
        custom_name: p.custom_name,
        type_name: p.type_name,
      }));
      
      console.log("[BatchDescriptionGenerator] Enviant partides:", partidesData);

      const { data, error } = await supabase.functions.invoke("generate-batch-description", {
        body: {
          template_text: template.template_text,
          partides: partidesData,
          subsubchapter_code: subsubchapterCode,
          language
        }
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast.error(language === "ca" ? "Límit de peticions excedit. Torna-ho a provar en uns segons." : "Límite de peticiones excedido. Inténtalo de nuevo en unos segundos.");
        } else if (error.message?.includes("402")) {
          toast.error(language === "ca" ? "Crèdits insuficients. Afegeix crèdits al teu espai de treball." : "Créditos insuficientes. Añade créditos a tu espacio de trabajo.");
        } else {
          throw error;
        }
        return;
      }

      console.log("[BatchDescriptionGenerator] Resposta de la IA:", data);

      if (data?.descriptions && Array.isArray(data.descriptions)) {
        console.log("[BatchDescriptionGenerator] Actualitzant descripcions llargues:", data.descriptions);
        
        // Actualitzar les descripcions LLARGUES a la base de dades
        for (const item of data.descriptions) {
          console.log(`[BatchDescriptionGenerator] Guardant descripció per partida ${item.partida_id}:`, item.description?.substring(0, 100));
          
          const { error: updateError } = await supabase
            .from("element_type_configs")
            .update({ description: item.description })
            .eq("id", item.partida_id);
            
          if (updateError) {
            console.error(`[BatchDescriptionGenerator] Error actualitzant ${item.partida_id}:`, updateError);
          }
        }

        onDescriptionsGenerated(data.descriptions.map((d: any) => ({
          id: d.partida_id,
          description: d.description
        })));

        toast.success(language === "ca" ? `Generades ${data.descriptions.length} descripcions tècniques` : `Generadas ${data.descriptions.length} descripciones técnicas`);
        onSelectionChange(new Set());
      } else {
        console.error("[BatchDescriptionGenerator] Resposta sense descripcions:", data);
        toast.error(language === "ca" ? "La IA no ha retornat descripcions vàlides" : "La IA no ha devuelto descripciones válidas");
      }
    } catch (err: any) {
      console.error("Error generating batch descriptions:", err);
      toast.error(err.message || (language === "ca" ? "Error generant les descripcions" : "Error generando las descripciones"));
    } finally {
      setGenerating(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <>
      <div className="mb-3 p-3 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Generació conjunta IA
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-emerald-600/70 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">
                    Selecciona partides per generar descripcions amb estructura idèntica. 
                    Només canviaran els paràmetres específics de cada partida.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {template.description && (
              <Badge variant="outline" className="text-xs">
                {template.description}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mostrar cost per crèdit */}
            {!shouldSkipCredits && selectedCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md">
                <Coins className="h-3 w-3" />
                <span>{totalCreditCost.toFixed(1)} crèdits</span>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={selectedCount === partides.length ? deselectAll : selectAll}
              className="h-7 text-xs"
            >
              {selectedCount === partides.length ? (
                <>
                  <Square className="h-3 w-3 mr-1" />
                  Deseleccionar
                </>
              ) : (
                <>
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Seleccionar tot
                </>
              )}
            </Button>
            
            <Button
              size="sm"
              onClick={handleGenerateClick}
              disabled={generating || selectedCount < 2}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generant...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generar ({selectedCount})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de confirmació de crèdits */}
      <CreditConfirmationModal
        open={showCreditConfirmation}
        onOpenChange={setShowCreditConfirmation}
        onConfirm={executeGeneration}
        creditCost={totalCreditCost}
        actionType="ai_budget_description"
        currentCredits={credits}
      />
    </>
  );
};

// Exportar el cost per ítem per usar-lo en altres components
export const useBatchCreditCost = () => {
  const { config } = useUserCredits();
  return config.creditsPerAiDescription;
};

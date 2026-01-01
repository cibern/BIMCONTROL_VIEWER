import { useState, useEffect, useMemo } from "react";
import { 
  NestedDialog, 
  NestedDialogContent, 
  NestedDialogHeader, 
  NestedDialogTitle, 
  NestedDialogDescription, 
  NestedDialogFooter 
} from "@/components/ui/nested-dialog";
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
import { calculateMeasuredValueForType } from "@/lib/ifcMeasurements";

interface EditTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string; // Now represents projectId
  ifcCategory: string;
  typeName: string;
  onSave: () => void;
  viewer: Viewer | null;
}

export const EditTypeModal = ({ 
  open, 
  onOpenChange, 
  centerId, 
  ifcCategory, 
  typeName,
  onSave,
  viewer
}: EditTypeModalProps) => {
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

  // Filter chapters that are not hidden
  const visibleChapters = useMemo(() => {
    return BUDGET_CHAPTERS.filter(chapter => !isHidden(chapter.code));
  }, [isHidden]);

  console.log("[EditTypeModal] Component mounted/updated");
  console.log("[EditTypeModal] Props:", { open, centerId, ifcCategory, typeName });

  useEffect(() => {
    if (open && centerId && ifcCategory && typeName) {
      loadExistingConfig();
    }
  }, [open, centerId, ifcCategory, typeName]);

  const loadExistingConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("element_type_configs")
        .select("*")
        .or(`project_id.eq.${centerId},center_id.eq.${centerId}`)
        .eq("ifc_category", ifcCategory)
        .eq("type_name", typeName)
        .maybeSingle();

      if (error) {
        console.error("Error loading config:", error);
        return;
      }

      if (data) {
        setExistingConfig(data);
        setCustomName(data.custom_name || "");
        setDescription(data.description || "");
        setPreferredUnit((data.preferred_unit as "UT" | "ML" | "M2" | "M3" | "KG") || "UT");
        setChapterId(data.chapter_id || "");
        setSubchapterId(data.subchapter_id || "");
        setSubsubchapterId(data.subsubchapter_id || "");
      } else {
        // Reset to defaults if no config exists
        setExistingConfig(null);
        setCustomName("");
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

      // Calcular el measured_value si no és manual - passar la unitat preferida
      const measured_value = calculateMeasuredValueForType(viewer, ifcCategory, typeName, preferredUnit);
      console.log(`[EditTypeModal] Calculated measured_value for ${typeName} (unit: ${preferredUnit}): ${measured_value}`);

      // Calcular el full_code basant-nos en els IDs seleccionats
      let full_code: string | null = null;
      if (subsubchapterId) {
        // El subsubchapterId ja és el codi complet (e.g., "30.10.10")
        full_code = subsubchapterId;
        console.log("[EditTypeModal] full_code calculat:", full_code);
      } else if (subchapterId) {
        // Si només tenim subchapter, usar-lo com a full_code
        full_code = subchapterId;
        console.log("[EditTypeModal] full_code des de subchapter:", full_code);
      } else if (chapterId) {
        // Si només tenim chapter, usar-lo com a full_code
        full_code = chapterId;
        console.log("[EditTypeModal] full_code des de chapter:", full_code);
      }

      // Calcular display_order si s'ha seleccionat subsubchapter
      let display_order = 1;
      if (subsubchapterId) {
        // Comptar quants elements ja existeixen amb aquesta combinació
        const { count, error: countError } = await supabase
          .from("element_type_configs")
          .select("*", { count: 'exact', head: true })
          .or(`project_id.eq.${centerId},center_id.eq.${centerId}`)
          .eq("chapter_id", chapterId)
          .eq("subchapter_id", subchapterId)
          .eq("subsubchapter_id", subsubchapterId)
          .neq("id", existingConfig?.id || ""); // Excloure l'element actual si s'està editant

        if (countError) throw countError;
        display_order = (count || 0) + 1;
      }

      const configData = {
        project_id: centerId, // Using projectId
        user_id: user.id,
        ifc_category: ifcCategory,
        type_name: typeName,
        custom_name: customName || null,
        description: description || null,
        preferred_unit: preferredUnit,
        chapter_id: chapterId || null,
        subchapter_id: subchapterId || null,
        subsubchapter_id: subsubchapterId || null,
        full_code: full_code,
        measured_value: measured_value,
        display_order: display_order,
      };

      console.log("[EditTypeModal] Saving config with full_code:", configData);

      if (existingConfig) {
        // Update existing config
        const { error } = await supabase
          .from("element_type_configs")
          .update(configData)
          .eq("id", existingConfig.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from("element_type_configs")
          .insert([configData]);

        if (error) throw error;
      }

      toast.success(language === 'ca' ? "Configuració guardada correctament" : "Configuración guardada correctamente");
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(language === 'ca' ? "Error al guardar la configuració" : "Error al guardar la configuración");
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
      subsubchapter: "Subsubcapítol",
      subsubchapterPlaceholder: "Selecciona un subsubcapítol",
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
      subsubchapter: "Subsubcapítulo",
      subsubchapterPlaceholder: "Selecciona un subsubcapítulo",
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
    if (!subchapterId) return [];
    const chapter = visibleChapters.find(c => `${c.code}` === chapterId);
    const subchapter = chapter?.subchapters.find(s => s.code === subchapterId);
    // Filter out hidden subsubchapters
    return (subchapter?.subsubchapters || []).filter(subsub => !isHidden(subsub.code));
  };

  const t = labels[language];

  console.log("[EditTypeModal] Render - open:", open, "centerId:", centerId, "ifcCategory:", ifcCategory, "typeName:", typeName);

  return (
    <NestedDialog open={open} onOpenChange={onOpenChange}>
      <NestedDialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <NestedDialogHeader>
          <NestedDialogTitle>{t.title}</NestedDialogTitle>
          <NestedDialogDescription>
            {ifcCategory} - {typeName}
          </NestedDialogDescription>
        </NestedDialogHeader>

        <div className="space-y-4 py-4">
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
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredUnit">{t.preferredUnit}</Label>
            <Select value={preferredUnit} onValueChange={(value) => setPreferredUnit(value as "UT" | "ML" | "M2" | "M3" | "KG")}>
              <SelectTrigger id="preferredUnit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[102]">
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
                  setSubchapterId(""); // Reset subchapter when chapter changes
                }}
              >
                <SelectTrigger id="chapter" className="flex-1">
                  <SelectValue placeholder={t.chapterPlaceholder} />
                </SelectTrigger>
                <SelectContent className="z-[102]">
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
                  setSubsubchapterId(""); // Reset subsubchapter when subchapter changes
                }}
                disabled={!chapterId}
              >
                <SelectTrigger id="subchapter" className="flex-1">
                  <SelectValue placeholder={t.subchapterPlaceholder} />
                </SelectTrigger>
                <SelectContent className="z-[102]">
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
                <SelectContent className="z-[102]">
                  {getFilteredSubsubchapters().map((subsubchapter) => (
                    <SelectItem key={subsubchapter.code} value={subsubchapter.code}>
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

        <NestedDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t.cancel}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (language === 'ca' ? 'Guardant...' : 'Guardando...') : t.save}
          </Button>
        </NestedDialogFooter>
      </NestedDialogContent>
    </NestedDialog>
  );
};
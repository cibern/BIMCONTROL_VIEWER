import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, FileText, Shield, Hammer, Users, Clock, Euro, AlertTriangle, CheckCircle, RotateCcw, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSpecificationsStructure, SPECIFICATIONS_UI_TRANSLATIONS } from "@/data/specificationsTranslations";

interface SpecificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}

export interface SpecificationSection {
  id: string;
  title: string;
  content: string;
}

export interface SpecificationChapter {
  id: string;
  code: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: SpecificationSection[];
}

// Icones per capítol
const CHAPTER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: FileText,
  technical: Hammer,
  economic: Euro,
  legal: Shield,
  planning: Clock,
  safety: AlertTriangle,
  environmental: CheckCircle,
  parties: Users,
};

// Funció per obtenir l'estructura amb icones segons l'idioma
const getSpecificationsWithIcons = (language: 'ca' | 'es'): SpecificationChapter[] => {
  const structure = getSpecificationsStructure(language);
  return structure.map(chapter => ({
    ...chapter,
    icon: CHAPTER_ICONS[chapter.id] || FileText,
    sections: chapter.sections.map(section => ({ ...section }))
  }));
};

// Export per compatibilitat amb altres components (usa català per defecte)
export const SPECIFICATIONS_STRUCTURE: SpecificationChapter[] = getSpecificationsWithIcons('ca');

// Funció per obtenir el contingut estàndard d'una secció
const getDefaultContent = (chapterId: string, sectionId: string, language: 'ca' | 'es' = 'ca'): string => {
  const structure = getSpecificationsWithIcons(language);
  const chapter = structure.find(c => c.id === chapterId);
  if (!chapter) return "";
  const section = chapter.sections.find(s => s.id === sectionId);
  return section?.content || "";
};

export const SpecificationsModal = ({ open, onOpenChange, projectId }: SpecificationsModalProps) => {
  const { language } = useLanguage();
  const currentLang = language === 'es' ? 'es' : 'ca';
  const t = SPECIFICATIONS_UI_TRANSLATIONS[currentLang];
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [chapters, setChapters] = useState<SpecificationChapter[]>(() => getSpecificationsWithIcons(currentLang));
  const [modifiedSections, setModifiedSections] = useState<Record<string, Record<string, boolean>>>({});

  // Actualitzar capítols quan canvia l'idioma o s'obre el modal
  useEffect(() => {
    if (open && projectId) {
      loadSpecifications();
    } else if (!open) {
      // Reset loading state when modal closes
      setLoading(true);
    }
  }, [open, projectId, currentLang]);

  const loadSpecifications = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      // Primer, inicialitzar amb el contingut estàndard segons l'idioma
      const defaultStructure = getSpecificationsWithIcons(currentLang);
      setChapters(defaultStructure.map(chapter => ({
        ...chapter,
        sections: chapter.sections.map(section => ({ ...section }))
      })));
      
      const { data, error } = await supabase
        .from("project_specifications" as any)
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading specifications:", error);
        return;
      }

      if (data) {
        const record = data as { specifications_data?: Record<string, Record<string, string>> };
        if (record.specifications_data) {
          const savedData = record.specifications_data;

          // Si l'usuari està en ES però la fila antiga es va guardar amb defaults en català,
          // ignorem el guardat i mostrem els defaults en ES.
          const isLegacyCatalanDefaults =
            currentLang === "es" &&
            getSpecificationsStructure("ca").every((ch: any) =>
              (ch.sections || []).every((s: any) => savedData?.[ch.id]?.[s.id] === s.content)
            );

          if (isLegacyCatalanDefaults) {
            setModifiedSections({});
            return;
          }

          const modified: Record<string, Record<string, boolean>> = {};

          // Aplicar les dades guardades sobre el contingut estàndard
          setChapters(
            defaultStructure.map((chapter) => {
              modified[chapter.id] = {};
              return {
                ...chapter,
                sections: chapter.sections.map((section) => {
                  const savedContent = savedData[chapter.id]?.[section.id];
                  const defaultContent = section.content;
                  // Si hi ha contingut guardat i és diferent del per defecte, marcar com a modificat
                  if (savedContent !== undefined && savedContent !== defaultContent) {
                    modified[chapter.id][section.id] = true;
                    return { ...section, content: savedContent };
                  }
                  return { ...section };
                }),
              };
            })
          );

          setModifiedSections(modified);
        }
      }
    } catch (error) {
      console.error("Error loading specifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (chapterId: string, sectionId: string, content: string) => {
    setChapters(prev => prev.map(chapter => 
      chapter.id === chapterId 
        ? {
            ...chapter,
            sections: chapter.sections.map(section =>
              section.id === sectionId ? { ...section, content } : section
            )
          }
        : chapter
    ));
    
    // Marcar com a modificat si és diferent del contingut original
    const defaultContent = getDefaultContent(chapterId, sectionId, currentLang);
    setModifiedSections(prev => ({
      ...prev,
      [chapterId]: {
        ...prev[chapterId],
        [sectionId]: content !== defaultContent
      }
    }));
  };

  const handleResetSection = (chapterId: string, sectionId: string) => {
    const defaultContent = getDefaultContent(chapterId, sectionId, currentLang);
    handleSectionChange(chapterId, sectionId, defaultContent);
  };

  const handleResetChapter = (chapterId: string) => {
    const defaultStructure = getSpecificationsWithIcons(currentLang);
    const chapter = defaultStructure.find(c => c.id === chapterId);
    if (!chapter) return;
    
    setChapters(prev => prev.map(ch => 
      ch.id === chapterId 
        ? {
            ...ch,
            sections: chapter.sections.map(s => ({ ...s }))
          }
        : ch
    ));
    
    setModifiedSections(prev => ({
      ...prev,
      [chapterId]: {}
    }));
  };

  const isSectionModified = (chapterId: string, sectionId: string): boolean => {
    return modifiedSections[chapterId]?.[sectionId] || false;
  };

  const isChapterModified = (chapterId: string): boolean => {
    const chapterMods = modifiedSections[chapterId];
    if (!chapterMods) return false;
    return Object.values(chapterMods).some(v => v);
  };

  const handleSave = async () => {
    if (!projectId) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // Convertir a format per guardar
      const specificationsData: Record<string, Record<string, string>> = {};
      chapters.forEach(chapter => {
        specificationsData[chapter.id] = {};
        chapter.sections.forEach(section => {
          specificationsData[chapter.id][section.id] = section.content;
        });
      });

      const { error } = await supabase
        .from("project_specifications" as any)
        .upsert({
          project_id: projectId,
          specifications_data: specificationsData,
          updated_at: new Date().toISOString(),
          created_by: user.id
        }, {
          onConflict: "project_id"
        });

      if (error) throw error;

      toast.success(t.savedSuccess);
    } catch (error) {
      console.error("Error saving specifications:", error);
      toast.error(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const activeChapter = chapters.find(c => c.id === activeTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Tabs laterals */}
            <div className="w-64 border-r bg-muted/30">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-1">
                  {chapters.map((chapter) => {
                    const Icon = chapter.icon;
                    const isActive = activeTab === chapter.id;
                    const hasModifications = isChapterModified(chapter.id);
                    
                    return (
                      <button
                        key={chapter.id}
                        onClick={() => setActiveTab(chapter.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? "" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {chapter.code}
                            </span>
                            {hasModifications && (
                              <Pencil className={`h-3 w-3 ${isActive ? "text-primary-foreground/70" : "text-amber-500"}`} />
                            )}
                          </div>
                          <span className="text-sm font-medium truncate block">
                            {chapter.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Contingut */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {activeChapter && (
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <activeChapter.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{activeChapter.code}. {activeChapter.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {activeChapter.sections.length} {t.sections}
                              {isChapterModified(activeChapter.id) && (
                                <span className="ml-2 text-amber-500">• {t.modified}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {isChapterModified(activeChapter.id) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleResetChapter(activeChapter.id)}
                                  className="text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  {t.resetChapter}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t.resetChapterTooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      <div className="space-y-6">
                        {activeChapter.sections.map((section, index) => {
                          const isModified = isSectionModified(activeChapter.id, section.id);
                          return (
                            <Card key={section.id} className={isModified ? "border-amber-300" : ""}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                      {activeChapter.code}.{index + 1}
                                    </span>
                                    {section.title}
                                    {isModified && (
                                      <span className="text-xs text-amber-500 flex items-center gap-1">
                                        <Pencil className="h-3 w-3" />
                                        {t.modified}
                                      </span>
                                    )}
                                  </CardTitle>
                                  {isModified && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => handleResetSection(activeChapter.id, section.id)}
                                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                          >
                                            <RotateCcw className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{t.resetSectionTooltip}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent>
                                <Textarea
                                  value={section.content}
                                  onChange={(e) => handleSectionChange(activeChapter.id, section.id, e.target.value)}
                                  placeholder={`${t.writePlaceholder} "${section.title}"...`}
                                  className="min-h-[200px] resize-y font-mono text-sm"
                                />
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="border-t p-4 bg-background flex justify-end gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t.cancel}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.saving}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {t.save}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

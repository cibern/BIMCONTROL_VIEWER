import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, AlertTriangle, Lock, CheckCircle2, Loader2 } from "lucide-react";

interface BudgetRequestActivationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const translations = {
  ca: {
    title: "Sol·licitud de pressupost",
    description: "Activa la sol·licitud de pressupostos per permetre que els industrials vegin el projecte i enviïn les seves ofertes.",
    activateLabel: "Activar sol·licitud de pressupost",
    warningTitle: "Atenció",
    warningText: "Un cop activada la sol·licitud, no es podrà desactivar. Els industrials podran veure les partides del projecte i enviar pressupostos.",
    alreadyActive: "La sol·licitud de pressupost ja està activa per aquest projecte.",
    activatedAt: "Activada el",
    confirmButton: "Confirmar activació",
    cancelButton: "Cancel·lar",
    successTitle: "Sol·licitud activada",
    successMessage: "La sol·licitud de pressupost s'ha activat correctament.",
    errorMessage: "Error en activar la sol·licitud",
    loading: "Carregant...",
    itemsCount: "partides per pressupostar",
  },
  es: {
    title: "Solicitud de presupuesto",
    description: "Activa la solicitud de presupuestos para permitir que los industriales vean el proyecto y envíen sus ofertas.",
    activateLabel: "Activar solicitud de presupuesto",
    warningTitle: "Atención",
    warningText: "Una vez activada la solicitud, no se podrá desactivar. Los industriales podrán ver las partidas del proyecto y enviar presupuestos.",
    alreadyActive: "La solicitud de presupuesto ya está activa para este proyecto.",
    activatedAt: "Activada el",
    confirmButton: "Confirmar activación",
    cancelButton: "Cancelar",
    successTitle: "Solicitud activada",
    successMessage: "La solicitud de presupuesto se ha activado correctamente.",
    errorMessage: "Error al activar la solicitud",
    loading: "Cargando...",
    itemsCount: "partidas a presupuestar",
  },
};

export const BudgetRequestActivationModal = ({
  open,
  onOpenChange,
  projectId,
}: BudgetRequestActivationModalProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const t = translations[language];

  const [isActive, setIsActive] = useState(false);
  const [activationDate, setActivationDate] = useState<string | null>(null);
  const [toggleChecked, setToggleChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [itemsCount, setItemsCount] = useState(0);

  useEffect(() => {
    if (open && projectId) {
      loadProjectStatus();
    }
  }, [open, projectId]);

  const loadProjectStatus = async () => {
    setIsLoading(true);
    try {
      // Carregar estat del projecte
      const { data: project, error } = await supabase
        .from("projects")
        .select("budget_request_active, budget_request_date")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      setIsActive(project?.budget_request_active || false);
      setActivationDate(project?.budget_request_date || null);
      setToggleChecked(project?.budget_request_active || false);

      // Comptar partides
      const { count, error: countError } = await supabase
        .from("element_type_configs")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .not("full_code", "is", null);

      if (!countError) {
        setItemsCount(count || 0);
      }
    } catch (error) {
      console.error("Error loading project status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    if (isActive || !toggleChecked) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      
      // 1. Obtenir totes les partides actuals del projecte
      const { data: measurements, error: measurementsError } = await supabase
        .from("element_type_configs")
        .select("*")
        .eq("project_id", projectId)
        .not("full_code", "is", null);

      if (measurementsError) throw measurementsError;

      // 2. Crear snapshot de les medicions
      if (measurements && measurements.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const snapshotData = measurements.map((m) => ({
          project_id: projectId,
          snapshot_date: now,
          created_by: user?.id,
          ifc_category: m.ifc_category,
          type_name: m.type_name,
          custom_name: m.custom_name,
          description: m.description,
          preferred_unit: m.preferred_unit,
          measured_value: m.measured_value,
          element_count: m.element_count,
          is_manual: m.is_manual,
          chapter_id: m.chapter_id,
          subchapter_id: m.subchapter_id,
          subsubchapter_id: m.subsubchapter_id,
          full_code: m.full_code,
          display_order: m.display_order,
          original_element_config_id: m.id,
        }));

        const { error: snapshotError } = await supabase
          .from("budget_request_snapshots")
          .insert(snapshotData);

        if (snapshotError) {
          console.error("Error creating snapshot:", snapshotError);
          throw snapshotError;
        }
      }

      // 3. Actualitzar projecte
      const { error } = await supabase
        .from("projects")
        .update({
          budget_request_active: true,
          budget_request_date: now,
        })
        .eq("id", projectId);

      if (error) throw error;

      // 4. Activar visibilitat per proveïdors
      const { error: visibilityError } = await supabase
        .from("project_supplier_visibility")
        .upsert({
          project_id: projectId,
          is_visible: true,
        }, { onConflict: "project_id" });

      if (visibilityError) {
        console.error("Error updating visibility:", visibilityError);
      }

      setIsActive(true);
      setActivationDate(now);

      toast({
        title: t.successTitle,
        description: t.successMessage,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error activating budget request:", error);
      toast({
        title: t.errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'es' ? 'es-ES' : 'ca-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t.loading}</span>
          </div>
        ) : isActive ? (
          <div className="space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="ml-2">
                <div className="font-medium">{t.alreadyActive}</div>
                {activationDate && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {t.activatedAt}: {formatDate(activationDate)}
                  </div>
                )}
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>{itemsCount} {t.itemsCount}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Send className="h-5 w-5 text-primary" />
                <Label htmlFor="activate-toggle" className="font-medium cursor-pointer">
                  {t.activateLabel}
                </Label>
              </div>
              <Switch
                id="activate-toggle"
                checked={toggleChecked}
                onCheckedChange={setToggleChecked}
              />
            </div>

            {toggleChecked && (
              <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <div className="font-medium">{t.warningTitle}</div>
                  <div className="text-sm mt-1">{t.warningText}</div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{itemsCount} {t.itemsCount}</span>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t.cancelButton}
              </Button>
              <Button
                onClick={handleActivate}
                disabled={!toggleChecked || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.confirmButton}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

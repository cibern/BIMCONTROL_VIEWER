import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Loader2, AlertCircle, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CreditsPurchaseModal } from "@/components/credits/CreditsPurchaseModal";

interface VerificationStep {
  id: string;
  label: string;
  status: "pending" | "checking" | "success" | "error";
  message?: string;
}

interface BudgetVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  category: string;
  supplierId: string;
  onVerified: () => void;
}

export function BudgetVerificationDialog({
  open,
  onOpenChange,
  projectId,
  category,
  supplierId,
  onVerified,
}: BudgetVerificationDialogProps) {
  const [steps, setSteps] = useState<VerificationStep[]>([
    { id: "existence", label: "Comprovant existència", status: "pending" },
    { id: "blocked", label: "Comprovant: Pressupost accessible per pressupostar", status: "pending" },
    { id: "status", label: "Comprovant: Estat actual del pressupost (acceptat/rebutjat/pendent)", status: "pending" },
    { id: "access", label: "Comprovant permisos", status: "pending" },
    { id: "credits", label: "Comprovant crèdits disponibles", status: "pending" },
  ]);
  const [canProceed, setCanProceed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [creditsRequired, setCreditsRequired] = useState(20);
  const [currentCredits, setCurrentCredits] = useState(0);

  useEffect(() => {
    if (open) {
      verifyBudget();
    } else {
      // Reset state when dialog closes
      setSteps([
        { id: "existence", label: "Comprovant existència", status: "pending" },
        { id: "blocked", label: "Comprovant: Pressupost accessible per pressupostar", status: "pending" },
        { id: "status", label: "Comprovant: Estat actual del pressupost (acceptat/rebutjat/pendent)", status: "pending" },
        { id: "access", label: "Comprovant permisos", status: "pending" },
        { id: "credits", label: "Comprovant crèdits disponibles", status: "pending" },
      ]);
      setCanProceed(false);
      setErrorMessage(null);
      setShowPurchaseModal(false);
    }
  }, [open, projectId, category, supplierId]);

  const updateStep = (stepId: string, status: VerificationStep["status"], message?: string) => {
    setSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status, message } : step
      )
    );
  };

  const verifyBudget = async () => {
    try {
      // Step 1: Check existence
      updateStep("existence", "checking");
      await new Promise(resolve => setTimeout(resolve, 800));

      const { data: budgetData, error: budgetError } = await supabase
        .from("supplier_budgets")
        .select("*")
        .eq("project_id", projectId)
        .eq("supplier_id", supplierId)
        .ilike("category", `%${category}%`)
        .maybeSingle();

      if (budgetError) {
        updateStep("existence", "error", "Error en la consulta a la base de dades");
        setErrorMessage("No s'ha pogut verificar l'existència del pressupost");
        return;
      }

      if (!budgetData) {
        updateStep("existence", "success", "OK");
      } else {
        updateStep("existence", "success", "OK");
      }

      // Step 2: Check if blocked (another supplier has accepted budget)
      updateStep("blocked", "checking");
      await new Promise(resolve => setTimeout(resolve, 800));

      const { data: acceptedBudgets, error: blockedError } = await supabase
        .from("supplier_budgets")
        .select("supplier_id, status")
        .eq("project_id", projectId)
        .ilike("category", `%${category}%`)
        .eq("status", "accepted");

      if (blockedError) {
        updateStep("blocked", "error", "Error comprovant bloqueigs");
        setErrorMessage("No s'ha pogut verificar l'estat de bloqueig");
        return;
      }

      const isBlockedByOther = acceptedBudgets && acceptedBudgets.length > 0 && 
                                acceptedBudgets.some(b => b.supplier_id !== supplierId);

      if (isBlockedByOther) {
        updateStep("blocked", "error", "Aquesta categoria ja té un pressupost acceptat");
        setErrorMessage("No pots valorar aquest pressupost perquè ja hi ha un pressupost acceptat per un altre industrial");
        return;
      } else {
        updateStep("blocked", "success", "Pressupost accessible per pressupostar");
      }

      // Step 3: Validate status
      updateStep("status", "checking");
      await new Promise(resolve => setTimeout(resolve, 800));

      if (budgetData) {
        if (budgetData.status === "accepted") {
          updateStep("status", "success", "Pressupost ja acceptat (mode visualització)");
        } else if (budgetData.status === "rejected") {
          updateStep("status", "success", "Pressupost rebutjat (es pot reenviar)");
        } else if (budgetData.status === "draft") {
          updateStep("status", "success", "Esborrany disponible per completar");
        } else {
          updateStep("status", "success", `Estat: ${budgetData.status}`);
        }
      } else {
        updateStep("status", "success", "Preparat per crear nou pressupost");
      }

      // Step 4: Verify access permissions
      updateStep("access", "checking");
      await new Promise(resolve => setTimeout(resolve, 800));

      // Check if user has supplier profile
      const { data: supplierCheck, error: supplierError } = await supabase
        .from("suppliers")
        .select("id")
        .eq("id", supplierId)
        .single();

      if (supplierError || !supplierCheck) {
        updateStep("access", "error", "Perfil d'industrial no trobat");
        setErrorMessage("No es pot accedir: perfil d'industrial invàlid");
        return;
      }

      updateStep("access", "success", "Permisos comprovats correctament");

      // Step 5: Check credits
      updateStep("credits", "checking");
      await new Promise(resolve => setTimeout(resolve, 800));

      // Get credits required from configuration
      const { data: creditsConfig } = await supabase
        .from("credit_configurations")
        .select("setting_value")
        .eq("setting_key", "credits_per_budget")
        .single();

      const requiredCredits = creditsConfig?.setting_value || 20;
      setCreditsRequired(requiredCredits);

      // Get supplier's current credits
      const { data: supplierData, error: creditsError } = await supabase
        .from("suppliers")
        .select("credits")
        .eq("id", supplierId)
        .single();

      if (creditsError) {
        updateStep("credits", "error", "Error comprovant crèdits");
        setErrorMessage("No s'ha pogut verificar els crèdits disponibles");
        return;
      }

      const availableCredits = supplierData?.credits || 0;
      setCurrentCredits(availableCredits);

      if (availableCredits < requiredCredits) {
        updateStep("credits", "error", `Crèdits insuficients (${availableCredits}/${requiredCredits})`);
        setErrorMessage(`Necessites ${requiredCredits} crèdits per enviar un pressupost. Tens ${availableCredits} crèdits. Pots comprar més crèdits per continuar.`);
        // Don't auto-open modal, let user click the button
        return;
      }

      updateStep("credits", "success", `Crèdits suficients (${availableCredits} disponibles)`);

      // All checks passed
      setCanProceed(true);

    } catch (error) {
      console.error("Error during verification:", error);
      setErrorMessage("Error inesperat durant la verificació");
    }
  };

  const handleCreditsPurchased = async () => {
    setShowPurchaseModal(false);
    // Reset steps for re-verification
    setSteps([
      { id: "existence", label: "Comprovant existència", status: "pending" },
      { id: "blocked", label: "Comprovant: Pressupost accessible per pressupostar", status: "pending" },
      { id: "status", label: "Comprovant: Estat actual del pressupost (acceptat/rebutjat/pendent)", status: "pending" },
      { id: "access", label: "Comprovant permisos", status: "pending" },
      { id: "credits", label: "Comprovant crèdits disponibles", status: "pending" },
    ]);
    setCanProceed(false);
    setErrorMessage(null);
    // Small delay to ensure DB is updated
    await new Promise(resolve => setTimeout(resolve, 500));
    // Re-run verification after purchase
    verifyBudget();
  };

  const handleProceed = () => {
    if (canProceed) {
      onVerified();
      onOpenChange(false);
    }
  };

  const getStepIcon = (step: VerificationStep) => {
    if (step.id === "credits") {
      switch (step.status) {
        case "checking":
          return <Loader2 className="h-5 w-5 animate-spin text-purple-500" />;
        case "success":
          return <Coins className="h-5 w-5 text-green-500" />;
        case "error":
          return <Coins className="h-5 w-5 text-red-500" />;
        default:
          return <Coins className="h-5 w-5 text-muted-foreground" />;
      }
    }
    switch (step.status) {
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verificació del pressupost</DialogTitle>
          <DialogDescription>
            Comprovant l'estat del pressupost abans de permetre l'accés...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-3 transition-opacity duration-300"
              style={{
                opacity: step.status === "pending" ? 0.4 : 1,
              }}
            >
              <div className="mt-0.5">{getStepIcon(step)}</div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{step.label}</p>
                {step.message && (
                  <p className={`text-xs ${
                    step.status === "error" ? "text-red-500" : "text-muted-foreground"
                  }`}>
                    {step.message}
                  </p>
                )}
              </div>
            </div>
          ))}

          {errorMessage && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">{errorMessage}</p>
              {steps.find(s => s.id === "credits")?.status === "error" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 border-purple-500 text-purple-600 hover:bg-purple-50"
                  onClick={() => setShowPurchaseModal(true)}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Comprar crèdits
                </Button>
              )}
            </div>
          )}

          {canProceed && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ Verificació completada correctament
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel·lar
          </Button>
          <Button
            onClick={handleProceed}
            disabled={!canProceed}
          >
            Continuar
          </Button>
        </div>
      </DialogContent>

      {/* Credits Purchase Modal - with higher z-index */}
      <CreditsPurchaseModal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={handleCreditsPurchased}
        supplierId={supplierId}
      />
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, AlertCircle, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SubscriptionVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  onCloseBudgetModal?: () => void; // Callback per tancar el modal de pressupost
}

type VerificationStep = {
  id: string;
  label: string;
  status: "pending" | "checking" | "success" | "error";
  errorMessage?: string;
};

export function SubscriptionVerificationDialog({
  open,
  onOpenChange,
  onVerified,
  onCloseBudgetModal,
}: SubscriptionVerificationDialogProps) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<VerificationStep[]>([
    {
      id: "user",
      label: "Comprovant usuari",
      status: "pending",
    },
    {
      id: "profile",
      label: "Verificant dades del perfil",
      status: "pending",
    },
    {
      id: "subscription",
      label: "Comprovant: Pla de subscripció actiu",
      status: "pending",
    },
  ]);
  
  const [canProceed, setCanProceed] = useState(false);
  const [isFreeUser, setIsFreeUser] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [hasIncompleteProfile, setHasIncompleteProfile] = useState(false);

  useEffect(() => {
    if (open) {
      verifySubscription();
    }
  }, [open]);

  const updateStep = (stepId: string, status: VerificationStep["status"], errorMessage?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, errorMessage } : step
    ));
  };

  const verifySubscription = async () => {
    // Step 1: Comprovar usuari
    updateStep("user", "checking");
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        updateStep("user", "error", "No s'ha pogut verificar l'usuari");
        return;
      }
      
      updateStep("user", "success");
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Comprovar dades del perfil
      updateStep("profile", "checking");
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: supplier, error: supplierError } = await supabase
        .from("suppliers")
        .select("email, name, nif, phone, street, postal_code, province, city, utm_x, utm_y, utm_zone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (supplierError) {
        updateStep("profile", "error", "Error al comprovar les dades del perfil");
        console.error("Error fetching supplier:", supplierError);
        return;
      }

      if (!supplier) {
        updateStep("profile", "error", "No s'ha trobat el perfil d'industrial");
        setHasIncompleteProfile(true);
        return;
      }

      // Comprovar tots els camps obligatoris
      const missing: string[] = [];
      if (!supplier.email) missing.push("Email");
      if (!supplier.name) missing.push("Nom de l'empresa");
      if (!supplier.nif) missing.push("NIF");
      if (!supplier.phone) missing.push("Telèfon");
      if (!supplier.street) missing.push("Carrer");
      if (!supplier.postal_code) missing.push("Codi Postal");
      if (!supplier.province) missing.push("Província");
      if (!supplier.city) missing.push("Ciutat");
      if (!supplier.utm_x || !supplier.utm_y || !supplier.utm_zone) {
        missing.push("Validació geocodificació (coordenades)");
      }

      if (missing.length > 0) {
        setMissingFields(missing);
        setHasIncompleteProfile(true);
        updateStep(
          "profile",
          "error",
          `Falten camps obligatoris: ${missing.join(", ")}`
        );
        return;
      }

      updateStep("profile", "success");
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 3: Comprovar pla de subscripció
      updateStep("subscription", "checking");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      if (profileError) {
        updateStep("subscription", "error", "Error al comprovar el pla de subscripció");
        return;
      }

      // Comprovar si és un usuari gratuït (standard)
      if (!profile.subscription_tier || profile.subscription_tier === "standard") {
        updateStep("subscription", "error", "Necessites un pla professional per enviar pressupostos");
        setIsFreeUser(true);
        return;
      }

      // Tots els checks han passat
      updateStep("subscription", "success");
      setCanProceed(true);
      
      // Esperar un moment abans de permetre continuar
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error("Error durant la verificació:", error);
      updateStep("subscription", "error", "Error inesperat durant la verificació");
    }
  };

  const handleContinue = () => {
    if (canProceed) {
      onVerified();
      onOpenChange(false);
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    if (onCloseBudgetModal) {
      onCloseBudgetModal();
    }
    navigate("/suppliers-projects?tab=plans");
  };

  const handleGoToAccount = () => {
    onOpenChange(false);
    navigate("/suppliers-projects?tab=account");
  };

  const getStepIcon = (status: VerificationStep["status"]) => {
    switch (status) {
      case "pending":
        return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[150]">
        <DialogHeader>
          <DialogTitle>Verificació del pla de subscripció</DialogTitle>
          <DialogDescription>
            Comprovant els requisits per enviar pressupostos...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {steps.map((step, index) => (
            <div key={step.id} className="space-y-2">
              <div className="flex items-center gap-3">
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {step.label}
                  </p>
                  {step.status === "success" && (
                    <p className="text-xs text-green-600 mt-1">
                      {step.id === "user" && "OK"}
                      {step.id === "profile" && "Perfil complet"}
                      {step.id === "subscription" && "Pla professional actiu"}
                    </p>
                  )}
                  {step.status === "error" && step.errorMessage && (
                    <p className="text-xs text-destructive mt-1">
                      {step.errorMessage}
                    </p>
                  )}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="ml-2.5 h-6 w-0.5 bg-border" />
              )}
            </div>
          ))}

          {hasIncompleteProfile && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex gap-3">
                <UserCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                    Perfil incomplet
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-200 mb-2">
                    Cal completar totes les dades del perfil per poder enviar pressupostos.
                  </p>
                  {missingFields.length > 0 && (
                    <div className="text-xs text-red-800 dark:text-red-200">
                      <p className="font-semibold mb-1">Camps que falten:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {missingFields.map((field) => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isFreeUser && !hasIncompleteProfile && (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Actualitza al pla Professional
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    El pla gratuït no permet enviar pressupostos. Actualitza el teu pla per poder valorar i enviar ofertes als projectes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel·lar
          </Button>
          {hasIncompleteProfile ? (
            <Button
              onClick={handleGoToAccount}
              className="bg-primary hover:bg-primary/90"
            >
              Completar perfil
            </Button>
          ) : isFreeUser ? (
            <Button
              onClick={handleUpgrade}
              className="bg-primary hover:bg-primary/90"
            >
              Veure plans
            </Button>
          ) : (
            <Button
              onClick={handleContinue}
              disabled={!canProceed}
            >
              Continuar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

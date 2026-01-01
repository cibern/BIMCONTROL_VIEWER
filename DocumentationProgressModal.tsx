import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  MapPin, 
  Hammer, 
  Calculator, 
  Euro, 
  FileStack,
  Loader2,
  Check,
  AlertCircle,
  FileDown
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LoadingStep = {
  id: string;
  label: string;
  status: "pending" | "loading" | "completed" | "error";
  icon: React.ReactNode;
};

interface DocumentationProgressModalProps {
  open: boolean;
  steps: LoadingStep[];
  currentStep: string | null;
}

const StepItem = ({ step, isCurrent }: { step: LoadingStep; isCurrent: boolean }) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
        isCurrent && "bg-[#6b7c4c]/10 ring-1 ring-[#6b7c4c]/30",
        step.status === "completed" && "opacity-80",
        step.status === "pending" && "opacity-50"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg transition-all duration-300",
          step.status === "loading" && "bg-[#6b7c4c]/20 animate-pulse",
          step.status === "completed" && "bg-green-500/20",
          step.status === "error" && "bg-red-500/20",
          step.status === "pending" && "bg-muted"
        )}
      >
        {step.status === "loading" ? (
          <Loader2 className="h-4 w-4 text-[#6b7c4c] animate-spin" />
        ) : step.status === "completed" ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : step.status === "error" ? (
          <AlertCircle className="h-4 w-4 text-red-600" />
        ) : (
          <div className="text-muted-foreground">{step.icon}</div>
        )}
      </div>
      <span
        className={cn(
          "text-sm font-medium transition-colors duration-300",
          step.status === "loading" && "text-[#6b7c4c]",
          step.status === "completed" && "text-green-700 dark:text-green-400",
          step.status === "error" && "text-red-600",
          step.status === "pending" && "text-muted-foreground"
        )}
      >
        {step.label}
      </span>
      {step.status === "loading" && (
        <span className="ml-auto text-xs text-[#6b7c4c] animate-pulse">
          Carregant...
        </span>
      )}
    </div>
  );
};

export const DocumentationProgressModal = ({
  open,
  steps,
  currentStep,
}: DocumentationProgressModalProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const completedCount = steps.filter(s => s.status === "completed").length;
    const targetProgress = (completedCount / steps.length) * 100;
    
    // Animate progress bar
    const timer = setTimeout(() => {
      setProgress(targetProgress);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [steps]);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" hideCloseButton>
        <DialogHeader className="px-6 py-5 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="p-2.5 rounded-xl bg-[#6b7c4c]/20">
              <FileDown className="h-5 w-5 text-[#6b7c4c]" />
            </div>
            <div className="flex-1">
              <span className="block text-[#6b7c4c]">Preparant documentació</span>
              <span className="text-sm font-normal text-muted-foreground">
                Carregant dades del projecte...
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Progrés de càrrega de la documentació
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Progrés general</span>
            <span className="text-xs font-medium text-[#6b7c4c]">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="px-6 py-4 space-y-2 max-h-[400px] overflow-y-auto">
          {steps.map((step) => (
            <StepItem
              key={step.id}
              step={step}
              isCurrent={step.id === currentStep}
            />
          ))}
        </div>

        <div className="px-6 py-4 border-t bg-muted/30">
          <p className="text-xs text-center text-muted-foreground">
            Aquesta operació pot trigar uns segons la primera vegada
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

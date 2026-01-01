import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle } from "@/components/ui/nested-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";

interface BudgetRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const translations = {
  ca: {
    title: "Pressupostos - Sol·licitud",
    description: "Sol·liciteu pressupostos a proveïdors i gestiona les peticions pendents. Envia les especificacions del projecte i rep ofertes dels professionals.",
    tutorial: "Tutorial",
    tutorialTitle: "Tutorial - Pressupostos - Sol·licitud",
    tutorialContent: "Contingut del tutorial (en construcció)",
    contentInDevelopment: "Contingut en desenvolupament",
  },
  es: {
    title: "Presupuestos - Solicitud",
    description: "Solicite presupuestos a proveedores y gestione las peticiones pendientes. Envíe las especificaciones del proyecto y reciba ofertas de los profesionales.",
    tutorial: "Tutorial",
    tutorialTitle: "Tutorial - Presupuestos - Solicitud",
    tutorialContent: "Contenido del tutorial (en construcción)",
    contentInDevelopment: "Contenido en desarrollo",
  },
};

export const BudgetRequestModal = ({
  open,
  onOpenChange,
}: BudgetRequestModalProps) => {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { language } = useLanguage();
  const t = translations[language];
  
  const handleTutorial = () => {
    setTutorialOpen(true);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {t.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-end mt-4 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleTutorial}
            className="gap-2"
          >
            <Info className="h-4 w-4" />
            {t.tutorial}
          </Button>
        </div>

        <div className="flex-1 mt-6 overflow-y-auto pr-4 pb-4">
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground text-center">
              {t.contentInDevelopment}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <NestedDialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
      <NestedDialogContent className="max-w-[98vw] max-h-[95vh]">
        <NestedDialogHeader>
          <NestedDialogTitle>{t.tutorialTitle}</NestedDialogTitle>
        </NestedDialogHeader>
        <div className="p-6">
          <p className="text-muted-foreground">{t.tutorialContent}</p>
        </div>
      </NestedDialogContent>
    </NestedDialog>
    </>
  );
};

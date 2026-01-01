import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileEdit } from "lucide-react";

interface FloorPlanElementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementData: {
    entityId: string;
    ifcType: string;
    name: string;
    propertySets?: any[];
  } | null;
  onEditElement?: () => void;
  isEditDisabled?: boolean;
}

export const FloorPlanElementModal = ({
  open,
  onOpenChange,
  elementData,
  onEditElement,
  isEditDisabled = false
}: FloorPlanElementModalProps) => {
  const { language } = useLanguage();

  if (!elementData) return null;

  const handleEdit = () => {
    onOpenChange(false);
    if (onEditElement) {
      onEditElement();
    }
  };

  const getCategoryLabel = (ifcType: string): string => {
    const categoryLabels: Record<string, { ca: string; es: string }> = {
      IfcWall: { ca: "Paret", es: "Pared" },
      IfcWallStandardCase: { ca: "Paret estàndard", es: "Pared estándar" },
      IfcSlab: { ca: "Forjat / Paviment", es: "Forjado / Pavimento" },
      IfcFloor: { ca: "Paviment", es: "Pavimento" },
      IfcDoor: { ca: "Porta", es: "Puerta" },
      IfcWindow: { ca: "Finestra", es: "Ventana" },
      IfcColumn: { ca: "Columna", es: "Columna" },
      IfcBeam: { ca: "Jàssera", es: "Viga" },
      IfcStair: { ca: "Escala", es: "Escalera" },
      IfcStairFlight: { ca: "Tram d'escala", es: "Tramo de escalera" },
      IfcRailing: { ca: "Barana", es: "Barandilla" },
      IfcRoof: { ca: "Coberta", es: "Cubierta" },
      IfcCovering: { ca: "Revestiment", es: "Revestimiento" },
      IfcCurtainWall: { ca: "Mur cortina", es: "Muro cortina" },
      IfcFurnishingElement: { ca: "Mobiliari", es: "Mobiliario" },
      IfcFurniture: { ca: "Moble", es: "Mueble" },
      IfcSpace: { ca: "Espai", es: "Espacio" },
      IfcBuildingElementProxy: { ca: "Element genèric", es: "Elemento genérico" },
      IfcPlate: { ca: "Placa", es: "Placa" },
      IfcMember: { ca: "Element estructural", es: "Elemento estructural" },
      IfcFooting: { ca: "Fonamentació", es: "Cimentación" },
      IfcPile: { ca: "Pilot", es: "Pilote" },
      IfcFlowTerminal: { ca: "Terminal de flux", es: "Terminal de flujo" },
      IfcSanitaryTerminal: { ca: "Aparell sanitari", es: "Aparato sanitario" },
      IfcLightFixture: { ca: "Lluminària", es: "Luminaria" },
      IfcElectricAppliance: { ca: "Aparell elèctric", es: "Aparato eléctrico" },
      IfcOpeningElement: { ca: "Obertura", es: "Abertura" },
    };

    const label = categoryLabels[ifcType];
    if (label) {
      return language === "ca" ? label.ca : label.es;
    }
    return ifcType;
  };

  const getCategoryColor = (ifcType: string): string => {
    const categoryColors: Record<string, string> = {
      IfcWall: "bg-gray-500",
      IfcWallStandardCase: "bg-gray-500",
      IfcSlab: "bg-amber-600",
      IfcFloor: "bg-amber-600",
      IfcDoor: "bg-blue-500",
      IfcWindow: "bg-cyan-500",
      IfcColumn: "bg-purple-500",
      IfcBeam: "bg-purple-400",
      IfcStair: "bg-green-500",
      IfcStairFlight: "bg-green-500",
      IfcRailing: "bg-green-400",
      IfcRoof: "bg-red-500",
      IfcCovering: "bg-yellow-500",
      IfcCurtainWall: "bg-teal-500",
      IfcFurnishingElement: "bg-orange-600",
      IfcFurniture: "bg-orange-600",
      IfcSpace: "bg-indigo-500",
      IfcBuildingElementProxy: "bg-slate-400",
    };
    return categoryColors[ifcType] || "bg-muted";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {language === "ca" ? "Categoria de l'element" : "Categoría del elemento"}
          </DialogTitle>
          <DialogDescription>
            {language === "ca" 
              ? "Informació de l'element seleccionat en mode planta" 
              : "Información del elemento seleccionado en modo planta"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* IFC Category */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">
              {language === "ca" ? "Categoria IFC" : "Categoría IFC"}
            </span>
            <div className="flex items-center gap-2">
              <Badge className={`${getCategoryColor(elementData.ifcType)} text-white`}>
                {elementData.ifcType}
              </Badge>
              <span className="text-sm">
                → {getCategoryLabel(elementData.ifcType)}
              </span>
            </div>
          </div>

          {/* Element Name */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">
              {language === "ca" ? "Nom de l'element" : "Nombre del elemento"}
            </span>
            <p className="text-sm font-mono bg-muted p-2 rounded">
              {elementData.name || elementData.entityId}
            </p>
          </div>

          {/* Entity ID */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">
              Entity ID
            </span>
            <p className="text-xs font-mono bg-muted p-2 rounded text-muted-foreground">
              {elementData.entityId}
            </p>
          </div>
        </div>

        {/* Edit button */}
        {onEditElement && (
          <DialogFooter>
            <Button
              onClick={handleEdit}
              disabled={isEditDisabled}
              className="w-full sm:w-auto"
              title={isEditDisabled 
                ? (language === 'ca' ? "No es pot editar: el projecte està compartit amb industrials" : "No se puede editar: el proyecto está compartido con industriales") 
                : undefined}
            >
              <FileEdit className="h-4 w-4 mr-2" />
              {language === 'ca' ? 'Editar element' : 'Editar elemento'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

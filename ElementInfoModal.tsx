import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layers, Tag, Hash, Box, FileText, FileEdit } from "lucide-react";

interface ElementInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementData: {
    entityId: string;
    ifcType: string;
    name: string;
    marca?: string | null;
    propertySets?: any[];
  } | null;
  onEditElement?: () => void;
  isEditDisabled?: boolean;
}

export const ElementInfoModal = ({
  open,
  onOpenChange,
  elementData,
  onEditElement,
  isEditDisabled = false
}: ElementInfoModalProps) => {
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
      IfcBuildingStorey: { ca: "Planta", es: "Planta" },
      IfcBuilding: { ca: "Edifici", es: "Edificio" },
      IfcSite: { ca: "Parcel·la", es: "Parcela" },
      IfcProxy: { ca: "Proxy", es: "Proxy" },
    };

    const label = categoryLabels[ifcType];
    if (label) {
      return language === "ca" ? label.ca : label.es;
    }
    return ifcType.replace("Ifc", "");
  };

  const getCategoryColor = (ifcType: string): string => {
    const categoryColors: Record<string, string> = {
      IfcWall: "bg-slate-500",
      IfcWallStandardCase: "bg-slate-500",
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
      IfcSanitaryTerminal: "bg-sky-400",
      IfcFlowTerminal: "bg-sky-400",
      IfcLightFixture: "bg-yellow-400",
    };
    return categoryColors[ifcType] || "bg-muted";
  };

  // Format numeric values with 2 decimals
  const formatValue = (value: any): string => {
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num) && value.match(/^-?\d+\.?\d*$/)) {
        return num.toFixed(2);
      }
    }
    return String(value);
  };

  // Extract basic properties from propertySets
  const getBasicProperties = () => {
    const props: { key: string; value: string }[] = [];
    
    if (!elementData.propertySets) return props;

    const importantProps = [
      "ObjectType", "TypeName", "Type", "Description", "Material", 
      "Level", "Reference", "LoadBearing", "IsExternal", "FireRating",
      "Area", "Volume", "Length", "Width", "Height", "Thickness"
    ];

    for (const pset of elementData.propertySets) {
      if (pset?.properties) {
        for (const prop of pset.properties) {
          const propName = prop.name || prop.Name;
          const propValue = prop.value ?? prop.Value;
          
          if (propName && propValue !== undefined && propValue !== null && propValue !== "") {
            // Check if it's an important property
            const isImportant = importantProps.some(
              important => propName.toLowerCase().includes(important.toLowerCase())
            );
            
            if (isImportant && props.length < 6) {
              props.push({
                key: propName,
                value: formatValue(propValue)
              });
            }
          }
        }
      }
    }

    return props;
  };

  const basicProperties = getBasicProperties();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            {language === "ca" ? "Informació de l'element" : "Información del elemento"}
          </DialogTitle>
          <DialogDescription>
            {language === "ca" 
              ? "Propietats bàsiques de l'element seleccionat" 
              : "Propiedades básicas del elemento seleccionado"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* IFC Category */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {language === "ca" ? "Categoria IFC" : "Categoría IFC"}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getCategoryColor(elementData.ifcType)} text-white`}>
                  {elementData.ifcType}
                </Badge>
                <span className="text-sm text-foreground">
                  {getCategoryLabel(elementData.ifcType)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Element Name */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {language === "ca" ? "Nom de l'element" : "Nombre del elemento"}
              </p>
              <p className="text-sm font-medium text-foreground break-words">
                {elementData.name || elementData.entityId}
              </p>
            </div>
          </div>

          {/* Marca (if available) */}
          {elementData.marca && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Marca
                  </p>
                  <p className="text-sm font-medium text-accent break-words">
                    {elementData.marca}
                  </p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Entity ID */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Hash className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Entity ID
              </p>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {elementData.entityId}
              </p>
            </div>
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

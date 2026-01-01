import { useEffect, useRef, useState } from "react";
import { MessageSquare, Eye, EyeOff, Layers, FileEdit, MessageSquareText, Ruler, Trash2, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ViewerContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onAddNote: () => void;
  onIsolateElement?: () => void;
  onHideElement?: () => void;
  onShowAll?: () => void;
  onEditDescription?: () => void;
  isEditDisabled?: boolean;
  annotationsVisible?: boolean;
  onToggleAnnotations?: () => void;
  distanceMeasurementsActive?: boolean;
  distanceMeasurementsVisible?: boolean;
  onToggleDistanceMeasurements?: () => void;
  onClearDistanceMeasurements?: () => void;
  elementInfoEnabled?: boolean;
  onToggleElementInfo?: () => void;
}

export const ViewerContextMenu = ({
  x,
  y,
  visible,
  onClose,
  onAddNote,
  onIsolateElement,
  onHideElement,
  onShowAll,
  onEditDescription,
  isEditDisabled = false,
  annotationsVisible = false,
  onToggleAnnotations,
  distanceMeasurementsActive = false,
  distanceMeasurementsVisible = false,
  onToggleDistanceMeasurements,
  onClearDistanceMeasurements,
  elementInfoEnabled = true,
  onToggleElementInfo
}: ViewerContextMenuProps) => {
  const { language } = useLanguage();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Calculate adjusted position to keep menu within viewport
  useEffect(() => {
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let adjustedLeft = x;
      let adjustedTop = y;
      
      // Check if menu goes beyond right edge
      if (x + menuRect.width > viewportWidth - 10) {
        adjustedLeft = Math.max(10, viewportWidth - menuRect.width - 10);
      }
      
      // Check if menu goes beyond bottom edge
      if (y + menuRect.height > viewportHeight - 10) {
        adjustedTop = Math.max(10, viewportHeight - menuRect.height - 10);
      }
      
      // Check if menu goes beyond left edge
      if (adjustedLeft < 10) {
        adjustedLeft = 10;
      }
      
      // Check if menu goes beyond top edge
      if (adjustedTop < 10) {
        adjustedTop = 10;
      }
      
      setPosition({ left: adjustedLeft, top: adjustedTop });
    }
  }, [visible, x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[200px]"
      style={{ left: position.left, top: position.top }}
    >
      <button
        onClick={() => {
          onAddNote();
          onClose();
        }}
        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
      >
        <MessageSquare className="h-4 w-4" />
        {language === 'ca' ? 'Afegir nota o comentari' : 'Añadir nota o comentario'}
      </button>
      
      {onToggleAnnotations && (
        <button
          onClick={() => {
            const newVisible = !annotationsVisible;
            // Disparar event per sincronitzar amb el menú nav
            window.dispatchEvent(new CustomEvent("toggle-annotations-visibility", { detail: { visible: newVisible } }));
            window.dispatchEvent(new CustomEvent("annotations-visibility-changed", { detail: { visible: newVisible } }));
            localStorage.setItem("viewer-annotations-visible", String(newVisible));
            onToggleAnnotations();
            onClose();
          }}
          className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
        >
          <MessageSquareText className="h-4 w-4" />
          {annotationsVisible 
            ? (language === 'ca' ? "Ocultar notes" : "Ocultar notas") 
            : (language === 'ca' ? "Mostrar notes" : "Mostrar notas")}
        </button>
      )}

      {/* Toggle per info de l'element */}
      {onToggleElementInfo && (
        <button
          onClick={() => {
            const newEnabled = !elementInfoEnabled;
            window.dispatchEvent(new CustomEvent("toggle-element-info-enabled", { detail: { enabled: newEnabled } }));
            window.dispatchEvent(new CustomEvent("element-info-enabled-changed", { detail: { enabled: newEnabled } }));
            localStorage.setItem("viewer-element-info-enabled", String(newEnabled));
            onToggleElementInfo();
            onClose();
          }}
          className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
        >
          <Info className="h-4 w-4" />
          {elementInfoEnabled 
            ? (language === 'ca' ? "Desactivar info element" : "Desactivar info elemento") 
            : (language === 'ca' ? "Activar info element" : "Activar info elemento")}
        </button>
      )}
      
      {/* Secció d'acotacions */}
      {onToggleDistanceMeasurements && (
        <>
          <div className="border-t border-border my-1" />
          <button
            onClick={() => {
              const newActive = !distanceMeasurementsActive;
              // Disparar event per sincronitzar amb el menú nav
              // Quan es desactiva, s'eliminaran automàticament les cotes al XeokitViewer
              window.dispatchEvent(new CustomEvent("toggle-distance-measurements-active", { detail: { active: newActive } }));
              window.dispatchEvent(new CustomEvent("distance-measurements-active-changed", { detail: { active: newActive } }));
              onToggleDistanceMeasurements();
              onClose();
            }}
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
          >
            <Ruler className="h-4 w-4" />
            {distanceMeasurementsActive 
              ? (language === 'ca' ? "Desactivar acotació" : "Desactivar acotación") 
              : (language === 'ca' ? "Acotar" : "Acotar")}
          </button>
          
          <button
            onClick={() => {
              const newVisible = !distanceMeasurementsVisible;
              window.dispatchEvent(new CustomEvent("toggle-distance-measurements-visibility", { detail: { visible: newVisible } }));
              window.dispatchEvent(new CustomEvent("distance-measurements-visibility-changed", { detail: { visible: newVisible } }));
              localStorage.setItem("viewer-distance-measurements-visible", String(newVisible));
              onClose();
            }}
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
          >
            {distanceMeasurementsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {distanceMeasurementsVisible 
              ? (language === 'ca' ? "Ocultar acotacions" : "Ocultar acotaciones") 
              : (language === 'ca' ? "Mostrar acotacions" : "Mostrar acotaciones")}
          </button>
          
          {onClearDistanceMeasurements && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("clear-distance-measurements"));
                onClearDistanceMeasurements();
                onClose();
              }}
              className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {language === 'ca' ? "Eliminar acotacions" : "Eliminar acotaciones"}
            </button>
          )}
        </>
      )}
      
      {onEditDescription && (
        <button
          onClick={() => {
            if (!isEditDisabled) {
              onEditDescription();
              onClose();
            }
          }}
          disabled={isEditDisabled}
          className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${
            isEditDisabled 
              ? "text-muted-foreground cursor-not-allowed opacity-50" 
              : "hover:bg-accent"
          }`}
          title={isEditDisabled 
            ? (language === 'ca' ? "No es pot editar: el projecte està compartit amb industrials" : "No se puede editar: el proyecto está compartido con industriales") 
            : undefined}
        >
          <FileEdit className="h-4 w-4" />
          {language === 'ca' ? "Editar descripció" : "Editar descripción"}
          {isEditDisabled && <span className="ml-auto text-xs">({language === 'ca' ? "bloquejat" : "bloqueado"})</span>}
        </button>
      )}
      
      {onIsolateElement && (
        <>
          <div className="border-t border-border my-1" />
          <button
            onClick={() => {
              onIsolateElement();
              onClose();
            }}
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {language === 'ca' ? "Aïllar element" : "Aislar elemento"}
          </button>
        </>
      )}
      
      {onHideElement && (
        <button
          onClick={() => {
            onHideElement();
            onClose();
          }}
          className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
        >
          <EyeOff className="h-4 w-4" />
          {language === 'ca' ? "Amagar element" : "Ocultar elemento"}
        </button>
      )}
      
      {onShowAll && (
        <>
          <div className="border-t border-border my-1" />
          <button
            onClick={() => {
              onShowAll();
              onClose();
            }}
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
          >
            <Layers className="h-4 w-4" />
            {language === 'ca' ? "Mostrar tot" : "Mostrar todo"}
          </button>
        </>
      )}
    </div>
  );
};

import { useEffect, useState, useRef } from "react";
import { X, Layers, Box } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QuantificationData {
  elementValue: number;
  totalValue: number;
  elementCount: number;
  typeName: string;
  ifcCategory: string;
  preferredUnit: string;
  customName?: string;
}

interface QuantificationTooltipProps {
  data: QuantificationData | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

const UNIT_LABELS: Record<string, string> = {
  UT: "ut",
  ML: "m",
  M2: "m²",
  M3: "m³",
  KG: "kg",
};

const UNIT_FULL_LABELS: Record<string, { ca: string; es: string }> = {
  UT: { ca: "Unitats", es: "Unidades" },
  ML: { ca: "Metres lineals", es: "Metros lineales" },
  M2: { ca: "Metres quadrats", es: "Metros cuadrados" },
  M3: { ca: "Metres cúbics", es: "Metros cúbicos" },
  KG: { ca: "Quilograms", es: "Kilogramos" },
};

function formatValue(value: number, unit: string): string {
  if (unit === "UT") {
    return value.toFixed(0);
  }
  if (value >= 1000) {
    return value.toLocaleString("ca-ES", { maximumFractionDigits: 2 });
  }
  return value.toFixed(2);
}

export const QuantificationTooltip = ({ data, position, onClose }: QuantificationTooltipProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (data && position) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [data, position, onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!position || !tooltipRef.current) {
      setAdjustedPosition(position);
      return;
    }

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = position.x;
    let newY = position.y;

    // Adjust horizontal position
    if (position.x + rect.width > viewportWidth - 20) {
      newX = position.x - rect.width - 10;
    }
    if (newX < 20) {
      newX = 20;
    }

    // Adjust vertical position
    if (position.y + rect.height > viewportHeight - 20) {
      newY = position.y - rect.height - 10;
    }
    if (newY < 20) {
      newY = 20;
    }

    setAdjustedPosition({ x: newX, y: newY });
  }, [position, data]);

  if (!data || !position) return null;

  const unitLabel = UNIT_LABELS[data.preferredUnit] || data.preferredUnit;
  const unitFullLabel = UNIT_FULL_LABELS[data.preferredUnit]?.ca || data.preferredUnit;
  const displayName = data.customName || data.typeName;

  return (
    <AnimatePresence>
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed z-[1000] pointer-events-auto"
        style={{
          left: adjustedPosition?.x ?? position.x,
          top: adjustedPosition?.y ?? position.y,
        }}
      >
        <div className="relative bg-gradient-to-br from-background via-background to-muted/50 border border-border/50 rounded-xl shadow-2xl backdrop-blur-xl min-w-[280px] max-w-[360px] overflow-hidden">
          {/* Decorative gradient line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/80" />
          
          {/* Header */}
          <div className="flex items-start justify-between p-4 pb-2">
            <div className="flex-1 pr-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Quantificació
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                {displayName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.ifcCategory}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="p-4 pt-2 space-y-3">
            {/* Element seleccionat */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Element seleccionat</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-primary">
                    {formatValue(data.elementValue, data.preferredUnit)}
                  </span>
                  <span className="text-sm text-primary/70">{unitLabel}</span>
                </div>
              </div>
            </div>

            {/* Total del tipus */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total del tipus</span>
                <span className="text-xs text-muted-foreground">
                  {data.elementCount} {data.elementCount === 1 ? "element" : "elements"}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {formatValue(data.totalValue, data.preferredUnit)}
                </span>
                <span className="text-sm text-muted-foreground">{unitLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{unitFullLabel}</p>
            </div>

            {/* Progress bar visual */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Proporció d'aquest element</span>
                <span>{((data.elementValue / data.totalValue) * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((data.elementValue / data.totalValue) * 100, 100)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

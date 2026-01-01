import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { useViewerState } from "@/contexts/ViewerStateContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface OpacitySliderProps {
  onOpacityChange: (opacity: number) => void;
}

export const OpacitySlider = ({ onOpacityChange }: OpacitySliderProps) => {
  const { baseModelOpacity, setBaseModelOpacity } = useViewerState();
  const [localOpacity, setLocalOpacity] = useState(baseModelOpacity);
  const { language } = useLanguage();

  const label = language === "es" ? "Opacidad" : "Opacitat";

  useEffect(() => {
    setLocalOpacity(baseModelOpacity);
  }, [baseModelOpacity]);

  const handleValueChange = (value: number[]) => {
    const newOpacity = value[0];
    setLocalOpacity(newOpacity);
    setBaseModelOpacity(newOpacity);
    onOpacityChange(newOpacity / 100);
  };

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-[15] flex flex-col items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <div className="text-xs font-medium text-muted-foreground">
        {Math.round(localOpacity)}%
      </div>
      <div className="h-48 flex items-center">
        <Slider
          value={[localOpacity]}
          onValueChange={handleValueChange}
          min={0}
          max={100}
          step={1}
          orientation="vertical"
          className="h-full"
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {label}
      </div>
    </div>
  );
};
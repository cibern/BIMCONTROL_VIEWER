import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SectionHeightSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const SectionHeightSlider = ({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.1
}: SectionHeightSliderProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { language } = useLanguage();

  const label = language === "es" ? "Corte" : "Tall";

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[15] flex flex-col items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <div className="text-xs font-medium text-muted-foreground">
        {value.toFixed(2)}m
      </div>
      <div className="h-48 flex items-center">
        <Slider
          value={[value]}
          onValueChange={(values) => onChange(values[0])}
          min={min}
          max={max}
          step={step}
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
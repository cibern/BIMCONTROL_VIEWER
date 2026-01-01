import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { useViewerState } from "@/contexts/ViewerStateContext";
import { Pencil } from "lucide-react";

interface EditedElementsOpacitySliderProps {
  onOpacityChange: (opacity: number) => void;
}

export const EditedElementsOpacitySlider = ({ onOpacityChange }: EditedElementsOpacitySliderProps) => {
  const { editedElementsOpacity, setEditedElementsOpacity } = useViewerState();
  const [localOpacity, setLocalOpacity] = useState(editedElementsOpacity);

  useEffect(() => {
    setLocalOpacity(editedElementsOpacity);
  }, [editedElementsOpacity]);

  const handleValueChange = (value: number[]) => {
    const newOpacity = value[0];
    setLocalOpacity(newOpacity);
    setEditedElementsOpacity(newOpacity);
    onOpacityChange(newOpacity / 100);
  };

  return (
    <div className="fixed left-[88px] top-1/2 -translate-y-1/2 z-[15] flex flex-col items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
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
        Editats
      </div>
    </div>
  );
};

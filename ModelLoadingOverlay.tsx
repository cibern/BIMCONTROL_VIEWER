import { useState, useEffect } from "react";
import { Building2, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface ModelLoadingOverlayProps {
  projectName?: string;
  loadingText?: string;
  loadingProgress: number;
  fileSize?: number;
  loadedSize?: number;
}

interface LoadingTip {
  id: string;
  text_ca: string;
  text_es: string;
}

// Fallback tips in case database is not available
const FALLBACK_TIPS = [
  { id: "1", text_ca: "Pots fer zoom amb la roda del ratolí", text_es: "Puedes hacer zoom con la rueda del ratón" },
  { id: "2", text_ca: "Fes clic dret per veure opcions", text_es: "Haz clic derecho para ver opciones" },
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ModelLoadingOverlay = ({
  projectName,
  loadingText,
  loadingProgress,
  fileSize,
  loadedSize,
}: ModelLoadingOverlayProps) => {
  const [tips, setTips] = useState<LoadingTip[]>(FALLBACK_TIPS);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipOpacity, setTipOpacity] = useState(1);
  const { language } = useLanguage();

  // Load tips from database
  useEffect(() => {
    const loadTips = async () => {
      try {
        const { data, error } = await supabase
          .from("loading_tips")
          .select("id, text_ca, text_es")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (!error && data && data.length > 0) {
          setTips(data);
        }
      } catch (error) {
        console.error("Error loading tips:", error);
      }
    };

    loadTips();
  }, []);

  // Rotate tips every 4 seconds with fade animation
  useEffect(() => {
    if (tips.length <= 1) return;

    const interval = setInterval(() => {
      setTipOpacity(0);
      
      setTimeout(() => {
        setCurrentTipIndex((prev) => (prev + 1) % tips.length);
        setTipOpacity(1);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, [tips.length]);

  const currentTip = tips[currentTipIndex];
  const tipText = language === "ca" ? currentTip?.text_ca : currentTip?.text_es;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-6 p-8 max-w-md">
        {/* Animated building icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
            <Building2 className="h-12 w-12 text-primary animate-pulse" />
          </div>
        </div>
        
        {/* Project name and loading text */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            {projectName 
              ? (language === "ca" ? `Carregant ${projectName}` : `Cargando ${projectName}`)
              : (language === "ca" ? "Carregant model..." : "Cargando modelo...")}
          </h2>
          {loadingText && (
            <p className="text-sm text-muted-foreground max-w-xs">{loadingText}</p>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="w-72 space-y-2">
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(loadingProgress, 2)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {fileSize && loadedSize !== undefined
                ? `${formatFileSize(loadedSize)} / ${formatFileSize(fileSize)}`
                : (language === "ca" ? "Processant model" : "Procesando modelo")}
            </span>
            <span className="font-medium text-foreground">{loadingProgress.toFixed(0)}%</span>
          </div>
        </div>

        {/* Tips section */}
        <div className="mt-4 w-full max-w-sm">
          <div className={cn(
            "flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/30",
            "transition-opacity duration-300 ease-in-out"
          )} style={{ opacity: tipOpacity }}>
            <div className="p-1.5 rounded-md bg-amber-500/20 shrink-0">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-h-[40px]">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {language === "ca" ? "Consell" : "Consejo"}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {tipText}
              </p>
            </div>
          </div>
        </div>

        {/* Dots indicator */}
        {tips.length > 1 && (
          <div className="flex gap-1.5 mt-2">
            {tips.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  index === currentTipIndex 
                    ? "bg-primary w-3" 
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

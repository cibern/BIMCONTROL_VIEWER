import { useEffect, useRef, useState } from "react";
import { TreeViewPlugin, Viewer } from "@xeokit/xeokit-sdk";
import { Button } from "@/components/ui/button";
import { ListTree, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import "./treeview.css";

interface ModelTreeViewProps {
  viewer: Viewer | null;
  currentModel: any;
}

export const ModelTreeView = ({ viewer, currentModel }: ModelTreeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const treeViewRef = useRef<TreeViewPlugin | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasMetadata, setHasMetadata] = useState(false);
  const knownModelsRef = useRef<Set<string>>(new Set());
  const { language } = useLanguage();

  const texts = {
    hideTree: language === 'es' ? 'Ocultar árbol' : 'Amagar arbre',
    showTree: language === 'es' ? 'Mostrar árbol de objetos' : "Mostrar arbre d'objectes",
    noMetadata: language === 'es' ? '⚠️ El modelo no contiene metadatos de estructura.' : '⚠️ El model no conté metadades d\'estructura.',
    xktInfo: language === 'es' ? 'Los archivos XKT necesitan incluir metadatos IFC para visualizar el árbol de objetos.' : "Els arxius XKT necessiten incloure metadades IFC per visualitzar l'arbre d'objectes.",
    loading: language === 'es' ? 'Cargando visor...' : 'Carregant visor...',
  };

  // Initialize TreeView plugin
  useEffect(() => {
    if (!viewer || !containerRef.current) {
      return;
    }

    try {
      const treeView = new TreeViewPlugin(viewer, {
        containerElement: containerRef.current,
        autoExpandDepth: 3,
        hierarchy: "containment",
        autoAddModels: false,
      });

      treeViewRef.current = treeView;

      return () => {
        if (treeViewRef.current) {
          try {
            treeViewRef.current.destroy();
          } catch {}
        }
      };
    } catch (err) {
      console.error("[TreeView] Error inicialitzant plugin:", err);
    }
  }, [viewer]);

  // Listen for model loaded events
  useEffect(() => {
    if (!viewer || !treeViewRef.current) return;

    const handleModelLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { model, modelId } = customEvent.detail || {};
      
      if (!modelId || knownModelsRef.current.has(modelId)) return;

      setTimeout(() => {
        try {
          const metaModel = viewer.metaScene?.metaModels?.[modelId];
          
          if (metaModel) {
            treeViewRef.current!.addModel(modelId);
            knownModelsRef.current.add(modelId);
            setHasMetadata(true);
          } else {
            setHasMetadata(false);
            
            const retries = [1000, 2000, 4000];
            retries.forEach((delay) => {
              setTimeout(() => {
                const mm = viewer.metaScene?.metaModels?.[modelId];
                if (mm && !knownModelsRef.current.has(modelId)) {
                  try {
                    treeViewRef.current!.addModel(modelId);
                    knownModelsRef.current.add(modelId);
                    setHasMetadata(true);
                  } catch {}
                }
              }, delay);
            });
          }
        } catch (err) {
          console.error("[TreeView] Error afegint model:", err);
          setHasMetadata(false);
        }
      }, 100);
    };

    window.addEventListener("model-loaded", handleModelLoaded);

    return () => {
      window.removeEventListener("model-loaded", handleModelLoaded);
    };
  }, [viewer]);

  const toggleTreeView = () => {
    setVisible(!visible);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTreeView}
        className="bg-background/80 backdrop-blur-sm"
        title={visible ? texts.hideTree : texts.showTree}
        disabled={!viewer}
      >
        {visible ? <X className="h-4 w-4" /> : <ListTree className="h-4 w-4" />}
      </Button>

      {visible && (
        <div className="absolute top-12 left-0 z-20">
          <div
            ref={containerRef}
            className="treeview-container"
            id="treeview-container"
          />
          
          {!hasMetadata && currentModel && (
            <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-4 max-w-xs">
              <p className="text-sm text-muted-foreground">
                {texts.noMetadata}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {texts.xktInfo}
              </p>
            </div>
          )}
          
          {!viewer && (
            <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-4 max-w-xs">
              <p className="text-sm text-muted-foreground">
                {texts.loading}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

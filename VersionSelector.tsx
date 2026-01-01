import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Layers, Check, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface VersionItem {
  id: string;
  name: string;
  ifc_file_url: string;
  version_number: number;
  display_order: number;
  is_primary?: boolean;
  registry_file_id?: string | null;
}

interface VersionSelectorProps {
  projectId: string;
  currentIfcUrl?: string;
  onVersionChange: (version: VersionItem) => void;
  onRegistryFileIdChange?: (registryFileId: string | null) => void;
}

export const VersionSelector = ({ projectId, currentIfcUrl, onVersionChange, onRegistryFileIdChange }: VersionSelectorProps) => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Notificar el registry_file_id de la versió actual quan canviï
  useEffect(() => {
    if (versions.length > 0 && currentIfcUrl && onRegistryFileIdChange) {
      const currentVersion = versions.find(v => v.ifc_file_url === currentIfcUrl);
      if (currentVersion) {
        onRegistryFileIdChange(currentVersion.registry_file_id || null);
      }
    }
  }, [versions, currentIfcUrl, onRegistryFileIdChange]);

  useEffect(() => {
    const loadVersions = async () => {
      setIsLoading(true);
      try {
        // Primer intentar carregar des de la BBDD
        const { data: dbVersions, error } = await supabase
          .from('project_versions')
          .select('*')
          .eq('project_id', projectId)
          .order('version_number', { ascending: false });

        if (!error && dbVersions && dbVersions.length > 0) {
          setVersions(dbVersions);
          setIsLoading(false);
          return;
        }

        // Fallback: carregar des de localStorage (per projectes antics)
        const stored = localStorage.getItem(`project-versions-${projectId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as VersionItem[];
            // Ordenar per version_number descendent (més nou primer)
            setVersions(parsed.sort((a, b) => b.version_number - a.version_number));
          } catch (e) {
            console.error('Error parsing stored versions:', e);
          }
        }
      } catch (err) {
        console.error('Error loading versions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadVersions();
  }, [projectId]);

  if (isLoading || versions.length <= 1) {
    return null; // No mostrar si només hi ha una versió o s'està carregant
  }

  const handleVersionClick = (version: VersionItem) => {
    if (version.ifc_file_url === currentIfcUrl) return;
    
    setLoadingVersion(version.id);
    
    // Forçar F5 sutil per netejar completament el visor
    // Guardem la versió seleccionada i recarreguem
    sessionStorage.setItem(`pending-version-${projectId}`, JSON.stringify(version));
    window.location.reload();
  };

  const currentVersion = versions.find(v => v.ifc_file_url === currentIfcUrl);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40">
      {/* Botó col·lapsat - centrat a dalt */}
      {!isExpanded && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="bg-background/90 backdrop-blur-sm border-violet-500/50 hover:border-violet-500 shadow-lg"
        >
          <Layers className="h-4 w-4 text-violet-600 mr-2" />
          <span className="text-sm font-medium">
            V{currentVersion?.version_number || '?'}
          </span>
          <Badge variant="secondary" className="ml-2 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
            {versions.length}
          </Badge>
        </Button>
      )}

      {/* Panel expandit */}
      {isExpanded && (
        <div className="bg-background/95 backdrop-blur-sm border border-violet-500/30 rounded-lg shadow-xl p-3 min-w-[280px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-violet-500/20">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Versions del model</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 w-6 p-0 hover:bg-violet-100 dark:hover:bg-violet-900/30"
            >
              ×
            </Button>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1">
              {versions.map((version) => {
                const isCurrent = version.ifc_file_url === currentIfcUrl;
                const isLoading = loadingVersion === version.id;
                
                return (
                  <button
                    key={version.id}
                    onClick={() => handleVersionClick(version)}
                    disabled={isLoading || isCurrent}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-md text-left transition-all",
                      isCurrent 
                        ? "bg-violet-500/20 border border-violet-500/50" 
                        : "hover:bg-violet-100 dark:hover:bg-violet-900/20 border border-transparent",
                      isLoading && "opacity-50 cursor-wait"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                      isCurrent ? "bg-violet-500 text-white" : "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                    )}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        `V${version.version_number}`
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm truncate",
                        isCurrent ? "font-medium text-violet-700 dark:text-violet-400" : "text-foreground"
                      )}>
                        {version.name}
                      </p>
                      {version.is_primary && (
                        <span className="text-[10px] text-violet-500">Principal</span>
                      )}
                    </div>
                    {isCurrent && (
                      <Check className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <div className="mt-3 pt-2 border-t border-violet-500/20 text-xs text-muted-foreground text-center">
            <RefreshCw className="h-3 w-3 inline mr-1" />
            Es recarregarà el visor al canviar
          </div>
        </div>
      )}
    </div>
  );
};
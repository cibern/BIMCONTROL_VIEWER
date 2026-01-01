import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  User, 
  Hash, 
  Calendar, 
  Clock, 
  MessageSquare, 
  History,
  ChevronUp,
  ChevronDown,
  X,
  Fingerprint,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ca } from "date-fns/locale";

interface VersionMetadata {
  id: string;
  file_hash: string;
  lighthouse_cid: string;
  file_name: string | null;
  file_size: number | null;
  author: string | null;
  version: string | null;
  file_uuid: string | null;
  creation_date: string | null;
  modification_date: string | null;
  comment: string | null;
  change_history: string | null;
  version_number: number;
  version_description: string | null;
  created_at: string;
}

interface VersionMetadataPanelProps {
  registryFileId: string | null;
  versionName?: string;
  versionNumber?: number;
}

export const VersionMetadataPanel = ({ 
  registryFileId, 
  versionName,
  versionNumber 
}: VersionMetadataPanelProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [metadata, setMetadata] = useState<VersionMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadMetadata = async () => {
      if (!registryFileId) {
        setMetadata(null);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("ifc_file_registry")
          .select("*")
          .eq("id", registryFileId)
          .single();

        if (error) throw error;
        setMetadata(data);
      } catch (err) {
        console.error("Error loading version metadata:", err);
        setMetadata(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetadata();
  }, [registryFileId]);

  // Si no hi ha registryFileId, no mostrem res
  if (!registryFileId) {
    return null;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ca });
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
  };

  const MetadataRow = ({ 
    icon: Icon, 
    label, 
    value, 
    copyable = false,
    monospace = false 
  }: { 
    icon: any; 
    label: string; 
    value: string | null | undefined; 
    copyable?: boolean;
    monospace?: boolean;
  }) => (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <p 
          className={cn(
            "text-sm break-all",
            monospace && "font-mono text-xs",
            copyable && "cursor-pointer hover:text-primary transition-colors",
            !value && "text-muted-foreground italic"
          )}
          onClick={() => copyable && value && copyToClipboard(value, label)}
          title={copyable ? "Clic per copiar" : undefined}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Botó toggle - posicionat a l'esquerra del visor (per no solapar amb nom projecte) */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(!isVisible)}
        className={cn(
          "absolute top-4 left-4 z-40 bg-background/90 backdrop-blur-sm shadow-lg",
          "border-emerald-500/50 hover:border-emerald-500",
          isVisible && "bg-emerald-500/10"
        )}
      >
        <FileText className="h-4 w-4 text-emerald-600 mr-2" />
        <span className="text-sm">Metadades</span>
        {isVisible ? (
          <X className="h-3.5 w-3.5 ml-2" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 ml-2" />
        )}
      </Button>

      {/* Panel de metadades */}
      {isVisible && (
        <div 
          className={cn(
            "absolute top-14 left-4 z-40 w-80",
            "bg-background/95 backdrop-blur-sm rounded-lg shadow-xl",
            "border border-emerald-500/30 overflow-hidden transition-all"
          )}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border-b border-emerald-500/20 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Metadades del Model
              </span>
              {versionNumber && (
                <Badge variant="secondary" className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  V{versionNumber}
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-emerald-600" />
            )}
          </div>

          {/* Contingut */}
          {isExpanded && (
            <ScrollArea className="max-h-[60vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </div>
              ) : metadata ? (
                <div className="px-3 py-2 space-y-0.5">
                  {/* Informació bàsica */}
                  <MetadataRow 
                    icon={FileText} 
                    label="Nom del fitxer" 
                    value={metadata.file_name} 
                  />
                  <MetadataRow 
                    icon={User} 
                    label="Autor" 
                    value={metadata.author} 
                  />
                  <MetadataRow 
                    icon={Hash} 
                    label="Versió" 
                    value={metadata.version} 
                  />
                  
                  {/* Notes i historial - visible (a dalt) */}
                  <div className="pt-2 mt-2 border-t border-emerald-500/20">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                      Notes i historial
                    </p>
                    <MetadataRow 
                      icon={MessageSquare} 
                      label="Descripció de la versió" 
                      value={metadata.version_description} 
                    />
                    <MetadataRow 
                      icon={MessageSquare} 
                      label="Comentaris" 
                      value={metadata.comment} 
                    />
                    <MetadataRow 
                      icon={History} 
                      label="Historial de canvis" 
                      value={metadata.change_history} 
                    />
                  </div>

                  {/* Dates */}
                  <MetadataRow 
                    icon={Calendar} 
                    label="Data de creació" 
                    value={formatDate(metadata.creation_date)} 
                  />
                  <MetadataRow 
                    icon={Clock} 
                    label="Data de modificació" 
                    value={formatDate(metadata.modification_date)} 
                  />
                  <MetadataRow 
                    icon={Calendar} 
                    label="Registrat a blockchain" 
                    value={formatDate(metadata.created_at)} 
                  />

                  {/* Identificadors */}
                  <div className="pt-2 mt-2 border-t border-emerald-500/20">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                      Identificadors
                    </p>
                    <MetadataRow 
                      icon={Fingerprint} 
                      label="UUID" 
                      value={metadata.file_uuid} 
                      copyable 
                      monospace
                    />
                    <MetadataRow 
                      icon={Hash} 
                      label="Hash SHA-256" 
                      value={metadata.file_hash} 
                      copyable 
                      monospace
                    />
                    <MetadataRow 
                      icon={Hash} 
                      label="CID (IPFS)" 
                      value={metadata.lighthouse_cid} 
                      copyable 
                      monospace
                    />
                  </div>

                  {/* Mida del fitxer */}
                  <div className="pt-2 mt-2 border-t border-emerald-500/20">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Mida del fitxer:</span>
                      <span className="font-medium">{formatFileSize(metadata.file_size)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No s'han trobat metadades per aquesta versió
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      )}
    </>
  );
};

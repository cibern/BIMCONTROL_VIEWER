import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { 
  GitBranch, 
  Search, 
  Loader2, 
  Calendar, 
  User, 
  FileText, 
  Hash,
  ExternalLink,
  ChevronRight,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionChainItem {
  id: string;
  file_name: string | null;
  file_hash: string;
  lighthouse_cid: string;
  version_number: number;
  version_description: string | null;
  author: string | null;
  created_at: string;
  parent_file_id: string | null;
}

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ifcUrl?: string;
}

export const VersionHistoryModal = ({ open, onOpenChange, ifcUrl }: VersionHistoryModalProps) => {
  const [searchHash, setSearchHash] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [versionChain, setVersionChain] = useState<VersionChainItem[]>([]);
  const [currentFile, setCurrentFile] = useState<VersionChainItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-search if ifcUrl contains a CID pattern
  useEffect(() => {
    if (open && ifcUrl) {
      // Try to extract CID from URL (Lighthouse URLs contain the CID)
      const cidMatch = ifcUrl.match(/baf[a-zA-Z0-9]+/);
      if (cidMatch) {
        handleSearchByCid(cidMatch[0]);
      }
    }
  }, [open, ifcUrl]);

  const handleSearchByCid = async (cid: string) => {
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    
    try {
      // First find the file by CID
      const { data: file, error: fileError } = await supabase
        .from('ifc_file_registry')
        .select('*')
        .eq('lighthouse_cid', cid)
        .maybeSingle();

      if (fileError) throw fileError;
      
      if (!file) {
        setError("No s'ha trobat cap fitxer amb aquest CID");
        setVersionChain([]);
        setCurrentFile(null);
        return;
      }

      setCurrentFile(file as VersionChainItem);
      
      // Get version chain
      const { data: chain, error: chainError } = await supabase
        .rpc('get_file_version_chain', { _file_id: file.id });
      
      if (chainError) throw chainError;
      
      setVersionChain((chain || []) as VersionChainItem[]);
    } catch (err) {
      console.error('[VersionHistoryModal] Error:', err);
      setError("Error cercant l'historial de versions");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchByHash = async () => {
    if (!searchHash.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    
    try {
      // First find the file by hash
      const { data: file, error: fileError } = await supabase
        .from('ifc_file_registry')
        .select('*')
        .eq('file_hash', searchHash.trim())
        .maybeSingle();

      if (fileError) throw fileError;
      
      if (!file) {
        setError("No s'ha trobat cap fitxer amb aquest hash");
        setVersionChain([]);
        setCurrentFile(null);
        return;
      }

      setCurrentFile(file as VersionChainItem);
      
      // Get version chain
      const { data: chain, error: chainError } = await supabase
        .rpc('get_file_version_chain', { _file_id: file.id });
      
      if (chainError) throw chainError;
      
      setVersionChain((chain || []) as VersionChainItem[]);
    } catch (err) {
      console.error('[VersionHistoryModal] Error:', err);
      setError("Error cercant l'historial de versions");
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenInGateway = (cid: string) => {
    window.open(`https://gateway.lighthouse.storage/ipfs/${cid}`, '_blank');
  };

  const handleReset = () => {
    setSearchHash("");
    setVersionChain([]);
    setCurrentFile(null);
    setError(null);
    setHasSearched(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Historial de Versions IFC
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search section */}
          <div className="space-y-2">
            <Label htmlFor="search-hash">Cerca per hash SHA-256</Label>
            <div className="flex gap-2">
              <Input
                id="search-hash"
                placeholder="Introdueix el hash del fitxer..."
                value={searchHash}
                onChange={(e) => setSearchHash(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchByHash()}
                className="font-mono text-sm"
              />
              <Button 
                onClick={handleSearchByHash} 
                disabled={isSearching || !searchHash.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Results */}
          <ScrollArea className="flex-1">
            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-destructive">{error}</p>
                <Button variant="link" onClick={handleReset} className="mt-2">
                  Tornar a cercar
                </Button>
              </div>
            )}

            {!isSearching && !error && hasSearched && versionChain.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aquest fitxer no té versions anteriors registrades</p>
              </div>
            )}

            {!isSearching && versionChain.length > 0 && (
              <div className="space-y-3 pr-4">
                {/* Current file info */}
                {currentFile && (
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/30 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">
                        {currentFile.file_name || 'Fitxer actual'}
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        v{currentFile.version_number}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {currentFile.file_hash}
                    </p>
                  </div>
                )}

                {/* Version timeline */}
                <div className="relative">
                  {versionChain.map((version, index) => {
                    const isCurrentVersion = currentFile?.id === version.id;
                    const isLatest = index === versionChain.length - 1;
                    
                    return (
                      <div 
                        key={version.id} 
                        className={cn(
                          "relative pl-8 pb-6 last:pb-0",
                          isCurrentVersion && "bg-accent/50 -mx-2 px-10 py-3 rounded-lg"
                        )}
                      >
                        {/* Timeline line */}
                        {index < versionChain.length - 1 && (
                          <div className="absolute left-3 top-6 w-0.5 h-full bg-border" />
                        )}
                        
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute left-1.5 top-1.5 w-4 h-4 rounded-full border-2 bg-background",
                          isCurrentVersion 
                            ? "border-primary bg-primary" 
                            : isLatest 
                              ? "border-primary" 
                              : "border-muted-foreground"
                        )} />

                        {/* Version content */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant={isCurrentVersion ? "default" : "outline"}
                              className="font-mono"
                            >
                              v{version.version_number}
                            </Badge>
                            <span className="text-sm font-medium">
                              {version.file_name || 'Sense nom'}
                            </span>
                            {isCurrentVersion && (
                              <Badge variant="secondary" className="text-xs">
                                <ChevronRight className="h-3 w-3 mr-1" />
                                Actual
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(version.created_at)}
                            </span>
                            {version.author && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {version.author}
                              </span>
                            )}
                          </div>

                          {version.version_description && (
                            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                              {version.version_description}
                            </p>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {version.file_hash.substring(0, 16)}...
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleOpenInGateway(version.lighthouse_cid)}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Obrir
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!hasSearched && !isSearching && (
              <div className="text-center py-12 text-muted-foreground">
                <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2">Cerca l'historial de versions</p>
                <p className="text-sm">
                  Introdueix el hash SHA-256 d'un fitxer IFC registrat per veure totes les seves versions
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

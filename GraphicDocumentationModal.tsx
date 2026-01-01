import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Image, Loader2, Plus, Trash2, FileText, Upload, ExternalLink, X, Save, LogOut } from "lucide-react";

interface GraphicDocumentationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface DocumentFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  display_order: number;
  created_at: string;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const GraphicDocumentationModal = ({
  open,
  onOpenChange,
  projectId,
}: GraphicDocumentationModalProps) => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && projectId) {
      loadDocuments();
    }
  }, [open, projectId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_graphic_documentation")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Error carregant els documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validar tipus de fitxer
    if (file.type !== "application/pdf") {
      toast.error("Només es permeten fitxers PDF");
      return;
    }

    // Validar mida
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`El fitxer supera el límit de ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    // Validar nombre màxim
    if (documents.length >= MAX_FILES) {
      toast.error(`Màxim ${MAX_FILES} documents permesos`);
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticat");

      // Pujar fitxer a Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${projectId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-graphic-docs")
        .upload(fileName, file);

      if (uploadError) {
        // Si el bucket no existeix, crear-lo o donar error més clar
        if (uploadError.message.includes("Bucket not found")) {
          toast.error("Configura l'emmagatzematge de documents. Contacta l'administrador.");
          return;
        }
        throw uploadError;
      }

      // Obtenir URL pública
      const { data: urlData } = supabase.storage
        .from("project-graphic-docs")
        .getPublicUrl(fileName);

      // Guardar a la base de dades
      const { data: docData, error: docError } = await supabase
        .from("project_graphic_documentation")
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          display_order: documents.length,
          created_by: user.id,
        })
        .select()
        .single();

      if (docError) throw docError;

      setDocuments([...documents, docData]);
      toast.success("Document pujat correctament");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error pujant el document");
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (doc: DocumentFile) => {
    try {
      // Eliminar de Storage
      const urlParts = doc.file_url.split("/");
      const filePath = `${projectId}/${urlParts[urlParts.length - 1]}`;
      
      await supabase.storage
        .from("project-graphic-docs")
        .remove([filePath]);

      // Eliminar de la base de dades
      const { error } = await supabase
        .from("project_graphic_documentation")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      setDocuments(documents.filter(d => d.id !== doc.id));
      toast.success("Document eliminat");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Error eliminant el document");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const canAddMore = documents.length < MAX_FILES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
              <Image className="h-6 w-6 text-[#6b7c4c]" />
            </div>
            <div className="flex-1">
              <span className="block text-[#6b7c4c]">Documentació gràfica</span>
              <span className="text-sm font-normal text-muted-foreground">
                Documents PDF del projecte (màx. {MAX_FILES} fitxers de {MAX_FILE_SIZE_MB}MB)
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Modal per gestionar la documentació gràfica del projecte
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
            <p className="text-base text-muted-foreground">Carregant documents...</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="p-8 space-y-6">
              {/* Llista de documents */}
              {documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc, index) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-4 bg-card border-2 border-[#6b7c4c]/20 rounded-xl hover:border-[#6b7c4c]/40 transition-colors"
                    >
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <FileText className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(doc.file_size)} • Document {index + 1} de {MAX_FILES}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(doc.file_url, "_blank")}
                          className="text-[#6b7c4c] hover:text-[#5a6a3f] hover:bg-[#6b7c4c]/10"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Obrir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-muted/30 rounded-xl border-2 border-dashed border-muted-foreground/30">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    No hi ha documents gràfics encara
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Puja el primer document PDF
                  </p>
                </div>
              )}

              {/* Botó afegir */}
              {canAddMore && (
                <div className="pt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    variant="outline"
                    className="w-full py-6 border-2 border-dashed border-[#6b7c4c]/40 hover:border-[#6b7c4c] hover:bg-[#6b7c4c]/5 text-[#6b7c4c]"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Pujant document...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-2" />
                        Afegir document PDF ({documents.length}/{MAX_FILES})
                      </>
                    )}
                  </Button>
                </div>
              )}

              {!canAddMore && (
                <div className="text-center py-4 text-sm text-amber-600 bg-amber-50 rounded-lg">
                  Has assolit el màxim de {MAX_FILES} documents
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Footer amb botó Cancel·lar vermell */}
        <div className="px-8 py-4 border-t bg-muted/30 flex justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel·lar
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Tancar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

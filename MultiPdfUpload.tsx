import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2, Eye, Plus, GripVertical, AlertCircle } from "lucide-react";

interface PdfFile {
  id: string;
  fileName: string;
  url: string;
  uploadedAt: string;
  description?: string;
}

interface MultiPdfUploadProps {
  projectId: string;
  fieldId: string;
  value?: PdfFile[];
  onChange?: (files: PdfFile[]) => void;
  maxFiles?: number;
}

export const MultiPdfUpload = ({
  projectId,
  fieldId,
  value = [],
  onChange,
  maxFiles = 10,
}: MultiPdfUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<PdfFile[]>(Array.isArray(value) ? value : []);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Obtenir userId al muntar
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  // Sincronitzar amb value extern (sempre com array)
  useEffect(() => {
    setFiles(Array.isArray(value) ? value : []);
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    if (!userId) {
      toast.error("Has d'estar autenticat per pujar arxius");
      return;
    }

    const currentFiles = Array.isArray(files) ? files : [];

    if (currentFiles.length + selectedFiles.length > maxFiles) {
      toast.error(`Pots afegir un màxim de ${maxFiles} documents`);
      return;
    }

    setUploading(true);

    try {
      const newFiles: PdfFile[] = [];

      for (const file of selectedFiles) {
        // Validar que és PDF
        if (file.type !== "application/pdf") {
          toast.error(`"${file.name}" no és un document PDF vàlid`);
          continue;
        }

        // Validar mida (màx 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`"${file.name}" supera el límit de 10MB`);
          continue;
        }

        const fileId = crypto.randomUUID();
        const fileExt = file.name.split('.').pop();
        // IMPORTANT: El path ha de començar amb userId per complir amb les polítiques RLS
        const fileName = `${userId}/documentation/${projectId}_${fileId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ifc-files')
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          console.error("Upload error:", uploadError);

          // Missatge d'error més amigable
          if (uploadError.message.includes('row-level security')) {
            toast.error(`No tens permisos per pujar "${file.name}". Verifica que estàs autenticat.`);
          } else {
            toast.error(`No s'ha pogut pujar "${file.name}". Intenta-ho de nou.`);
          }
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('ifc-files')
          .getPublicUrl(fileName);

        newFiles.push({
          id: fileId,
          fileName: file.name,
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        });
      }

      if (newFiles.length > 0) {
        const updatedFiles = [...currentFiles, ...newFiles];
        setFiles(updatedFiles);
        onChange?.(updatedFiles);
        toast.success(
          newFiles.length === 1
            ? `Document "${newFiles[0].fileName}" afegit correctament`
            : `${newFiles.length} documents afegits correctament`
        );
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Hi ha hagut un problema pujant els documents. Intenta-ho de nou.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = (fileId: string) => {
    const fileToRemove = files.find(f => f.id === fileId);
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onChange?.(updatedFiles);
    toast.success(fileToRemove ? `"${fileToRemove.fileName}" eliminat` : "Document eliminat");
  };

  const handleDescriptionChange = (fileId: string, description: string) => {
    const updatedFiles = files.map(f =>
      f.id === fileId ? { ...f, description } : f
    );
    setFiles(updatedFiles);
    onChange?.(updatedFiles);
  };

  return (
    <div className="space-y-4">
      {/* Input ocult */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={uploading || files.length >= maxFiles || !userId}
      />

      {/* Missatge si no està autenticat */}
      {!userId && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Has d'estar autenticat per poder afegir documents.
          </p>
        </div>
      )}

      {/* Llista d'arxius */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file, index) => (
            <div
              key={file.id}
              className="group relative p-4 rounded-xl border bg-card hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Icona i número */}
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>

                {/* Info del fitxer */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      #{index + 1}
                    </span>
                    <p className="text-sm font-semibold truncate text-foreground">
                      {file.fileName}
                    </p>
                  </div>
                  
                  {/* Camp descripció opcional */}
                  <input
                    type="text"
                    placeholder="Descripció del document (opcional)"
                    value={file.description || ""}
                    onChange={(e) => handleDescriptionChange(file.id, e.target.value)}
                    className="w-full mt-2 px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Afegit: {new Date(file.uploadedAt).toLocaleDateString('ca-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Accions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => window.open(file.url, '_blank')}
                    title="Veure document"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveFile(file.id)}
                    title="Eliminar document"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botó per afegir */}
      {userId && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-14 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || files.length >= maxFiles}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Pujant documents...
            </>
          ) : (
            <>
              <Plus className="h-5 w-5 mr-2" />
              Afegir document PDF
            </>
          )}
        </Button>
      )}

      {/* Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{files.length} de {maxFiles} documents</span>
        <span>Màxim 10MB per document</span>
      </div>

      {/* Placeholder quan no hi ha arxius */}
      {files.length === 0 && !uploading && userId && (
        <div 
          className="h-[180px] rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center bg-muted/20 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground text-center">
            Clica per afegir documents PDF
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Plànols, croquis, documentació gràfica...
          </p>
        </div>
      )}
    </div>
  );
};

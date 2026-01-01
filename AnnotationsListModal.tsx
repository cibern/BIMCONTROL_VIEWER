import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnnotationDetailModal } from "./AnnotationDetailModal";
import { FormalizeRequestDialog } from "./FormalizeRequestDialog";
import { RequestDetailDialog } from "./RequestDetailDialog";

interface Annotation {
  id: string;
  annotation_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  primary_image_index: number;
  is_request: boolean;
  created_at: string;
}

interface AnnotationsListModalProps {
  open: boolean;
  onClose: () => void;
  centerId: string;
  showOnlyRequests?: boolean;
}

export const AnnotationsListModal = ({
  open,
  onClose,
  centerId,
  showOnlyRequests = false,
}: AnnotationsListModalProps) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showFormalizeDialog, setShowFormalizeDialog] = useState(false);
  const [showRequestDetailDialog, setShowRequestDetailDialog] = useState(false);
  const [annotationToFormalize, setAnnotationToFormalize] = useState<Annotation | null>(null);
  const [formalizedRequests, setFormalizedRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadAnnotations();
      loadFormalizedRequests();
    }
  }, [open, centerId]);

  const loadFormalizedRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("annotation_id");

      if (error) throw error;

      const formalizedSet = new Set(data.map((r) => r.annotation_id));
      setFormalizedRequests(formalizedSet);
    } catch (error) {
      console.error("Error loading formalized requests:", error);
    }
  };

  const loadAnnotations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('annotations')
        .select('*')
        .eq('center_id', centerId);

      if (showOnlyRequests) {
        query = query.eq('is_request', true);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      setAnnotations(data || []);
    } catch (error) {
      console.error("Error loading annotations:", error);
      toast.error("Error al carregar les anotacions");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (annotation: Annotation) => {
    setSelectedAnnotation(annotation);
    setShowDetailModal(true);
  };

  const handleToggleRequest = async (annotation: Annotation) => {
    try {
      const { error } = await supabase
        .from('annotations')
        .update({ is_request: !annotation.is_request })
        .eq('id', annotation.id);

      if (error) throw error;

      toast.success(annotation.is_request ? "Anotació desmarcada com a petició" : "Anotació marcada com a petició");
      loadAnnotations();
    } catch (error) {
      console.error("Error updating annotation:", error);
      toast.error("Error al actualitzar l'anotació");
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const handleFormalizeRequest = (annotation: Annotation) => {
    setAnnotationToFormalize(annotation);
    setShowFormalizeDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto z-[60]">
          <DialogHeader>
            <DialogTitle>{showOnlyRequests ? "Llistat de Peticions" : "Llistat d'Anotacions"}</DialogTitle>
            <DialogDescription>
              {showOnlyRequests 
                ? "Totes les peticions creades per a aquest centre"
                : "Totes les anotacions creades per a aquest centre"}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : annotations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {showOnlyRequests ? "No hi ha peticions per a aquest centre" : "No hi ha anotacions per a aquest centre"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  {!showOnlyRequests && <TableHead className="w-20">Petició</TableHead>}
                  <TableHead>Títol</TableHead>
                  <TableHead>Descripció</TableHead>
                  <TableHead className="w-32">Imatge</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-32 text-right">Accions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {annotations.map((annotation, index) => (
                  <TableRow key={annotation.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    {!showOnlyRequests && (
                      <TableCell>
                        <Checkbox
                          checked={annotation.is_request}
                          onCheckedChange={() => handleToggleRequest(annotation)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{annotation.title}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {annotation.description || "-"}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const primaryImageUrl = annotation.primary_image_index === 1 ? annotation.image_url :
                                               annotation.primary_image_index === 2 ? annotation.image_url_2 :
                                               annotation.primary_image_index === 3 ? annotation.image_url_3 :
                                               annotation.image_url;
                        return primaryImageUrl ? (
                          <img
                            src={primaryImageUrl}
                            alt={annotation.title}
                            className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleImageClick(primaryImageUrl)}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {new Date(annotation.created_at).toLocaleDateString('ca-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(annotation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {showOnlyRequests && (
                          formalizedRequests.has(annotation.id) ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setAnnotationToFormalize(annotation);
                                setShowRequestDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Veure Petició
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFormalizeRequest(annotation)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Formalitzar
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      {selectedAnnotation && (
        <AnnotationDetailModal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAnnotation(null);
          }}
          annotation={selectedAnnotation}
          onUpdate={() => {
            loadAnnotations();
            setShowDetailModal(false);
            setSelectedAnnotation(null);
          }}
          onDelete={() => {
            loadAnnotations();
            setShowDetailModal(false);
            setSelectedAnnotation(null);
          }}
        />
      )}

      {/* Image modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 z-[70]">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={() => setShowImageModal(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Annotation"
                className="w-full h-auto"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Formalize request dialog */}
      {annotationToFormalize && (
        <>
          <FormalizeRequestDialog
            open={showFormalizeDialog}
            onClose={() => {
              setShowFormalizeDialog(false);
              setAnnotationToFormalize(null);
              loadFormalizedRequests();
            }}
            annotationId={annotationToFormalize.id}
            annotationTitle={annotationToFormalize.title}
            onSuccess={() => {
              loadAnnotations();
              loadFormalizedRequests();
            }}
          />
          <RequestDetailDialog
            open={showRequestDetailDialog}
            onOpenChange={(open) => {
              setShowRequestDetailDialog(open);
              if (!open) setAnnotationToFormalize(null);
            }}
            annotationId={annotationToFormalize.id}
            annotationTitle={annotationToFormalize.title}
          />
        </>
      )}
    </>
  );
};

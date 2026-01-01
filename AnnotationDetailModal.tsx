import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AnnotationDetailModalProps {
  open: boolean;
  onClose: () => void;
  annotation: {
    id: string;
    annotation_id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    image_url_2: string | null;
    image_url_3: string | null;
    primary_image_index: number;
    created_at: string;
  } | null;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export const AnnotationDetailModal = ({
  open,
  onClose,
  annotation,
  onUpdate,
  onDelete,
}: AnnotationDetailModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  useEffect(() => {
    if (annotation) {
      setTitle(annotation.title);
      setDescription(annotation.description || "");
      setImagePreviews([
        annotation.image_url,
        annotation.image_url_2,
        annotation.image_url_3
      ]);
      setPrimaryImageIndex(annotation.primary_image_index || 1);
    }
  }, [annotation]);

  if (!annotation) return null;

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetDimension = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > targetDimension) {
          height = (height * targetDimension) / width;
          width = targetDimension;
        } else if (height > targetDimension) {
          width = (width * targetDimension) / height;
          height = targetDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/jpeg', 0.8);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = (index: number) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newImageFiles = [...imageFiles];
      newImageFiles[index] = file;
      setImageFiles(newImageFiles);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPreviews = [...imagePreviews];
        newPreviews[index] = reader.result as string;
        setImagePreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImageFiles = [...imageFiles];
    newImageFiles[index] = null;
    setImageFiles(newImageFiles);
    
    const newPreviews = [...imagePreviews];
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
  };

  const handleUpdate = async () => {
    if (!title.trim()) {
      toast.error("El títol és obligatori");
      return;
    }

    setLoading(true);
    try {
      const imageUrls = [
        annotation?.image_url,
        annotation?.image_url_2,
        annotation?.image_url_3
      ];

      // Upload new images if provided
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageFiles[i]) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("User not found");

          const resizedBlob = await resizeImage(imageFiles[i]!);
          const fileName = `${user.id}/${Date.now()}_annotation_${i + 1}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('ifc-files')
            .upload(fileName, resizedBlob, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('ifc-files')
            .getPublicUrl(fileName);

          imageUrls[i] = publicUrl;
        } else if (imagePreviews[i] === null) {
          // Image was removed
          imageUrls[i] = null;
        }
      }

      const { error } = await supabase
        .from('annotations')
        .update({
          title: title,
          description: description || null,
          image_url: imageUrls[0],
          image_url_2: imageUrls[1],
          image_url_3: imageUrls[2],
          primary_image_index: primaryImageIndex
        })
        .eq('id', annotation!.id);

      if (error) throw error;

      toast.success("Anotació actualitzada");
      setIsEditing(false);
      setImageFiles([null, null, null]);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating annotation:", error);
      toast.error("Error al actualitzar l'anotació");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Estàs segur que vols eliminar aquesta anotació?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('id', annotation.id);

      if (error) throw error;

      toast.success("Anotació eliminada");
      onDelete?.();
      onClose();
    } catch (error) {
      console.error("Error deleting annotation:", error);
      toast.error("Error al eliminar l'anotació");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95vw] max-h-[90vh] overflow-y-auto z-[60]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Anotació" : "Detalls de l'Anotació"}</DialogTitle>
            <DialogDescription>
              {new Date(annotation.created_at).toLocaleDateString('ca-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column - Text fields */}
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <Label htmlFor="title">Títol *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Títol de l'anotació"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Descripció</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descripció de l'anotació"
                      rows={8}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Títol</Label>
                    <p className="text-foreground font-medium">{annotation.title}</p>
                  </div>

                  {annotation.description && (
                    <div>
                      <Label>Descripció</Label>
                      <p className="text-muted-foreground whitespace-pre-wrap">{annotation.description}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right column - Images */}
            <div className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <Label>Imatges (màxim 3 - JPG, PNG, BMP)</Label>
                  
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="space-y-2 pb-3 border-b last:border-b-0">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`edit-image-${index}`} className="text-sm">
                          Imatge {index + 1}
                          {imagePreviews[index] && (
                            <span className="ml-2">
                              <input
                                type="radio"
                                checked={primaryImageIndex === index + 1}
                                onChange={() => setPrimaryImageIndex(index + 1)}
                                className="ml-2"
                                disabled={loading}
                              />
                              <span className="ml-1 text-xs">Principal</span>
                            </span>
                          )}
                        </Label>
                      </div>
                      
                      <Input
                        id={`edit-image-${index}`}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/bmp"
                        onChange={handleImageChange(index)}
                        disabled={loading}
                      />
                      
                      {imagePreviews[index] && (
                        <div className="flex gap-2 items-start">
                          <img
                            src={imagePreviews[index]!}
                            alt={`Preview ${index + 1}`}
                            className="w-32 h-32 object-cover rounded cursor-pointer"
                            onClick={() => {
                              setFullScreenImage(imagePreviews[index]);
                              setShowImageModal(true);
                            }}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveImage(index)}
                            disabled={loading}
                          >
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Imatges</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[annotation.image_url, annotation.image_url_2, annotation.image_url_3].map((url, index) => (
                      url && (
                        <div key={index} className="relative">
                          <img
                            src={url}
                            alt={`${annotation.title} - Imatge ${index + 1}`}
                            className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setFullScreenImage(url);
                              setShowImageModal(true);
                            }}
                          />
                          {annotation.primary_image_index === index + 1 && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              Principal
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                  {!annotation.image_url && !annotation.image_url_2 && !annotation.image_url_3 && (
                    <p className="text-muted-foreground text-sm">Sense imatges</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setTitle(annotation.title);
                    setDescription(annotation.description || "");
                    setImagePreviews([
                      annotation.image_url,
                      annotation.image_url_2,
                      annotation.image_url_3
                    ]);
                    setImageFiles([null, null, null]);
                    setPrimaryImageIndex(annotation.primary_image_index || 1);
                  }}
                  disabled={loading}
                >
                  Cancel·lar
                </Button>
                <Button onClick={handleUpdate} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Desar Canvis
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Eliminar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button onClick={onClose}>Tancar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <img
              src={fullScreenImage || ""}
              alt={annotation?.title || "Imatge"}
              className="w-full h-auto"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Info, AlertTriangle, CheckSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type AnnotationType = 'info' | 'alert' | 'task' | 'review';

interface AnnotationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    annotationType: AnnotationType;
    imageUrl?: string;
    imageUrl2?: string;
    imageUrl3?: string;
    primaryImageIndex: number;
  }) => Promise<void>;
  worldPos: [number, number, number];
  entityId?: string;
}

const getAnnotationTypes = (language: string) => [
  { type: 'info' as AnnotationType, label: language === 'es' ? 'Información' : 'Informació', icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500' },
  { type: 'alert' as AnnotationType, label: 'Alerta', icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  { type: 'task' as AnnotationType, label: language === 'es' ? 'Tarea' : 'Tasca', icon: CheckSquare, color: 'text-green-500', bgColor: 'bg-green-500' },
  { type: 'review' as AnnotationType, label: language === 'es' ? 'Revisión' : 'Revisió', icon: Search, color: 'text-purple-500', bgColor: 'bg-purple-500' },
];

const ANNOTATION_TYPES: { type: AnnotationType; label: string; icon: typeof Info; color: string; bgColor: string }[] = [
  { type: 'info', label: 'Informació', icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500' },
  { type: 'alert', label: 'Alerta', icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  { type: 'task', label: 'Tasca', icon: CheckSquare, color: 'text-green-500', bgColor: 'bg-green-500' },
  { type: 'review', label: 'Revisió', icon: Search, color: 'text-purple-500', bgColor: 'bg-purple-500' },
];

export const getAnnotationTypeConfig = (type: AnnotationType) => {
  return ANNOTATION_TYPES.find(t => t.type === type) || ANNOTATION_TYPES[0];
};

export const AnnotationModal = ({
  open,
  onClose,
  onSave,
  worldPos,
  entityId
}: AnnotationModalProps) => {
  const { language } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [annotationType, setAnnotationType] = useState<AnnotationType>('info');
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];
  
  const annotationTypes = getAnnotationTypes(language);
  
  const texts = {
    newAnnotation: language === 'es' ? 'Nueva Anotación' : 'Nova Anotació',
    description: language === 'es' ? 'Añade una nota al modelo 3D para documentar o comunicar información.' : "Afegeix una nota al model 3D per documentar o comunicar informació.",
    annotationType: language === 'es' ? 'Tipo de anotación' : "Tipus d'anotació",
    title: language === 'es' ? 'Título *' : 'Títol *',
    titlePlaceholder: language === 'es' ? 'Título de la anotación' : "Títol de l'anotació",
    titleRequired: language === 'es' ? 'El título es obligatorio' : 'El títol és obligatori',
    descriptionLabel: language === 'es' ? 'Descripción' : 'Descripció',
    descriptionPlaceholder: language === 'es' ? 'Descripción detallada...' : 'Descripció detallada...',
    images: language === 'es' ? 'Imágenes (opcional, máximo 3)' : 'Imatges (opcional, màxim 3)',
    image: language === 'es' ? 'Imagen' : 'Imatge',
    main: 'Principal',
    cancel: language === 'es' ? 'Cancelar' : 'Cancel·lar',
    create: language === 'es' ? 'Crear Anotación' : 'Crear Anotació',
    success: language === 'es' ? 'Anotación creada correctamente' : 'Anotació creada correctament',
    errorSave: language === 'es' ? 'Error al guardar la anotación' : "Error al guardar l'anotació",
    errorImage: language === 'es' ? 'Error al procesar la imagen' : 'Error al processar la imatge',
  };

  const resizeImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        const isVertical = img.height > img.width;
        const targetWidth = isVertical ? 600 : 800;
        const targetHeight = isVertical ? 800 : 600;
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        ctx?.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to resize image"));
          }
        }, 'image/jpeg', 0.85);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    if (primaryImageIndex === index + 1) {
      const firstAvailable = newImageFiles.findIndex(f => f !== null);
      setPrimaryImageIndex(firstAvailable >= 0 ? firstAvailable + 1 : 1);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(texts.titleRequired);
      return;
    }

    setIsLoading(true);

    try {
      const imageUrls: (string | undefined)[] = [undefined, undefined, undefined];

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        if (imageFile) {
          try {
            const resizedBlob = await resizeImage(imageFile);
            const fileName = `annotation-${Date.now()}-${i + 1}.jpg`;
            const filePath = `annotations/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('ifc-files')
              .upload(filePath, resizedBlob, {
                contentType: 'image/jpeg',
                upsert: false
              });

            if (uploadError) {
              console.error(`Error uploading image ${i + 1}:`, uploadError);
              throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('ifc-files')
              .getPublicUrl(filePath);

            imageUrls[i] = publicUrl;
          } catch (error) {
            console.error(`Error processing image ${i + 1}:`, error);
            throw new Error(`${texts.errorImage} ${i + 1}`);
          }
        }
      }

      await onSave({
        title: title.trim(),
        description: description.trim(),
        annotationType,
        imageUrl: imageUrls[0],
        imageUrl2: imageUrls[1],
        imageUrl3: imageUrls[2],
        primaryImageIndex
      });

      // Reset form
      setTitle("");
      setDescription("");
      setAnnotationType('info');
      setImageFiles([null, null, null]);
      setImagePreviews([null, null, null]);
      setPrimaryImageIndex(1);
      onClose();
      
      toast.success(texts.success);
    } catch (error) {
      console.error("Error saving annotation:", error);
      toast.error(error instanceof Error ? error.message : texts.errorSave);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTypeConfig = getAnnotationTypeConfig(annotationType);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] z-[9999] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <selectedTypeConfig.icon className={cn("h-5 w-5", selectedTypeConfig.color)} />
            {texts.newAnnotation}
          </DialogTitle>
          <DialogDescription>
            {texts.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Annotation Type Selector */}
          <div className="space-y-2">
            <Label>{texts.annotationType}</Label>
            <div className="grid grid-cols-4 gap-2">
              {annotationTypes.map(({ type, label, icon: Icon, color, bgColor }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAnnotationType(type)}
                  disabled={isLoading}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                    annotationType === type
                      ? `border-current ${color} bg-accent`
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <Icon className={cn("h-5 w-5 mb-1", color)} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">{texts.title}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={texts.titlePlaceholder}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{texts.descriptionLabel}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={texts.descriptionPlaceholder}
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>{texts.images}</Label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-1">
                  <input
                    ref={fileInputRefs[index]}
                    id={`image-${index}`}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/bmp"
                    onChange={handleImageChange(index)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  
                  {imagePreviews[index] ? (
                    <div className="relative group">
                      <img
                        src={imagePreviews[index]!}
                        alt={`Preview ${index + 1}`}
                        className={cn(
                          "w-full h-20 object-cover rounded-md border-2 cursor-pointer",
                          primaryImageIndex === index + 1 ? "border-primary" : "border-transparent"
                        )}
                        onClick={() => setPrimaryImageIndex(index + 1)}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImage(index)}
                        disabled={isLoading}
                      >
                        ×
                      </Button>
                      {primaryImageIndex === index + 1 && (
                        <span className="absolute bottom-1 left-1 text-[10px] bg-primary text-primary-foreground px-1 rounded">
                          {texts.main}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-20 text-xs"
                      onClick={() => fileInputRefs[index].current?.click()}
                      disabled={isLoading}
                    >
                      + {texts.image} {index + 1}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {texts.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className={cn(selectedTypeConfig.bgColor, "hover:opacity-90")}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {texts.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

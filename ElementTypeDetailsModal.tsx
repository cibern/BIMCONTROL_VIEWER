import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";

interface ElementTypeDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementTypeConfigId: string;
  elementName: string;
}

interface ElementTypeDetails {
  id?: string;
  brand: string;
  model: string;
  image_url: string;
  website: string;
  phone: string;
  email: string;
  contact_name: string;
}

const MAX_IMAGE_SIZE_KB = 1024; // 1MB
const TARGET_WIDTH = 800;
const TARGET_HEIGHT = 600;

export function ElementTypeDetailsModal({
  open,
  onOpenChange,
  elementTypeConfigId,
  elementName,
}: ElementTypeDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<ElementTypeDetails>({
    brand: "",
    model: "",
    image_url: "",
    website: "",
    phone: "",
    email: "",
    contact_name: "",
  });
  const [existingId, setExistingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && elementTypeConfigId) {
      loadDetails();
    }
  }, [open, elementTypeConfigId]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("element_type_details")
        .select("*")
        .eq("element_type_config_id", elementTypeConfigId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setDetails({
          brand: data.brand || "",
          model: data.model || "",
          image_url: data.image_url || "",
          website: data.website || "",
          phone: data.phone || "",
          email: data.email || "",
          contact_name: data.contact_name || "",
        });
        if (data.image_url) {
          setImagePreview(data.image_url);
        }
      } else {
        setExistingId(null);
        setDetails({
          brand: "",
          model: "",
          image_url: "",
          website: "",
          phone: "",
          email: "",
          contact_name: "",
        });
        setImagePreview(null);
      }
    } catch (error) {
      console.error("Error loading details:", error);
      toast.error("Error carregant els detalls");
    } finally {
      setLoading(false);
    }
  };

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        // Calculate proportional dimensions
        let width = img.width;
        let height = img.height;
        
        const aspectRatio = width / height;
        const targetAspectRatio = TARGET_WIDTH / TARGET_HEIGHT;
        
        if (aspectRatio > targetAspectRatio) {
          // Image is wider - fit to width
          width = TARGET_WIDTH;
          height = width / aspectRatio;
        } else {
          // Image is taller - fit to height
          height = TARGET_HEIGHT;
          width = height * aspectRatio;
        }
        
        // Ensure dimensions don't exceed targets
        if (width > TARGET_WIDTH) {
          width = TARGET_WIDTH;
          height = width / aspectRatio;
        }
        if (height > TARGET_HEIGHT) {
          height = TARGET_HEIGHT;
          width = height * aspectRatio;
        }

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob"));
            }
          },
          "image/jpeg",
          0.8
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an allowed image format
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/bmp"];
    if (!allowedTypes.some(type => file.type.includes(type.split("/")[1]))) {
      toast.error("Només s'accepten imatges JPG, PNG o BMP");
      return;
    }

    // Check file size before processing (1MB = 1024KB)
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB > MAX_IMAGE_SIZE_KB) {
      toast.error(`La imatge és massa gran (${(fileSizeKB / 1024).toFixed(2)}MB). Màxim 1MB`);
      return;
    }

    setUploadingImage(true);
    try {
      // Resize image
      const resizedBlob = await resizeImage(file);

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Has d'estar autenticat");
        return;
      }

      // Upload to Supabase Storage
      const fileName = `element-details/${user.id}/${elementTypeConfigId}-${Date.now()}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ifc-files")
        .upload(fileName, resizedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("ifc-files")
        .getPublicUrl(fileName);

      setDetails((prev) => ({ ...prev, image_url: publicUrl }));
      setImagePreview(publicUrl);
      toast.success("Imatge pujada correctament");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error pujant la imatge");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setDetails((prev) => ({ ...prev, image_url: "" }));
    setImagePreview(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Has d'estar autenticat");
        return;
      }

      const payload = {
        element_type_config_id: elementTypeConfigId,
        user_id: user.id,
        brand: details.brand || null,
        model: details.model || null,
        image_url: details.image_url || null,
        website: details.website || null,
        phone: details.phone || null,
        email: details.email || null,
        contact_name: details.contact_name || null,
      };

      if (existingId) {
        const { error } = await supabase
          .from("element_type_details")
          .update(payload)
          .eq("id", existingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("element_type_details")
          .insert(payload);

        if (error) throw error;
      }

      toast.success("Detalls guardats correctament");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving details:", error);
      toast.error("Error guardant els detalls");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalls de la partida</DialogTitle>
          <DialogDescription className="truncate">
            {elementName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Marca / Empresa</Label>
                <Input
                  id="brand"
                  value={details.brand}
                  onChange={(e) =>
                    setDetails((prev) => ({ ...prev, brand: e.target.value }))
                  }
                  placeholder="Ex: Roca, Schneider..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={details.model}
                  onChange={(e) =>
                    setDetails((prev) => ({ ...prev, model: e.target.value }))
                  }
                  placeholder="Ex: Serie 100..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Imatge (JPG, PNG, BMP - màx. 1MB)</Label>
              {imagePreview ? (
                <div className="relative w-full h-32 border rounded-md overflow-hidden bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingImage ? (
                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Clica per seleccionar una imatge
                      </p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/bmp"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Web</Label>
              <Input
                id="website"
                value={details.website}
                onChange={(e) =>
                  setDetails((prev) => ({ ...prev, website: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telèfon</Label>
                <Input
                  id="phone"
                  value={details.phone}
                  onChange={(e) =>
                    setDetails((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="Ex: 972 123 456"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={details.email}
                  onChange={(e) =>
                    setDetails((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="contacte@empresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Nom persona de contacte</Label>
              <Input
                id="contact_name"
                value={details.contact_name}
                onChange={(e) =>
                  setDetails((prev) => ({ ...prev, contact_name: e.target.value }))
                }
                placeholder="Ex: Joan García"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel·lar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

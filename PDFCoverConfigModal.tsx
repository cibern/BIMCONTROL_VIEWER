import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  FileDown, 
  User, 
  Loader2, 
  X,
  Building2,
  MapPin,
  GraduationCap,
  Upload,
  Image as ImageIcon,
  FileText,
  Palette,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Lock,
  ExternalLink
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditConfirmationModal, getCreditConfirmationDisabled } from "@/components/credits/CreditConfirmationModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PDFColorTheme } from "@/lib/pdfGenerator";

export interface TechnicianData {
  id?: string;
  name: string;
  surname: string;
  dni: string;
  email: string;
  phone: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  degreeTitle: string;
  professionalCollege: string;
  collegeNumber: string;
}

export interface CoverConfig {
  title: string;
  subtitle: string;
  coverImageUrl: string | null;
  technician: TechnicianData;
  projectName: string;
  ownerName: string;
  locationAddress: string;
  colorTheme: PDFColorTheme;
  includeTocLinks: boolean;
  projectTypeName?: string;
  watermarkText?: string;
}

interface PDFCoverConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  ownerName: string;
  locationAddress: string;
  projectTypeName?: string;
  onGenerate: (config: CoverConfig, isDraft: boolean) => void;
}

const defaultTechnician: TechnicianData = {
  name: "",
  surname: "",
  dni: "",
  email: "",
  phone: "",
  street: "",
  streetNumber: "",
  postalCode: "",
  city: "",
  degreeTitle: "",
  professionalCollege: "",
  collegeNumber: "",
};

// Validation functions
function validDniCifNie(dni: string): boolean {
  dni = dni.toUpperCase();
  const letras = "TRWAGMYFPDXBNJZSQVHLCKE";

  if (!/^[A-Z0-9]{9}$/.test(dni)) {
    return false;
  }

  // NIF estándar (8 números + 1 letra)
  if (/^[0-9]{8}[A-Z]$/.test(dni)) {
    const numero = parseInt(dni.slice(0, 8), 10);
    const letra = dni[8];
    return letra === letras[numero % 23];
  }

  // NIE (X, Y, Z seguido de 7 números y una letra)
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(dni)) {
    const reemplazo: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    const numero = reemplazo[dni[0]] + dni.slice(1, 8);
    const letra = dni[8];
    return letra === letras[parseInt(numero, 10) % 23];
  }

  // CIF (letra + 7 números + letra/número)
  if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[A-Z0-9]$/.test(dni)) {
    let sumaPar = 0;
    let sumaImpar = 0;

    for (let i = 1; i <= 6; i += 2) {
      sumaPar += parseInt(dni[i], 10);
    }

    for (let i = 0; i <= 6; i += 2) {
      let doble = parseInt(dni[i], 10) * 2;
      sumaImpar += doble > 9 ? doble - 9 : doble;
    }

    const sumaTotal = sumaPar + sumaImpar;
    const control = (10 - (sumaTotal % 10)) % 10;
    const controlEsperado = dni[8];

    if (/[A-Z]/.test(controlEsperado)) {
      return controlEsperado === String.fromCharCode(64 + control);
    } else {
      return parseInt(controlEsperado, 10) === control;
    }
  }

  // NIE especial (T seguido de 8 dígitos)
  if (/^T[0-9]{8}$/.test(dni)) {
    return true;
  }

  return false;
}

function validPhone(phone: string): boolean {
  // Acepta formatos: +34 XXX XXX XXX, 34XXXXXXXXX, XXXXXXXXX, +XX XXXXXXXXX
  const cleanPhone = phone.replace(/[\s\-\.]/g, '');
  return /^(\+?[0-9]{1,4})?[0-9]{9,12}$/.test(cleanPhone);
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const COLOR_OPTIONS: { value: PDFColorTheme; label: string; color: string; bgColor: string }[] = [
  { value: 'olive', label: 'Verd oliva', color: '#6b7c4c', bgColor: 'bg-[#6b7c4c]' },
  { value: 'black', label: 'Negre', color: '#282828', bgColor: 'bg-[#282828]' },
  { value: 'blue', label: 'Blau', color: '#29629B', bgColor: 'bg-[#29629B]' },
  { value: 'purple', label: 'Lila', color: '#6A4C93', bgColor: 'bg-[#6A4C93]' },
];

export const PDFCoverConfigModal = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  ownerName,
  locationAddress,
  projectTypeName,
  onGenerate,
}: PDFCoverConfigModalProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(projectName);
  const [subtitle, setSubtitle] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [technician, setTechnician] = useState<TechnicianData>(defaultTechnician);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [creditsRequired, setCreditsRequired] = useState(50);
  const [colorTheme, setColorTheme] = useState<PDFColorTheme>('olive');
  const [includeTocLinks, setIncludeTocLinks] = useState(false);
  const [creditsPerColor, setCreditsPerColor] = useState(2);
  const [creditsPerTocLinks, setCreditsPerTocLinks] = useState(2);
  
  // Cadastre status
  const [cadastreStatus, setCadastreStatus] = useState<'idle' | 'checking' | 'available' | 'maintenance' | 'error'>('idle');
  const [cadastreMessage, setCadastreMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  
  const { credits, userId, config: creditsConfig, shouldSkipCredits, demoSettings, isDemoUser, loading: creditsLoading } = useUserCredits();
  const { canOnlyGenerateDrafts, trialDaysRemaining, isInTrial } = useTrialStatus();

  useEffect(() => {
    if (open) {
      setTitle(projectName);
      setSubtitle(`${locationAddress}${ownerName ? ` • ${ownerName}` : ""}`);
      loadTechnicianData();
      loadCoverImage();
      // Reset status when opening
      setCadastreStatus('idle');
      setCadastreMessage(null);
      setIsGenerating(false);
      setColorTheme('olive');
      setIncludeTocLinks(false);
    }
  }, [open, projectName, ownerName, locationAddress]);

  const loadCoverImage = async () => {
    try {
      const { data } = await supabase
        .from("projects")
        .select("cover_image_url")
        .eq("id", projectId)
        .single();
      if (data?.cover_image_url) {
        setCoverImageUrl(data.cover_image_url);
      }
    } catch (error) {
      console.error("Error loading cover image:", error);
    }
  };

  // Compress image to target size (500KB)
  const compressImage = async (file: File, maxSizeKB: number = 500): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          // Scale down if image is very large
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with high quality and reduce until under target size
          let quality = 0.9;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resolve(file);
                  return;
                }
                if (blob.size <= maxSizeKB * 1024 || quality <= 0.1) {
                  resolve(blob);
                } else {
                  quality -= 0.1;
                  tryCompress();
                }
              },
              "image/jpeg",
              quality
            );
          };
          tryCompress();
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const loadTechnicianData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("technician_profiles")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTechnician({
          id: data.id,
          name: data.name || "",
          surname: data.surname || "",
          dni: data.dni || "",
          email: data.email || "",
          phone: (data as any).phone || "",
          street: data.street || "",
          streetNumber: data.street_number || "",
          postalCode: data.postal_code || "",
          city: data.city || "",
          degreeTitle: data.degree_title || "",
          professionalCollege: data.professional_college || "",
          collegeNumber: data.college_number || "",
        });
      }
    } catch (error) {
      console.error("Error loading technician data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if all required technician fields are filled
  const hasCompleteTechnicianProfile = () => {
    return !!(
      technician.name?.trim() &&
      technician.surname?.trim() &&
      technician.dni?.trim() &&
      technician.email?.trim() &&
      technician.phone?.trim() &&
      technician.street?.trim() &&
      technician.postalCode?.trim() &&
      technician.city?.trim() &&
      technician.degreeTitle?.trim() &&
      technician.professionalCollege?.trim() &&
      technician.collegeNumber?.trim()
    );
  };

  const openUserProfile = () => {
    // Close this modal and dispatch event to open profile modal
    onOpenChange(false);
    // Small delay to allow this modal to close first
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-user-profile-modal"));
    }, 100);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Només es permeten imatges");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imatge no pot superar 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      // Compress to 500KB
      const compressedBlob = await compressImage(file, 500);
      console.log("Compressed image size:", Math.round(compressedBlob.size / 1024), "KB");
      
      const fileName = `${projectId}/cover-${Date.now()}.jpg`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("project-graphic-docs")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw uploadError;
      }

      console.log("Upload successful:", uploadData);

      const { data: { publicUrl } } = supabase.storage
        .from("project-graphic-docs")
        .getPublicUrl(fileName);

      // Save to database
      const { error: updateError } = await supabase
        .from("projects")
        .update({ cover_image_url: publicUrl })
        .eq("id", projectId);

      if (updateError) {
        console.error("Error saving cover URL:", updateError);
      }

      setCoverImageUrl(publicUrl);
      toast.success("Imatge pujada i comprimida correctament");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(`Error pujant la imatge: ${error?.message || 'Error desconegut'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // Load credits required from config
  useEffect(() => {
    const loadCreditsConfig = async () => {
      const { data } = await supabase
        .from("credit_configurations")
        .select("setting_key, setting_value")
        .in("setting_key", ["credits_per_pdf_memoria", "credits_per_pdf_color", "credits_per_pdf_toc_links"]);
      
      if (data) {
        for (const config of data) {
          if (config.setting_key === "credits_per_pdf_memoria") {
            setCreditsRequired(config.setting_value);
          } else if (config.setting_key === "credits_per_pdf_color") {
            setCreditsPerColor(config.setting_value);
          } else if (config.setting_key === "credits_per_pdf_toc_links") {
            setCreditsPerTocLinks(config.setting_value);
          }
        }
      }
    };
    if (open) {
      loadCreditsConfig();
    }
  }, [open]);

  // Calculate total credits needed
  const calculateTotalCredits = (isDraft: boolean) => {
    if (isDraft) return 0;
    let total = creditsRequired;
    if (colorTheme !== 'olive') total += creditsPerColor;
    if (includeTocLinks) total += creditsPerTocLinks;
    return total;
  };

  const handleGenerate = async (isDraft: boolean) => {
    // Validació de camps obligatoris del tècnic
    const requiredFields = [
      { field: technician.name, label: "Nom" },
      { field: technician.surname, label: "Cognoms" },
      { field: technician.dni, label: "DNI/NIE" },
      { field: technician.email, label: "Correu electrònic" },
      { field: technician.phone, label: "Telèfon de contacte" },
      { field: technician.street, label: "Adreça" },
      { field: technician.postalCode, label: "Codi Postal" },
      { field: technician.city, label: "Població" },
      { field: technician.degreeTitle, label: "Titulació" },
      { field: technician.professionalCollege, label: "Col·legi professional" },
      { field: technician.collegeNumber, label: "Número de col·legiat" },
    ];

    const missingFields = requiredFields.filter(f => !f.field?.trim());
    if (missingFields.length > 0) {
      toast.error("Camps obligatoris sense omplir", {
        description: `Omple el teu perfil amb: ${missingFields.map(f => f.label).join(", ")}. Pots fer-ho des del menú d'usuari → El meu perfil.`
      });
      return;
    }

    // Validació email
    if (!validEmail(technician.email)) {
      toast.error("El correu electrònic no és vàlid");
      return;
    }

    // Validació telèfon
    if (!validPhone(technician.phone)) {
      toast.error("El telèfon no té un format vàlid");
      return;
    }

    // Validació DNI/NIE
    if (!validDniCifNie(technician.dni)) {
      toast.error("El DNI/NIE/CIF no és vàlid");
      return;
    }

    const totalCreditsNeeded = calculateTotalCredits(isDraft);

    // If not draft, check cadastre and (optionally) deduct credits
    if (!isDraft) {
      // If credits logic is enabled, check credits first
      if (!shouldSkipCredits) {
        if (credits < totalCreditsNeeded) {
          setShowInsufficientCredits(true);
          return;
        }
      }

      // Check cadastre status before generating
      setIsGenerating(true);
      setCadastreStatus('checking');
      setCadastreMessage(null);

      try {
        const { data, error } = await supabase.functions.invoke('cadastre-lookup', {
          body: { checkOnly: true }
        });

        if (error) {
          console.error('Cadastre check error:', error);
          setCadastreStatus('error');
          setCadastreMessage("No s'ha pogut verificar l'estat del servei de cadastre");
          setIsGenerating(false);
          return;
        }

        if (data?.maintenance) {
          setCadastreStatus('maintenance');
          setCadastreMessage(data.error || "El servei de cadastre està en manteniment. No es pot generar el PDF en aquest moment.");
          setIsGenerating(false);
          toast.error("Servei de cadastre no disponible", {
            description: "El cadastre està en manteniment. Torna-ho a intentar més tard."
          });
          return;
        }

        if (!data?.success) {
          setCadastreStatus('error');
          setCadastreMessage(data?.error || "El servei de cadastre no està disponible");
          setIsGenerating(false);
          toast.error("Servei de cadastre no disponible");
          return;
        }

        setCadastreStatus('available');
      } catch (e) {
        console.error('Cadastre check exception:', e);
        setCadastreStatus('error');
        setCadastreMessage("Error de connexió amb el servei de cadastre");
        setIsGenerating(false);
        toast.error("Error verificant el servei de cadastre");
        return;
      }

      // Cadastre OK - Deduct credits only when credits logic is enabled
      if (!shouldSkipCredits) {
        if (!userId) {
          toast.error("No s'ha trobat l'usuari");
          setIsGenerating(false);
          return;
        }

        // Use edge function for secure, atomic credit deduction
        const descriptionParts = [`Generació PDF memòria: ${projectName}`];
        if (colorTheme !== 'olive') descriptionParts.push(`Color: ${colorTheme}`);
        if (includeTocLinks) descriptionParts.push("Índex amb enllaços");

        const { data: creditResult, error: creditError } = await supabase.functions.invoke('manage-credits', {
          body: {
            type: 'deduct_pdf_memoria',
            amount: totalCreditsNeeded,
            referenceId: projectId,
            projectId: projectId,
            description: descriptionParts.join(" | ")
          }
        });

        if (creditError || !creditResult?.success) {
          console.error("Error deducting credits:", creditError || creditResult?.error);
          
          // Check if it's insufficient credits
          if (creditResult?.error?.includes('Insufficient')) {
            setShowInsufficientCredits(true);
          } else {
            toast.error("Error descomptant crèdits", {
              description: creditResult?.error || creditError?.message
            });
          }
          setIsGenerating(false);
          return;
        }

        // Dispatch event to update credits in UI
        window.dispatchEvent(new CustomEvent("user-credits-updated"));
        toast.success(`S'han descomptat ${totalCreditsNeeded} crèdits`);
      }
    }

    setIsGenerating(false);
    onGenerate({
      title,
      subtitle,
      coverImageUrl,
      technician,
      projectName,
      ownerName,
      locationAddress,
      colorTheme,
      includeTocLinks,
      projectTypeName,
      watermarkText: isDemoUser && demoSettings?.watermarkText ? demoSettings.watermarkText : undefined,
    }, isDraft);
    onOpenChange(false);
  };

  const updateTechnician = (field: keyof TechnicianData, value: string) => {
    setTechnician(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
              <FileDown className="h-6 w-6 text-[#6b7c4c]" />
            </div>
            <div className="flex-1">
              <span className="block text-[#6b7c4c]">Configuració del document</span>
              <span className="text-sm font-normal text-muted-foreground">
                Defineix les dades de la portada i del tècnic
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Modal per configurar la portada del document PDF
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
            <p className="text-base text-muted-foreground">Carregant dades...</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="p-6 space-y-6">
              {/* Cadastre Status Alert - Only show when checking or after check */}
              {cadastreStatus === 'checking' && (
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <AlertDescription className="text-blue-700 dark:text-blue-400">
                      Verificant disponibilitat del servei de cadastre...
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {cadastreStatus === 'maintenance' && (
                <Alert variant="destructive">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex-1">
                      {cadastreMessage || "El servei de cadastre està en manteniment. No es pot generar el PDF en aquest moment."}
                    </AlertDescription>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setCadastreStatus('idle');
                        setCadastreMessage(null);
                      }}
                      className="shrink-0"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Tancar
                    </Button>
                  </div>
                </Alert>
              )}

              {cadastreStatus === 'error' && (
                <Alert variant="destructive">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex-1">
                      {cadastreMessage || "No s'ha pogut verificar l'estat del servei de cadastre."}
                    </AlertDescription>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setCadastreStatus('idle');
                        setCadastreMessage(null);
                      }}
                      className="shrink-0"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Tancar
                    </Button>
                  </div>
                </Alert>
              )}
              
              {cadastreStatus === 'available' && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Servei de cadastre disponible - Generant PDF...
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Secció Portada */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#6b7c4c] flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Portada del document
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Títol del document</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Títol del projecte"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtitle">Subtítol</Label>
                    <Input
                      id="subtitle"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="Adreça i propietari"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Imatge de portada (opcional)</Label>
                  <div className="flex items-center gap-4">
                    {coverImageUrl ? (
                      <div className="relative w-32 h-24 rounded-lg overflow-hidden border">
                        <img
                          src={coverImageUrl}
                          alt="Portada"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={async () => {
                            setCoverImageUrl(null);
                            await supabase
                              .from("projects")
                              .update({ cover_image_url: null })
                              .eq("id", projectId);
                          }}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-32 h-24 border-2 border-dashed rounded-lg cursor-pointer hover:border-[#6b7c4c]/50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        {uploadingImage ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mt-1">Pujar imatge</span>
                          </>
                        )}
                      </label>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Màxim 2MB. Format JPG, PNG o WebP recomanat.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Secció Tècnic */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#6b7c4c] flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Dades del tècnic
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openUserProfile}
                    className="border-[#6b7c4c]/30 text-[#6b7c4c] hover:bg-[#6b7c4c]/10"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Introduir dades
                  </Button>
                </div>
                
                {!hasCompleteTechnicianProfile() ? (
                  <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-400">
                      <strong>Dades del tècnic incompletes.</strong> Has d'omplir el teu perfil amb totes les dades del tècnic abans de poder generar el PDF.
                      <Button 
                        variant="link" 
                        className="p-0 h-auto ml-1 text-amber-700 dark:text-amber-400 underline"
                        onClick={openUserProfile}
                      >
                        Anar al meu perfil
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Dades del tècnic completes. Les dades es capturen del teu perfil d'usuari.
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Les dades del tècnic es gestionen des del teu perfil d'usuari i no es poden modificar aquí.
                </p>

                {/* Dades personals - Només lectura */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tech-name" className="flex items-center gap-1">
                      Nom <Lock className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="tech-name"
                      value={technician.name}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tech-surname" className="flex items-center gap-1">
                      Cognoms <Lock className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="tech-surname"
                      value={technician.surname}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tech-dni" className="flex items-center gap-1">
                      DNI/NIE <Lock className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="tech-dni"
                      value={technician.dni}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tech-email" className="flex items-center gap-1">
                      Correu electrònic <Lock className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="tech-email"
                      type="email"
                      value={technician.email}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tech-phone" className="flex items-center gap-1">
                      Telèfon de contacte <Lock className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="tech-phone"
                      type="tel"
                      value={technician.phone}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                {/* Adreça - Només lectura */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Adreça <Lock className="h-3 w-3" />
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <Input
                        value={technician.street}
                        disabled
                        placeholder="Carrer"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={technician.streetNumber}
                        disabled
                        placeholder="Número"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={technician.postalCode}
                        disabled
                        placeholder="CP"
                        className="bg-muted/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Input
                      value={technician.city}
                      disabled
                      placeholder="Població"
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                {/* Titulació - Només lectura */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    Dades professionals <Lock className="h-3 w-3" />
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Input
                        value={technician.degreeTitle}
                        disabled
                        placeholder="Titulació"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={technician.professionalCollege}
                        disabled
                        placeholder="Col·legi professional"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={technician.collegeNumber}
                        disabled
                        placeholder="Núm. col·legiat"
                        className="bg-muted/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Secció Estil del PDF */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#6b7c4c] flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Estil de color del PDF
                </h3>
                
                <p className="text-sm text-muted-foreground">
                  Escull el color principal del document. El verd oliva és gratuït, els altres colors tenen un cost de {creditsPerColor} crèdits.
                </p>

                <div className="flex items-center gap-4">
                  {COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setColorTheme(option.value)}
                      className={`relative w-10 h-10 rounded-full transition-all ${option.bgColor} ${
                        colorTheme === option.value 
                          ? 'ring-2 ring-offset-2 ring-foreground scale-110' 
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      title={option.label}
                    >
                      {colorTheme === option.value && (
                        <span className="absolute inset-0 flex items-center justify-center text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">
                    {COLOR_OPTIONS.find(o => o.value === colorTheme)?.label}
                    {!shouldSkipCredits && colorTheme !== 'olive' && (
                      <span className="text-amber-600 ml-1">(+{creditsPerColor} crèdits)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-4 p-3 rounded-lg bg-muted/50">
                  <Checkbox
                    id="toc-links"
                    checked={includeTocLinks}
                    onCheckedChange={(checked) => setIncludeTocLinks(checked === true)}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="toc-links" 
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Índex amb enllaços clicables
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Afegeix enllaços a l'índex per navegar directament als apartats{!shouldSkipCredits ? ` (+${creditsPerTocLinks} crèdits)` : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="px-8 py-4 border-t bg-muted/30 flex justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel·lar
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleGenerate(true)}
              disabled={loading || creditsLoading || isGenerating || !hasCompleteTechnicianProfile()}
              className="border-[#6b7c4c]/50 text-[#6b7c4c] hover:bg-[#6b7c4c]/10 hover:border-[#6b7c4c]"
            >
              <FileText className="w-4 h-4 mr-2" />
              Generar Borrador
            </Button>
            {/* Check if demo user OR trial user can generate final PDF */}
            {(isDemoUser && !demoSettings.allowFinalPdf) || canOnlyGenerateDrafts ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                      >
                        <FileDown className="w-4 h-4 mr-2" />
                        Generar PDF definitiu
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canOnlyGenerateDrafts ? (
                      <p>Durant el període de prova ({trialDaysRemaining} dies restants) només pots generar esborranys. Subscriu-te per generar PDFs definitius.</p>
                    ) : (
                      <p>Només pots generar esborranys en mode demo</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                onClick={() => {
                  if (!hasCompleteTechnicianProfile()) {
                    toast.error("Dades del tècnic incompletes", {
                      description: "Omple el teu perfil amb totes les dades del tècnic des del menú d'usuari → El meu perfil."
                    });
                    return;
                  }
                  // Skip credit check for demo users with skipCreditsLogic
                  if (!shouldSkipCredits) {
                    const totalCreditsNeeded = calculateTotalCredits(false);
                    if (credits < totalCreditsNeeded) {
                      setShowInsufficientCredits(true);
                      return;
                    }
                    // Check if confirmation is disabled
                    if (!getCreditConfirmationDisabled("generate_pdf")) {
                      setShowCreditConfirmation(true);
                      return;
                    }
                  }
                  handleGenerate(false);
                }}
                disabled={loading || isGenerating || !hasCompleteTechnicianProfile()}
                className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificant...
                  </>
                ) : shouldSkipCredits ? (
                  <>
                    <FileDown className="w-4 h-4 mr-2" />
                    Generar PDF definitiu
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4 mr-2" />
                    Generar PDF ({calculateTotalCredits(false)} crèdits)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Modal de confirmació de crèdits */}
        <CreditConfirmationModal
          open={showCreditConfirmation}
          onOpenChange={setShowCreditConfirmation}
          actionType="generate_pdf"
          creditCost={calculateTotalCredits(false)}
          currentCredits={credits}
          onConfirm={() => handleGenerate(false)}
        />

        {/* Modal de crèdits insuficients */}
        <InsufficientCreditsModal
          open={showInsufficientCredits}
          onClose={() => setShowInsufficientCredits(false)}
          requiredCredits={calculateTotalCredits(false)}
          currentCredits={credits}
          userId={userId || ""}
        />
      </DialogContent>
    </Dialog>
  );
};

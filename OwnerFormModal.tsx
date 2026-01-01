import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Save, User, Users, Building2, Loader2, LogOut, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type OwnerType = "individual" | "couple" | "company";

// Validació DNI/NIE/CIF
function validDniCifNie(dni: string): boolean {
  dni = dni.toUpperCase();
  const letras = "TRWAGMYFPDXBNJZSQVHLCKE";

  if (!/^[A-Z0-9]{9}$/.test(dni)) {
    return false;
  }

  // NIF estàndard (8 números + 1 lletra)
  if (/^[0-9]{8}[A-Z]$/.test(dni)) {
    const numero = parseInt(dni.slice(0, 8), 10);
    const letra = dni[8];
    return letra === letras[numero % 23];
  }

  // NIE (X, Y, Z seguit de 7 números i una lletra)
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(dni)) {
    const reemplazo: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    const numero = reemplazo[dni[0]] + dni.slice(1, 8);
    const letra = dni[8];
    return letra === letras[parseInt(numero, 10) % 23];
  }

  // CIF (lletra + 7 números + lletra/número)
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

  // NIE especial (T seguit de 8 dígits)
  if (/^T[0-9]{8}$/.test(dni)) {
    return true;
  }

  return false;
}

// Validació telèfon (format espanyol: +34, 6XX, 7XX, 8XX, 9XX amb 9 dígits o format internacional)
function validPhone(phone: string): boolean {
  const cleanPhone = phone.replace(/[\s\-\.\(\)]/g, '');
  // Format espanyol: 9 dígits començant per 6, 7, 8, 9 o amb prefix +34
  const spanishRegex = /^(\+34)?[6789]\d{8}$/;
  // Format internacional genèric: + seguit de 7-15 dígits
  const internationalRegex = /^\+\d{7,15}$/;
  return spanishRegex.test(cleanPhone) || internationalRegex.test(cleanPhone);
}

interface OwnerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface OwnerData {
  tipus_propietari: OwnerType;
  // Individual / Primera persona
  nom: string;
  cognoms: string;
  dni: string;
  telefon: string;
  email: string;
  adreca: string;
  numero: string;
  codi_postal: string;
  poblacio: string;
  // Segona persona (couple)
  nom_2: string;
  cognoms_2: string;
  dni_2: string;
  telefon_2: string;
  email_2: string;
  adreca_2: string;
  numero_2: string;
  codi_postal_2: string;
  poblacio_2: string;
  // Empresa
  rao_social: string;
  nif_empresa: string;
  telefon_empresa: string;
  email_empresa: string;
  adreca_empresa: string;
  numero_empresa: string;
  codi_postal_empresa: string;
  poblacio_empresa: string;
  // Representant
  representant_nom: string;
  representant_cognoms: string;
  representant_dni: string;
}

const defaultOwnerData: OwnerData = {
  tipus_propietari: "individual",
  nom: "",
  cognoms: "",
  dni: "",
  telefon: "",
  email: "",
  adreca: "",
  numero: "",
  codi_postal: "",
  poblacio: "",
  nom_2: "",
  cognoms_2: "",
  dni_2: "",
  telefon_2: "",
  email_2: "",
  adreca_2: "",
  numero_2: "",
  codi_postal_2: "",
  poblacio_2: "",
  rao_social: "",
  nif_empresa: "",
  telefon_empresa: "",
  email_empresa: "",
  adreca_empresa: "",
  numero_empresa: "",
  codi_postal_empresa: "",
  poblacio_empresa: "",
  representant_nom: "",
  representant_cognoms: "",
  representant_dni: "",
};

export const OwnerFormModal = ({
  open,
  onOpenChange,
  projectId,
}: OwnerFormModalProps) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<OwnerData>(defaultOwnerData);
  const [ownerDataId, setOwnerDataId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && projectId) {
      loadData();
    }
  }, [open, projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar dades guardades de la nova taula
      const { data: ownerData, error } = await supabase
        .from("project_owner_data")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching owner data:", error);
      }

      if (ownerData) {
        setOwnerDataId(ownerData.id);
        const savedData = ownerData.form_data as Record<string, unknown>;
        setFormData({
          ...defaultOwnerData,
          tipus_propietari: (ownerData.owner_type as OwnerType) || "individual",
          ...savedData,
        } as OwnerData);
      } else {
        setOwnerDataId(null);
        setFormData(defaultOwnerData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error(language === "ca" ? "Error carregant les dades" : "Error cargando los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof OwnerData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validar camps abans de guardar
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const dniError = language === "ca" ? "El DNI/NIE no és vàlid" : "El DNI/NIE no es válido";
    const phoneError = language === "ca" ? "El format del telèfon no és vàlid" : "El formato del teléfono no es válido";
    const cifError = language === "ca" ? "El NIF/CIF no és vàlid" : "El NIF/CIF no es válido";
    
    if (formData.tipus_propietari === "individual" || formData.tipus_propietari === "couple") {
      if (formData.dni && !validDniCifNie(formData.dni)) {
        errors.dni = dniError;
      }
      if (formData.telefon && !validPhone(formData.telefon)) {
        errors.telefon = phoneError;
      }
    }
    
    if (formData.tipus_propietari === "couple") {
      if (formData.dni_2 && !validDniCifNie(formData.dni_2)) {
        errors.dni_2 = dniError;
      }
      if (formData.telefon_2 && !validPhone(formData.telefon_2)) {
        errors.telefon_2 = phoneError;
      }
    }
    
    if (formData.tipus_propietari === "company") {
      if (formData.nif_empresa && !validDniCifNie(formData.nif_empresa)) {
        errors.nif_empresa = cifError;
      }
      if (formData.telefon_empresa && !validPhone(formData.telefon_empresa)) {
        errors.telefon_empresa = phoneError;
      }
      if (formData.representant_dni && !validDniCifNie(formData.representant_dni)) {
        errors.representant_dni = dniError;
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (closeAfter: boolean = false) => {
    if (!validateForm()) {
      toast.error(language === "ca" ? "Si us plau, corregeix els errors del formulari" : "Por favor, corrige los errores del formulario");
      return;
    }
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(language === "ca" ? "Has d'estar autenticat per guardar" : "Debes estar autenticado para guardar");
        return;
      }

      const formDataToSave = { ...formData };
      delete (formDataToSave as any).tipus_propietari;

      if (ownerDataId) {
        const { error } = await supabase
          .from("project_owner_data")
          .update({
            owner_type: formData.tipus_propietari,
            form_data: JSON.parse(JSON.stringify(formDataToSave)),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ownerDataId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("project_owner_data")
          .insert([
            {
              project_id: projectId,
              owner_type: formData.tipus_propietari,
              form_data: JSON.parse(JSON.stringify(formDataToSave)),
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        if (data) setOwnerDataId(data.id);
      }

      toast.success(language === "ca" ? "Dades guardades correctament" : "Datos guardados correctamente");
      if (closeAfter) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(language === "ca" ? "Error guardant les dades" : "Error guardando los datos");
    } finally {
      setSaving(false);
    }
  };

  // PDF generation removed

  const inputClasses =
    "h-12 text-base bg-background border-2 focus:border-[#6b7c4c] focus:ring-[#6b7c4c]/20 transition-colors";
  const labelClasses = "text-sm font-semibold text-foreground mb-2 block";
  const sectionClasses =
    "bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6 space-y-5";
  const sectionTitleClasses =
    "text-base font-semibold text-[#6b7c4c] flex items-center gap-2 mb-4";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
              <User className="h-6 w-6 text-[#6b7c4c]" />
            </div>
            <div className="flex-1">
              <span className="block text-[#6b7c4c]">
                {language === "ca" ? "Propietari/a - Promotor/a" : "Propietario/a - Promotor/a"}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {language === "ca" ? "Dades del propietari o promotor del projecte" : "Datos del propietario o promotor del proyecto"}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
            <p className="text-base text-muted-foreground">
              {language === "ca" ? "Carregant dades..." : "Cargando datos..."}
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="p-8 space-y-6">
              {/* Selector de tipus */}
              <div className="bg-gradient-to-br from-[#6b7c4c]/5 to-[#6b7c4c]/10 rounded-xl p-6 border-2 border-[#6b7c4c]/30">
                <Label className="text-base font-semibold text-foreground mb-4 block">
                  {language === "ca" ? "Tipus de propietari/a - promotor/a" : "Tipo de propietario/a - promotor/a"}
                </Label>
                <RadioGroup
                  value={formData.tipus_propietari}
                  onValueChange={(val) =>
                    handleFieldChange("tipus_propietari", val as OwnerType)
                  }
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <div
                    className={`relative flex items-center space-x-3 rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
                      formData.tipus_propietari === "individual"
                        ? "border-[#6b7c4c] bg-[#6b7c4c]/10 shadow-sm"
                        : "border-muted-foreground/20 hover:border-[#6b7c4c]/50"
                    }`}
                  >
                    <RadioGroupItem
                      value="individual"
                      id="individual"
                      className="sr-only"
                    />
                    <label
                      htmlFor="individual"
                      className="flex items-center gap-3 cursor-pointer w-full"
                    >
                      <div
                        className={`p-3 rounded-lg ${
                          formData.tipus_propietari === "individual"
                            ? "bg-[#6b7c4c] text-white"
                            : "bg-muted"
                        }`}
                      >
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-semibold block text-base">
                          {language === "ca" ? "Una persona" : "Una persona"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {language === "ca" ? "Propietari individual" : "Propietario individual"}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div
                    className={`relative flex items-center space-x-3 rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
                      formData.tipus_propietari === "couple"
                        ? "border-[#6b7c4c] bg-[#6b7c4c]/10 shadow-sm"
                        : "border-muted-foreground/20 hover:border-[#6b7c4c]/50"
                    }`}
                  >
                    <RadioGroupItem value="couple" id="couple" className="sr-only" />
                    <label
                      htmlFor="couple"
                      className="flex items-center gap-3 cursor-pointer w-full"
                    >
                      <div
                        className={`p-3 rounded-lg ${
                          formData.tipus_propietari === "couple"
                            ? "bg-[#6b7c4c] text-white"
                            : "bg-muted"
                        }`}
                      >
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-semibold block text-base">
                          {language === "ca" ? "Dues persones" : "Dos personas"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {language === "ca" ? "Copropietaris" : "Copropietarios"}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div
                    className={`relative flex items-center space-x-3 rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
                      formData.tipus_propietari === "company"
                        ? "border-[#6b7c4c] bg-[#6b7c4c]/10 shadow-sm"
                        : "border-muted-foreground/20 hover:border-[#6b7c4c]/50"
                    }`}
                  >
                    <RadioGroupItem
                      value="company"
                      id="company"
                      className="sr-only"
                    />
                    <label
                      htmlFor="company"
                      className="flex items-center gap-3 cursor-pointer w-full"
                    >
                      <div
                        className={`p-3 rounded-lg ${
                          formData.tipus_propietari === "company"
                            ? "bg-[#6b7c4c] text-white"
                            : "bg-muted"
                        }`}
                      >
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-semibold block text-base">
                          {language === "ca" ? "Empresa" : "Empresa"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {language === "ca" ? "Persona jurídica" : "Persona jurídica"}
                        </span>
                      </div>
                    </label>
                  </div>
                </RadioGroup>
              </div>

              {/* Formulari segons tipus */}
              {formData.tipus_propietari === "individual" && (
                <div className={sectionClasses}>
                  <div className={sectionTitleClasses}>
                    <User className="h-5 w-5" />
                    {language === "ca" ? "Dades del propietari/a" : "Datos del propietario/a"}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className={labelClasses}>{language === "ca" ? "Nom *" : "Nombre *"}</Label>
                      <Input
                        value={formData.nom}
                        onChange={(e) => handleFieldChange("nom", e.target.value)}
                        placeholder={language === "ca" ? "Introdueix el nom" : "Introduce el nombre"}
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <Label className={labelClasses}>{language === "ca" ? "Cognoms *" : "Apellidos *"}</Label>
                      <Input
                        value={formData.cognoms}
                        onChange={(e) =>
                          handleFieldChange("cognoms", e.target.value)
                        }
                        placeholder={language === "ca" ? "Introdueix els cognoms" : "Introduce los apellidos"}
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className={labelClasses}>DNI/NIE *</Label>
                    <Input
                      value={formData.dni}
                      onChange={(e) => handleFieldChange("dni", e.target.value)}
                      placeholder={language === "ca" ? "Introdueix el DNI o NIE" : "Introduce el DNI o NIE"}
                      className={`${inputClasses} ${validationErrors.dni ? 'border-destructive' : ''}`}
                    />
                    {validationErrors.dni && (
                      <p className="text-destructive text-sm mt-1">{validationErrors.dni}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className={labelClasses}>{language === "ca" ? "Telèfon *" : "Teléfono *"}</Label>
                      <Input
                        value={formData.telefon}
                        onChange={(e) => handleFieldChange("telefon", e.target.value)}
                        placeholder={language === "ca" ? "Introdueix el telèfon" : "Introduce el teléfono"}
                        className={`${inputClasses} ${validationErrors.telefon ? 'border-destructive' : ''}`}
                      />
                      {validationErrors.telefon && (
                        <p className="text-destructive text-sm mt-1">{validationErrors.telefon}</p>
                      )}
                    </div>
                    <div>
                      <Label className={labelClasses}>{language === "ca" ? "Correu electrònic *" : "Correo electrónico *"}</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleFieldChange("email", e.target.value)}
                        placeholder={language === "ca" ? "Introdueix el correu electrònic" : "Introduce el correo electrónico"}
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="text-sm font-semibold text-[#6b7c4c] mb-3 flex items-center gap-2">
                      <div className="w-8 h-0.5 bg-[#6b7c4c]/30 rounded" />
                      {language === "ca" ? "Domicili" : "Domicilio"}
                      <div className="flex-1 h-0.5 bg-[#6b7c4c]/30 rounded" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="md:col-span-2">
                        <Label className={labelClasses}>{language === "ca" ? "Adreça *" : "Dirección *"}</Label>
                        <Input
                          value={formData.adreca}
                          onChange={(e) =>
                            handleFieldChange("adreca", e.target.value)
                          }
                          placeholder={language === "ca" ? "Carrer, avinguda, plaça..." : "Calle, avenida, plaza..."}
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Número" : "Número"}</Label>
                        <Input
                          value={formData.numero}
                          onChange={(e) =>
                            handleFieldChange("numero", e.target.value)
                          }
                          placeholder={language === "ca" ? "Núm." : "Núm."}
                          className={inputClasses}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Codi Postal *" : "Código Postal *"}</Label>
                        <Input
                          value={formData.codi_postal}
                          onChange={(e) =>
                            handleFieldChange("codi_postal", e.target.value)
                          }
                          placeholder="00000"
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Població *" : "Población *"}</Label>
                        <Input
                          value={formData.poblacio}
                          onChange={(e) =>
                            handleFieldChange("poblacio", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix la població" : "Introduce la población"}
                          className={inputClasses}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formData.tipus_propietari === "couple" && (
                <>
                  {/* Persona 1 */}
                  <div className={sectionClasses}>
                    <div className={sectionTitleClasses}>
                      <User className="h-5 w-5" />
                      {language === "ca" ? "Primera persona propietària" : "Primera persona propietaria"}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Nom *" : "Nombre *"}</Label>
                        <Input
                          value={formData.nom}
                          onChange={(e) =>
                            handleFieldChange("nom", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix el nom" : "Introduce el nombre"}
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Cognoms *" : "Apellidos *"}</Label>
                        <Input
                          value={formData.cognoms}
                          onChange={(e) =>
                            handleFieldChange("cognoms", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix els cognoms" : "Introduce los apellidos"}
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className={labelClasses}>DNI/NIE *</Label>
                      <Input
                        value={formData.dni}
                        onChange={(e) => handleFieldChange("dni", e.target.value)}
                        placeholder={language === "ca" ? "Introdueix el DNI o NIE" : "Introduce el DNI o NIE"}
                        className={`${inputClasses} ${validationErrors.dni ? 'border-destructive' : ''}`}
                      />
                      {validationErrors.dni && (
                        <p className="text-destructive text-sm mt-1">{validationErrors.dni}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Telèfon *" : "Teléfono *"}</Label>
                        <Input
                          value={formData.telefon}
                          onChange={(e) => handleFieldChange("telefon", e.target.value)}
                          placeholder={language === "ca" ? "Introdueix el telèfon" : "Introduce el teléfono"}
                          className={`${inputClasses} ${validationErrors.telefon ? 'border-destructive' : ''}`}
                        />
                        {validationErrors.telefon && (
                          <p className="text-destructive text-sm mt-1">{validationErrors.telefon}</p>
                        )}
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Correu electrònic *" : "Correo electrónico *"}</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleFieldChange("email", e.target.value)}
                          placeholder={language === "ca" ? "Introdueix el correu electrònic" : "Introduce el correo electrónico"}
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="text-sm font-semibold text-[#6b7c4c] mb-3 flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-[#6b7c4c]/30 rounded" />
                        {language === "ca" ? "Domicili" : "Domicilio"}
                        <div className="flex-1 h-0.5 bg-[#6b7c4c]/30 rounded" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="md:col-span-2">
                          <Label className={labelClasses}>{language === "ca" ? "Adreça *" : "Dirección *"}</Label>
                          <Input
                            value={formData.adreca}
                            onChange={(e) =>
                              handleFieldChange("adreca", e.target.value)
                            }
                            placeholder={language === "ca" ? "Carrer, avinguda, plaça..." : "Calle, avenida, plaza..."}
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Número" : "Número"}</Label>
                          <Input
                            value={formData.numero}
                            onChange={(e) =>
                              handleFieldChange("numero", e.target.value)
                            }
                            placeholder={language === "ca" ? "Núm." : "Núm."}
                            className={inputClasses}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Codi Postal *" : "Código Postal *"}</Label>
                          <Input
                            value={formData.codi_postal}
                            onChange={(e) =>
                              handleFieldChange("codi_postal", e.target.value)
                            }
                            placeholder="00000"
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Població *" : "Población *"}</Label>
                          <Input
                            value={formData.poblacio}
                            onChange={(e) =>
                              handleFieldChange("poblacio", e.target.value)
                            }
                            placeholder={language === "ca" ? "Introdueix la població" : "Introduce la población"}
                            className={inputClasses}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Persona 2 */}
                  <div className={sectionClasses}>
                    <div className={sectionTitleClasses}>
                      <User className="h-5 w-5" />
                      {language === "ca" ? "Segona persona propietària" : "Segunda persona propietaria"}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Nom *" : "Nombre *"}</Label>
                        <Input
                          value={formData.nom_2}
                          onChange={(e) =>
                            handleFieldChange("nom_2", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix el nom" : "Introduce el nombre"}
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Cognoms *" : "Apellidos *"}</Label>
                        <Input
                          value={formData.cognoms_2}
                          onChange={(e) =>
                            handleFieldChange("cognoms_2", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix els cognoms" : "Introduce los apellidos"}
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className={labelClasses}>DNI/NIE *</Label>
                      <Input
                        value={formData.dni_2}
                        onChange={(e) =>
                          handleFieldChange("dni_2", e.target.value)
                        }
                        placeholder={language === "ca" ? "Introdueix el DNI o NIE" : "Introduce el DNI o NIE"}
                        className={`${inputClasses} ${validationErrors.dni_2 ? 'border-destructive' : ''}`}
                      />
                      {validationErrors.dni_2 && (
                        <p className="text-destructive text-sm mt-1">{validationErrors.dni_2}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Telèfon" : "Teléfono"}</Label>
                        <Input
                          value={formData.telefon_2}
                          onChange={(e) => handleFieldChange("telefon_2", e.target.value)}
                          placeholder={language === "ca" ? "Introdueix el telèfon (opcional)" : "Introduce el teléfono (opcional)"}
                          className={`${inputClasses} ${validationErrors.telefon_2 ? 'border-destructive' : ''}`}
                        />
                        {validationErrors.telefon_2 && (
                          <p className="text-destructive text-sm mt-1">{validationErrors.telefon_2}</p>
                        )}
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Correu electrònic" : "Correo electrónico"}</Label>
                        <Input
                          type="email"
                          value={formData.email_2}
                          onChange={(e) => handleFieldChange("email_2", e.target.value)}
                          placeholder={language === "ca" ? "Introdueix el correu electrònic (opcional)" : "Introduce el correo electrónico (opcional)"}
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="text-sm font-semibold text-[#6b7c4c] mb-3 flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-[#6b7c4c]/30 rounded" />
                        {language === "ca" ? "Domicili" : "Domicilio"}
                        <div className="flex-1 h-0.5 bg-[#6b7c4c]/30 rounded" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="md:col-span-2">
                          <Label className={labelClasses}>{language === "ca" ? "Adreça *" : "Dirección *"}</Label>
                          <Input
                            value={formData.adreca_2}
                            onChange={(e) =>
                              handleFieldChange("adreca_2", e.target.value)
                            }
                            placeholder={language === "ca" ? "Carrer, avinguda, plaça..." : "Calle, avenida, plaza..."}
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Número" : "Número"}</Label>
                          <Input
                            value={formData.numero_2}
                            onChange={(e) =>
                              handleFieldChange("numero_2", e.target.value)
                            }
                            placeholder={language === "ca" ? "Núm." : "Núm."}
                            className={inputClasses}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Codi Postal *" : "Código Postal *"}</Label>
                          <Input
                            value={formData.codi_postal_2}
                            onChange={(e) =>
                              handleFieldChange("codi_postal_2", e.target.value)
                            }
                            placeholder="00000"
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Població *" : "Población *"}</Label>
                          <Input
                            value={formData.poblacio_2}
                            onChange={(e) =>
                              handleFieldChange("poblacio_2", e.target.value)
                            }
                            placeholder={language === "ca" ? "Introdueix la població" : "Introduce la población"}
                            className={inputClasses}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {formData.tipus_propietari === "company" && (
                <>
                  {/* Dades de l'empresa */}
                  <div className={sectionClasses}>
                    <div className={sectionTitleClasses}>
                      <Building2 className="h-5 w-5" />
                      {language === "ca" ? "Dades de l'empresa" : "Datos de la empresa"}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                        <Label className={labelClasses}>{language === "ca" ? "Raó Social *" : "Razón Social *"}</Label>
                        <Input
                          value={formData.rao_social}
                          onChange={(e) =>
                            handleFieldChange("rao_social", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix la raó social de l'empresa" : "Introduce la razón social de la empresa"}
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <Label className={labelClasses}>NIF/CIF *</Label>
                        <Input
                          value={formData.nif_empresa}
                          onChange={(e) =>
                            handleFieldChange("nif_empresa", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix el NIF o CIF" : "Introduce el NIF o CIF"}
                          className={`${inputClasses} ${validationErrors.nif_empresa ? 'border-destructive' : ''}`}
                        />
                        {validationErrors.nif_empresa && (
                          <p className="text-destructive text-sm mt-1">{validationErrors.nif_empresa}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Telèfon *" : "Teléfono *"}</Label>
                        <Input
                          value={formData.telefon_empresa}
                          onChange={(e) => handleFieldChange("telefon_empresa", e.target.value)}
                          placeholder={language === "ca" ? "Introdueix el telèfon de l'empresa" : "Introduce el teléfono de la empresa"}
                          className={`${inputClasses} ${validationErrors.telefon_empresa ? 'border-destructive' : ''}`}
                        />
                        {validationErrors.telefon_empresa && (
                          <p className="text-destructive text-sm mt-1">{validationErrors.telefon_empresa}</p>
                        )}
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Correu electrònic *" : "Correo electrónico *"}</Label>
                        <Input
                          type="email"
                          value={formData.email_empresa}
                          onChange={(e) => handleFieldChange("email_empresa", e.target.value)}
                          placeholder={language === "ca" ? "Introdueix el correu electrònic de l'empresa" : "Introduce el correo electrónico de la empresa"}
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="text-sm font-semibold text-[#6b7c4c] mb-3 flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-[#6b7c4c]/30 rounded" />
                        {language === "ca" ? "Domicili social" : "Domicilio social"}
                        <div className="flex-1 h-0.5 bg-[#6b7c4c]/30 rounded" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="md:col-span-2">
                          <Label className={labelClasses}>{language === "ca" ? "Adreça *" : "Dirección *"}</Label>
                          <Input
                            value={formData.adreca_empresa}
                            onChange={(e) =>
                              handleFieldChange("adreca_empresa", e.target.value)
                            }
                            placeholder={language === "ca" ? "Carrer, avinguda, plaça..." : "Calle, avenida, plaza..."}
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Número" : "Número"}</Label>
                          <Input
                            value={formData.numero_empresa}
                            onChange={(e) =>
                              handleFieldChange("numero_empresa", e.target.value)
                            }
                            placeholder={language === "ca" ? "Núm." : "Núm."}
                            className={inputClasses}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Codi Postal *" : "Código Postal *"}</Label>
                          <Input
                            value={formData.codi_postal_empresa}
                            onChange={(e) =>
                              handleFieldChange(
                                "codi_postal_empresa",
                                e.target.value
                              )
                            }
                            placeholder="00000"
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <Label className={labelClasses}>{language === "ca" ? "Població *" : "Población *"}</Label>
                          <Input
                            value={formData.poblacio_empresa}
                            onChange={(e) =>
                              handleFieldChange("poblacio_empresa", e.target.value)
                            }
                            placeholder={language === "ca" ? "Introdueix la població" : "Introduce la población"}
                            className={inputClasses}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Representant legal */}
                  <div className={sectionClasses}>
                    <div className={sectionTitleClasses}>
                      <User className="h-5 w-5" />
                      {language === "ca" ? "Representant legal" : "Representante legal"}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Nom *" : "Nombre *"}</Label>
                        <Input
                          value={formData.representant_nom}
                          onChange={(e) =>
                            handleFieldChange("representant_nom", e.target.value)
                          }
                          placeholder={language === "ca" ? "Introdueix el nom" : "Introduce el nombre"}
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <Label className={labelClasses}>{language === "ca" ? "Cognoms *" : "Apellidos *"}</Label>
                        <Input
                          value={formData.representant_cognoms}
                          onChange={(e) =>
                            handleFieldChange(
                              "representant_cognoms",
                              e.target.value
                            )
                          }
                          placeholder={language === "ca" ? "Introdueix els cognoms" : "Introduce los apellidos"}
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className={labelClasses}>
                        {language === "ca" ? "DNI/NIE del representant *" : "DNI/NIE del representante *"}
                      </Label>
                      <Input
                        value={formData.representant_dni}
                        onChange={(e) =>
                          handleFieldChange("representant_dni", e.target.value)
                        }
                        placeholder={language === "ca" ? "Introdueix el DNI o NIE del representant" : "Introduce el DNI o NIE del representante"}
                        className={`${inputClasses} ${validationErrors.representant_dni ? 'border-destructive' : ''}`}
                      />
                      {validationErrors.representant_dni && (
                        <p className="text-destructive text-sm mt-1">{validationErrors.representant_dni}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="px-8 py-4 border-t bg-muted/30 flex justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            {language === "ca" ? "Cancel·lar" : "Cancelar"}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="border-[#6b7c4c]/30 text-[#6b7c4c] hover:bg-[#6b7c4c]/10 hover:border-[#6b7c4c]"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving 
                ? (language === "ca" ? "Guardant..." : "Guardando...") 
                : (language === "ca" ? "Guardar" : "Guardar")}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-[#6b7c4c] hover:bg-[#5a6a40] text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {saving 
                ? (language === "ca" ? "Guardant..." : "Guardando...") 
                : (language === "ca" ? "Guardar i sortir" : "Guardar y salir")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useState, useEffect, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Save, FileText, Loader2, FolderOpen, Upload, X, File, ChevronDown, ChevronRight, Lock, MapPin, FileImage, FileDown, LogOut } from "lucide-react";
import jsPDF from "jspdf";
import { LocationMapField } from "./LocationMapField";
import { MultiPdfUpload } from "./MultiPdfUpload";

// Estructura real del JSON:
// sections[] -> pestanyes (tabs)
//   - id, label
//   - sections[] -> grups dins la pestanya (accordions)
//     - id, label
//     - fields[] -> camps del formulari
//       - id, label, type

interface Field {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface SubSection {
  id: string;
  label: string;
  fields?: Field[];
}

interface MainSection {
  id: string;
  label: string;
  sections?: SubSection[];
  fields?: Field[];
}

interface Template {
  sections: MainSection[];
}

interface UserProfile {
  full_name: string | null;
  email: string | null;
  nif: string | null;
  phone: string | null;
  street: string | null;
  street_number: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
}

interface ProjectData {
  cadastral_reference: string | null;
  address: string | null;
  street: string | null;
  street_number: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}

interface CadastreLookupData {
  address?: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  municipality: string;
  province: string;
  latitude: number;
  longitude: number;
}

interface ProjectTypeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTypeId: string | null;
}

// Camps que s'han d'omplir automàticament des del perfil d'usuari (autor_projecte)
const AUTHOR_FIELD_MAPPING: Record<string, keyof UserProfile> = {
  "nom": "full_name",
  "cognoms": "full_name", // Usarem full_name per ara
  "dni": "nif",
  "telefon": "phone",
  "email": "email",
  "adreca": "street",
};

// Camps que s'han d'omplir automàticament des del projecte
const PROJECT_FIELD_MAPPING: Record<string, keyof ProjectData> = {
  "referencia_cadastral": "cadastral_reference",
};

export const ProjectTypeFormModal = ({
  open,
  onOpenChange,
  projectId,
  projectTypeId,
}: ProjectTypeFormModalProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [projectTypeName, setProjectTypeName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [documentationId, setDocumentationId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [cadastreData, setCadastreData] = useState<CadastreLookupData | null>(null);
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (open && projectTypeId) {
      loadTemplateAndData();
    }
  }, [open, projectTypeId, projectId]);

  // Omplir automàticament camps d'adreça del formulari (prioritat: dades del cadastre)
  useEffect(() => {
    if (!open || !template) return;

    // Dades del cadastre tenen prioritat
    const addr = cadastreData?.street || projectData?.street || projectData?.address || "";
    const num = cadastreData?.streetNumber || projectData?.street_number || "";
    const cp = cadastreData?.postalCode || projectData?.postal_code || "";
    const city = cadastreData?.municipality || projectData?.city || "";
    const province = cadastreData?.province || projectData?.province || "";

    if (!addr && !num && !cp && !city && !province) return;

    // Patrons per identificar camps d'adreça (per field.id)
    const adrecaPatterns = ["adreca", "carrer", "direccio", "via", "calle"];
    const numeroPatterns = ["numero", "num", "number"];
    const cpPatterns = ["codi_postal", "cp", "codipostal", "postal_code", "codigo_postal"];
    const poblacioPatterns = ["poblacio", "ciutat", "municipi", "city", "municipio", "localitat"];
    const provinciaPatterns = ["provincia", "prov", "province"];

    const normalizeKey = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const matchesPattern = (fieldId: string, patterns: string[]) => {
      const id = normalizeKey(fieldId);
      return patterns.some((p) => id === p || id.includes(p));
    };

    const fillIfEmpty = (next: Record<string, unknown>, keys: string[], value: string) => {
      if (!value) return false;
      let changed = false;
      for (const k of keys) {
        const current = next[k];
        if (current === undefined || current === null || current === "") {
          next[k] = value;
          changed = true;
        }
      }
      return changed;
    };

    setFormData((prev) => {
      const next = { ...prev };
      let changed = false;

      const applyToField = (field: Field, keyCandidates: string[]) => {
        if (matchesPattern(field.id, adrecaPatterns)) changed ||= fillIfEmpty(next, keyCandidates, addr);
        if (matchesPattern(field.id, numeroPatterns)) changed ||= fillIfEmpty(next, keyCandidates, num);
        if (matchesPattern(field.id, cpPatterns)) changed ||= fillIfEmpty(next, keyCandidates, cp);
        if (matchesPattern(field.id, poblacioPatterns)) changed ||= fillIfEmpty(next, keyCandidates, city);
        if (matchesPattern(field.id, provinciaPatterns)) changed ||= fillIfEmpty(next, keyCandidates, province);
      };

      // Escanejar totes les seccions i subseccions de la plantilla
      template.sections.forEach((mainSection) => {
        // Camps directes de la secció principal (aquí el codi antic feia servir keys inconsistents)
        if (mainSection.fields) {
          mainSection.fields.forEach((field) => {
            const keyCandidates = [
              `${mainSection.id}.${field.id}`, // per coherència futura
              field.id, // alguns llocs del codi ho compten així
              `.${field.id}`, // el renderField actual ho genera quan subsectionId és ""
            ];
            applyToField(field, keyCandidates);
          });
        }

        // Subseccions amb camps (aquí la clau correcta és subsection.id.field.id)
        if (mainSection.sections) {
          mainSection.sections.forEach((subSection) => {
            if (subSection.fields) {
              subSection.fields.forEach((field) => {
                const keyCandidates = [`${subSection.id}.${field.id}`];
                applyToField(field, keyCandidates);
              });
            }
          });
        }
      });

      return changed ? next : prev;
    });
  }, [open, projectData, cadastreData, template, documentationId, loading]);

  const loadTemplateAndData = async () => {
    if (!projectTypeId) return;
    
    setLoading(true);
    try {
      // Carregar dades de l'usuari actual
      const { data: { user } } = await supabase.auth.getUser();
      let profile: UserProfile | null = null;
      
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email, nif, phone, street, street_number, city, postal_code, province")
          .eq("id", user.id)
          .single();
        
        if (profileData) {
          profile = profileData as UserProfile;
          setUserProfile(profile);
        }
      }

      // Carregar dades del projecte
      const { data: projectDataResult } = await supabase
        .from("projects")
        .select("cadastral_reference, address, street, street_number, city, province, postal_code")
        .eq("id", projectId)
        .single();
      
      if (projectDataResult) {
        setProjectData(projectDataResult as ProjectData);

        // Obtenir dades exactes via referència cadastral (per omplir camps i mapa)
        if (projectDataResult.cadastral_reference) {
          const { data: cadData, error: cadError } = await supabase.functions.invoke(
            "cadastre-lookup",
            { body: { cadastralReference: projectDataResult.cadastral_reference } }
          );

          if (!cadError && cadData?.success && cadData.data) {
            setCadastreData(cadData.data as CadastreLookupData);
          } else {
            setCadastreData(null);
            // No bloquegem el formulari: fem fallback a les dades del projecte
            console.warn("Cadastre lookup failed", cadError || cadData);
          }
        } else {
          setCadastreData(null);
        }
      }

      // Carregar plantilla del tipus de projecte
      const { data: typeData, error: typeError } = await supabase
        .from("project_types")
        .select("id, name_ca, template_json")
        .eq("id", projectTypeId)
        .single();

      if (typeError) {
        console.error("Error fetching project type:", typeError);
        toast.error("Error carregant el tipus de projecte");
        setLoading(false);
        return;
      }

      if (typeData) {
        setProjectTypeName(typeData.name_ca);
        
        const templateJson = typeData.template_json as unknown as Template;
        if (templateJson && templateJson.sections && templateJson.sections.length > 0) {
          setTemplate(templateJson);
          setActiveTab(templateJson.sections[0].id);
          
          // Obrir per defecte la primera subsecció de cada secció principal
          const initialOpenSections: Record<string, boolean> = {};
          templateJson.sections.forEach((section) => {
            if (section.sections && section.sections.length > 0) {
              initialOpenSections[`${section.id}-${section.sections[0].id}`] = true;
            }
          });
          setOpenSections(initialOpenSections);
        } else {
          setTemplate(null);
        }
      } else {
        setTemplate(null);
        setProjectTypeName("");
      }

      // Carregar dades guardades de la taula project_documentation
      const { data: docData, error: docError } = await supabase
        .from("project_documentation")
        .select("*")
        .eq("project_id", projectId)
        .eq("project_type_id", projectTypeId)
        .maybeSingle();

      if (docError) {
        console.error("Error fetching documentation:", docError);
      }

      if (docData) {
        setDocumentationId(docData.id);
        setFormData(docData.form_data as Record<string, unknown> || {});
      } else {
        setDocumentationId(null);
        // Pre-omplir amb dades de l'usuari i projecte
        const prefilledData: Record<string, unknown> = {};
        const newLockedFields = new Set<string>();

        // Pre-omplir camps de l'autor del projecte
        if (profile) {
          Object.entries(AUTHOR_FIELD_MAPPING).forEach(([fieldId, profileKey]) => {
            const fullFieldId = `autor_projecte.${fieldId}`;
            const value = profile[profileKey];
            if (value) {
              prefilledData[fullFieldId] = value;
              newLockedFields.add(fullFieldId);
            }
          });
        }

        // Pre-omplir referència cadastral des del projecte
        if (projectDataResult?.cadastral_reference) {
          const fullFieldId = `emplaçament_grua.referencia_cadastral`;
          prefilledData[fullFieldId] = projectDataResult.cadastral_reference;
          newLockedFields.add(fullFieldId);
        }

        // Pre-omplir dades d'adreça del projecte (editable)
        if (projectDataResult) {
          // IMPORTANT: aquí cal usar IDs de SUBSECCIONS reals (p. ex. "adreca_situacio"),
          // no només IDs genèrics com "situacio".
          const sections = [
            "emplaçament_grua",
            "emplaçament",
            "situacio",
            "localitzacio",
            "adreca_situacio",
          ];

          const addr = projectDataResult.street || projectDataResult.address || "";
          const num = projectDataResult.street_number || "";
          const cp = projectDataResult.postal_code || "";
          const city = projectDataResult.city || "";
          const province = projectDataResult.province || "";

          const maybeSet = (key: string, value: string) => {
            if (!value) return;
            if (
              prefilledData[key] === undefined ||
              prefilledData[key] === null ||
              prefilledData[key] === ""
            ) {
              prefilledData[key] = value;
            }
          };

          sections.forEach((s) => {
            // Adreça
            ["adreca", "carrer", "direccio"].forEach((k) =>
              maybeSet(`${s}.${k}`, addr)
            );
            // Número
            ["numero", "num"].forEach((k) => maybeSet(`${s}.${k}`, num));
            // Codi postal (en algunes plantilles el camp és "cp")
            ["codi_postal", "cp", "codipostal", "postal_code"].forEach((k) =>
              maybeSet(`${s}.${k}`, cp)
            );
            // Població
            ["poblacio", "ciutat", "municipi", "city"].forEach((k) =>
              maybeSet(`${s}.${k}`, city)
            );
            // Província (si existeix a la plantilla)
            ["provincia", "prov", "province"].forEach((k) =>
              maybeSet(`${s}.${k}`, province)
            );
          });
        }

        setFormData(prefilledData);
        setLockedFields(newLockedFields);
      }
    } catch (error) {
      console.error("Error loading template:", error);
      toast.error("Error carregant la plantilla");
    } finally {
      setLoading(false);
    }
  };
  
  // Generar ID únic per camp combinant subsection.id + field.id
  const getFullFieldId = (subsectionId: string, fieldId: string): string => {
    return `${subsectionId}.${fieldId}`;
  };
  
  // Comprovar si un camp està bloquejat
  const isFieldLocked = (fullFieldId: string): boolean => {
    return lockedFields.has(fullFieldId);
  };
  
  // Obtenir adreça del cadastre a partir de la referència cadastral
  const getCadastralAddress = (): string | null => {
    if (!projectData) return null;
    
    const parts = [
      projectData.street,
      projectData.street_number,
      projectData.postal_code,
      projectData.city,
      projectData.province
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(", ") : projectData.address;
  };

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Has d'estar autenticat per pujar arxius");
        return;
      }

      const fileExt = file.name.split('.').pop();
      // IMPORTANT: El path ha de començar amb userId per complir amb les polítiques RLS
      const fileName = `${user.id}/documentation/${projectId}_${fieldId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('ifc-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        if (uploadError.message.includes('row-level security')) {
          toast.error("No tens permisos per pujar aquest arxiu. Verifica que estàs autenticat.");
        } else {
          toast.error("No s'ha pogut pujar l'arxiu. Intenta-ho de nou.");
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('ifc-files')
        .getPublicUrl(fileName);

      handleFieldChange(fieldId, {
        fileName: file.name,
        url: publicUrl,
        uploadedAt: new Date().toISOString()
      });

      toast.success(`Document "${file.name}" afegit correctament`);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Hi ha hagut un problema pujant l'arxiu. Intenta-ho de nou.");
    }
  };

  const handleRemoveFile = (fieldId: string) => {
    handleFieldChange(fieldId, null);
  };

  const toggleSection = (sectionKey: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleSave = async (closeAfter: boolean = false) => {
    if (!projectTypeId) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Has d'estar autenticat per guardar");
        return;
      }

      if (documentationId) {
        // Actualitzar documentació existent
        const { error } = await supabase
          .from("project_documentation")
          .update({ 
            form_data: JSON.parse(JSON.stringify(formData)),
            updated_at: new Date().toISOString()
          })
          .eq("id", documentationId);

        if (error) throw error;
      } else {
        // Crear nova documentació
        const { data, error } = await supabase
          .from("project_documentation")
          .insert([{
            project_id: projectId,
            project_type_id: projectTypeId,
            form_data: JSON.parse(JSON.stringify(formData)),
            created_by: user.id
          }])
          .select()
          .single();

        if (error) throw error;
        if (data) setDocumentationId(data.id);
      }

      toast.success("Documentació guardada correctament");
      if (closeAfter) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving documentation:", error);
      toast.error("Error guardant la documentació");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      // Colors corporatius
      const primaryColor: [number, number, number] = [41, 98, 255]; // Blau
      const darkColor: [number, number, number] = [30, 41, 59]; // Gris fosc
      const lightGray: [number, number, number] = [241, 245, 249]; // Gris clar
      const mediumGray: [number, number, number] = [148, 163, 184];

      // ========== PÀGINA 1: PORTADA ==========
      // Fons degradat superior
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 100, 'F');
      
      // Forma decorativa
      doc.setFillColor(255, 255, 255);
      doc.setGState(doc.GState({ opacity: 0.1 }));
      doc.circle(pageWidth - 30, 50, 80, 'F');
      doc.circle(30, 80, 60, 'F');
      doc.setGState(doc.GState({ opacity: 1 }));

      // Títol principal
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      doc.setFont("helvetica", "bold");
      doc.text("DOCUMENTACIÓ", pageWidth / 2, 45, { align: "center" });
      doc.setFontSize(28);
      doc.text("TÈCNICA", pageWidth / 2, 60, { align: "center" });

      // Subtítol (tipus de projecte)
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(projectTypeName.toUpperCase(), pageWidth / 2, 80, { align: "center" });

      // Caixa d'informació del projecte
      const boxY = 120;
      const boxHeight = 100;
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, boxY, contentWidth, boxHeight, 5, 5, 'F');
      
      // Línia decorativa a l'esquerra
      doc.setFillColor(...primaryColor);
      doc.rect(margin, boxY, 4, boxHeight, 'F');

      // Contingut de la caixa
      doc.setTextColor(...darkColor);
      let infoY = boxY + 20;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...mediumGray);
      doc.text("REFERÈNCIA CADASTRAL", margin + 15, infoY);
      infoY += 8;
      doc.setFontSize(14);
      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "normal");
      doc.text(projectData?.cadastral_reference || "No especificada", margin + 15, infoY);
      infoY += 20;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...mediumGray);
      doc.text("EMPLAÇAMENT", margin + 15, infoY);
      infoY += 8;
      doc.setFontSize(12);
      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "normal");
      const addressParts = [
        cadastreData?.street || projectData?.street,
        cadastreData?.streetNumber || projectData?.street_number,
      ].filter(Boolean).join(", ");
      const locationParts = [
        cadastreData?.postalCode || projectData?.postal_code,
        cadastreData?.municipality || projectData?.city,
        cadastreData?.province || projectData?.province,
      ].filter(Boolean).join(" - ");
      doc.text(addressParts || "No especificada", margin + 15, infoY);
      if (locationParts) {
        infoY += 6;
        doc.text(locationParts, margin + 15, infoY);
      }

      // Data de generació
      doc.setFontSize(10);
      doc.setTextColor(...mediumGray);
      doc.text(`Document generat el ${new Date().toLocaleDateString('ca-ES', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      })}`, pageWidth / 2, pageHeight - 30, { align: "center" });

      // ========== PÀGINA 2: ÍNDEX ==========
      doc.addPage();
      
      // Capçalera
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("ÍNDEX", pageWidth / 2, 26, { align: "center" });

      let indexY = 60;
      doc.setTextColor(...darkColor);

      if (template) {
        template.sections.forEach((section, sectionIndex) => {
          // Número i títol de secció
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...primaryColor);
          const sectionNum = `${sectionIndex + 1}.`;
          doc.text(sectionNum, margin, indexY);
          doc.setTextColor(...darkColor);
          doc.text(section.label.toUpperCase(), margin + 12, indexY);
          
          // Línia de punts fins al número de pàgina (pàgina 3 + offset)
          doc.setDrawColor(...mediumGray);
          doc.setLineDashPattern([1, 2], 0);
          const textWidth = doc.getTextWidth(section.label.toUpperCase()) + 12;
          doc.line(margin + textWidth + 5, indexY, pageWidth - margin - 15, indexY);
          doc.setLineDashPattern([], 0);
          
          indexY += 10;

          // Subseccions
          if (section.sections) {
            section.sections.forEach((subsection, subIndex) => {
              doc.setFontSize(10);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(...mediumGray);
              doc.text(`${sectionIndex + 1}.${subIndex + 1}`, margin + 10, indexY);
              doc.setTextColor(...darkColor);
              doc.text(subsection.label, margin + 25, indexY);
              indexY += 7;
            });
          }
          indexY += 5;
        });
      }

      // ========== PÀGINES 3+: CONTINGUT ==========
      if (template) {
        for (const section of template.sections) {
          doc.addPage();
          
          // Capçalera de secció
          doc.setFillColor(...primaryColor);
          doc.rect(0, 0, pageWidth, 40, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(section.label.toUpperCase(), pageWidth / 2, 26, { align: "center" });

          let yPos = 55;

          // Subseccions
          if (section.sections) {
            for (const subsection of section.sections) {
              // Títol de subsecció amb fons
              doc.setFillColor(...lightGray);
              doc.roundedRect(margin, yPos - 5, contentWidth, 12, 2, 2, 'F');
              doc.setFontSize(11);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(...primaryColor);
              doc.text(subsection.label, margin + 5, yPos + 3);
              yPos += 15;

              if (subsection.fields) {
                for (const field of subsection.fields) {
                  const fullFieldId = getFullFieldId(subsection.id, field.id);
                  const value = formData[fullFieldId];

                  // Etiqueta del camp
                  doc.setFontSize(9);
                  doc.setFont("helvetica", "bold");
                  doc.setTextColor(...mediumGray);
                  doc.text(field.label, margin + 5, yPos);
                  yPos += 5;

                  // Valor del camp
                  doc.setFontSize(10);
                  doc.setFont("helvetica", "normal");
                  doc.setTextColor(...darkColor);

                  let displayValue = "";
                  if (value === undefined || value === null || value === "") {
                    displayValue = "—";
                    doc.setTextColor(...mediumGray);
                  } else if (Array.isArray(value)) {
                    displayValue = value.length > 0 ? `${value.length} document(s) adjunt(s)` : "—";
                  } else if (typeof value === "object") {
                    const obj = value as Record<string, unknown>;
                    displayValue = (obj.fileName as string) || "Arxiu adjunt";
                  } else if (typeof value === "boolean") {
                    displayValue = value ? "✓ Sí" : "✗ No";
                  } else {
                    displayValue = String(value);
                  }

                  // Gestionar text llarg amb salt de línia
                  const maxWidth = contentWidth - 10;
                  const lines = doc.splitTextToSize(displayValue, maxWidth);
                  doc.text(lines, margin + 5, yPos);
                  yPos += lines.length * 5 + 8;

                  // Nova pàgina si cal
                  if (yPos > pageHeight - 40) {
                    doc.addPage();
                    // Capçalera petita per continuació
                    doc.setFillColor(...lightGray);
                    doc.rect(0, 0, pageWidth, 20, 'F');
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...mediumGray);
                    doc.text(`${section.label} (continuació)`, margin, 13);
                    yPos = 35;
                  }
                }
              }
              yPos += 5;
            }
          }

          // Camps directes de la secció
          if (section.fields && section.fields.length > 0) {
            for (const field of section.fields) {
              const fullFieldId = getFullFieldId("", field.id);
              const value = formData[fullFieldId];

              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(...mediumGray);
              doc.text(field.label, margin + 5, yPos);
              yPos += 5;

              doc.setFontSize(10);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(...darkColor);

              let displayValue = "";
              if (value === undefined || value === null || value === "") {
                displayValue = "—";
                doc.setTextColor(...mediumGray);
              } else if (Array.isArray(value)) {
                displayValue = value.length > 0 ? `${value.length} document(s) adjunt(s)` : "—";
              } else if (typeof value === "object") {
                const obj = value as Record<string, unknown>;
                displayValue = (obj.fileName as string) || "Arxiu adjunt";
              } else if (typeof value === "boolean") {
                displayValue = value ? "✓ Sí" : "✗ No";
              } else {
                displayValue = String(value);
              }

              const maxWidth = contentWidth - 10;
              const lines = doc.splitTextToSize(displayValue, maxWidth);
              doc.text(lines, margin + 5, yPos);
              yPos += lines.length * 5 + 8;

              if (yPos > pageHeight - 40) {
                doc.addPage();
                doc.setFillColor(...lightGray);
                doc.rect(0, 0, pageWidth, 20, 'F');
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...mediumGray);
                doc.text(`${section.label} (continuació)`, margin, 13);
                yPos = 35;
              }
            }
          }
        }
      }

      // ========== PEU DE PÀGINA A TOTES LES PÀGINES ==========
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Línia separadora
        doc.setDrawColor(...lightGray);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        // Text del peu
        doc.setFontSize(8);
        doc.setTextColor(...mediumGray);
        
        if (i === 1) {
          // Portada: només logo/marca
          doc.setFont("helvetica", "bold");
          doc.text("BuildTrack", margin, pageHeight - 8);
        } else {
          doc.setFont("helvetica", "normal");
          doc.text(projectTypeName, margin, pageHeight - 8);
          doc.text(`Pàgina ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
        }
      }

      // Descarregar
      const fileName = `documentacio_${projectTypeName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success("PDF generat correctament");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error generant el PDF");
    }
  };

  // Obtenir valors d'adreça des del formData per al mapa
  const getAddressFieldsForMap = () => {
    // Buscar camps d'adreça en diferents seccions possibles
    const possibleSections = ['emplaçament_grua', 'emplaçament', 'situacio', 'localitzacio'];
    
    let address = '';
    let streetNumber = '';
    let city = '';
    let province = '';
    let postalCode = '';

    for (const section of possibleSections) {
      if (formData[`${section}.adreca`]) address = formData[`${section}.adreca`] as string;
      if (formData[`${section}.carrer`]) address = formData[`${section}.carrer`] as string;
      if (formData[`${section}.numero`]) streetNumber = formData[`${section}.numero`] as string;
      if (formData[`${section}.poblacio`]) city = formData[`${section}.poblacio`] as string;
      if (formData[`${section}.ciutat`]) city = formData[`${section}.ciutat`] as string;
      if (formData[`${section}.provincia`]) province = formData[`${section}.provincia`] as string;
      if (formData[`${section}.codi_postal`]) postalCode = formData[`${section}.codi_postal`] as string;
    }

    // Fallback a dades del projecte
    if (!address && projectData?.street) address = projectData.street;
    if (!streetNumber && projectData?.street_number) streetNumber = projectData.street_number;
    if (!city && projectData?.city) city = projectData.city;
    if (!province && projectData?.province) province = projectData.province;
    if (!postalCode && projectData?.postal_code) postalCode = projectData.postal_code;

    return { address, streetNumber, city, province, postalCode };
  };

  const renderField = (field: Field, subsectionId: string) => {
    const fullFieldId = getFullFieldId(subsectionId, field.id);
    const value = formData[fullFieldId];
    const isLocked = isFieldLocked(fullFieldId);
    const isCadastralField = subsectionId.includes("emplaçament") && field.id === "referencia_cadastral";

    // Camp especial per al mapa de situació
    if (field.type === "map" || field.id === "mapa_situacio" || field.id === "mapa") {
      const addressFields = getAddressFieldsForMap();

      // NOMÉS coordenades del cadastre. Si no n'hi ha, no renderitzem mapa (ni geocoding).
      const cadastreCoords =
        cadastreData && cadastreData.latitude !== 0 && cadastreData.longitude !== 0
          ? { latitude: cadastreData.latitude, longitude: cadastreData.longitude }
          : null;

      return (
        <LocationMapField
          address={cadastreData?.street || addressFields.address}
          streetNumber={cadastreData?.streetNumber || addressFields.streetNumber}
          city={cadastreData?.municipality || addressFields.city}
          province={cadastreData?.province || addressFields.province}
          postalCode={cadastreData?.postalCode || addressFields.postalCode}
          value={cadastreCoords}
          onChange={(coords) => handleFieldChange(fullFieldId, coords)}
          disableGeocoding
          sourceLabel="Cadastre"
          showCoordinates={false}
        />
      );
    }

    const looksLikePdfField = (() => {
      const id = (field.id || "").toLowerCase();
      const label = (field.label || "").toLowerCase();

      // IMPORTANT: només considerem PDFs si el camp és realment un "file"
      if (field.type !== "file") return false;

      return (
        id.includes("pdf") ||
        label.includes("pdf") ||
        id.includes("plano") ||
        id.includes("planol") ||
        label.includes("plànol")
      );
    })();

    // Camp especial per a múltiples PDFs (màxim 10) - només a documentació gràfica
    const shouldUseMultiPdf =
      field.id === "crud_pdf" ||
      field.id === "documents_grafics" ||
      field.id === "planols" ||
      subsectionId.includes("documentacio_grafica") ||
      field.type === "multi_pdf";

    if (field.type === "multi_pdf" || (shouldUseMultiPdf && looksLikePdfField)) {
      return (
        <MultiPdfUpload
          projectId={projectId}
          fieldId={fullFieldId}
          value={Array.isArray(value) ? (value as any[]) : []}
          onChange={(files) => handleFieldChange(fullFieldId, files)}
          maxFiles={10}
        />
      );
    }

    switch (field.type) {
      case "text":
        return (
          <div className="space-y-1">
            <div className="relative">
              <Input
                id={fullFieldId}
                value={(value as string) || ""}
                onChange={(e) => !isLocked && handleFieldChange(fullFieldId, e.target.value)}
                placeholder={field.placeholder || `Introdueix ${field.label.toLowerCase()}`}
                className={`h-12 text-base bg-background ${isLocked ? "pr-10 bg-muted/50 cursor-not-allowed" : ""}`}
                readOnly={isLocked}
                disabled={isLocked}
              />
              {isLocked && (
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {isCadastralField && getCadastralAddress() && (
              <p className="text-xs text-muted-foreground pl-1">
                📍 {getCadastralAddress()}
              </p>
            )}
          </div>
        );

      case "number":
        return (
          <div className="relative">
            <Input
              id={fullFieldId}
              type="number"
              value={(value as number) ?? ""}
              onChange={(e) => !isLocked && handleFieldChange(fullFieldId, e.target.value ? parseFloat(e.target.value) : "")}
              placeholder={field.placeholder || "0"}
              className={`h-12 text-base bg-background ${isLocked ? "pr-10 bg-muted/50 cursor-not-allowed" : ""}`}
              readOnly={isLocked}
              disabled={isLocked}
            />
            {isLocked && (
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );

      case "textarea":
        return (
          <div className="relative">
            <Textarea
              id={fullFieldId}
              value={(value as string) || ""}
              onChange={(e) => !isLocked && handleFieldChange(fullFieldId, e.target.value)}
              placeholder={field.placeholder || `Introdueix ${field.label.toLowerCase()}`}
              className={`min-h-[120px] text-base bg-background resize-y ${isLocked ? "bg-muted/50 cursor-not-allowed" : ""}`}
              readOnly={isLocked}
              disabled={isLocked}
            />
            {isLocked && (
              <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );

      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => !isLocked && handleFieldChange(fullFieldId, v)}
            disabled={isLocked}
          >
            <SelectTrigger className={`h-12 text-base bg-background ${isLocked ? "bg-muted/50 cursor-not-allowed" : ""}`}>
              <SelectValue placeholder="Selecciona una opció" />
              {isLocked && <Lock className="h-4 w-4 text-muted-foreground ml-auto" />}
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option} className="text-base">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-3 py-3 px-4 rounded-lg bg-muted/30 border">
            <Checkbox
              id={fullFieldId}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => !isLocked && handleFieldChange(fullFieldId, checked)}
              className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              disabled={isLocked}
            />
            <label
              htmlFor={fullFieldId}
              className={`text-base font-medium leading-none select-none ${isLocked ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}
            >
              {field.label}
              {isLocked && <Lock className="inline-block h-3 w-3 ml-1 text-muted-foreground" />}
            </label>
          </div>
        );

      case "file":
        const fileValue = value as { fileName: string; url: string } | null;
        return (
          <div className="space-y-2">
            <input
              ref={(el) => { fileInputRefs.current[fullFieldId] = el; }}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && !isLocked) handleFileUpload(fullFieldId, file);
              }}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
              disabled={isLocked}
            />
            {fileValue ? (
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <File className="h-5 w-5 text-primary" />
                </div>
                <a 
                  href={fileValue.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline truncate flex-1"
                >
                  {fileValue.fileName}
                </a>
                {!isLocked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleRemoveFile(fullFieldId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {isLocked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className={`w-full h-14 justify-start text-base ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}
                onClick={() => !isLocked && fileInputRefs.current[fullFieldId]?.click()}
                disabled={isLocked}
              >
                <Upload className="h-5 w-5 mr-3" />
                Seleccionar arxiu
                {isLocked && <Lock className="h-4 w-4 ml-auto text-muted-foreground" />}
              </Button>
            )}
          </div>
        );

      default:
        return (
          <div className="relative">
            <Input
              id={fullFieldId}
              value={(value as string) || ""}
              onChange={(e) => !isLocked && handleFieldChange(fullFieldId, e.target.value)}
              placeholder={field.placeholder}
              className={`h-12 text-base bg-background ${isLocked ? "pr-10 bg-muted/50 cursor-not-allowed" : ""}`}
              readOnly={isLocked}
              disabled={isLocked}
            />
            {isLocked && (
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );
    }
  };

  const renderFields = (fields?: Field[], subsectionId?: string) => {
    if (!fields || fields.length === 0) {
      return (
        <p className="text-sm text-muted-foreground italic py-4">
          No hi ha camps definits per aquesta secció.
        </p>
      );
    }

    return (
      <div className="space-y-6">
        {fields.map((field) => {
          const fullFieldId = subsectionId ? getFullFieldId(subsectionId, field.id) : field.id;
          const isLocked = isFieldLocked(fullFieldId);
          
          // Override de labels per casos específics
          const getLabelOverride = (fieldId: string, originalLabel: string): string => {
            // Secció "Objecte de la documentació tècnica" -> "Descripció" -> "Descripció de la finca"
            if (fieldId.includes("objecte") && originalLabel.toLowerCase() === "descripció") {
              return "Descripció de la finca";
            }
            return originalLabel;
          };

          const displayLabel = getLabelOverride(fullFieldId, field.label);

          return (
            <div key={fullFieldId} className="space-y-2">
              {field.type !== "checkbox" && (
                <Label 
                  htmlFor={fullFieldId}
                  className={`text-sm font-semibold ${isLocked ? "text-muted-foreground" : "text-foreground"} flex items-center gap-2`}
                >
                  {displayLabel}
                  {field.required && (
                    <span className="text-destructive">*</span>
                  )}
                  {isLocked && (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-normal">
                      Automàtic
                    </Badge>
                  )}
                </Label>
              )}
              {renderField(field, subsectionId || "")}
            </div>
          );
        })}
      </div>
    );
  };

  const isValueFilled = (value: unknown): boolean => {
    if (value === undefined || value === null || value === "") return false;
    // Arrays (com PDFs múltiples)
    if (Array.isArray(value)) return value.length > 0;
    // Objectes (com arxius individuals amb {fileName, url})
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return Object.keys(obj).length > 0 && !!(obj.url || obj.fileName);
    }
    return true;
  };

  const countFilledFields = (section: MainSection): { filled: number; total: number } => {
    let filled = 0;
    let total = 0;

    const countFields = (fields?: Field[], subsectionId?: string) => {
      if (!fields) return;
      fields.forEach(field => {
        total++;
        // IMPORTANT: usar sempre getFullFieldId per consistència amb com es guarden les dades
        const fullFieldId = getFullFieldId(subsectionId || "", field.id);
        const value = formData[fullFieldId];
        if (isValueFilled(value)) {
          filled++;
        }
      });
    };

    if (section.sections) {
      section.sections.forEach(sub => countFields(sub.fields, sub.id));
    }
    // Per camps directes de la secció, passar string buit per consistència
    countFields(section.fields, "");

    return { filled, total };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <span className="block">Documentació tècnica</span>
              {projectTypeName && (
                <span className="text-sm font-normal text-muted-foreground">
                  {projectTypeName}
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-base text-muted-foreground">Carregant plantilla...</p>
          </div>
        ) : !template || !template.sections?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="p-6 rounded-full bg-muted mb-6">
              <FileText className="h-14 w-14 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">No hi ha plantilla configurada</p>
            <p className="text-base text-muted-foreground mt-2 max-w-md">
              Configura la plantilla des de l'administració → Mòduls → Projectes → Plantilles IA.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-8 py-4 border-b bg-background">
                <TabsList className="w-full justify-start h-auto gap-2 bg-muted/50 p-2 rounded-xl flex-wrap">
                  {template.sections.map((section) => {
                    const { filled, total } = countFilledFields(section);
                    return (
                      <TabsTrigger 
                        key={section.id} 
                        value={section.id}
                        className="px-5 py-3 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all gap-2"
                      >
                        {section.label}
                        {total > 0 && (
                          <Badge 
                            variant={filled === total ? "default" : "secondary"} 
                            className="text-[10px] px-2 py-0.5"
                          >
                            {filled}/{total}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {template.sections.map((section) => (
                <TabsContent 
                  key={section.id} 
                  value={section.id} 
                  className="flex-1 mt-0 overflow-hidden"
                >
                  <ScrollArea className="h-[55vh] px-8 py-6">
                    <div className="space-y-4 max-w-4xl">
                      {section.sections?.map((subsection) => {
                        const sectionKey = `${section.id}-${subsection.id}`;
                        const isOpen = openSections[sectionKey] ?? false;
                        
                        return (
                          <Collapsible
                            key={subsection.id}
                            open={isOpen}
                            onOpenChange={() => toggleSection(sectionKey)}
                          >
                            <div className="rounded-xl border-2 bg-card overflow-hidden shadow-sm">
                              <CollapsibleTrigger className="w-full px-6 py-4 bg-muted/30 border-b flex items-center gap-3 hover:bg-muted/50 transition-colors">
                                {isOpen ? (
                                  <ChevronDown className="h-5 w-5 text-primary shrink-0" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                )}
                                <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                                <h3 className="font-semibold text-base flex-1 text-left">
                                  {subsection.label}
                                </h3>
                                {subsection.fields && (
                                  <Badge variant="outline" className="text-xs px-2 py-1">
                                    {subsection.fields.filter(f => {
                                      const fullId = getFullFieldId(subsection.id, f.id);
                                      return isValueFilled(formData[fullId]);
                                    }).length}/{subsection.fields.length}
                                  </Badge>
                                )}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-6">
                                  {renderFields(subsection.fields, subsection.id)}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                      
                      {section.fields && section.fields.length > 0 && (
                        <div className="rounded-xl border-2 bg-card overflow-hidden shadow-sm">
                          <div className="p-6">
                            {renderFields(section.fields)}
                          </div>
                        </div>
                      )}

                      {(!section.sections || section.sections.length === 0) && 
                       (!section.fields || section.fields.length === 0) && (
                        <div className="text-center py-12 text-muted-foreground">
                          <p className="text-base">No hi ha contingut definit per aquesta pestanya.</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-between gap-4 px-8 py-5 border-t bg-muted/30">
              <Button 
                variant="outline" 
                size="lg"
                onClick={handleGeneratePDF}
              >
                <FileDown className="h-5 w-5 mr-2" />
                Generar PDF
              </Button>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel·lar
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="min-w-[120px]"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {saving ? "Guardant..." : "Guardar"}
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="min-w-[160px]"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  {saving ? "Guardant..." : "Guardar i sortir"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
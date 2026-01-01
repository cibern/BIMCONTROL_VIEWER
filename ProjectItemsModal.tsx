import { useState, useEffect } from "react";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { useDemoUser } from "@/hooks/useDemoUser";
import { useCredits } from "@/hooks/useCredits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionVerificationDialog } from "./SubscriptionVerificationDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, Calendar, AlertCircle, Building2, Mail, Phone, MapPin, FileText, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBudgetCode } from "@/lib/utils";

interface ProjectItem {
  id: string;
  custom_name: string | null;
  type_name: string;
  description: string | null;
  measured_value: number;
  preferred_unit: string;
  chapter_id: string | null;
  subchapter_id: string | null;
  subsubchapter_id: string | null;
  display_order: number;
  full_code?: string | null;
}

interface ProjectItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectId: string;
  items: ProjectItem[];
}

export function ProjectItemsModal({
  open,
  onOpenChange,
  projectName,
  projectId,
  items,
}: ProjectItemsModalProps) {
  const { tier } = useSubscriptionTier();
  const { isDemoUser } = useDemoUser();
  const { deductCreditsForBudget, canSendBudget, config, refreshCredits } = useCredits();
  const [offerAmounts, setOfferAmounts] = useState<Record<string, string>>({});
  const [validityDays, setValidityDays] = useState<string>("30");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSubscriptionVerification, setShowSubscriptionVerification] = useState(false);
  const [supplierData, setSupplierData] = useState<{
    name: string;
    nif: string;
    email: string;
    street: string;
    street_number: string | null;
    postal_code: string;
    city: string;
  } | null>(null);
  
  // Estats per les condicions
  const [conditions, setConditions] = useState({
    condition_scope: true,
    condition_economic: true,
    condition_deadlines: true,
    condition_execution: true,
    condition_materials: true,
    condition_safety: true,
    condition_coordination: true,
    condition_documentation: true,
    condition_suspension: true,
    condition_jurisdiction: true,
  });


  const handleAmountChange = (itemId: string, value: string) => {
    setOfferAmounts(prev => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const formatUnit = (unit: string) => {
    const unitMap: Record<string, string> = {
      UT: "UT",
      ML: "ML",
      M2: "M2",
      M3: "M3",
      KG: "Kg",
      PA: "PA",
    };
    return unitMap[unit.toUpperCase()] || unit;
  };

  const calculateTotal = () => {
    return Object.entries(offerAmounts).reduce((sum, [itemId, amount]) => {
      const item = items.find(i => i.id === itemId);
      if (item && amount) {
        const numAmount = parseFloat(amount);
        if (!isNaN(numAmount)) {
          return sum + (numAmount * item.measured_value);
        }
      }
      return sum;
    }, 0);
  };

  const handlePreSubmitValidation = () => {
    // Validar que tots els camps tenen import
    const itemsWithoutPrice = items.filter(item => !offerAmounts[item.id] || parseFloat(offerAmounts[item.id]) <= 0);
    
    if (itemsWithoutPrice.length > 0) {
      toast.error("Falten imports per completar", {
        description: `Hi ha ${itemsWithoutPrice.length} partides sense preu. Has d'introduir un import per totes les partides.`,
      });
      return;
    }

    // Validar període de validesa
    const validityNum = parseInt(validityDays);
    if (!validityNum || validityNum < 1) {
      toast.error("El període de validesa ha de ser com a mínim 1 dia");
      return;
    }

    // Mostrar verificació de subscripció abans de confirmar
    setShowSubscriptionVerification(true);
  };

  const handleSubscriptionVerified = async () => {
    // Carregar dades del supplier
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: supplier, error } = await supabase
        .from("suppliers")
        .select("name, nif, email, street, street_number, postal_code, city")
        .eq("user_id", user.id)
        .single();

      if (error || !supplier) {
        toast.error("No s'han pogut carregar les dades del perfil");
        return;
      }

      setSupplierData(supplier);
      // Si la verificació de subscripció passa, mostrar diàleg de confirmació
      setShowConfirmDialog(true);
    } catch (error) {
      console.error("Error carregant dades del supplier:", error);
      toast.error("Error carregant les dades del perfil");
    }
  };

  const handleSubmitBudget = async () => {
    setShowConfirmDialog(false);

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Has d'estar autenticat per enviar pressupostos");
        return;
      }

      // Validar període de validesa
      const validityNum = parseInt(validityDays);
      if (!validityNum || validityNum < 1) {
        toast.error("El període de validesa ha de ser com a mínim 1 dia");
        return;
      }

      // Obtenir el supplier_id de la taula suppliers
      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (supplierError || !supplierData) {
        console.error("Error obtenint supplier_id:", supplierError);
        toast.error("No s'ha pogut trobar el teu perfil d'industrial. Si us plau, contacta amb l'administrador.");
        return;
      }


      // Preparar totes les partides amb preu
      const valuations = items
        .filter(item => offerAmounts[item.id] && parseFloat(offerAmounts[item.id]) > 0)
        .map(item => {
          const fullCode = item.full_code || '';
          const codes = fullCode.split('.');
          
          const chapter_code = codes[0] || '';
          const subchapter_code = codes[1] || '';
          const subsubchapter_code = codes[2] || '';
          const item_code = codes[3] || '';
          
          const complete_code = [chapter_code, subchapter_code, subsubchapter_code, item_code]
            .filter(c => c)
            .join('.');
          
          return {
            item_id: item.id,
            chapter_code,
            subchapter_code, 
            subsubchapter_code,
            item_code,
            full_code: complete_code,
            item_name: item.custom_name || item.type_name || '',
            short_description: item.custom_name || item.type_name || '',
            long_description: item.description || '',
            description: item.description || '',
            estimated_amount: parseFloat(offerAmounts[item.id]) * item.measured_value,
            total: parseFloat(offerAmounts[item.id]) * item.measured_value,
            unit_price: parseFloat(offerAmounts[item.id]),
            quantity: item.measured_value,
            unit: formatUnit(item.preferred_unit),
            chapter_id: item.chapter_id,
            subchapter_id: item.subchapter_id,
            subsubchapter_id: item.subsubchapter_id,
            display_order: item.display_order,
          };
        });

      const totalAmount = calculateTotal();
      
      // Calcular categoria basant-se en les partides pressupostades
      // Buscar a la taula budget_category_mappings per obtenir els noms correctes de specialist_categories
      const budgetCodes = valuations
        .map(v => {
          const parts = v.full_code?.split('.') || [];
          return parts.length >= 3 ? parts.slice(0, 3).join('.') : null;
        })
        .filter(Boolean);

      let category = "General";
      
      if (budgetCodes.length > 0) {
        // Buscar les categories a la base de dades
        const { data: mappings } = await supabase
          .from("budget_category_mappings")
          .select("budget_code, specialist_categories(name)")
          .in("budget_code", budgetCodes);

        if (mappings && mappings.length > 0) {
          const uniqueCategories = new Set<string>();
          mappings.forEach((m: any) => {
            if (m.specialist_categories?.name) {
              uniqueCategories.add(m.specialist_categories.name);
            }
          });
          
          if (uniqueCategories.size > 0) {
            category = Array.from(uniqueCategories).join(', ');
          }
        }
      }
      
      // Si no s'ha pogut determinar cap categoria, usar la del supplier
      if (category === "General") {
        const { data: supplierCategories } = await supabase
          .from("supplier_categories")
          .select("specialist_categories(name)")
          .eq("supplier_id", supplierData.id)
          .limit(1)
          .maybeSingle();
        
        if (supplierCategories?.specialist_categories?.name) {
          category = supplierCategories.specialist_categories.name;
        }
      }

      // VALIDACIÓ CRÍTICA: Comprovar si ja existeix un pressupost ACCEPTAT per aquesta categoria i projecte
      const { data: existingAcceptedBudget, error: checkError } = await supabase
        .from("supplier_budgets")
        .select("id, supplier_id")
        .eq("project_id", projectId)
        .eq("category", category)
        .eq("status", "accepted")
        .maybeSingle();

      if (checkError) {
        console.error("Error comprovant pressupostos acceptats:", checkError);
        toast.error("Error al validar el pressupost");
        return;
      }

      if (existingAcceptedBudget) {
        toast.error("Pressupost ja acceptat", {
          description: `Un altre industrial ja té un pressupost acceptat per aquesta categoria. No pots enviar un nou pressupost.`,
        });
        return;
      }

      // Generar codi únic per aquest pressupost
      const budgetCode = generateBudgetCode();

      // Si és usuari DEMO, simular l'enviament sense guardar a la base de dades
      if (isDemoUser) {
        // Simular un delay per fer-ho més realista
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast.success("🎉 Simulació d'enviament completada!", {
          description: (
            <div className="space-y-1">
              <p><strong>Mode Demo:</strong> El pressupost no s'ha enviat realment.</p>
              <p>Import total: {totalAmount.toFixed(2)}€ amb {valuations.length} partides</p>
              <p className="text-xs text-muted-foreground mt-2">
                Això és una demostració. Per enviar pressupostos reals, contacta amb l'administrador.
              </p>
            </div>
          ),
          duration: 8000,
        });

        // Netejar el formulari
        setOfferAmounts({});
        setValidityDays("30");
        setNotes("");
        
        // Tancar modal
        onOpenChange(false);
        return;
      }

      // VALIDACIÓ DE CRÈDITS: Verificar que l'industrial té prou crèdits
      if (!canSendBudget) {
        toast.error("Crèdits insuficients", {
          description: `Necessites ${config.creditsPerBudget} crèdits per enviar un pressupost. Compra més crèdits des del teu panell.`,
        });
        return;
      }

      // Crear un sol pressupost amb totes les partides
      const { data: insertedBudget, error } = await supabase
        .from("supplier_budgets")
        .insert({
          project_id: projectId,
          supplier_id: supplierData.id,
          category: category,
          total_amount: totalAmount,
          validity_days: validityNum,
          notes: notes.trim() || null,
          valuations: valuations,
          status: "submitted",
          offer_code: budgetCode,
          ...conditions,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error guardant pressupost:", error);
        throw error;
      }

      // DESCOMPTAR CRÈDITS després de crear el pressupost exitosament
      const creditsDeducted = await deductCreditsForBudget(insertedBudget.id);
      if (!creditsDeducted) {
        console.error("Error descomptant crèdits, però el pressupost s'ha creat");
        // No bloquejem l'enviament, però avisem
        toast.warning("Pressupost enviat però hi ha hagut un problema amb els crèdits");
      }

      toast.success(`Pressupost enviat correctament!`, {
        description: `Import total: ${totalAmount.toFixed(2)}€ amb ${valuations.length} partides. S'han descomptat ${config.creditsPerBudget} crèdits.`,
      });

      // Refrescar els crèdits
      refreshCredits();

      // Netejar el formulari
      setOfferAmounts({});
      setValidityDays("30");
      setNotes("");
      
      // Disparar event amb les dades del pressupost per actualitzar l'estat immediatament
      const newBudget = {
        project_id: projectId,
        supplier_id: supplierData.id,
        status: "submitted",
        total_amount: totalAmount,
        category: category,
      };
      
      window.dispatchEvent(new CustomEvent('budget-submitted', { 
        detail: newBudget
      }));
      
      // Tancar modal immediatament - l'estat ja s'ha actualitzat
      onOpenChange(false);
    } catch (error) {
      console.error("Error enviant pressupost:", error);
      toast.error("Error al enviar el pressupost. Si us plau, torna-ho a intentar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0 z-[100] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30 flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">
            Partides del Projecte: {projectName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Introdueix els imports per cada partida per generar la teva oferta
          </p>
        </DialogHeader>

        <Tabs defaultValue="pressupost" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 flex-shrink-0">
            <TabsTrigger value="pressupost">Pressupost</TabsTrigger>
            <TabsTrigger value="condicions">Condicions</TabsTrigger>
          </TabsList>

          <TabsContent value="pressupost" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="px-6 space-y-4 pb-6">
                {items.map((item) => (
                  <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                      {/* Header with title and badges */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {item.custom_name || item.type_name}
                          </h3>
                          {item.full_code && (
                            <Badge variant="outline" className="mt-1">
                              {item.full_code}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Main data table */}
                      <div className="grid grid-cols-4 gap-4 py-3 border-y">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Quantitat</p>
                          <p className="font-medium">{item.measured_value.toFixed(2)} {formatUnit(item.preferred_unit)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Preu Unitari (€/{formatUnit(item.preferred_unit)})</p>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={offerAmounts[item.id] || ""}
                            onChange={(e) => handleAmountChange(item.id, e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-1 text-right">Import Total</p>
                          <p className="font-bold text-lg text-primary text-right">
                            {offerAmounts[item.id]
                              ? (parseFloat(offerAmounts[item.id]) * item.measured_value).toFixed(2)
                              : "0.00"} €
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      {item.description && (
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-xs text-muted-foreground mb-1">Descripció</p>
                          <p className="text-sm">{item.description}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}

                {/* Footer amb total */}
                <div className="pt-4 border-t bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de partides</p>
                      <p className="text-lg font-semibold">{items.length} partides</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Import Total</p>
                      <p className="text-3xl font-bold text-primary">{calculateTotal().toFixed(2)} €</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="condicions" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="px-6 space-y-6 pb-6">
                {/* Període de validesa */}
                <div className="space-y-2">
                  <Label htmlFor="validity" className="flex items-center gap-2 text-base font-semibold">
                    <Calendar className="h-4 w-4" />
                    Període de validesa *
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="validity"
                      type="number"
                      min="1"
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                      placeholder="30"
                      className="h-10 max-w-[120px]"
                    />
                    <span className="text-sm text-muted-foreground">dies</span>
                  </div>
                </div>

                {/* Condicions amb checkboxes */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-base">Condicions del Pressupost</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_scope"
                        checked={conditions.condition_scope}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_scope: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_scope" className="text-sm font-medium cursor-pointer">
                          Objecte i abast
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Aquest pressupost es refereix exclusivament als treballs i subministraments detallats en les partides adjuntes.</p>
                          <p>Qualsevol modificació, ampliació o treball addicional no especificat serà objecte de valoració a part.</p>
                          <p>Els preus inclouen mà d&apos;obra, materials i mitjans propis necessaris per a l&apos;execució correcta, excepte si s&apos;indica el contrari.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_economic"
                        checked={conditions.condition_economic}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_economic: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_economic" className="text-sm font-medium cursor-pointer">
                          Condicions econòmiques
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Els preus no inclouen IVA i són vàlids durant 30 dies des de la data del pressupost.</p>
                          <p>Les certificacions i pagaments es faran segons l&apos;avanç real dels treballs, amb un termini màxim de pagament de 30 dies des de la seva aprovació.</p>
                          <p>L&apos;empresa es reserva el dret d&apos;aplicar interessos per demora segons la Llei 3/2004 de lluita contra la morositat.</p>
                          <p>Els preus es consideren tancats excepte per variacions justificades en materials o condicions d&apos;obra alienes a l&apos;industrial.</p>
                          <p>Qualsevol aturada, retard o modificació no imputable a l&apos;empresa podrà donar lloc a ajustament de terminis o cost addicional.</p>
                          <p>En cas d&apos;augment excepcional de costos de materials o energia, es podrà sol·licitar revisió proporcional de preus.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_deadlines"
                        checked={conditions.condition_deadlines}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_deadlines: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_deadlines" className="text-sm font-medium cursor-pointer">
                          Terminis i planificació
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Els terminis d&apos;execució s&apos;entenen orientatius i condicionats a la correcta coordinació d&apos;oficis, lliurament de zones d&apos;obra, permisos, subministraments i condicions meteorològiques.</p>
                          <p>L&apos;empresa no serà responsable de retards derivats de causes alienes o canvis d&apos;ordre d&apos;execució.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_execution"
                        checked={conditions.condition_execution}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_execution: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_execution" className="text-sm font-medium cursor-pointer">
                          Condicions d&apos;execució
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Els treballs s&apos;executaran segons el projecte o les instruccions rebudes, sempre que siguin tècnicament viables i segures.</p>
                          <p>Si es detecten incoherències, riscos o errades de projecte, l&apos;empresa ho comunicarà a la Direcció Facultativa i suspendrà temporalment l&apos;actuació fins a aclariment.</p>
                          <p>Les partides inclouen mitjans auxiliars propis habituals, però no bastides generals, grues torre, o altres mitjans col·lectius si no s&apos;especifica.</p>
                          <p>La zona d&apos;obra haurà d&apos;estar lliure, accessible i amb serveis bàsics (llum, aigua, acopi).</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_materials"
                        checked={conditions.condition_materials}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_materials: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_materials" className="text-sm font-medium cursor-pointer">
                          Materials i garanties
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Els materials utilitzats seran de primera qualitat i amb marcat CE.</p>
                          <p>Les garanties dels materials o equips seran les del fabricant, i l&apos;empresa respondrà únicament de la muntatge i posada en obra.</p>
                          <p>Les reparacions durant el període de garantia es limitaran a defectes d&apos;execució demostrats.</p>
                          <p>No s&apos;admeten reclamacions per mal ús, falta de manteniment o intervencions d&apos;altres oficis.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_safety"
                        checked={conditions.condition_safety}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_safety: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_safety" className="text-sm font-medium cursor-pointer">
                          Seguretat i medi ambient
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>L&apos;empresa compleix amb el Pla de Seguretat i Salut i amb la normativa vigent en matèria laboral i mediambiental.</p>
                          <p>Les despeses associades a seguretat, gestió de residus o transport s&apos;inclouen només si es detallen expressament al pressupost.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_coordination"
                        checked={conditions.condition_coordination}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_coordination: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_coordination" className="text-sm font-medium cursor-pointer">
                          Coordinació i responsabilitats
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>L&apos;empresa es compromet a coordinar-se amb la resta d&apos;industrials, però no assumeix responsabilitat per danys o repassos derivats d&apos;altres oficis.</p>
                          <p>Els treballs afectats per altres empreses o intervencions posteriors no seran objecte de repàs sense cost addicional.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_documentation"
                        checked={conditions.condition_documentation}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_documentation: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_documentation" className="text-sm font-medium cursor-pointer">
                          Documentació i recepció
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>En finalitzar els treballs, s&apos;emetrà un certificat d&apos;obra executada i es lliuraran les fitxes tècniques i garanties.</p>
                          <p>La recepció s&apos;entendrà feta si, en un termini de 7 dies, no es formulen observacions per escrit.</p>
                          <p>Els treballs tindran una garantia d&apos;un any per defectes d&apos;execució, excepte per normativa o acord diferent.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_suspension"
                        checked={conditions.condition_suspension}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_suspension: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_suspension" className="text-sm font-medium cursor-pointer">
                          Causes de suspensió o resolució
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>L&apos;empresa podrà suspendre o rescindir el contracte si:</p>
                          <p className="pl-4">• No es compleixen els terminis de pagament acordats.</p>
                          <p className="pl-4">• S&apos;ordenen modificacions substancials sense autorització escrita.</p>
                          <p className="pl-4">• No es garanteixen les condicions mínimes de seguretat o accés.</p>
                          <p>En aquests casos, l&apos;empresa tindrà dret a cobrar els treballs executats i a reclamar els perjudicis derivats.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="condition_jurisdiction"
                        checked={conditions.condition_jurisdiction}
                        onCheckedChange={(checked) => setConditions(prev => ({ ...prev, condition_jurisdiction: checked as boolean }))}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="condition_jurisdiction" className="text-sm font-medium cursor-pointer">
                          Jurisdicció
                        </label>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Qualsevol discrepància es resoldrà preferentment per via amistosa, i en cas contrari, davant els tribunals del lloc d&apos;execució de l&apos;obra.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observacions */}
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="notes" className="text-base font-semibold">
                    Observacions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Afegeix qualsevol informació addicional: condicions de pagament, terminis de lliurament, treballs no inclosos...
                  </p>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Escriu les observacions aquí..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Botó d'enviament fix al footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex-shrink-0">
          <div className="space-y-3">
            {isDemoUser && (
              <Alert className="border-purple-100 bg-purple-50/50 dark:bg-purple-950/20">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-xs text-purple-800 dark:text-purple-200">
                  <strong>Mode Demo actiu:</strong> Estàs utilitzant un codi promocional. Els pressupostos que enviïs seran <strong>simulats</strong> i no s'enviaran realment als clients.
                </AlertDescription>
              </Alert>
            )}
            {tier === "standard" && !isDemoUser && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Nota important:</strong> Podràs veure tot el procés de valoració, però només els comptes amb pla Professional o Premium poden enviar pressupostos als clients.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel·lar
              </Button>
              <Button
                onClick={handlePreSubmitValidation}
                disabled={submitting || calculateTotal() === 0}
                className={`gap-2 ${isDemoUser ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isDemoUser ? "Simulant..." : "Enviant..."}
                  </>
                ) : (
                  <>
                    {isDemoUser ? <Sparkles className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {isDemoUser ? "Simular Enviament" : "Enviar Pressupost"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Diàleg de verificació de subscripció */}
      <SubscriptionVerificationDialog
        open={showSubscriptionVerification}
        onOpenChange={setShowSubscriptionVerification}
        onVerified={handleSubscriptionVerified}
        onCloseBudgetModal={() => onOpenChange(false)}
      />

        {/* Diàleg de confirmació */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="z-[200] max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                Confirmar enviament del pressupost
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 pt-2">
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Aquest procés no és reversible.</strong> Un cop enviïs aquest pressupost, l'usuari el rebrà i no el podràs modificar.
                    </AlertDescription>
                  </Alert>

                  {/* Dades de l'empresa */}
                  {supplierData && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Dades de l'empresa
                      </h4>
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Nom de l'empresa</p>
                            <p className="font-medium">{supplierData.name}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">NIF</p>
                            <p className="font-medium">{supplierData.nif}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Correu electrònic</p>
                            <p className="font-medium">{supplierData.email}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Adreça</p>
                            <p className="font-medium">
                              {supplierData.street} {supplierData.street_number || "s/n"}, {supplierData.postal_code} {supplierData.city}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resum del pressupost */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Resum del pressupost
                    </h4>
                    <div className="bg-primary/5 p-4 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Projecte:</span>
                        <span className="font-semibold">{projectName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Partides pressupostades:</span>
                        <span className="font-semibold">
                          {Object.values(offerAmounts).filter(v => v && parseFloat(v) > 0).length} de {items.length}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Import total:</span>
                        <span className="font-bold text-lg text-primary">{calculateTotal().toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Validesa:</span>
                        <span className="font-semibold">{validityDays} dies</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Assegura't que tota la informació és correcta abans de continuar.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel·lar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmitBudget} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviant...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Confirmar i enviar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

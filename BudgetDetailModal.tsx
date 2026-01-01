import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, CheckCircle2, Clock, Calendar } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, addDays, differenceInDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BudgetDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
}

interface Valuation {
  // Codis (4 nivells)
  chapter_code: string;
  subchapter_code: string;
  subsubchapter_code: string;
  item_code?: string;
  full_code?: string;
  
  // Noms i descripcions
  custom_name?: string;
  type_name?: string;
  short_description?: string;
  long_description?: string;
  
  // Imports i quantitats
  estimated_amount: number;
  unit_price?: number;
  quantity?: number;
  measured_value?: number;
  unit?: string;
  preferred_unit?: string;
}

interface BudgetDetail {
  id: string;
  supplier_id: string;
  project_id: string;
  valuations: Valuation[];
  total_amount: number;
  submitted_at: string;
  validity_days: number;
  status: string;
  notes: string | null;
  offer_code?: string | null;
  condition_scope: boolean;
  condition_jurisdiction: boolean;
  condition_suspension: boolean;
  condition_documentation: boolean;
  condition_coordination: boolean;
  condition_safety: boolean;
  condition_materials: boolean;
  condition_execution: boolean;
  condition_deadlines: boolean;
  condition_economic: boolean;
}

export const BudgetDetailModal = ({
  open,
  onOpenChange,
  budgetId,
}: BudgetDetailModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [supplierInfo, setSupplierInfo] = useState<any>(null);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [clientInfo, setClientInfo] = useState<any>(null);

  useEffect(() => {
    if (open && budgetId) {
      loadBudgetDetail();
    }
  }, [open, budgetId]);

  const loadBudgetDetail = async () => {
    setLoading(true);
    try {
      // Carregar pressupost
      const { data: budgetData, error: budgetError } = await supabase
        .from("supplier_budgets")
        .select("*")
        .eq("id", budgetId)
        .single();

      if (budgetError) throw budgetError;

      // Obtenir els item_ids per buscar els full_codes
      const itemIds = Array.isArray(budgetData.valuations)
        ? (budgetData.valuations as any[]).map((v: any) => v.item_id).filter(Boolean)
        : [];

      // Carregar els full_codes dels items
      let itemsMap = new Map<string, { full_code: string; custom_name: string; type_name: string; description: string }>();
      if (itemIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("element_type_configs")
          .select("id, full_code, custom_name, type_name, description")
          .in("id", itemIds);

        if (itemsData) {
          itemsData.forEach(item => {
            itemsMap.set(item.id, {
              full_code: item.full_code || '',
              custom_name: item.custom_name || '',
              type_name: item.type_name || '',
              description: item.description || '',
            });
          });
        }
      }

      const processedBudget: BudgetDetail = {
        ...budgetData,
        valuations: Array.isArray(budgetData.valuations)
          ? (budgetData.valuations as any[]).map((v: any) => {
              // Prioritzar: 1) full_code del pressupost, 2) full_code de l'item, 3) subsubchapter_id
              let full_code = v.full_code || '';
              
              if (!full_code && v.item_id && itemsMap.has(v.item_id)) {
                const itemData = itemsMap.get(v.item_id)!;
                full_code = itemData.full_code;
              }
              
              if (!full_code) {
                full_code = v.subsubchapter_id || '';
              }
              
              // Extreure els 4 nivells del codi
              const parts = full_code.split('.');
              const chapter_code = parts[0] || '';
              const subchapter_code = parts[1] || '';
              const subsubchapter_code = parts[2] || '';
              const item_code = parts[3] || '';
              
              // Obtenir noms i descripcions (prioritzar dades del pressupost, després de l'item)
              const itemData = v.item_id && itemsMap.has(v.item_id) ? itemsMap.get(v.item_id)! : null;
              const short_description = v.short_description || v.custom_name || v.type_name || v.item_name || itemData?.custom_name || itemData?.type_name || '';
              const long_description = v.long_description || v.description || itemData?.description || '';
              
              return {
                // Codis (4 nivells)
                chapter_code,
                subchapter_code,
                subsubchapter_code,
                item_code,
                full_code,
                
                // Noms i descripcions
                custom_name: v.custom_name || itemData?.custom_name || '',
                type_name: v.type_name || itemData?.type_name || '',
                short_description,
                long_description,
                
                // Imports
                estimated_amount: Number(v.estimated_amount) || Number(v.total) || 0,
                unit_price: Number(v.unit_price) || 0,
                quantity: Number(v.quantity) || 0,
                unit: v.unit || '',
              };
            })
          : [],
      };

      setBudget(processedBudget);

      // Carregar informació del supplier
      const { data: supplier } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", budgetData.supplier_id)
        .single();

      setSupplierInfo(supplier);

      // Carregar informació del projecte
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", budgetData.project_id)
        .single();

      setProjectInfo(project);

      // Carregar informació del client
      if (project) {
        const { data: client } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", project.created_by)
          .single();

        setClientInfo(client);
      }

    } catch (error) {
      console.error("Error loading budget detail:", error);
      toast({
        title: "Error",
        description: "No s'han pogut carregar els detalls del pressupost",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!budget || !supplierInfo || !projectInfo || !clientInfo) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Colors corporatius
    const primaryColor: [number, number, number] = [59, 130, 246];
    const textColor: [number, number, number] = [51, 51, 51];

    // Títol
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.text("PRESSUPOST", pageWidth / 2, 20, { align: "center" });

    // Línia separadora
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(20, 25, pageWidth - 20, 25);

    // Informació de l'empresa (Esquerra)
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "bold");
    doc.text("DADES DE L'EMPRESA", 20, 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let yPos = 42;
    doc.text(`Empresa: ${supplierInfo.full_name || "N/A"}`, 20, yPos);
    yPos += 5;
    doc.text(`NIF: ${supplierInfo.nif || "N/A"}`, 20, yPos);
    yPos += 5;
    doc.text(`Email: ${supplierInfo.email || "N/A"}`, 20, yPos);
    yPos += 5;
    doc.text(`Telèfon: ${supplierInfo.phone || "N/A"}`, 20, yPos);
    yPos += 5;
    const supplierAddress = [
      supplierInfo.street,
      supplierInfo.street_number,
      supplierInfo.postal_code,
      supplierInfo.city,
      supplierInfo.province
    ].filter(Boolean).join(", ");
    doc.text(`Adreça: ${supplierAddress || "N/A"}`, 20, yPos);

    // Informació del client i projecte (Dreta)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("DADES DEL CLIENT", pageWidth / 2 + 10, 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    yPos = 42;
    doc.text(`Client: ${clientInfo.full_name || "N/A"}`, pageWidth / 2 + 10, yPos);
    yPos += 5;
    doc.text(`NIF: ${clientInfo.nif || "N/A"}`, pageWidth / 2 + 10, yPos);
    yPos += 5;
    doc.text(`Email: ${clientInfo.email || "N/A"}`, pageWidth / 2 + 10, yPos);
    yPos += 5;
    doc.text(`Telèfon: ${clientInfo.phone || "N/A"}`, pageWidth / 2 + 10, yPos);
    yPos += 5;
    const clientAddress = [
      clientInfo.street,
      clientInfo.street_number,
      clientInfo.postal_code,
      clientInfo.city,
      clientInfo.province
    ].filter(Boolean).join(", ");
    doc.text(`Adreça: ${clientAddress || "N/A"}`, pageWidth / 2 + 10, yPos);

    yPos += 10;

    // Informació del projecte
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("DADES DEL PROJECTE", pageWidth / 2 + 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    yPos += 7;
    doc.text(`Projecte: ${projectInfo.name || "N/A"}`, pageWidth / 2 + 10, yPos);
    yPos += 5;
    if (projectInfo.description) {
      doc.text(`Descripció: ${projectInfo.description.substring(0, 50)}...`, pageWidth / 2 + 10, yPos);
      yPos += 5;
    }
    const projectAddress = [
      projectInfo.street,
      projectInfo.street_number,
      projectInfo.postal_code,
      projectInfo.city,
      projectInfo.province
    ].filter(Boolean).join(", ");
    if (projectAddress) {
      doc.text(`Adreça: ${projectAddress}`, pageWidth / 2 + 10, yPos);
      yPos += 5;
    }
    if (projectInfo.cadastral_reference) {
      doc.text(`Ref. Cadastral: ${projectInfo.cadastral_reference}`, pageWidth / 2 + 10, yPos);
    }

    yPos = Math.max(yPos, 80);

    // Data i validesa
    const submittedDate = new Date(budget.submitted_at);
    const expirationDate = addDays(submittedDate, budget.validity_days);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    yPos += 10;
    doc.text(`Data de presentació: ${format(submittedDate, "dd/MM/yyyy")}`, 20, yPos);
    doc.text(`Data de caducitat: ${format(expirationDate, "dd/MM/yyyy")}`, pageWidth / 2 + 10, yPos);

    yPos += 10;

    // Taula de valoracions
    const tableData = budget.valuations.map(val => [
      `${val.chapter_code}.${val.subchapter_code}.${val.subsubchapter_code}`,
      `Descripció ${val.chapter_code}.${val.subchapter_code}.${val.subsubchapter_code}`,
      `${val.estimated_amount.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Codi', 'Descripció', 'Import']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 100 },
        2: { cellWidth: 40, halign: 'right' },
      },
    });

    // Total
    yPos = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(
      `TOTAL: ${budget.total_amount.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      pageWidth - 20,
      yPos,
      { align: "right" }
    );

    // Condicions acceptades
    yPos += 15;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CONDICIONS GENERALS ACCEPTADES", 20, yPos);

    const conditions = [
      { key: "condition_scope", label: "Àmbit" },
      { key: "condition_jurisdiction", label: "Jurisdicció" },
      { key: "condition_suspension", label: "Suspensió" },
      { key: "condition_documentation", label: "Documentació" },
      { key: "condition_coordination", label: "Coordinació" },
      { key: "condition_safety", label: "Seguretat" },
      { key: "condition_materials", label: "Materials" },
      { key: "condition_execution", label: "Execució" },
      { key: "condition_deadlines", label: "Terminis" },
      { key: "condition_economic", label: "Econòmiques" },
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    yPos += 7;
    
    conditions.forEach(condition => {
      if (budget[condition.key as keyof BudgetDetail]) {
        doc.text(`✓ ${condition.label}`, 25, yPos);
        yPos += 5;
      }
    });

    // Observacions
    if (budget.notes) {
      yPos += 10;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("OBSERVACIONS", 20, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitNotes = doc.splitTextToSize(budget.notes, pageWidth - 40);
      doc.text(splitNotes, 20, yPos);
    }

    // Descarregar PDF
    const fileName = `pressupost_${supplierInfo.full_name}_${format(submittedDate, "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);

    toast({
      title: "PDF generat",
      description: "El pressupost s'ha descarregat correctament",
    });
  };

  const conditions = [
    { 
      key: "condition_scope", 
      label: "Objecte i abast", 
      description: "Aquest pressupost es refereix exclusivament als treballs i subministraments detallats en les partides adjuntes. Qualsevol modificació, ampliació o treball addicional no especificat serà objecte de valoració a part. Els preus inclouen mà d'obra, materials i mitjans propis necessaris per a l'execució correcta, excepte si s'indica el contrari." 
    },
    { 
      key: "condition_economic", 
      label: "Condicions econòmiques", 
      description: "Els preus no inclouen IVA i són vàlids durant 30 dies des de la data del pressupost. Les certificacions i pagaments es faran segons l'avanç real dels treballs, amb un termini màxim de pagament de 30 dies des de la seva aprovació. L'empresa es reserva el dret d'aplicar interessos per demora segons la Llei 3/2004 de lluita contra la morositat. Els preus es consideren tancats excepte per variacions justificades en materials o condicions d'obra alienes a l'industrial. Qualsevol aturada, retard o modificació no imputable a l'empresa podrà donar lloc a ajustament de terminis o cost addicional. En cas d'augment excepcional de costos de materials o energia, es podrà sol·licitar revisió proporcional de preus." 
    },
    { 
      key: "condition_deadlines", 
      label: "Terminis i planificació", 
      description: "Els terminis d'execució s'entenen orientatius i condicionats a la correcta coordinació d'oficis, lliurament de zones d'obra, permisos, subministraments i condicions meteorològiques. L'empresa no serà responsable de retards derivats de causes alienes o canvis d'ordre d'execució." 
    },
    { 
      key: "condition_execution", 
      label: "Condicions d'execució", 
      description: "Els treballs s'executaran segons el projecte o les instruccions rebudes, sempre que siguin tècnicament viables i segures. Si es detecten incoherències, riscos o errades de projecte, l'empresa ho comunicarà a la Direcció Facultativa i suspendrà temporalment l'actuació fins a aclariment. Les partides inclouen mitjans auxiliars propis habituals, però no bastides generals, grues torre, o altres mitjans col·lectius si no s'especifica. La zona d'obra haurà d'estar lliure, accessible i amb serveis bàsics (llum, aigua, acopi)." 
    },
    { 
      key: "condition_materials", 
      label: "Materials i garanties", 
      description: "Els materials utilitzats seran de primera qualitat i amb marcat CE. Les garanties dels materials o equips seran les del fabricant, i l'empresa respondrà únicament de la muntatge i posada en obra. Les reparacions durant el període de garantia es limitaran a defectes d'execució demostrats. No s'admeten reclamacions per mal ús, falta de manteniment o intervencions d'altres oficis." 
    },
    { 
      key: "condition_safety", 
      label: "Seguretat i medi ambient", 
      description: "L'empresa compleix amb el Pla de Seguretat i Salut i amb la normativa vigent en matèria laboral i mediambiental. Les despeses associades a seguretat, gestió de residus o transport s'inclouen només si es detallen expressament al pressupost." 
    },
    { 
      key: "condition_coordination", 
      label: "Coordinació i responsabilitats",
      description: "L'empresa es compromet a coordinar-se amb la resta d'industrials, però no assumeix responsabilitat per danys o repassos derivats d'altres oficis. Els treballs afectats per altres empreses o intervencions posteriors no seran objecte de repàs sense cost addicional." 
    },
    { 
      key: "condition_documentation", 
      label: "Documentació i recepció", 
      description: "En finalitzar els treballs, s'emetrà un certificat d'obra executada i es lliuraran les fitxes tècniques i garanties. La recepció s'entendrà feta si, en un termini de 7 dies, no es formulen observacions per escrit. Els treballs tindran una garantia d'un any per defectes d'execució, excepte per normativa o acord diferent." 
    },
    { 
      key: "condition_suspension", 
      label: "Causes de suspensió o resolució", 
      description: "L'empresa podrà suspendre o rescindir el contracte si: • No es compleixen els terminis de pagament acordats. • S'ordenen modificacions substancials sense autorització escrita. • No es garanteixen les condicions mínimes de seguretat o accés. En aquests casos, l'empresa tindrà dret a cobrar els treballs executats i a reclamar els perjudicis derivats." 
    },
    { 
      key: "condition_jurisdiction", 
      label: "Jurisdicció", 
      description: "Qualsevol discrepància es resoldrà preferentment per via amistosa, i en cas contrari, davant els tribunals del lloc d'execució de l'obra." 
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendent", variant: "secondary" as const },
      accepted: { label: "Acceptat", variant: "default" as const },
      rejected: { label: "Rebutjat", variant: "destructive" as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRemainingDays = () => {
    if (!budget) return 0;
    const expirationDate = addDays(new Date(budget.submitted_at), budget.validity_days);
    return differenceInDays(expirationDate, new Date());
  };

  const getRemainingDaysColor = (days: number) => {
    if (days < 0) return "text-destructive";
    if (days <= 7) return "text-orange-500";
    return "text-green-600";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-2xl">Detall del pressupost</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !budget ? (
          <div className="text-center p-8 text-muted-foreground flex-1 flex items-center justify-center">
            No s'han pogut carregar les dades del pressupost
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="py-4">
              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-2xl flex items-center gap-2 flex-wrap">
                        {supplierInfo?.full_name || "Industrial"}
                        {getStatusBadge(budget.status)}
                      </CardTitle>
                      <CardDescription className="text-base">
                        Pressupost per: {projectInfo?.name || "Projecte"}
                      </CardDescription>
                      {budget.offer_code && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-sm text-muted-foreground">Codi pressupost:</span>
                          <span className="text-sm font-mono font-semibold text-primary">{budget.offer_code}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 lg:text-right">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">Presentació: {format(new Date(budget.submitted_at), "dd/MM/yyyy")}</span>
                          <span className="font-medium">Caducitat: {format(addDays(new Date(budget.submitted_at), budget.validity_days), "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 text-sm font-semibold ${getRemainingDaysColor(getRemainingDays())}`}>
                        <Clock className="h-4 w-4" />
                        <span>
                          {getRemainingDays() >= 0 
                            ? `${getRemainingDays()} dies restants`
                            : `Caducat fa ${Math.abs(getRemainingDays())} dies`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-6">
                  {/* Informació de contacte */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold text-lg border-b pb-2">Dades de l'empresa</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">NIF:</span> {supplierInfo?.nif || "N/A"}</p>
                        <p><span className="font-medium">Email:</span> {supplierInfo?.email || "N/A"}</p>
                        <p><span className="font-medium">Telèfon:</span> {supplierInfo?.phone || "N/A"}</p>
                        {supplierInfo?.street && (
                          <p><span className="font-medium">Adreça:</span> {[
                            supplierInfo.street,
                            supplierInfo.street_number,
                            supplierInfo.postal_code,
                            supplierInfo.city,
                            supplierInfo.province
                          ].filter(Boolean).join(", ")}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold text-lg border-b pb-2">Dades del projecte</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Client:</span> {clientInfo?.full_name || "N/A"}</p>
                        <p><span className="font-medium">Email:</span> {clientInfo?.email || "N/A"}</p>
                        <p><span className="font-medium">Telèfon:</span> {clientInfo?.phone || "N/A"}</p>
                        {projectInfo?.street && (
                          <p><span className="font-medium">Adreça obra:</span> {[
                            projectInfo.street,
                            projectInfo.street_number,
                            projectInfo.postal_code,
                            projectInfo.city,
                            projectInfo.province
                          ].filter(Boolean).join(", ")}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desglossament - PRIMER */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Desglossament del pressupost</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-muted/50 z-10">
                            <TableRow>
                              <TableHead className="font-semibold min-w-[140px]">Codi</TableHead>
                              <TableHead className="font-semibold min-w-[100px]">Unitat</TableHead>
                              <TableHead className="font-semibold min-w-[100px]">Quantitat</TableHead>
                              <TableHead className="font-semibold min-w-[200px]">Nom</TableHead>
                              <TableHead className="font-semibold min-w-[300px]">Descripció</TableHead>
                              <TableHead className="text-right font-semibold min-w-[120px]">Import</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {budget.valuations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  No hi ha partides en aquest pressupost
                                </TableCell>
                              </TableRow>
                            ) : (
                              budget.valuations.map((val, idx) => {
                                // Utilitzar full_code si existeix, sinó construir-lo
                                const fullCode = val.full_code || 
                                  [val.chapter_code, val.subchapter_code, val.subsubchapter_code, val.item_code]
                                    .filter(c => c)
                                    .join('.');
                                
                                const displayName = val.short_description || val.custom_name || val.type_name || `Partida ${fullCode}`;
                                const displayDescription = val.long_description || val.short_description || '';
                                const unit = val.unit || 'UT';
                                const quantity = val.quantity || 0;
                                
                                return (
                                  <TableRow key={idx} className="hover:bg-muted/30">
                                    <TableCell className="font-mono text-sm align-top">
                                      {fullCode || '---'}
                                    </TableCell>
                                    <TableCell className="text-sm align-top">
                                      {unit}
                                    </TableCell>
                                    <TableCell className="text-sm align-top">
                                      {quantity.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <span className="font-medium">{displayName || '---'}</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground align-top">
                                      {displayDescription || '---'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium align-top whitespace-nowrap">
                                      {val.estimated_amount.toLocaleString('ca-ES', { 
                                        minimumFractionDigits: 2, 
                                        maximumFractionDigits: 2 
                                      })} €
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                            <TableRow className="bg-primary/10 font-bold border-t-2 sticky bottom-0">
                              <TableCell colSpan={5} className="text-right text-lg">TOTAL</TableCell>
                              <TableCell className="text-right text-xl whitespace-nowrap">
                                {budget.total_amount.toLocaleString('ca-ES', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })} €
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  {/* Condicions acceptades - DESPRÉS */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Condicions generals acceptades
                    </h3>
                    <div className="space-y-2">
                      {conditions.map(condition => (
                        budget[condition.key as keyof BudgetDetail] && (
                          <div key={condition.key} className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-sm">{condition.label}</p>
                                <p className="text-xs text-muted-foreground mt-1">{condition.description}</p>
                              </div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>

                  {/* Observacions */}
                  {budget.notes && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg border-b pb-2">Observacions</h3>
                      <div className="p-4 bg-muted/30 rounded-lg border">
                        <p className="text-sm whitespace-pre-wrap">{budget.notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 border-t bg-muted/30 flex-shrink-0">
          <Button
            onClick={generatePDF}
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            disabled={!budget}
          >
            <FileDown className="h-4 w-4" />
            Descarregar PDF
          </Button>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Tancar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

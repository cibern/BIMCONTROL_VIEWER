import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Eye, EyeOff, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BestOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  bestOffer: Array<{
    code: string;
    description: string;
    amount: number;
    supplier: string;
    supplierId?: string;
    unit?: string;
    quantity?: number;
    itemName?: string;
    expiryDate?: string;
  }>;
  worstOfferTotal?: number;
}

interface ProjectInfo {
  name: string;
  description?: string;
  street?: string;
  street_number?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  created_by: string;
}

interface ClientInfo {
  full_name?: string;
  email?: string;
}

export const BestOfferModal = ({
  open,
  onOpenChange,
  projectId,
  bestOffer,
  worstOfferTotal,
}: BestOfferModalProps) => {
  const [loading, setLoading] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [suppliersInfo, setSuppliersInfo] = useState<Map<string, string>>(new Map());
  const [supplierCategories, setSupplierCategories] = useState<Map<string, string>>(new Map());
  const [showPercentage, setShowPercentage] = useState(false);
  const [sortField, setSortField] = useState<"supplier" | "days" | "amount" | "percentage" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  useEffect(() => {
    if (open && projectId) {
      loadProjectData();
    }
  }, [open, projectId]);

  const loadProjectData = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      // Carregar informació del projecte
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      setProjectInfo(project);

      // Carregar informació del client
      if (project) {
        const { data: client } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", project.created_by)
          .single();

        setClientInfo(client);
      }

      // Obtenir IDs únics dels suppliers
      const uniqueSupplierIds = [...new Set(bestOffer.map(item => item.supplierId).filter(Boolean))];
      
      // Carregar informació de tots els suppliers
      if (uniqueSupplierIds.length > 0) {
        const { data: suppliers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", uniqueSupplierIds);

        if (suppliers) {
          const suppliersMap = new Map(suppliers.map(s => [s.id, s.full_name || '']));
          setSuppliersInfo(suppliersMap);
        }

        // Carregar categories dels suppliers
        const { data: categories } = await supabase
          .from("supplier_categories")
          .select(`
            supplier_id,
            specialist_categories (name)
          `)
          .in("supplier_id", uniqueSupplierIds);

        if (categories) {
          const categoriesMap = new Map(
            categories.map(c => [
              c.supplier_id, 
              c.specialist_categories?.name || ''
            ])
          );
          setSupplierCategories(categoriesMap);
        }
      }

    } catch (error) {
      console.error("Error loading project data:", error);
      toast({
        title: "Error",
        description: "No s'han pogut carregar les dades del projecte",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = bestOffer.reduce((sum, item) => sum + item.amount, 0);
  
  // Obtenir tots els noms únics dels industrials
  const allSuppliers = [...new Set(bestOffer.map(item => item.supplier))].filter(Boolean);

  // Calcular la proposta més cara per obtenir percentatges
  const maxAmount = Math.max(...bestOffer.map(item => item.amount));
  
  // Comptar quantes ofertes úniques hi ha per cada partida
  const hasMultipleOffers = bestOffer.length > allSuppliers.length;
  
  // Calcular percentatge de reducció respecte la pitjor oferta
  const reductionPercentage = worstOfferTotal && worstOfferTotal > 0 
    ? ((worstOfferTotal - totalAmount) / worstOfferTotal) * 100 
    : 0;

  // Dades ordenades
  const sortedBestOffer = useMemo(() => {
    if (!sortField) return bestOffer;

    return [...bestOffer].sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "supplier":
          compareValue = a.supplier.localeCompare(b.supplier);
          break;
        case "days":
          const daysA = a.expiryDate ? differenceInDays(new Date(a.expiryDate), new Date()) : -Infinity;
          const daysB = b.expiryDate ? differenceInDays(new Date(b.expiryDate), new Date()) : -Infinity;
          compareValue = daysA - daysB;
          break;
        case "amount":
          compareValue = a.amount - b.amount;
          break;
        case "percentage":
          const percA = maxAmount > 0 ? (a.amount / maxAmount) * 100 : 0;
          const percB = maxAmount > 0 ? (b.amount / maxAmount) * 100 : 0;
          compareValue = percA - percB;
          break;
      }

      return sortDirection === "asc" ? compareValue : -compareValue;
    });
  }, [bestOffer, sortField, sortDirection, maxAmount]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Data d'impressió
    const printDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    // Títol
    doc.setFontSize(18);
    doc.text(`Millor oferta combinada`, 14, 20);
    
    // Data d'impressió
    doc.setFontSize(10);
    doc.text(`Data d'impressió: ${printDate}`, 14, 28);
    
    // Informació del projecte
    doc.setFontSize(12);
    doc.text(`Projecte: ${projectInfo?.name || "N/A"}`, 14, 38);
    doc.text(`Client: ${clientInfo?.full_name || "N/A"}`, 14, 45);
    if (projectInfo?.street) {
      const address = [
        projectInfo.street,
        projectInfo.street_number,
        projectInfo.postal_code,
        projectInfo.city,
        projectInfo.province
      ].filter(Boolean).join(", ");
      doc.text(`Adreça: ${address}`, 14, 52);
    }
    
    doc.text(`Industrials participants (${allSuppliers.length}): ${allSuppliers.join(" • ")}`, 14, 59);
    
    // Preparar dades de la taula
    const tableData = sortedBestOffer.map((item) => {
      const daysRemaining = item.expiryDate 
        ? differenceInDays(new Date(item.expiryDate), new Date())
        : null;
      
      const daysText = daysRemaining !== null 
        ? daysRemaining >= 0 
          ? `${daysRemaining} dies`
          : `Caducat (${Math.abs(daysRemaining)} dies)`
        : '---';

      const categoryText = item.supplierId 
        ? supplierCategories.get(item.supplierId) || ''
        : '';
      
      const descriptionWithCategory = categoryText 
        ? `${item.description || '---'} (${categoryText})`
        : (item.description || '---');

      const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
      const percentageText = percentage === 100 ? "(única oferta)" : `${percentage.toFixed(1)}%`;

      const row = [
        item.code || '---',
        item.itemName || '---',
        descriptionWithCategory,
        item.supplier,
        daysText,
        `${item.amount.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      ];

      if (showPercentage) {
        row.push(percentageText);
      }

      return row;
    });

    const headers = ["Codi", "Nom", "Descripció", "Industrial", "Dies restants", "Import"];
    if (showPercentage) {
      headers.push("% vs màx");
    }

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 68,
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      headStyles: { 
        fillColor: [59, 130, 246],
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 25 },  // Codi
        1: { cellWidth: 35 },  // Nom
        2: { cellWidth: 70 },  // Descripció
        3: { cellWidth: 40 },  // Industrial
        4: { cellWidth: 30 },  // Dies restants
        5: { cellWidth: 30, halign: 'right' },  // Import
        ...(showPercentage && { 6: { cellWidth: 25, halign: 'right' } })  // % vs màx
      },
      foot: [[
        { content: 'TOTAL:', colSpan: showPercentage ? 5 : 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { 
          content: `${totalAmount.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €${worstOfferTotal && reductionPercentage > 0 ? ` (-${reductionPercentage.toFixed(1)}%)` : ''}`, 
          styles: { fontStyle: 'bold' } 
        },
        ...(showPercentage ? [{ content: '', styles: {} }] : [])
      ]],
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0] }
    });

    doc.save(`millor-oferta-${projectInfo?.name || 'proposta'}.pdf`);
    
    toast({
      title: "PDF generat",
      description: "El PDF s'ha descarregat correctament",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-2xl">Millor oferta combinada</DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setShowPercentage(!showPercentage)}
              >
                {showPercentage ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPercentage ? "Ocultar %" : "Mostrar %"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={exportToPDF}
              >
                <Download className="h-4 w-4" />
                Descarregar PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {/* Informació del projecte i industrials */}
            <div className="mb-6 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 border">
                <h3 className="font-semibold text-lg mb-3">Informació del projecte</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Projecte:</p>
                    <p className="text-muted-foreground">{projectInfo?.name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Client:</p>
                    <p className="text-muted-foreground">{clientInfo?.full_name || "N/A"}</p>
                  </div>
                  {projectInfo?.street && (
                    <div className="md:col-span-2">
                      <p className="font-medium">Adreça:</p>
                      <p className="text-muted-foreground">
                        {[
                          projectInfo.street,
                          projectInfo.street_number,
                          projectInfo.postal_code,
                          projectInfo.city,
                          projectInfo.province
                        ].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                <h3 className="font-semibold text-lg mb-2">Industrials participants ({allSuppliers.length})</h3>
                <p className="text-sm text-muted-foreground">
                  {allSuppliers.join(" • ")}
                </p>
              </div>
            </div>

            {/* Taula de partides */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      <TableHead className="font-semibold min-w-[140px]">Codi</TableHead>
                      <TableHead className="font-semibold min-w-[180px]">Nom</TableHead>
                      <TableHead className="font-semibold min-w-[250px]">Descripció</TableHead>
                      <TableHead 
                        className="font-semibold min-w-[150px] cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort("supplier")}
                      >
                        <div className="flex items-center gap-1">
                          Industrial
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold min-w-[120px] cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort("days")}
                      >
                        <div className="flex items-center gap-1">
                          Dies restants
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-right font-semibold min-w-[120px] cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort("amount")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Import
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      {showPercentage && (
                        <TableHead 
                          className="text-right font-semibold min-w-[100px] cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("percentage")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            % vs màx
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBestOffer.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={showPercentage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                          No hi ha partides disponibles
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedBestOffer.map((item, idx) => {
                        const daysRemaining = item.expiryDate 
                          ? differenceInDays(new Date(item.expiryDate), new Date())
                          : null;
                        
                        const daysColor = daysRemaining !== null
                          ? daysRemaining < 0 
                            ? 'text-destructive font-bold'
                            : daysRemaining <= 7 
                            ? 'text-orange-500 font-semibold'
                            : 'text-green-600'
                          : '';

                        const categoryText = item.supplierId 
                          ? supplierCategories.get(item.supplierId)
                          : '';

                        const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                        const isUniqueOffer = percentage === 100;
                        
                        return (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-sm">
                              {item.code || '---'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.itemName || '---'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.description || '---'}
                              {categoryText && (
                                <span className="ml-1 text-xs text-primary">({categoryText})</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {item.supplier}
                            </TableCell>
                            <TableCell className={`text-sm ${daysColor}`}>
                              {daysRemaining !== null 
                                ? daysRemaining >= 0 
                                  ? `${daysRemaining} dies`
                                  : `Caducat (${Math.abs(daysRemaining)} dies)`
                                : '---'
                              }
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.amount.toLocaleString('ca-ES', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                              })} €
                            </TableCell>
                            {showPercentage && (
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {isUniqueOffer ? "(única oferta)" : `${percentage.toFixed(1)}%`}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                    <TableRow className="bg-muted/70 border-t-2 font-bold">
                      <TableCell colSpan={5} className="text-right text-lg">
                        TOTAL:
                      </TableCell>
                      <TableCell className="text-right text-lg font-bold text-primary">
                        <div className="flex flex-col items-end">
                          <span>
                            {totalAmount.toLocaleString('ca-ES', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })} €
                          </span>
                          {worstOfferTotal && reductionPercentage > 0 && (
                            <span className="text-sm text-green-600 dark:text-green-400 font-normal">
                              (-{reductionPercentage.toFixed(1)}% respecte pitjor oferta)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {showPercentage && (
                        <TableCell className="text-right text-sm text-muted-foreground font-normal">
                          ---
                        </TableCell>
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

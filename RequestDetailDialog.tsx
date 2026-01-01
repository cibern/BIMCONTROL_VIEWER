import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Copy, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RequestDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annotationId: string;
  annotationTitle: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  category: string;
  accessToken?: string;
  offer?: {
    amount: number;
    validity_days: number;
    offer_date: string;
    pdf_url: string | null;
    notes: string | null;
  };
}

interface RequestData {
  id: string;
  notes: string | null;
  status: string;
  suppliers: Supplier[];
}

export function RequestDetailDialog({
  open,
  onOpenChange,
  annotationId,
  annotationTitle,
}: RequestDetailDialogProps) {
  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadRequestData();
    }
  }, [open, annotationId]);

  const loadRequestData = async () => {
    try {
      setLoading(true);

      // Get request for this annotation
      const { data: request, error: requestError } = await supabase
        .from("requests")
        .select("id, notes, status")
        .eq("annotation_id", annotationId)
        .single();

      if (requestError) throw requestError;

      // Get suppliers for this request with access tokens
      const { data: requestSuppliers, error: suppliersError } = await supabase
        .from("request_suppliers")
        .select(`
          supplier_id,
          access_token,
          suppliers (
            id,
            name,
            email,
            category
          )
        `)
        .eq("request_id", request.id);

      if (suppliersError) throw suppliersError;

      // Get supplier offers for this request
      const { data: offers, error: offersError } = await supabase
        .from("supplier_offers")
        .select("supplier_id, amount, validity_days, offer_date, pdf_url, notes")
        .eq("request_id", request.id);

      if (offersError) throw offersError;

      // Map offers to suppliers
      const offersMap = new Map(
        offers?.map((offer) => [offer.supplier_id, offer]) || []
      );

      const suppliers = requestSuppliers
        .map((rs: any) => ({
          ...rs.suppliers,
          accessToken: rs.access_token,
          offer: offersMap.get(rs.supplier_id) || null
        }))
        .filter(Boolean);

      setRequestData({
        id: request.id,
        notes: request.notes,
        status: request.status,
        suppliers,
      });
    } catch (error) {
      console.error("Error loading request data:", error);
      toast({
        title: "Error",
        description: "No s'han pogut carregar les dades de la petició",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyOfferLink = (token: string) => {
    const link = `${window.location.origin}/offer/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Enllaç copiat!",
      description: "L'enllaç s'ha copiat al portapapers",
    });
  };

  const openOfferLink = (token: string) => {
    const link = `${window.location.origin}/offer/${token}`;
    window.open(link, '_blank');
  };

  const getRemainingDays = (offerDate: string, validityDays: number) => {
    const expiryDate = new Date(offerDate);
    expiryDate.setDate(expiryDate.getDate() + validityDays);
    return differenceInDays(expiryDate, new Date());
  };

  const downloadPdf = async (pdfUrl: string, supplierName: string) => {
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `oferta-${supplierName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: "PDF descarregat",
        description: "L'oferta s'ha descarregat correctament",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description: "No s'ha pogut descarregar el PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-[70]">
        <DialogHeader>
          <DialogTitle>Detall de la Petició: {annotationTitle}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : requestData ? (
          <div className="space-y-6">
            {/* Notes section */}
            {requestData.notes && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Notes addicionals:</h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {requestData.notes}
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Estat:</h3>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                {requestData.status === "pending" ? "Pendent" : requestData.status}
              </span>
            </div>

            {/* Suppliers table */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Proveidors sol·licitats:</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveïdor</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-center">Enllaç Oferta</TableHead>
                      <TableHead className="text-center">Import (€)</TableHead>
                      <TableHead className="text-center">Dies Restants</TableHead>
                      <TableHead className="text-center">Oferta PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestData.suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {supplier.email}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground">
                            {supplier.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyOfferLink(supplier.accessToken!)}
                              className="h-8 w-8 p-0"
                              title="Copiar enllaç"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openOfferLink(supplier.accessToken!)}
                              className="h-8 w-8 p-0"
                              title="Obrir enllaç"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {supplier.offer ? (
                            <div className="text-sm font-medium text-primary">
                              {parseFloat(supplier.offer.amount.toString()).toLocaleString('ca-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} €
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground italic">
                              Pendent
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {supplier.offer ? (
                            (() => {
                              const remaining = getRemainingDays(
                                supplier.offer.offer_date,
                                supplier.offer.validity_days
                              );
                              return (
                                <div
                                  className={`text-sm font-medium ${
                                    remaining < 7
                                      ? 'text-destructive'
                                      : remaining < 14
                                      ? 'text-warning'
                                      : 'text-success'
                                  }`}
                                >
                                  {remaining > 0 ? `${remaining} dies` : 'Expirat'}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-sm text-muted-foreground italic">-</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {supplier.offer?.pdf_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadPdf(supplier.offer!.pdf_url!, supplier.name)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Descarregar PDF
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              Sense PDF
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {requestData.suppliers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hi ha proveidors assignats a aquesta petició
                </p>
              )}
              
              {/* Information note */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Nota:</strong> Pots copiar els enllaços i enviar-los manualment als proveïdors per correu electrònic o WhatsApp. 
                  Cada enllaç és únic per a cada proveïdor i els permet enviar la seva oferta directament.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No s'han trobat dades de la petició
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

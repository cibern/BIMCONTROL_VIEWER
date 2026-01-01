import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, FileText, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ca } from "date-fns/locale";

interface Offer {
  id: string;
  request_id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_email: string;
  amount: number;
  offer_date: string;
  validity_days: number;
  notes: string | null;
  pdf_url: string | null;
  annotation_title: string;
  annotation_id: string;
}

interface OffersListModalProps {
  open: boolean;
  onClose: () => void;
  centerId: string;
}

export const OffersListModal = ({
  open,
  onClose,
  centerId,
}: OffersListModalProps) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadOffers();
    }
  }, [open, centerId]);

  const loadOffers = async () => {
    setLoading(true);
    try {
      // Get all offers for requests related to annotations in this center
      const { data, error } = await supabase
        .from('supplier_offers')
        .select(`
          id,
          request_id,
          supplier_id,
          amount,
          offer_date,
          validity_days,
          notes,
          pdf_url,
          suppliers (
            name,
            email
          ),
          requests!inner (
            id,
            annotations!inner (
              id,
              title,
              center_id
            )
          )
        `)
        .eq('requests.annotations.center_id', centerId)
        .order('offer_date', { ascending: false });

      if (error) throw error;

      const formattedOffers: Offer[] = data.map((offer: any) => ({
        id: offer.id,
        request_id: offer.request_id,
        supplier_id: offer.supplier_id,
        supplier_name: offer.suppliers.name,
        supplier_email: offer.suppliers.email,
        amount: offer.amount,
        offer_date: offer.offer_date,
        validity_days: offer.validity_days,
        notes: offer.notes,
        pdf_url: offer.pdf_url,
        annotation_title: offer.requests.annotations.title,
        annotation_id: offer.requests.annotations.id,
      }));

      setOffers(formattedOffers);
    } catch (error) {
      console.error("Error loading offers:", error);
      toast.error("Error al carregar les ofertes");
    } finally {
      setLoading(false);
    }
  };

  const calculateRemainingDays = (offerDate: string, validityDays: number) => {
    const expiryDate = new Date(offerDate);
    expiryDate.setDate(expiryDate.getDate() + validityDays);
    const today = new Date();
    const remaining = differenceInDays(expiryDate, today);
    return remaining;
  };

  const getRemainingDaysColor = (remaining: number) => {
    if (remaining < 0) return "text-destructive";
    if (remaining <= 7) return "text-orange-500";
    return "text-green-600";
  };

  const downloadPdf = async (pdfUrl: string) => {
    try {
      const path = pdfUrl.replace(/^.*\/storage\/v1\/object\/public\/ifc-files\//, '');
      const { data, error } = await supabase.storage
        .from('ifc-files')
        .createSignedUrl(path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descarregar el PDF');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto z-[60]">
        <DialogHeader>
          <DialogTitle>Llistat d'Ofertes dels Proveidors</DialogTitle>
          <DialogDescription>
            Totes les ofertes rebudes dels proveidors per a aquest centre
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hi ha ofertes per a aquest centre
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Petició</TableHead>
                <TableHead>Proveïdor</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Import (€)</TableHead>
                <TableHead>Data Oferta</TableHead>
                <TableHead>Validesa</TableHead>
                <TableHead>Dies Restants</TableHead>
                <TableHead>Anotacions</TableHead>
                <TableHead className="text-center">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer, index) => {
                const remainingDays = calculateRemainingDays(offer.offer_date, offer.validity_days);
                return (
                  <TableRow key={offer.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{offer.annotation_title}</TableCell>
                    <TableCell>{offer.supplier_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {offer.supplier_email}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {offer.amount.toLocaleString('ca-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(offer.offer_date), "dd MMM yyyy", { locale: ca })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {offer.validity_days} dies
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 text-sm font-medium ${getRemainingDaysColor(remainingDays)}`}>
                        <Clock className="h-3 w-3" />
                        {remainingDays < 0 ? "Caducada" : `${remainingDays} dies`}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {offer.notes ? (
                        <div className="text-sm text-muted-foreground truncate" title={offer.notes}>
                          {offer.notes}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {offer.pdf_url ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdf(offer.pdf_url!)}
                          className="gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Veure
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Pendent
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

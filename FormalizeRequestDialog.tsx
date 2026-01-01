import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  nif: string;
}

interface SupplierWithCategories extends Supplier {
  categories: { category_id: string }[];
}

interface FormalizeRequestDialogProps {
  open: boolean;
  onClose: () => void;
  annotationId: string;
  annotationTitle: string;
  onSuccess: () => void;
}

export const FormalizeRequestDialog = ({
  open,
  onClose,
  annotationId,
  annotationTitle,
  onSuccess,
}: FormalizeRequestDialogProps) => {
  const [suppliers, setSuppliers] = useState<SupplierWithCategories[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<SupplierWithCategories[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [notes, setNotes] = useState("");
  const [specialistCategories, setSpecialistCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      loadSpecialistCategories();
      loadSuppliers();
    } else {
      // Reset state when closing
      setSelectedSuppliers([]);
      setSearchTerm("");
      setCategoryFilter("all");
      setNotes("");
    }
  }, [open]);

  useEffect(() => {
    filterSuppliers();
  }, [suppliers, searchTerm, categoryFilter]);

  const loadSpecialistCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('specialist_categories')
        .select('id, name')
        .order('display_order');

      if (error) throw error;
      setSpecialistCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (suppliersError) throw suppliersError;

      // Carregar categories per cada supplier
      const { data: supplierCategoriesData, error: categoriesError } = await supabase
        .from('supplier_categories')
        .select('supplier_id, category_id');

      if (categoriesError) throw categoriesError;

      // Combinar dades
      const suppliersWithCategories: SupplierWithCategories[] = (suppliersData || []).map(supplier => ({
        ...supplier,
        categories: supplierCategoriesData
          ?.filter(sc => sc.supplier_id === supplier.id)
          .map(sc => ({ category_id: sc.category_id })) || []
      }));

      setSuppliers(suppliersWithCategories);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast.error("Error al carregar els proveïdors");
    } finally {
      setLoading(false);
    }
  };

  const filterSuppliers = () => {
    let filtered = suppliers;

    if (categoryFilter !== "all") {
      filtered = filtered.filter(s => 
        s.categories.some(c => c.category_id === categoryFilter)
      );
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search) ||
        s.nif.toLowerCase().includes(search)
      );
    }

    setFilteredSuppliers(filtered);
  };

  const handleSupplierToggle = (supplierId: string) => {
    setSelectedSuppliers(prev => {
      if (prev.includes(supplierId)) {
        return prev.filter(id => id !== supplierId);
      } else {
        if (prev.length >= 3) {
          toast.error("Només pots seleccionar fins a 3 proveïdors");
          return prev;
        }
        return [...prev, supplierId];
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedSuppliers.length === 0) {
      toast.error("Has de seleccionar almenys un proveïdor");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Get annotation details to fetch center_id
      const { data: annotation, error: annotationError } = await supabase
        .from('annotations')
        .select('center_id')
        .eq('id', annotationId)
        .single();

      if (annotationError) throw annotationError;

      // Get center name
      const { data: center, error: centerError } = await supabase
        .from('centers')
        .select('name')
        .eq('id', annotation.center_id)
        .single();

      if (centerError) throw centerError;

      const centerName = center?.name || "Centre";

      // Create the request
      const { data: request, error: requestError } = await supabase
        .from('requests')
        .insert({
          annotation_id: annotationId,
          user_id: user.id,
          status: 'pending',
          notes: notes || null,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Assign suppliers to the request with explicit access_token generation
      const supplierAssignments = selectedSuppliers.map(supplierId => ({
        request_id: request.id,
        supplier_id: supplierId,
        access_token: crypto.randomUUID(), // Generate unique token for each supplier
      }));

      const { data: createdAssignments, error: assignError } = await supabase
        .from('request_suppliers')
        .insert(supplierAssignments)
        .select('*');

      if (assignError) {
        console.error("Error creating request_suppliers:", assignError);
        throw assignError;
      }

      console.log("Created request_suppliers with tokens:", createdAssignments);

      // Try to send emails to suppliers (non-blocking)
      toast.success(`Petició formalitzada correctament amb ${selectedSuppliers.length} proveïdor${selectedSuppliers.length > 1 ? 's' : ''}`);
      
      // Send emails in background without blocking the UI
      supabase.functions.invoke('send-request-emails', {
        body: {
          requestId: request.id,
          annotationId: annotationId,
          centerName: centerName,
          notes: notes || "",
          appUrl: window.location.origin,
        },
      }).then(({ data, error: emailError }) => {
        if (emailError) {
          console.error("Error sending emails:", emailError);
          toast.warning("Els correus no s'han pogut enviar. Comparteix els enllaços manualment des de 'Veure Petició'");
        } else if (data) {
          const successCount = data.sent || 0;
          const totalCount = data.total || 0;
          
          if (successCount === 0) {
            toast.warning("Els correus no s'han pogut enviar. Comparteix els enllaços manualment des de 'Veure Petició'");
          } else if (successCount < totalCount) {
            toast.warning(`Només ${successCount} de ${totalCount} correus s'han enviat. Revisa els enllaços a 'Veure Petició'`);
          } else {
            toast.success("Correus enviats correctament als proveïdors!");
          }
        }
      }).catch((emailError) => {
        console.error("Error sending emails:", emailError);
        toast.warning("Els correus no s'han pogut enviar. Comparteix els enllaços manualment des de 'Veure Petició'");
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error formalizing request:", error);
      toast.error("Error al formalitzar la petició");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryNames = (categories: { category_id: string }[]) => {
    return categories
      .map(c => specialistCategories.find(sc => sc.id === c.category_id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto z-[70]">
        <DialogHeader>
          <DialogTitle>Formalitzar Petició</DialogTitle>
          <DialogDescription>
            Selecciona fins a 3 proveïdors per enviar la petició: <strong>{annotationTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes addicionals (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Afegeix notes o comentaris addicionals per a la petició..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Cerca per nom, email o NIF</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar proveïdor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Totes les categories</SelectItem>
                  {specialistCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected count */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              Proveïdors seleccionats: {selectedSuppliers.length} / 3
            </span>
            {selectedSuppliers.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSuppliers([])}
              >
                Netejar selecció
              </Button>
            )}
          </div>

          {/* Suppliers list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {suppliers.length === 0 
                ? "No tens proveïdors creats. Crea'n un primer des del menú de proveïdors."
                : "No s'han trobat proveïdors amb els filtres aplicats"}
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
              {filteredSuppliers.map((supplier) => {
                const isSelected = selectedSuppliers.includes(supplier.id);
                const categoryNames = getCategoryNames(supplier.categories);
                
                return (
                  <div
                    key={supplier.id}
                    className={`p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => handleSupplierToggle(supplier.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleSupplierToggle(supplier.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{supplier.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <div>{supplier.email}</div>
                        {supplier.phone && <div>{supplier.phone}</div>}
                        <div className="flex items-center gap-2">
                          <span>NIF: {supplier.nif}</span>
                          {categoryNames && (
                            <span className="text-xs px-2 py-0.5 bg-muted rounded">
                              {categoryNames}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel·lar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedSuppliers.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Formalitzant...
              </>
            ) : (
              `Formalitzar Petició (${selectedSuppliers.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

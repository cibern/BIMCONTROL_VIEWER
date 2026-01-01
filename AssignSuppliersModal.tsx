import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle } from "@/components/ui/nested-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface AssignSuppliersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string;
  userId: string;
  chapterCode: string;
  chapterName: string;
  subchapterCode: string;
  subchapterName: string;
  subsubchapterCode: string;
  subsubchapterName: string;
  specialistCategory: string;
  elementCount: number;
}

export function AssignSuppliersModal({
  open,
  onOpenChange,
  centerId,
  userId,
  chapterCode,
  chapterName,
  subchapterCode,
  subchapterName,
  subsubchapterCode,
  subsubchapterName,
  specialistCategory,
  elementCount,
}: AssignSuppliersModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualCategory, setManualCategory] = useState<string>("");

  const SPECIALIST_CATEGORIES = [
    "Terreny i fonamentació",
    "Estructura (formigó estructural / encofrats)",
    "Paleteria i tancaments",
    "Fusteria i serralleria",
    "Pintura i acabats",
    "Aigua i sanejament",
    "Climatització i ventilació",
    "Electricitat i control",
    "Telecomunicacions i seguretat",
    "Gas i combustibles",
    "Protecció contra incendis",
    "Equipament i mobiliari",
    "Urbanització i exteriors",
    "Obra temporal i logística",
  ];

  useEffect(() => {
    if (open) {
      setManualCategory("");
      loadExistingAssignments();
      if (specialistCategory) {
        loadSuppliers();
      }
    }
  }, [open, specialistCategory]);

  useEffect(() => {
    if (manualCategory) {
      loadSuppliers();
    }
  }, [manualCategory]);

  const loadSuppliers = async () => {
    const categoryToUse = manualCategory || specialistCategory;
    if (!categoryToUse) return;

    setLoading(true);
    try {
      const { data: categoryData, error: categoryError } = await supabase
        .from("specialist_categories")
        .select("id")
        .eq("name", categoryToUse)
        .maybeSingle();

      if (categoryError) throw categoryError;
      if (!categoryData) {
        toast.error("Categoria d'especialista no trobada");
        return;
      }

      const { data: supplierCategories, error: supplierCategoriesError } = await supabase
        .from("supplier_categories")
        .select("supplier_id")
        .eq("category_id", categoryData.id);

      if (supplierCategoriesError) throw supplierCategoriesError;

      const supplierIds = supplierCategories?.map((sc) => sc.supplier_id) || [];

      if (supplierIds.length === 0) {
        setSuppliers([]);
        return;
      }

      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("id, name, email, phone")
        .in("id", supplierIds)
        .eq("user_id", userId);

      if (suppliersError) throw suppliersError;

      setSuppliers(suppliersData || []);
    } catch (error) {
      toast.error("Error carregant els industrials/especialistes");
      console.error("Error loading suppliers:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAssignments = async () => {
    if (!centerId) {
      console.warn("No centerId provided");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("budget_supplier_valuations")
        .select("supplier_id")
        .eq("center_id", centerId)
        .eq("user_id", userId)
        .eq("chapter_code", chapterCode)
        .eq("subchapter_code", subchapterCode)
        .eq("subsubchapter_code", subsubchapterCode);

      if (error) throw error;

      setSelectedSuppliers(data?.map(v => v.supplier_id) || []);
    } catch (error) {
      console.error("Error loading existing assignments:", error);
    }
  };

  const handleToggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const handleSave = async () => {
    if (!centerId) {
      toast.error("No s'ha pogut identificar el centre. Si us plau, associa aquest projecte a un centre.");
      return;
    }

    setSaving(true);
    try {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from("budget_supplier_valuations")
        .delete()
        .eq("center_id", centerId)
        .eq("user_id", userId)
        .eq("chapter_code", chapterCode)
        .eq("subchapter_code", subchapterCode)
        .eq("subsubchapter_code", subsubchapterCode);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (selectedSuppliers.length > 0) {
        const insertData = selectedSuppliers.map(supplierId => ({
          center_id: centerId,
          user_id: userId,
          chapter_code: chapterCode,
          subchapter_code: subchapterCode,
          subsubchapter_code: subsubchapterCode,
          supplier_id: supplierId,
          estimated_amount: 0,
        }));

        const { error: insertError } = await supabase
          .from("budget_supplier_valuations")
          .insert(insertData);

        if (insertError) throw insertError;
      }

      toast.success("Industrials/especialistes assignats correctament");
      onOpenChange(false);
    } catch (error) {
      toast.error("Error assignant industrials/especialistes");
      console.error("Error saving assignments:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <NestedDialog open={open} onOpenChange={onOpenChange}>
      <NestedDialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <NestedDialogHeader>
          <NestedDialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assignar industrials i especialistes
          </NestedDialogTitle>
        </NestedDialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto px-1">
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Capítol:</strong> {chapterCode} - {chapterName}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Subcapítol:</strong> {subchapterCode} - {subchapterName}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Sub-subcapítol:</strong> {subsubchapterCode} - {subsubchapterName}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Categoria:</span>
              {specialistCategory ? (
                <Badge variant="secondary">{specialistCategory}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No determinada automàticament
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Elements:</span>
              <Badge variant="outline">{elementCount}</Badge>
            </div>
          </div>

          <Separator />

          {!specialistCategory && !manualCategory ? (
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Categoria no determinada automàticament
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Selecciona manualment una categoria d'especialista per assignar industrials a aquesta partida.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-category" className="text-base font-semibold">
                  Selecciona la categoria d'especialista
                </Label>
                <Select value={manualCategory} onValueChange={setManualCategory}>
                  <SelectTrigger id="manual-category">
                    <SelectValue placeholder="Tria una categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIST_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                No hi ha industrials assignats a la categoria <strong>{manualCategory || specialistCategory}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Afegeix industrials des del menú "Industrials i especialistes"
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Industrials disponibles</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Seleccioneu els industrials que voleu assignar a aquesta partida
                </p>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {suppliers.map((supplier) => (
                  <div key={supplier.id} className="border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`supplier-${supplier.id}`}
                        checked={selectedSuppliers.includes(supplier.id)}
                        onCheckedChange={() => handleToggleSupplier(supplier.id)}
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor={`supplier-${supplier.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {supplier.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">{supplier.email}</p>
                        {supplier.phone && (
                          <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedSuppliers.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium">
                    {selectedSuppliers.length} industrial{selectedSuppliers.length !== 1 ? 's' : ''} seleccionat{selectedSuppliers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel·lar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </NestedDialogContent>
    </NestedDialog>
  );
}

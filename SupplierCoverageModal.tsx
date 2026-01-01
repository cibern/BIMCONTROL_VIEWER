import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ChevronDown,
  ChevronRight,
  Send,
  FileText,
  Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface BudgetElement {
  id: string;
  type_name: string;
  custom_name?: string | null;
  full_code?: string | null;
  subsubchapter_id?: string | null;
  measured_value?: number | null;
  preferred_unit?: string;
}

interface SupplierCoverageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  categoriesWithItems: { categoryName: string; itemCount: number; items?: BudgetElement[] }[];
}

interface CategoryCoverage {
  categoryName: string;
  categoryId: string | null;
  itemCount: number;
  supplierCount: number;
  items: BudgetElement[];
}

export const SupplierCoverageModal = ({
  open,
  onOpenChange,
  projectId,
  categoriesWithItems,
}: SupplierCoverageModalProps) => {
  const [coverage, setCoverage] = useState<CategoryCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && categoriesWithItems.length > 0) {
      loadCoverage();
    }
  }, [open, categoriesWithItems]);

  const loadCoverage = async () => {
    setLoading(true);
    try {
      // Obtenir totes les categories d'especialista
      const { data: allCategories } = await supabase
        .from("specialist_categories")
        .select("id, name");

      const categoryMap = new Map(allCategories?.map(c => [c.name.toLowerCase().trim(), c]) || []);

      // Per cada categoria amb partides, buscar el nombre de suppliers
      const coverageResults: CategoryCoverage[] = [];

      for (const catItem of categoriesWithItems) {
        const normalizedName = catItem.categoryName.toLowerCase().trim();
        const category = categoryMap.get(normalizedName);

        let supplierCount = 0;

        if (category) {
          // Comptar suppliers amb aquesta categoria
          const { count } = await supabase
            .from("supplier_categories")
            .select("id", { count: 'exact', head: true })
            .eq("category_id", category.id);

          supplierCount = count || 0;
        }

        coverageResults.push({
          categoryName: catItem.categoryName,
          categoryId: category?.id || null,
          itemCount: catItem.itemCount,
          supplierCount,
          items: catItem.items || [],
        });
      }

      // Ordenar per nombre de suppliers (menys primers per destacar els problemes)
      coverageResults.sort((a, b) => a.supplierCount - b.supplierCount);
      setCoverage(coverageResults);
    } catch (error) {
      console.error("Error loading coverage:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const totalSuppliers = coverage.reduce((sum, c) => sum + c.supplierCount, 0);
  const totalPartides = coverage.reduce((sum, c) => sum + c.itemCount, 0);
  const categoriesWithSuppliers = coverage.filter(c => c.supplierCount > 0).length;
  const categoriesWithoutSuppliers = coverage.filter(c => c.supplierCount === 0).length;

  const getCoverageIcon = (supplierCount: number) => {
    if (supplierCount === 0) return <XCircle className="h-5 w-5 text-destructive" />;
    if (supplierCount < 3) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getCoverageColor = (supplierCount: number) => {
    if (supplierCount === 0) return "bg-destructive/10 border-destructive/30";
    if (supplierCount < 3) return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800";
    return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Send className="h-6 w-6 text-primary" />
            Pressupost enviat als industrials
          </DialogTitle>
          <DialogDescription>
            Resum de les partides i possibles ofertes per categoria
          </DialogDescription>
        </DialogHeader>

        {/* Resum general */}
        <div className="grid grid-cols-3 gap-3 py-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-primary">{totalPartides}</div>
              <div className="text-sm text-muted-foreground">Partides totals</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{categoriesWithSuppliers}</div>
              <div className="text-sm text-muted-foreground">Categories cobertes</div>
            </CardContent>
          </Card>
          <Card className={categoriesWithoutSuppliers > 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted/50"}>
            <CardContent className="p-4 text-center">
              <div className={`text-3xl font-bold ${categoriesWithoutSuppliers > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {categoriesWithoutSuppliers}
              </div>
              <div className="text-sm text-muted-foreground">Sense industrials</div>
            </CardContent>
          </Card>
        </div>

        {categoriesWithoutSuppliers > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">Atenció</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Hi ha {categoriesWithoutSuppliers} {categoriesWithoutSuppliers === 1 ? 'categoria' : 'categories'} sense cap industrial registrat.
                  Aquestes partides no rebran ofertes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Llista de categories */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregant informació...
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {coverage.map((cat) => (
                <Collapsible
                  key={cat.categoryName}
                  open={expandedCategories.has(cat.categoryName)}
                  onOpenChange={() => toggleCategory(cat.categoryName)}
                >
                  <div className={`rounded-lg border-2 ${getCoverageColor(cat.supplierCount)}`}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg">
                        <div className="flex items-center gap-3">
                          {getCoverageIcon(cat.supplierCount)}
                          <div className="text-left">
                            <div className="font-semibold">{cat.categoryName}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Layers className="h-3 w-3" />
                              {cat.itemCount} {cat.itemCount === 1 ? 'partida' : 'partides'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={cat.supplierCount === 0 ? "destructive" : "secondary"}
                            className="text-sm"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {cat.supplierCount} {cat.supplierCount === 1 ? 'oferta possible' : 'ofertes possibles'}
                          </Badge>
                          {expandedCategories.has(cat.categoryName) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {cat.items.length > 0 ? (
                        <div className="border-t px-4 py-3 space-y-2">
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Partides incloses en aquesta categoria:
                          </div>
                          {cat.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-background border"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {item.custom_name || item.type_name}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  {item.full_code && (
                                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                                      {item.full_code}
                                    </span>
                                  )}
                                  {item.measured_value !== null && item.measured_value !== undefined && (
                                    <span>
                                      {item.measured_value.toFixed(2)} {item.preferred_unit || 'UT'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border-t px-4 py-4 text-center text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="text-sm">No hi ha detall de partides disponible</p>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>
            Entès
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ChevronDown,
  ChevronRight,
  BarChart3,
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
import { Progress } from "@/components/ui/progress";

interface BudgetElement {
  id: string;
  type_name: string;
  custom_name?: string | null;
  full_code?: string | null;
  subsubchapter_id?: string | null;
  measured_value?: number | null;
  preferred_unit?: string;
}

interface SupplierCoverageTabProps {
  projectId: string;
  categoriesWithItems: { categoryName: string; itemCount: number; items?: BudgetElement[] }[];
  isVisible: boolean;
}

interface CategoryCoverage {
  categoryName: string;
  categoryId: string | null;
  itemCount: number;
  supplierCount: number;
  items: BudgetElement[];
}

export const SupplierCoverageTab = ({
  projectId,
  categoriesWithItems,
  isVisible,
}: SupplierCoverageTabProps) => {
  const [coverage, setCoverage] = useState<CategoryCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [uniqueSuppliersCount, setUniqueSuppliersCount] = useState(0);

  useEffect(() => {
    if (categoriesWithItems.length > 0) {
      loadCoverage();
    } else {
      setLoading(false);
    }
  }, [categoriesWithItems]);

  const loadCoverage = async () => {
    setLoading(true);
    try {
      // Obtenir totes les categories d'especialista
      const { data: allCategories } = await supabase
        .from("specialist_categories")
        .select("id, name");

      const categoryMap = new Map(allCategories?.map(c => [c.name.toLowerCase().trim(), c]) || []);

      // Recollir tots els category IDs del projecte
      const projectCategoryIds: string[] = [];

      // Per cada categoria amb partides, comptar els suppliers
      const coverageResults: CategoryCoverage[] = [];

      for (const catItem of categoriesWithItems) {
        const normalizedName = catItem.categoryName.toLowerCase().trim();
        const category = categoryMap.get(normalizedName);

        let supplierCount = 0;

        if (category) {
          projectCategoryIds.push(category.id);
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

      // Calcular industrials únics per totes les categories del projecte
      if (projectCategoryIds.length > 0) {
        const { data: supplierCategories } = await supabase
          .from("supplier_categories")
          .select("supplier_id")
          .in("category_id", projectCategoryIds);

        if (supplierCategories) {
          const uniqueSupplierIds = new Set(supplierCategories.map(sc => sc.supplier_id));
          setUniqueSuppliersCount(uniqueSupplierIds.size);
        }
      } else {
        setUniqueSuppliersCount(0);
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

  const totalPartides = coverage.reduce((sum, c) => sum + c.itemCount, 0);
  const categoriesWithSuppliers = coverage.filter(c => c.supplierCount > 0).length;
  const categoriesWithoutSuppliers = coverage.filter(c => c.supplierCount === 0).length;
  const coveragePercentage = coverage.length > 0 
    ? Math.round((categoriesWithSuppliers / coverage.length) * 100) 
    : 0;

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

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        Carregant informació...
      </div>
    );
  }

  if (categoriesWithItems.length === 0) {
    return (
      <div className="py-8 text-center">
        <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Encara no hi ha partides classificades</h3>
        <p className="text-muted-foreground">
          Classifica les partides del pressupost per veure les possibilitats d'ofertes per categoria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Resum general */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold text-primary">{uniqueSuppliersCount}</div>
                <div className="text-xs text-muted-foreground">Industrials únics</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Layers className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{totalPartides}</div>
                <div className="text-xs text-muted-foreground">Partides totals</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{coverage.length}</div>
                <div className="text-xs text-muted-foreground">Categories</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{categoriesWithSuppliers}</div>
                <div className="text-xs text-muted-foreground">Cobertes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={categoriesWithoutSuppliers > 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted/50"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className={`h-8 w-8 ${categoriesWithoutSuppliers > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div>
                <div className={`text-2xl font-bold ${categoriesWithoutSuppliers > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {categoriesWithoutSuppliers}
                </div>
                <div className="text-xs text-muted-foreground">Sense industrials</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de progrés de cobertura */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Cobertura de categories</span>
            <span className="text-sm font-bold text-primary">{coveragePercentage}%</span>
          </div>
          <Progress value={coveragePercentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {categoriesWithSuppliers} de {coverage.length} categories tenen industrials que poden ofertar
          </p>
        </CardContent>
      </Card>

      {/* Estat del pressupost */}
      {isVisible ? (
        <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Send className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">Pressupost visible pels industrials</p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Les {totalPartides} partides de {coverage.length} categories estan disponibles per rebre ofertes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">Pressupost no visible</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Quan facis visible el pressupost, les {totalPartides} partides podran rebre ofertes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Avís de categories sense industrials */}
      {categoriesWithoutSuppliers > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Atenció: Categories sense cobertura</p>
              <p className="text-sm text-muted-foreground">
                Hi ha {categoriesWithoutSuppliers} {categoriesWithoutSuppliers === 1 ? 'categoria' : 'categories'} sense cap industrial registrat.
                Les partides d'aquestes categories no rebran ofertes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Llista de categories */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Detall per categoria
        </h3>
        
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
    </div>
  );
};

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Building, Receipt, Layers, FileText, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { BUDGET_CHAPTERS } from "@/data/budgetChapters";

interface FewestSuppliersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  fewestOffer?: Array<{
    code: string;
    description: string;
    amount: number;
    supplier: string;
    supplierId?: string;
    expiryDate?: string;
  }>;
  worstOfferTotal?: number;
}

interface Valuation {
  chapter_id: string;
  subchapter_id: string;
  subsubchapter_id: string;
  item_code?: string;
  short_description?: string;
  custom_name?: string;
  type_name?: string;
  long_description?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
}

interface SupplierBudget {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_nif?: string;
  supplier_email: string;
  supplier_categories: string[];
  valuations: Valuation[];
  total_amount: number;
  submitted_at: string;
  expires_at: string;
  validity_days: number;
  status: string;
  notes?: string;
}

export const FewestSuppliersModal = ({
  open,
  onOpenChange,
  projectId,
}: FewestSuppliersModalProps) => {
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<SupplierBudget[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && projectId) {
      loadBudgets();
    }
  }, [open, projectId]);

  const loadBudgets = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      // Carregar pressupostos
      const { data: budgetsData, error: budgetsError } = await supabase
        .from("supplier_budgets")
        .select("*")
        .eq("project_id", projectId);

      if (budgetsError) throw budgetsError;

      if (!budgetsData || budgetsData.length === 0) {
        setBudgets([]);
        toast({
          title: "Info",
          description: "No s'han rebut pressupostos encara",
        });
        return;
      }

      const supplierIds = [...new Set(budgetsData.map(b => b.supplier_id))];
      
      // Carregar informació dels proveïdors
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("profiles")
        .select("id, full_name, email, nif")
        .in("id", supplierIds);

      if (suppliersError) throw suppliersError;

      const supplierMap = new Map(suppliersData?.map(s => [s.id, s]) || []);

      // Carregar IDs de la taula suppliers
      const { data: suppliersTableData, error: supplierCoordsError } = await supabase
        .from("suppliers")
        .select("id, user_id")
        .in("user_id", supplierIds);

      if (supplierCoordsError) console.error("Error loading supplier data:", supplierCoordsError);

      const userIdToSupplierIdMap = new Map(suppliersTableData?.map(s => [s.user_id, s.id]) || []);

      const supplierTableIds = suppliersTableData?.map(s => s.id) || [];
      
      // Carregar categories
      const { data: supplierCategoriesData, error: categoriesError } = await supabase
        .from("supplier_categories")
        .select("supplier_id, category_id, specialist_categories(name, display_order)")
        .in("supplier_id", supplierTableIds);

      if (categoriesError) throw categoriesError;

      const supplierIdToCategoriesMap = new Map<string, { categories: string[]; order: number }>();
      supplierCategoriesData?.forEach((sc: any) => {
        const categoryData = sc.specialist_categories;
        if (categoryData) {
          const supplierId = sc.supplier_id;
          const existing = supplierIdToCategoriesMap.get(supplierId);
          
          if (existing) {
            existing.categories.push(categoryData.name || "Sense categoria");
          } else {
            supplierIdToCategoriesMap.set(supplierId, {
              categories: [categoryData.name || "Sense categoria"],
              order: categoryData.display_order || 999,
            });
          }
        }
      });

      const processedBudgets: SupplierBudget[] = budgetsData.map(budget => {
        const supplier = supplierMap.get(budget.supplier_id);
        const supplierTableId = userIdToSupplierIdMap.get(budget.supplier_id);
        const categoryInfo = supplierTableId 
          ? (supplierIdToCategoriesMap.get(supplierTableId) || { categories: ["Sense categoria"], order: 999 })
          : { categories: ["Sense categoria"], order: 999 };
        
        const valuations: Valuation[] = [];
        if (budget.valuations && Array.isArray(budget.valuations)) {
          (budget.valuations as any[]).forEach((v: any) => {
            valuations.push({
              chapter_id: v.chapter_id || '',
              subchapter_id: v.subchapter_id || '',
              subsubchapter_id: v.subsubchapter_id || '',
              item_code: v.item_code || '',
              short_description: v.short_description || '',
              custom_name: v.custom_name || '',
              type_name: v.type_name || '',
              long_description: v.long_description || '',
              unit: v.unit || '',
              quantity: v.quantity || 0,
              unit_price: v.unit_price || 0,
              total: v.total || 0,
            });
          });
        }

        const expiresAt = budget.expires_at || format(addDays(new Date(budget.submitted_at), budget.validity_days), 'yyyy-MM-dd\'T\'HH:mm:ss');
        
        return {
          id: budget.id,
          supplier_id: budget.supplier_id,
          supplier_name: supplier?.full_name || "Industrial desconegut",
          supplier_nif: supplier?.nif || "N/D",
          supplier_email: supplier?.email || "",
          supplier_categories: categoryInfo.categories,
          valuations,
          total_amount: budget.total_amount || 0,
          submitted_at: budget.submitted_at,
          expires_at: expiresAt,
          validity_days: budget.validity_days,
          status: budget.status,
          notes: budget.notes,
        };
      });

      setBudgets(processedBudgets);

    } catch (error) {
      console.error("Error loading budgets:", error);
      toast({
        title: "Error",
        description: "No s'han pogut carregar els pressupostos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Agrupar per categories d'industrials
  const budgetsByCategory = useMemo(() => {
    const grouped = new Map<string, SupplierBudget[]>();
    budgets.forEach(budget => {
      budget.supplier_categories.forEach(category => {
        const existing = grouped.get(category) || [];
        existing.push(budget);
        grouped.set(category, existing);
      });
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [budgets]);

  // Agrupar per capítols de pressupost (00-80)
  const budgetsByChapter = useMemo(() => {
    const grouped = new Map<string, { budgets: SupplierBudget[]; chapterName: string }>();
    
    budgets.forEach(budget => {
      budget.valuations.forEach(valuation => {
        if (valuation.chapter_id) {
          const chapter = BUDGET_CHAPTERS.find(ch => ch.code === valuation.chapter_id);
          const chapterName = chapter ? `${chapter.code} - ${chapter.name}` : valuation.chapter_id;
          
          const existing = grouped.get(valuation.chapter_id);
          if (existing) {
            if (!existing.budgets.find(b => b.id === budget.id)) {
              existing.budgets.push(budget);
            }
          } else {
            grouped.set(valuation.chapter_id, {
              budgets: [budget],
              chapterName,
            });
          }
        }
      });
    });
    
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [budgets]);

  const renderBudgetDetails = (budget: SupplierBudget) => {
    const daysRemaining = differenceInDays(new Date(budget.expires_at), new Date());
    const isExpired = daysRemaining < 0;
    const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 7;

    // Agrupar valoracions per capítol
    const valuationsByChapter = new Map<string, Valuation[]>();
    budget.valuations.forEach(val => {
      const chapter = val.chapter_id;
      const existing = valuationsByChapter.get(chapter) || [];
      existing.push(val);
      valuationsByChapter.set(chapter, existing);
    });

    return (
      <div className="space-y-4 mt-4">
        {/* Informació del pressupost */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informació de l'oferta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de presentació:</span>
                <span className="font-medium">{format(new Date(budget.submitted_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dies de validesa:</span>
                <span className="font-medium">{budget.validity_days} dies</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Data d'expiració:</span>
                <div className="flex items-center gap-2">
                  {isExpired ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : isExpiringSoon ? (
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <span className={`font-medium ${isExpired ? 'text-destructive' : isExpiringSoon ? 'text-orange-500' : 'text-green-600'}`}>
                    {format(new Date(budget.expires_at), 'dd/MM/yyyy')}
                    {isExpired && ' (Caducada)'}
                    {isExpiringSoon && !isExpired && ` (${daysRemaining} dies)`}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estat:</span>
                <Badge variant={budget.status === 'pending' ? 'default' : budget.status === 'accepted' ? 'default' : 'secondary'}>
                  {budget.status === 'pending' ? 'Pendent' : budget.status === 'accepted' ? 'Acceptat' : budget.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total pressupost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {budget.total_amount.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              {budget.notes && (
                <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                  <p className="font-medium mb-1">Notes:</p>
                  <p className="text-muted-foreground">{budget.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Valoracions per capítol */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detall de valoracions per capítol</CardTitle>
            <CardDescription>
              {valuationsByChapter.size} capítol{valuationsByChapter.size !== 1 ? 's' : ''} · {budget.valuations.length} partida{budget.valuations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {Array.from(valuationsByChapter.entries()).map(([chapterCode, vals]) => {
                const chapter = BUDGET_CHAPTERS.find(ch => ch.code === chapterCode);
                const chapterTotal = vals.reduce((sum, v) => sum + (v.total || 0), 0);
                
                return (
                  <AccordionItem key={chapterCode} value={chapterCode}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Layers className="h-4 w-4 text-primary" />
                          <span className="font-semibold">
                            {chapter ? `${chapter.code} - ${chapter.name}` : chapterCode}
                          </span>
                          <Badge variant="outline">{vals.length} partides</Badge>
                        </div>
                        <span className="font-bold text-primary">
                          {chapterTotal.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-7 pt-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[120px]">Codi</TableHead>
                              <TableHead>Descripció</TableHead>
                              <TableHead className="text-right w-[100px]">Quantitat</TableHead>
                              <TableHead className="text-right w-[100px]">Unitat</TableHead>
                              <TableHead className="text-right w-[120px]">Preu unit.</TableHead>
                              <TableHead className="text-right w-[120px]">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {vals.map((val, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">{val.item_code || '-'}</TableCell>
                                <TableCell className="text-sm">
                                  {val.custom_name || val.type_name || val.short_description || '-'}
                                  {val.long_description && (
                                    <p className="text-xs text-muted-foreground mt-1">{val.long_description}</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">{val.quantity?.toFixed(2) || '-'}</TableCell>
                                <TableCell className="text-right">{val.unit || '-'}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {val.unit_price ? `${val.unit_price.toFixed(2)} €` : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold text-primary">
                                  {val.total ? `${val.total.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-bold">
                              <TableCell colSpan={5} className="text-right">Subtotal capítol:</TableCell>
                              <TableCell className="text-right text-primary">
                                {chapterTotal.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Bustia d'entrada</DialogTitle>
              <DialogDescription>
                {budgets.length} pressupost{budgets.length !== 1 ? 's' : ''} rebut{budgets.length !== 1 ? 's' : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : budgets.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No s'han rebut pressupostos encara</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6 pb-6">
            <Tabs defaultValue="categories" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="categories" className="gap-2">
                  <Building className="h-4 w-4" />
                  Per Categories d'Industrials
                </TabsTrigger>
                <TabsTrigger value="chapters" className="gap-2">
                  <Layers className="h-4 w-4" />
                  Per Capítols de Pressupost
                </TabsTrigger>
              </TabsList>

              {/* Per categories d'industrials */}
              <TabsContent value="categories" className="mt-0">
                <div className="space-y-3">
                  {budgetsByCategory.map(([category, categoryBudgets]) => (
                    <Card key={category}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">{category}</CardTitle>
                          </div>
                          <Badge variant="secondary">{categoryBudgets.length} ofert{categoryBudgets.length !== 1 ? 'es' : 'a'}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                          {categoryBudgets.map((budget) => (
                            <AccordionItem key={budget.id} value={budget.id}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="font-semibold">{budget.supplier_name}</span>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span>NIF: {budget.supplier_nif}</span>
                                      <span>·</span>
                                      <span>{budget.supplier_email}</span>
                                    </div>
                                  </div>
                                  <span className="text-lg font-bold text-primary">
                                    {budget.total_amount.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                {renderBudgetDetails(budget)}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Per capítols de pressupost */}
              <TabsContent value="chapters" className="mt-0">
                <div className="space-y-3">
                  {budgetsByChapter.map(([chapterCode, { budgets: chapterBudgets, chapterName }]) => (
                    <Card key={chapterCode}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">{chapterName}</CardTitle>
                          </div>
                          <Badge variant="secondary">{chapterBudgets.length} ofert{chapterBudgets.length !== 1 ? 'es' : 'a'}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                          {chapterBudgets.map((budget) => (
                            <AccordionItem key={budget.id} value={budget.id}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="font-semibold">{budget.supplier_name}</span>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span>NIF: {budget.supplier_nif}</span>
                                      <span>·</span>
                                      <span>{budget.supplier_email}</span>
                                      <span>·</span>
                                      <span>{budget.supplier_categories.join(', ')}</span>
                                    </div>
                                  </div>
                                  <span className="text-lg font-bold text-primary">
                                    {budget.total_amount.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                {renderBudgetDetails(budget)}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
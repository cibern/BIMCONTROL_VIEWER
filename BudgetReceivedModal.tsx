import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Loader2, EyeOff, Eye, MapPin } from "lucide-react";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle } from "@/components/ui/nested-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BudgetDetailModal } from "./BudgetDetailModal";
import { BestOfferModal } from "./BestOfferModal";
import { WorstOfferModal } from "./WorstOfferModal";
import { FewestSuppliersModal } from "./FewestSuppliersModal";
import { TutorialModal } from "./TutorialModal";
import { BUDGET_CHAPTERS } from "@/data/budgetChapters";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { calculateDistanceInKm } from "@/lib/geoUtils";
import { BudgetMapView } from "./BudgetMapView";
import { addDays } from "date-fns";

interface BudgetReceivedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

interface Valuation {
  chapter_code: string;
  subchapter_code: string;
  subsubchapter_code: string;
  estimated_amount: number;
  preferred_unit?: string;
  measured_value?: number;
  short_description?: string;
  custom_name?: string;
  type_name?: string;
  long_description?: string;
  full_code?: string;
  item_code?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
}

interface SupplierBudget {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_company: string;
  supplier_categories: string[];
  category_order: number;
  valuations: Valuation[];
  total_amount: number;
  submitted_at: string;
  validity_days: number;
  status: string;
  supplier_utm_x?: number;
  supplier_utm_y?: number;
  supplier_utm_zone?: string;
  distance?: number;
  supplier_email?: string;
  supplier_phone?: string;
}

interface BudgetRow {
  chapter_code: string;
  subchapter_code: string;
  subsubchapter_code: string;
  full_code: string;
  description: string;
  supplierAmounts: { [supplierId: string]: number };
}

export const BudgetReceivedModal = ({
  open,
  onOpenChange,
  projectId,
}: BudgetReceivedModalProps) => {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<SupplierBudget[]>([]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<SupplierBudget | null>(null);
  const [showBudgetDetail, setShowBudgetDetail] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [chartType, setChartType] = useState<'all' | 'best' | 'worst' | 'fewest'>('all');
  const [tableView, setTableView] = useState<'all' | 'best' | 'worst' | 'fewest'>('all');
  const [hoveredRowCode, setHoveredRowCode] = useState<string | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [projectCoords, setProjectCoords] = useState<{ x: number; y: number; zone: string; address?: string; city?: string; postal_code?: string } | null>(null);
  const [showBestOfferModal, setShowBestOfferModal] = useState(false);
  const [showWorstOfferModal, setShowWorstOfferModal] = useState(false);
  const [showFewestSuppliersModal, setShowFewestSuppliersModal] = useState(false);
  const { toast } = useToast();
  
  const handleTutorial = () => {
    setTutorialOpen(true);
  };

  useEffect(() => {
    if (open && projectId) {
      loadBudgets();
    }
  }, [open, projectId]);

  const loadBudgets = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      // Carregar informació del projecte incloent coordenades UTM
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("utm_x, utm_y, utm_zone, address, city, postal_code")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      // Guardar coordenades del projecte
      if (projectData?.utm_x && projectData?.utm_y && projectData?.utm_zone) {
        setProjectCoords({
          x: projectData.utm_x,
          y: projectData.utm_y,
          zone: projectData.utm_zone,
          address: projectData.address || undefined,
          city: projectData.city || undefined,
          postal_code: projectData.postal_code || undefined,
        });
      }

      const { data: budgetsData, error: budgetsError } = await supabase
        .from("supplier_budgets")
        .select("*")
        .eq("project_id", projectId);

      if (budgetsError) throw budgetsError;

      if (!budgetsData || budgetsData.length === 0) {
        setBudgets([]);
        setBudgetRows([]);
        toast({
          title: "Info",
          description: "No s'han trobat pressupostos per aquest projecte",
        });
        return;
      }

      const supplierIds = [...new Set(budgetsData.map(b => b.supplier_id))];
      
      console.log("📊 Carregant pressupostos:", { 
        projectId, 
        num_budgets: budgetsData.length, 
        supplier_ids: supplierIds 
      });

      // Carregar dades dels suppliers (incloent coordenades UTM i user_id)
      const { data: suppliersTableData, error: supplierCoordsError } = await supabase
        .from("suppliers")
        .select("id, user_id, name, utm_x, utm_y, utm_zone")
        .in("id", supplierIds);

      if (supplierCoordsError) {
        console.error("Error loading supplier data:", supplierCoordsError);
        throw supplierCoordsError;
      }

      // Obtenir els user_ids per carregar informació dels perfils
      const userIds = suppliersTableData?.map(s => s.user_id).filter(Boolean) || [];
      
      // Carregar informació dels proveïdors des dels perfils
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      if (suppliersError) {
        console.error("Error loading supplier profiles:", suppliersError);
      }

      // Mapa de supplier.id -> dades del supplier (coordenades, nom, etc.)
      const supplierMap = new Map(suppliersTableData?.map(s => [s.id, {
        id: s.id,
        user_id: s.user_id,
        name: s.name,
        utm_x: s.utm_x,
        utm_y: s.utm_y,
        utm_zone: s.utm_zone
      }]) || []);
      
      // Mapa de user_id -> dades del perfil
      const profileMap = new Map(suppliersData?.map(s => [s.id, s]) || []);

      // Obtenir els supplier IDs (no user IDs) per buscar les categories
      const supplierTableIds = suppliersTableData?.map(s => s.id) || [];
      
      const { data: supplierCategoriesData, error: categoriesError } = await supabase
        .from("supplier_categories")
        .select("supplier_id, category_id, specialist_categories(name, display_order)")
        .in("supplier_id", supplierTableIds);

      if (categoriesError) throw categoriesError;

      // Mapa de supplier.id (de la taula suppliers) -> arrays de categories
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
        const profile = supplier ? profileMap.get(supplier.user_id) : null;
        
        // Ara budget.supplier_id ja és el supplier.id correcte, podem buscar les categories directament
        const categoryInfo = supplierIdToCategoriesMap.get(budget.supplier_id) || { categories: ["Sense categoria"], order: 999 };
        
        // Calcular distància si tenim coordenades del projecte i del proveïdor
        let distance: number | undefined = undefined;
        if (projectData?.utm_x && projectData?.utm_y && supplier?.utm_x && supplier?.utm_y) {
          distance = calculateDistanceInKm(
            projectData.utm_x,
            projectData.utm_y,
            supplier.utm_x,
            supplier.utm_y
          );
        }
        
        const valuationsMap = new Map<string, number>();
        
        if (budget.valuations && Array.isArray(budget.valuations)) {
          (budget.valuations as any[]).forEach((v: any) => {
            const code = String(v.subsubchapter_id || '');
            if (code) {
              const currentAmount = valuationsMap.get(code) || 0;
              valuationsMap.set(code, currentAmount + (Number(v.total) || 0));
            }
          });
        }
        
        const valuations: Valuation[] = Array.from(valuationsMap.entries()).map(([code, amount]) => {
          const parts = code.split('.');
          return {
            chapter_code: parts[0] || '',
            subchapter_code: parts[1] || '',
            subsubchapter_code: parts[2] || '',
            estimated_amount: amount,
          };
        });
        
        return {
          id: budget.id,
          supplier_id: budget.supplier_id,
          supplier_name: profile?.full_name || supplier?.name || "Industrial desconegut",
          supplier_company: supplier?.name || profile?.full_name || "",
          supplier_categories: categoryInfo.categories,
          category_order: categoryInfo.order,
          valuations,
          total_amount: budget.total_amount || 0,
          submitted_at: budget.submitted_at,
          validity_days: budget.validity_days,
          status: budget.status,
          supplier_utm_x: supplier?.utm_x,
          supplier_utm_y: supplier?.utm_y,
          supplier_utm_zone: supplier?.utm_zone,
          distance,
          supplier_email: profile?.email,
          supplier_phone: profile?.phone,
        };
      });

      processedBudgets.sort((a, b) => {
        if (a.category_order !== b.category_order) {
          return a.category_order - b.category_order;
        }
        return a.supplier_name.localeCompare(b.supplier_name);
      });

      setBudgets(processedBudgets);

      const allCodesMap = new Map<string, { chapter: string; sub: string; subsub: string }>();
      processedBudgets.forEach(budget => {
        budget.valuations.forEach(val => {
          const code = `${val.chapter_code}.${val.subchapter_code}.${val.subsubchapter_code}`;
          if (code && code !== '..' && val.chapter_code && val.subchapter_code && val.subsubchapter_code) {
            allCodesMap.set(code, {
              chapter: val.chapter_code,
              sub: val.subchapter_code,
              subsub: val.subsubchapter_code,
            });
          }
        });
      });

      if (allCodesMap.size === 0) {
        toast({
          title: "Avís",
          description: "No s'han trobat valoracions en els pressupostos",
        });
      }

      const rows: BudgetRow[] = Array.from(allCodesMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, parts]) => {
          const { chapter: chapterCode, sub: subchapterCode, subsub: subsubchapterCode } = parts;
          
          const fullSubchapterCode = `${chapterCode}.${subchapterCode}`;
          const fullSubsubchapterCode = `${chapterCode}.${subchapterCode}.${subsubchapterCode}`;
          
          let description = code;
          const chapter = BUDGET_CHAPTERS.find(ch => ch.code === chapterCode);
          if (chapter) {
            const subchapter = chapter.subchapters?.find(sub => sub.code === fullSubchapterCode);
            if (subchapter) {
              const subsubchapter = subchapter.subsubchapters?.find(subsub => subsub.code === fullSubsubchapterCode);
              if (subsubchapter) {
                description = subsubchapter.name;
              }
            }
          }
          
          const supplierAmounts: { [supplierId: string]: number } = {};
          
          processedBudgets.forEach(budget => {
            const valuation = budget.valuations.find(
              v => v.chapter_code === chapterCode && 
                   v.subchapter_code === subchapterCode && 
                   v.subsubchapter_code === subsubchapterCode
            );
            
            if (valuation) {
              supplierAmounts[budget.supplier_id] = valuation.estimated_amount;
            }
          });

          return {
            chapter_code: chapterCode,
            subchapter_code: subchapterCode,
            subsubchapter_code: subsubchapterCode,
            full_code: code,
            description,
            supplierAmounts,
          };
        });

      setBudgetRows(rows);

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

  const handleAmountClick = (supplierId: string) => {
    const budget = budgets.find(b => b.supplier_id === supplierId);
    if (budget) {
      setSelectedBudget(budget);
      setShowBudgetDetail(true);
    }
  };

  const getAmountClassName = (amount: number | undefined, row: BudgetRow) => {
    if (!amount) return "";
    
    const amounts = Object.values(row.supplierAmounts).filter(a => a !== undefined && a > 0);
    if (amounts.length <= 1) return "";
    
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    
    if (amount === minAmount) {
      return "bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-400 font-bold";
    }
    if (amount === maxAmount && minAmount !== maxAmount) {
      return "bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-400 font-bold";
    }
    return "";
  };

  const calculateDifferencePercentage = (row: BudgetRow): number | null => {
    const amounts = Object.values(row.supplierAmounts).filter(a => a !== undefined && a > 0);
    if (amounts.length <= 1) return null;
    
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    
    if (minAmount === 0) return null;
    
    return ((maxAmount - minAmount) / minAmount) * 100;
  };

  // Filtrar budgets per distància
  const filteredBudgets = useMemo(() => {
    if (!distanceFilter) return budgets;
    
    return budgets.filter(budget => {
      if (budget.distance === undefined) return true; // Si no hi ha distància, mostrar-lo
      return budget.distance <= distanceFilter;
    });
  }, [budgets, distanceFilter]);

  // Calcular capítols i categories eliminades pel filtre de distància
  const removedByDistance = useMemo(() => {
    if (!distanceFilter || filteredBudgets.length === budgets.length) {
      return { chapters: [], categories: new Set<string>() };
    }

    // Capítols que tenien pressupost abans del filtre
    const allChaptersBefore = new Set<string>();
    budgetRows.forEach(row => {
      allChaptersBefore.add(row.full_code);
    });

    // Capítols que tenen pressupost després del filtre
    const allChaptersAfter = new Set<string>();
    const codesMap = new Map<string, { chapter: string; sub: string; subsub: string }>();
    filteredBudgets.forEach(budget => {
      budget.valuations.forEach(val => {
        const code = `${val.chapter_code}.${val.subchapter_code}.${val.subsubchapter_code}`;
        if (code && code !== '..' && val.chapter_code && val.subchapter_code && val.subsubchapter_code) {
          allChaptersAfter.add(code);
        }
      });
    });

    // Capítols eliminats
    const removedChapters = Array.from(allChaptersBefore).filter(code => !allChaptersAfter.has(code));

    // Categories d'industrials eliminats
    const removedBudgets = budgets.filter(b => !filteredBudgets.find(fb => fb.supplier_id === b.supplier_id));
    const removedCategories = new Set(removedBudgets.flatMap(b => b.supplier_categories));

    return {
      chapters: removedChapters.map(code => {
        const row = budgetRows.find(r => r.full_code === code);
        return {
          code,
          description: row?.description || code
        };
      }),
      categories: removedCategories,
      suppliersCount: removedBudgets.length
    };
  }, [distanceFilter, budgets, filteredBudgets, budgetRows]);

  // Recalcular budgetRows basant-se en filteredBudgets
  const filteredBudgetRows = useMemo(() => {
    const allCodesMap = new Map<string, { chapter: string; sub: string; subsub: string }>();
    filteredBudgets.forEach(budget => {
      budget.valuations.forEach(val => {
        const code = `${val.chapter_code}.${val.subchapter_code}.${val.subsubchapter_code}`;
        if (code && code !== '..' && val.chapter_code && val.subchapter_code && val.subsubchapter_code) {
          allCodesMap.set(code, {
            chapter: val.chapter_code,
            sub: val.subchapter_code,
            subsub: val.subsubchapter_code,
          });
        }
      });
    });

    const rows: BudgetRow[] = Array.from(allCodesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, parts]) => {
        const { chapter: chapterCode, sub: subchapterCode, subsub: subsubchapterCode } = parts;
        
        const fullSubchapterCode = `${chapterCode}.${subchapterCode}`;
        const fullSubsubchapterCode = `${chapterCode}.${subchapterCode}.${subsubchapterCode}`;
        
        let description = code;
        const chapter = BUDGET_CHAPTERS.find(ch => ch.code === chapterCode);
        if (chapter) {
          const subchapter = chapter.subchapters?.find(sub => sub.code === fullSubchapterCode);
          if (subchapter) {
            const subsubchapter = subchapter.subsubchapters?.find(subsub => subsub.code === fullSubsubchapterCode);
            if (subsubchapter) {
              description = subsubchapter.name;
            }
          }
        }
        
        const supplierAmounts: { [supplierId: string]: number } = {};
        
        filteredBudgets.forEach(budget => {
          const valuation = budget.valuations.find(
            v => v.chapter_code === chapterCode && 
                 v.subchapter_code === subchapterCode && 
                 v.subsubchapter_code === subsubchapterCode
          );
          
          if (valuation) {
            supplierAmounts[budget.supplier_id] = valuation.estimated_amount;
          }
        });

        return {
          chapter_code: chapterCode,
          subchapter_code: subchapterCode,
          subsubchapter_code: subsubchapterCode,
          full_code: code,
          description,
          supplierAmounts,
        };
      });

    return rows;
  }, [filteredBudgets]);

  // Estadístiques
  const hoveredRow = hoveredRowCode ? filteredBudgetRows.find(r => r.full_code === hoveredRowCode) : null;
  
  const statistics = hoveredRow ? {
    lowestTotal: (() => {
      const amounts = Object.values(hoveredRow.supplierAmounts).filter(a => a !== undefined && a > 0);
      return amounts.length > 0 ? Math.min(...amounts) : 0;
    })(),
    highestTotal: (() => {
      const amounts = Object.values(hoveredRow.supplierAmounts).filter(a => a !== undefined && a > 0);
      return amounts.length > 0 ? Math.max(...amounts) : 0;
    })(),
    averageTotal: (() => {
      const amounts = Object.values(hoveredRow.supplierAmounts).filter(a => a !== undefined && a > 0);
      return amounts.length > 0 ? amounts.reduce((sum, a) => sum + a, 0) / amounts.length : 0;
    })(),
    difference: 0,
    lowestSupplier: '',
    highestSupplier: '',
    rowDescription: hoveredRow.description,
  } : {
    lowestTotal: filteredBudgets.length > 0 ? Math.min(...filteredBudgets.map(b => b.total_amount)) : 0,
    highestTotal: filteredBudgets.length > 0 ? Math.max(...filteredBudgets.map(b => b.total_amount)) : 0,
    averageTotal: filteredBudgets.length > 0 
      ? filteredBudgets.reduce((sum, b) => sum + b.total_amount, 0) / filteredBudgets.length 
      : 0,
    difference: 0,
    lowestSupplier: '',
    highestSupplier: '',
    rowDescription: null,
  };

  if (hoveredRow) {
    const amounts = Object.entries(hoveredRow.supplierAmounts)
      .filter(([_, amount]) => amount !== undefined && amount > 0)
      .map(([supplierId, amount]) => ({
        supplierId,
        amount,
        supplierName: budgets.find(b => b.supplier_id === supplierId)?.supplier_name || '',
      }));
    
    if (amounts.length > 0) {
      const lowest = amounts.reduce((min, curr) => curr.amount < min.amount ? curr : min);
      const highest = amounts.reduce((max, curr) => curr.amount > max.amount ? curr : max);
      statistics.lowestSupplier = lowest.supplierName;
      statistics.highestSupplier = highest.supplierName;
      statistics.difference = statistics.highestTotal - statistics.lowestTotal;
    }
  } else if (filteredBudgets.length > 0) {
    const lowest = filteredBudgets.find(b => b.total_amount === statistics.lowestTotal);
    const highest = filteredBudgets.find(b => b.total_amount === statistics.highestTotal);
    statistics.lowestSupplier = lowest?.supplier_name || '';
    statistics.highestSupplier = highest?.supplier_name || '';
    statistics.difference = statistics.highestTotal - statistics.lowestTotal;
  }

  // Calcular millor oferta combinada amb totes les dades necessàries
  const bestCombinedOffer = filteredBudgetRows.map(row => {
    const amounts = Object.entries(row.supplierAmounts).filter(([_, amt]) => amt !== undefined && amt > 0);
    if (amounts.length === 0) return { 
      code: row.full_code, 
      description: row.description, 
      amount: 0, 
      supplier: '-',
      supplierId: undefined,
      unit: undefined,
      quantity: undefined,
      itemName: undefined,
      expiryDate: undefined
    };
    
    const best = amounts.reduce((min, curr) => curr[1] < min[1] ? curr : min);
    const supplier = filteredBudgets.find(b => b.supplier_id === best[0]);
    
    // Trobar la valoració per obtenir unitat i quantitat
    const valuation = supplier?.valuations.find(v => 
      `${v.chapter_code}.${v.subchapter_code}.${v.subsubchapter_code}` === row.full_code
    );
    
    // Calcular data de caducitat
    const expiryDate = supplier ? addDays(new Date(supplier.submitted_at), supplier.validity_days).toISOString() : undefined;
    
    return {
      code: row.full_code,
      description: row.description,
      amount: best[1],
      supplier: supplier?.supplier_name || '-',
      supplierId: best[0],
      unit: valuation?.unit || 'UT',
      quantity: valuation?.quantity || 0,
      itemName: valuation?.short_description || valuation?.custom_name || valuation?.type_name || row.description,
      expiryDate: expiryDate
    };
  });

  const bestCombinedTotal = bestCombinedOffer.reduce((sum, item) => sum + item.amount, 0);

  // Calcular pitjor oferta combinada
  const worstCombinedOffer = filteredBudgetRows.map(row => {
    const amounts = Object.entries(row.supplierAmounts).filter(([_, amt]) => amt !== undefined && amt > 0);
    if (amounts.length === 0) return { code: row.full_code, description: row.description, amount: 0, supplier: '-' };
    
    const worst = amounts.reduce((max, curr) => curr[1] > max[1] ? curr : max);
    const supplier = filteredBudgets.find(b => b.supplier_id === worst[0]);
    const expiryDate = supplier ? addDays(new Date(supplier.submitted_at), supplier.validity_days).toISOString() : undefined;
    
    return {
      code: row.full_code,
      description: row.description,
      amount: worst[1],
      supplier: supplier?.supplier_name || '-',
      supplierId: worst[0],
      expiryDate: expiryDate
    };
  });

  const worstCombinedTotal = worstCombinedOffer.reduce((sum, item) => sum + item.amount, 0);

  // Calcular millor oferta amb menys industrials
  const calculateFewestSuppliersOffer = () => {
    if (filteredBudgets.length === 0) {
      return {
        offer: [],
        total: 0,
        supplierCount: 0,
        mainSupplier: '',
      };
    }

    const supplierScores = filteredBudgets.map(mainSupplier => {
      let total = 0;
      const suppliersUsed = new Set<string>();
      
      filteredBudgetRows.forEach(row => {
        const mainAmount = row.supplierAmounts[mainSupplier.supplier_id];
        
        if (mainAmount !== undefined && mainAmount > 0) {
          total += mainAmount;
          suppliersUsed.add(mainSupplier.supplier_id);
        } else {
          const otherAmounts = Object.entries(row.supplierAmounts)
            .filter(([id, amt]) => amt !== undefined && amt > 0);
          
          if (otherAmounts.length > 0) {
            const best = otherAmounts.reduce((min, curr) => curr[1] < min[1] ? curr : min);
            total += best[1];
            suppliersUsed.add(best[0]);
          }
        }
      });
      
      return {
        mainSupplierId: mainSupplier.supplier_id,
        mainSupplierName: mainSupplier.supplier_name,
        total,
        supplierCount: suppliersUsed.size,
      };
    });
    
    const best = supplierScores.reduce((best, curr) => {
      if (curr.supplierCount < best.supplierCount) return curr;
      if (curr.supplierCount === best.supplierCount && curr.total < best.total) return curr;
      return best;
    }, supplierScores[0]);
    
    const detailedOffer = filteredBudgetRows.map(row => {
      const mainAmount = row.supplierAmounts[best.mainSupplierId];
      
      if (mainAmount !== undefined && mainAmount > 0) {
        const supplier = filteredBudgets.find(b => b.supplier_id === best.mainSupplierId);
        const expiryDate = supplier ? addDays(new Date(supplier.submitted_at), supplier.validity_days).toISOString() : undefined;
        return {
          code: row.full_code,
          description: row.description,
          amount: mainAmount,
          supplier: best.mainSupplierName,
          supplierId: best.mainSupplierId,
          expiryDate: expiryDate
        };
      } else {
        const otherAmounts = Object.entries(row.supplierAmounts)
          .filter(([_, amt]) => amt !== undefined && amt > 0);
        
        if (otherAmounts.length > 0) {
          const bestOther = otherAmounts.reduce((min, curr) => curr[1] < min[1] ? curr : min);
          const supplier = filteredBudgets.find(b => b.supplier_id === bestOther[0]);
          const expiryDate = supplier ? addDays(new Date(supplier.submitted_at), supplier.validity_days).toISOString() : undefined;
          return {
            code: row.full_code,
            description: row.description,
            amount: bestOther[1],
            supplier: supplier?.supplier_name || '-',
            supplierId: bestOther[0],
            expiryDate: expiryDate
          };
        }
        
        return {
          code: row.full_code,
          description: row.description,
          amount: 0,
          supplier: '-',
        };
      }
    });
    
    return {
      offer: detailedOffer,
      total: best.total,
      supplierCount: best.supplierCount,
      mainSupplier: best.mainSupplierName,
    };
  };

  const fewestSuppliersOffer = calculateFewestSuppliersOffer();

  // Determinar quines dades mostrar a la taula segons el tableView
  const displayedBudgetRows = useMemo(() => {
    if (tableView === 'all') return filteredBudgetRows;
    
    if (tableView === 'best') {
      // Crear una fila per cada item de la millor oferta
      return bestCombinedOffer.map(item => {
        const supplierAmounts: { [supplierId: string]: number } = {};
        const supplier = filteredBudgets.find(b => b.supplier_name === item.supplier);
        if (supplier) {
          supplierAmounts[supplier.supplier_id] = item.amount;
        }
        return {
          chapter_code: item.code.split('.')[0] || '',
          subchapter_code: item.code.split('.')[1] || '',
          subsubchapter_code: item.code.split('.')[2] || '',
          full_code: item.code,
          description: item.description,
          supplierAmounts,
        };
      });
    }
    
    if (tableView === 'worst') {
      // Crear una fila per cada item de la pitjor oferta
      return worstCombinedOffer.map(item => {
        const supplierAmounts: { [supplierId: string]: number } = {};
        const supplier = filteredBudgets.find(b => b.supplier_name === item.supplier);
        if (supplier) {
          supplierAmounts[supplier.supplier_id] = item.amount;
        }
        return {
          chapter_code: item.code.split('.')[0] || '',
          subchapter_code: item.code.split('.')[1] || '',
          subsubchapter_code: item.code.split('.')[2] || '',
          full_code: item.code,
          description: item.description,
          supplierAmounts,
        };
      });
    }
    
    if (tableView === 'fewest') {
      // Crear una fila per cada item de l'oferta amb menys industrials
      return fewestSuppliersOffer.offer.map(item => {
        const supplierAmounts: { [supplierId: string]: number } = {};
        const supplier = filteredBudgets.find(b => b.supplier_name === item.supplier);
        if (supplier) {
          supplierAmounts[supplier.supplier_id] = item.amount;
        }
        return {
          chapter_code: item.code.split('.')[0] || '',
          subchapter_code: item.code.split('.')[1] || '',
          subsubchapter_code: item.code.split('.')[2] || '',
          full_code: item.code,
          description: item.description,
          supplierAmounts,
        };
      });
    }
    
    return filteredBudgetRows;
  }, [tableView, filteredBudgetRows, bestCombinedOffer, worstCombinedOffer, fewestSuppliersOffer, filteredBudgets]);

  // Calcular el total mostrat segons la vista
  const displayedTotal = useMemo(() => {
    if (tableView === 'best') return bestCombinedTotal;
    if (tableView === 'worst') return worstCombinedTotal;
    if (tableView === 'fewest') return fewestSuppliersOffer.total;
    return filteredBudgets.reduce((sum, b) => sum + b.total_amount, 0);
  }, [tableView, bestCombinedTotal, worstCombinedTotal, fewestSuppliersOffer, filteredBudgets]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <DialogTitle className="text-2xl font-bold">
                Comparativa de pressupostos
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Comparativa detallada per capítols (3 nivells)
              </DialogDescription>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              
              {/* Selector de distància */}
              {projectCoords && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={distanceFilter?.toString() || 'all'}
                    onValueChange={(value) => setDistanceFilter(value === 'all' ? null : Number(value))}
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="Distància" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Totes</SelectItem>
                      <SelectItem value="5">Fins a 5km</SelectItem>
                      <SelectItem value="10">Fins a 10km</SelectItem>
                      <SelectItem value="20">Fins a 20km</SelectItem>
                      <SelectItem value="50">Fins a 50km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleTutorial}
                className="gap-2"
              >
                <Info className="h-4 w-4" />
                Tutorial
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-full px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : budgets.length === 0 ? (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">
                No s'han rebut pressupostos encara
              </p>
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">
                No hi ha proveïdors en el radi de distància seleccionat
              </p>
            </div>
          ) : (
            <Tabs defaultValue="table" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="table">Taula Comparativa</TabsTrigger>
                <TabsTrigger value="chart">Gràfics</TabsTrigger>
                <TabsTrigger value="map">Mapa</TabsTrigger>
              </TabsList>
              
              <TabsContent value="table" className="mt-0">
                {/* Avís de capítols eliminats per distància */}
                {distanceFilter && removedByDistance.chapters.length > 0 && (
                  <div className="mb-3 p-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <div className="text-orange-600 dark:text-orange-400 text-sm mt-0.5">⚠️</div>
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold text-orange-800 dark:text-orange-300 mb-1">
                          Capítols exclosos per distància (màxim {distanceFilter}km)
                        </h4>
                        <p className="text-xs text-orange-700 dark:text-orange-400 mb-2">
                          S'han exclòs <strong>{removedByDistance.suppliersCount} industrial{removedByDistance.suppliersCount !== 1 ? 's' : ''}</strong> fora del radi, 
                          eliminant <strong>{removedByDistance.chapters.length} capítol{removedByDistance.chapters.length !== 1 ? 's' : ''}</strong>. 
                          Caldrà buscar altres industrials.
                        </p>
                        
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(removedByDistance.categories).filter(cat => cat !== "Sense categoria").map((category) => (
                              <span 
                                key={category}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                          
                          <details className="mt-2">
                            <summary className="text-[10px] font-semibold text-orange-800 dark:text-orange-300 cursor-pointer hover:underline">
                              Capítols eliminats ({removedByDistance.chapters.length})
                            </summary>
                            <div className="mt-1.5 pl-3 space-y-0.5 max-h-32 overflow-y-auto">
                              {removedByDistance.chapters.map((chapter) => (
                                <div key={chapter.code} className="text-[10px] text-orange-700 dark:text-orange-400">
                                  <span className="font-mono font-semibold">{chapter.code}</span>
                                  {' - '}
                                  <span>{chapter.description}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Button
                    variant={tableView === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTableView('all')}
                    className="gap-2"
                  >
                    Totes les ofertes
                  </Button>
                  <Button
                    variant={tableView === 'best' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTableView('best')}
                    className="gap-2 bg-green-500/10 hover:bg-green-500/20 border-green-500/30"
                  >
                    Millor oferta global: {bestCombinedTotal.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </Button>
                  <Button
                    variant={tableView === 'worst' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTableView('worst')}
                    className="gap-2 bg-red-500/10 hover:bg-red-500/20 border-red-500/30"
                  >
                    Pitjor oferta global: {worstCombinedTotal.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </Button>
                  <Button
                    variant={tableView === 'fewest' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTableView('fewest')}
                    className="gap-2 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30"
                  >
                    Oferta amb menys industrials: {fewestSuppliersOffer.total.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} € ({fewestSuppliersOffer.supplierCount})
                  </Button>
                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDescription(!showDescription)}
                      className="gap-2"
                    >
                      {showDescription ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showDescription ? 'Amagar' : 'Mostrar'} descripcions
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted z-30">
                      <TableRow className="border-b">
                        <TableHead className="w-[60px] sticky left-0 bg-muted z-20 border-r font-bold p-0.5 text-[10px] leading-tight">
                          Codi
                        </TableHead>
                        {showDescription && (
                          <TableHead className="min-w-[180px] sticky left-[60px] bg-muted z-20 border-r font-bold p-1 text-[10px] leading-tight">
                            Descripció
                          </TableHead>
                        )}
                        <TableHead className={`w-[50px] ${showDescription ? 'sticky left-[240px]' : 'sticky left-[60px]'} bg-muted z-20 border-r font-bold p-0.5 text-[10px] leading-tight text-center`}>
                          Dif.%
                        </TableHead>
                        {filteredBudgets.map(budget => (
                          <TableHead key={budget.supplier_id} className="text-center min-w-[55px] max-w-[70px] border-r font-bold p-0 relative h-28">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="transform -rotate-90 origin-center whitespace-nowrap">
                                <div className="font-bold text-[10px] leading-none mb-0.5">
                                  {budget.supplier_name}
                                  {budget.distance && (
                                    <span className="text-[8px] text-blue-600 dark:text-blue-400 ml-1">
                                      ({budget.distance.toFixed(1)}km)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[8px] text-muted-foreground font-normal max-w-[90px] leading-none">
                                  {budget.supplier_categories.join(', ')}
                                </div>
                              </div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedBudgetRows.map((row, idx) => {
                        const diffPercentage = calculateDifferencePercentage(row);
                        return (
                          <TableRow 
                            key={idx} 
                            className="hover:bg-muted/50"
                            onMouseEnter={() => setHoveredRowCode(row.full_code)}
                            onMouseLeave={() => setHoveredRowCode(null)}
                          >
                            <TableCell className="font-mono text-[9px] sticky left-0 bg-background z-10 border-r font-medium p-0.5 leading-tight">
                              {row.full_code}
                            </TableCell>
                            {showDescription && (
                              <TableCell className="sticky left-[60px] bg-background z-10 border-r text-[10px] p-1 leading-tight">
                                {row.description}
                              </TableCell>
                            )}
                            <TableCell className={`${showDescription ? 'sticky left-[240px]' : 'sticky left-[60px]'} bg-background z-10 border-r text-[9px] p-0.5 text-center font-bold leading-tight ${
                              diffPercentage !== null && diffPercentage >= 30 
                                ? 'text-red-600 dark:text-red-400' 
                                : diffPercentage !== null && diffPercentage >= 10
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-muted-foreground'
                            }`}>
                              {diffPercentage !== null ? `${diffPercentage.toFixed(0)}%` : '-'}
                            </TableCell>
                            {filteredBudgets.map(budget => {
                              const amount = row.supplierAmounts[budget.supplier_id];
                              const highlightClass = getAmountClassName(amount, row);
                              return (
                                <TableCell key={budget.supplier_id} className="text-center border-r p-0">
                                  {amount !== undefined ? (
                                    <Button
                                      variant="ghost"
                                      className={`hover:opacity-90 font-semibold h-auto py-0.5 px-0.5 text-[9px] w-full leading-none ${highlightClass || 'text-primary hover:bg-primary/10'}`}
                                      onClick={() => handleAmountClick(budget.supplier_id)}
                                    >
                                      {amount.toLocaleString('ca-ES', { 
                                        minimumFractionDigits: 0, 
                                        maximumFractionDigits: 0 
                                      })}€
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground text-[9px]">-</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/70 border-t-2 font-bold">
                        <TableCell className="sticky left-0 bg-muted/70 z-10 border-r text-right p-1" colSpan={showDescription ? 3 : 2}>
                          <span className="text-[10px] font-bold">TOTAL {tableView === 'best' ? '(MILLOR)' : tableView === 'worst' ? '(PITJOR)' : tableView === 'fewest' ? `(MENYS IND.: ${fewestSuppliersOffer.supplierCount})` : ''}</span>
                        </TableCell>
                        {filteredBudgets.map(budget => {
                          const budgetTotal = tableView === 'all' 
                            ? budget.total_amount 
                            : displayedBudgetRows.reduce((sum, row) => {
                                const amount = row.supplierAmounts[budget.supplier_id];
                                return sum + (amount || 0);
                              }, 0);
                          
                          return (
                            <TableCell key={budget.supplier_id} className="text-center border-r p-0">
                              <Button
                                variant="ghost"
                                className="text-primary hover:bg-primary/10 font-bold text-[10px] h-auto py-0.5 px-0.5 w-full leading-none"
                                onClick={() => handleAmountClick(budget.supplier_id)}
                              >
                                {budgetTotal > 0 ? budgetTotal.toLocaleString('ca-ES', { 
                                  minimumFractionDigits: 0, 
                                  maximumFractionDigits: 0 
                                }) + '€' : '-'}
                              </Button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                
                {tableView === 'best' && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="default"
                      size="lg"
                      onClick={() => setShowBestOfferModal(true)}
                      className="gap-2"
                    >
                      Veure millor oferta global
                    </Button>
                  </div>
                )}
                
                {tableView === 'worst' && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="default"
                      size="lg"
                      onClick={() => setShowWorstOfferModal(true)}
                      className="gap-2"
                    >
                      Veure pitjor oferta global
                    </Button>
                  </div>
                )}
                
                {tableView === 'fewest' && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="default"
                      size="lg"
                      onClick={() => setShowFewestSuppliersModal(true)}
                      className="gap-2"
                    >
                      Obrir Bustia d'entrada
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="chart" className="mt-0">
                <div className="space-y-4 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={chartType === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('all')}
                      className="gap-2"
                    >
                      Tots els industrials
                    </Button>
                    <Button
                      variant={chartType === 'best' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('best')}
                      className="gap-2 bg-green-500/10 hover:bg-green-500/20 border-green-500/30"
                    >
                      Millor oferta
                    </Button>
                    <Button
                      variant={chartType === 'worst' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('worst')}
                      className="gap-2 bg-red-500/10 hover:bg-red-500/20 border-red-500/30"
                    >
                      Pitjor oferta
                    </Button>
                    <Button
                      variant={chartType === 'fewest' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('fewest')}
                      className="gap-2 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30"
                    >
                      Menys industrials
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {chartType === 'all' && (
                    <>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Comparació de preus totals</h3>
                        <p className="text-sm text-muted-foreground">
                          Distribució percentual dels imports totals de cada proveïdor
                          {distanceFilter && ` (màxim ${distanceFilter}km)`}
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height={500}>
                        <PieChart>
                          <Pie
                            data={filteredBudgets.map(budget => ({
                              name: `${budget.supplier_name}${budget.distance ? ` (${budget.distance.toFixed(1)}km)` : ''}`,
                              value: budget.total_amount,
                              categories: budget.supplier_categories.join(', '),
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            outerRadius={150}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {filteredBudgets.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'][index % 6]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => `${value.toLocaleString('ca-ES')} €`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  )}
                  
                  {chartType === 'best' && (
                    <>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Millor oferta combinada - Distribució per proveïdor</h3>
                        <p className="text-sm text-muted-foreground">
                          % del volum d'import que aporta cada industrial a la millor oferta combinada
                        </p>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total millor oferta combinada</p>
                          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {bestCombinedTotal.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                          </p>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={500}>
                        <PieChart>
                          <Pie
                            data={(() => {
                              const supplierTotals: { [key: string]: { name: string; value: number } } = {};
                              bestCombinedOffer.forEach(item => {
                                if (item?.supplier && item?.amount) {
                                  if (!supplierTotals[item.supplier]) {
                                    supplierTotals[item.supplier] = { name: item.supplier, value: 0 };
                                  }
                                  supplierTotals[item.supplier].value += item.amount;
                                }
                              });
                              return Object.values(supplierTotals);
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            outerRadius={150}
                            fill="#10b981"
                            dataKey="value"
                          >
                            {Object.keys((() => {
                              const supplierTotals: { [key: string]: number } = {};
                              bestCombinedOffer.forEach(item => {
                                if (item?.supplier && item?.amount) {
                                  supplierTotals[item.supplier] = (supplierTotals[item.supplier] || 0) + item.amount;
                                }
                              });
                              return supplierTotals;
                            })()).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => `${value.toLocaleString('ca-ES')} € (${((value / bestCombinedTotal) * 100).toFixed(1)}%)`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  )}
                  
                  {chartType === 'worst' && (
                    <>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Pitjor oferta combinada - Distribució per proveïdor</h3>
                        <p className="text-sm text-muted-foreground">
                          % del volum d'import que aporta cada industrial a la pitjor oferta combinada
                        </p>
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total pitjor oferta combinada</p>
                          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {worstCombinedTotal.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                          </p>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={500}>
                        <PieChart>
                          <Pie
                            data={(() => {
                              const supplierTotals: { [key: string]: { name: string; value: number } } = {};
                              worstCombinedOffer.forEach(item => {
                                if (item?.supplier && item?.amount) {
                                  if (!supplierTotals[item.supplier]) {
                                    supplierTotals[item.supplier] = { name: item.supplier, value: 0 };
                                  }
                                  supplierTotals[item.supplier].value += item.amount;
                                }
                              });
                              return Object.values(supplierTotals);
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            outerRadius={150}
                            fill="#ef4444"
                            dataKey="value"
                          >
                            {Object.keys((() => {
                              const supplierTotals: { [key: string]: number } = {};
                              worstCombinedOffer.forEach(item => {
                                if (item?.supplier && item?.amount) {
                                  supplierTotals[item.supplier] = (supplierTotals[item.supplier] || 0) + item.amount;
                                }
                              });
                              return supplierTotals;
                            })()).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => `${value.toLocaleString('ca-ES')} € (${((value / worstCombinedTotal) * 100).toFixed(1)}%)`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  )}
                  
                  {chartType === 'fewest' && (
                    <>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Oferta amb menys industrials - Distribució per proveïdor</h3>
                        <p className="text-sm text-muted-foreground">
                          % del volum d'import que aporta cada industrial a l'oferta amb menys proveïdors
                        </p>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total amb menys industrials</p>
                          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {fewestSuppliersOffer.total.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Nombre d'industrials: <strong>{fewestSuppliersOffer.supplierCount}</strong>
                          </p>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={500}>
                        <PieChart>
                          <Pie
                            data={(() => {
                              const supplierTotals: { [key: string]: { name: string; value: number } } = {};
                              fewestSuppliersOffer.offer.forEach(item => {
                                if (item?.supplier && item?.amount) {
                                  if (!supplierTotals[item.supplier]) {
                                    supplierTotals[item.supplier] = { name: item.supplier, value: 0 };
                                  }
                                  supplierTotals[item.supplier].value += item.amount;
                                }
                              });
                              return Object.values(supplierTotals);
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            outerRadius={150}
                            fill="#3b82f6"
                            dataKey="value"
                          >
                            {Object.keys((() => {
                              const supplierTotals: { [key: string]: number } = {};
                              fewestSuppliersOffer.offer.forEach(item => {
                                if (item?.supplier && item?.amount) {
                                  supplierTotals[item.supplier] = (supplierTotals[item.supplier] || 0) + item.amount;
                                }
                              });
                              return supplierTotals;
                            })()).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => `${value.toLocaleString('ca-ES')} € (${((value / fewestSuppliersOffer.total) * 100).toFixed(1)}%)`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="map" className="mt-0">
                <BudgetMapView
                  projectCoords={projectCoords}
                  suppliers={filteredBudgets.map(b => ({
                    id: b.supplier_id,
                    name: b.supplier_name,
                    company: b.supplier_company,
                    categories: b.supplier_categories,
                    utm_x: b.supplier_utm_x || 0,
                    utm_y: b.supplier_utm_y || 0,
                    utm_zone: b.supplier_utm_zone || '',
                    total_amount: b.total_amount,
                    distance: b.distance,
                    email: b.supplier_email,
                    phone: b.supplier_phone,
                    supplier_id: b.supplier_id,
                  }))}
                  onViewBudget={(supplierId) => {
                    const budget = filteredBudgets.find(b => b.supplier_id === supplierId);
                    if (budget) {
                      setSelectedBudget(budget);
                      setShowBudgetDetail(true);
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>

    <NestedDialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
      <NestedDialogContent className="max-w-[98vw] max-h-[95vh]">
        <NestedDialogHeader>
          <NestedDialogTitle>Tutorial - Pressupostos rebuts</NestedDialogTitle>
        </NestedDialogHeader>
        <div className="p-6">
          <p className="text-muted-foreground">
            Aquesta taula mostra tots els pressupostos rebuts organitzats per capítols fins al tercer nivell.
            Cada columna representa un industrial diferent i clicant sobre qualsevol import pots veure el pressupost complet.
          </p>
        </div>
      </NestedDialogContent>
    </NestedDialog>

    {selectedBudget && (
      <BudgetDetailModal
        open={showBudgetDetail}
        onOpenChange={setShowBudgetDetail}
        budgetId={selectedBudget.id}
      />
    )}
    
    <BestOfferModal
      open={showBestOfferModal}
      onOpenChange={setShowBestOfferModal}
      projectId={projectId}
      bestOffer={bestCombinedOffer}
      worstOfferTotal={worstCombinedTotal}
    />
    
    <WorstOfferModal
      open={showWorstOfferModal}
      onOpenChange={setShowWorstOfferModal}
      projectId={projectId}
      worstOffer={worstCombinedOffer}
      bestOfferTotal={bestCombinedTotal}
    />
    
    <FewestSuppliersModal
      open={showFewestSuppliersModal}
      onOpenChange={setShowFewestSuppliersModal}
      projectId={projectId}
      fewestOffer={fewestSuppliersOffer.offer}
      worstOfferTotal={worstCombinedTotal}
    />
    
    <TutorialModal
      open={tutorialOpen}
      onOpenChange={setTutorialOpen}
    />
    </>
  );
};

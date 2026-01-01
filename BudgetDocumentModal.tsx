import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Calculator, Loader2, Save, X, LogOut, Euro, Plus, Trash2, Percent } from "lucide-react";
import { BUDGET_CHAPTERS } from "@/data/budgetChapters";

interface BudgetDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

type BudgetType = "justified" | "unjustified" | "percentage";

interface BudgetDocData {
  budget_type: BudgetType;
  pem_justified: number | null;
  pem_unjustified: number | null;
  coeficient_p_pr: number;
  euro_per_m2: number | null;
}

interface BudgetLine {
  id: string;
  zona_planta: string;
  superficie: number;
  modul_basic: number;
  cg: number;
  ct: number;
  cq: number;
  cu: number;
  display_order: number;
}

interface PercentageLine {
  chapter_code: string;
  chapter_name: string;
  percentage: number;
}

export const BudgetDocumentModal = ({
  open,
  onOpenChange,
  projectId,
}: BudgetDocumentModalProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetDocData>({
    budget_type: "justified",
    pem_justified: null,
    pem_unjustified: null,
    coeficient_p_pr: 1,
    euro_per_m2: null,
  });
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [percentageLines, setPercentageLines] = useState<PercentageLine[]>([]);
  const [builtAreaTotal, setBuiltAreaTotal] = useState<number>(0);

  // Initialize percentage lines with chapter codes
  const initializePercentageLines = (): PercentageLine[] => {
    return BUDGET_CHAPTERS.map(chapter => ({
      chapter_code: chapter.code,
      chapter_name: chapter.name,
      percentage: 0,
    }));
  };

  useEffect(() => {
    if (open && projectId) {
      loadBudgetData();
    }
  }, [open, projectId]);

  const loadBudgetData = async () => {
    setLoading(true);
    try {
      // Load budget documentation
      const { data: docData, error: docError } = await supabase
        .from("project_budget_documentation")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (docError) throw docError;

      if (docData) {
        setBudgetData({
          budget_type: (docData.budget_type as BudgetType) || "justified",
          pem_justified: docData.pem_justified !== null ? Number(docData.pem_justified) : null,
          pem_unjustified: docData.pem_unjustified !== null ? Number(docData.pem_unjustified) : null,
          coeficient_p_pr: docData.coeficient_p_pr !== null ? Number(docData.coeficient_p_pr) : 1,
          euro_per_m2: (docData as any).euro_per_m2 !== null ? Number((docData as any).euro_per_m2) : null,
        });
        setExistingId(docData.id);
      } else {
        setBudgetData({
          budget_type: "justified",
          pem_justified: null,
          pem_unjustified: null,
          coeficient_p_pr: 1,
          euro_per_m2: null,
        });
        setExistingId(null);
      }

      // Load budget lines
      const { data: linesData, error: linesError } = await supabase
        .from("project_budget_lines")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order", { ascending: true });

      if (linesError) throw linesError;

      if (linesData && linesData.length > 0) {
        setBudgetLines(linesData.map(line => ({
          id: line.id,
          zona_planta: line.zona_planta || '',
          superficie: Number(line.superficie) || 0,
          modul_basic: Number(line.modul_basic) || 646,
          cg: Number(line.cg) || 1,
          ct: Number(line.ct) || 1,
          cq: Number(line.cq) || 1,
          cu: Number(line.cu) || 1,
          display_order: line.display_order || 0,
        })));
      } else {
        setBudgetLines([]);
      }

      // Load percentage budget lines
      const { data: percentData, error: percentError } = await supabase
        .from("project_budget_percentage_lines")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order", { ascending: true });

      if (percentError) throw percentError;

      if (percentData && percentData.length > 0) {
        setPercentageLines(percentData.map(line => ({
          chapter_code: line.chapter_code,
          chapter_name: line.chapter_name,
          percentage: Number(line.percentage) || 0,
        })));
      } else {
        // Initialize with default chapter lines
        setPercentageLines(initializePercentageLines());
      }

      // Load built area total from surface areas
      const { data: surfaceData, error: surfaceError } = await supabase
        .from("project_surface_areas")
        .select("surface_data")
        .eq("project_id", projectId)
        .maybeSingle();

      if (surfaceError) throw surfaceError;

      if (surfaceData && surfaceData.surface_data) {
        const sd = surfaceData.surface_data as any;
        const builtAreas = sd.built_areas || [];
        const total = builtAreas.reduce((sum: number, item: any) => {
          const area = Number(item.area) || 0;
          const computation = Number(item.computation) || 100;
          return sum + (area * computation / 100);
        }, 0);
        setBuiltAreaTotal(total);
      } else {
        setBuiltAreaTotal(0);
      }
    } catch (error) {
      console.error("Error loading budget data:", error);
      toast.error("Error carregant les dades del pressupost");
    } finally {
      setLoading(false);
    }
  };

  // Calculate pressupost for a line
  const calculatePressupost = (line: BudgetLine): number => {
    return line.superficie * line.modul_basic * line.cg * line.ct * line.cq * line.cu;
  };

  // Calculate totals
  const superficieTotal = budgetLines.reduce((sum, line) => sum + line.superficie, 0);
  const pr = budgetLines.reduce((sum, line) => sum + calculatePressupost(line), 0);
  const pem = pr * budgetData.coeficient_p_pr;

  // Add new line
  const handleAddLine = async () => {
    try {
      const newOrder = budgetLines.length > 0 
        ? Math.max(...budgetLines.map(l => l.display_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from("project_budget_lines")
        .insert({
          project_id: projectId,
          zona_planta: '',
          superficie: 0,
          modul_basic: 646,
          cg: 1,
          ct: 1,
          cq: 1,
          cu: 1,
          display_order: newOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setBudgetLines([...budgetLines, {
        id: data.id,
        zona_planta: '',
        superficie: 0,
        modul_basic: 646,
        cg: 1,
        ct: 1,
        cq: 1,
        cu: 1,
        display_order: newOrder,
      }]);
    } catch (error) {
      console.error("Error adding line:", error);
      toast.error("Error afegint línia");
    }
  };

  // Delete line
  const handleDeleteLine = async (lineId: string) => {
    try {
      const { error } = await supabase
        .from("project_budget_lines")
        .delete()
        .eq("id", lineId);

      if (error) throw error;

      setBudgetLines(budgetLines.filter(l => l.id !== lineId));
    } catch (error) {
      console.error("Error deleting line:", error);
      toast.error("Error eliminant línia");
    }
  };

  // Update line field with debounce
  const updateLineField = useCallback(async (lineId: string, field: keyof BudgetLine, value: string | number) => {
    // Update local state immediately
    setBudgetLines(prev => prev.map(line => 
      line.id === lineId ? { ...line, [field]: value } : line
    ));

    // Update in database
    try {
      const { error } = await supabase
        .from("project_budget_lines")
        .update({ [field]: value })
        .eq("id", lineId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating line:", error);
    }
  }, []);

  // Update coefficient
  const updateCoeficient = useCallback(async (value: number) => {
    setBudgetData(prev => ({ ...prev, coeficient_p_pr: value }));

    if (existingId) {
      try {
        await supabase
          .from("project_budget_documentation")
          .update({ coeficient_p_pr: value })
          .eq("id", existingId);
      } catch (error) {
        console.error("Error updating coefficient:", error);
      }
    }
  }, [existingId]);

  // Update percentage line
  const updatePercentageLine = useCallback((chapterCode: string, percentage: number) => {
    setPercentageLines(prev => prev.map(line => 
      line.chapter_code === chapterCode ? { ...line, percentage } : line
    ));
  }, []);

  // Calculate percentage budget totals
  const percentageTotalPercent = percentageLines.reduce((sum, line) => sum + line.percentage, 0);
  const euroPerM2 = budgetData.euro_per_m2 || 0;
  const percentagePEM = euroPerM2 * builtAreaTotal;

  // Calculate individual chapter budgets
  const calculateChapterBudget = (percentage: number): number => {
    return (percentage / 100) * percentagePEM;
  };

  const handleSave = async (closeAfter: boolean = false) => {
    // Validate percentage total if budget type is percentage
    if (budgetData.budget_type === "percentage") {
      const totalPercent = percentageLines.reduce((sum, line) => sum + line.percentage, 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        toast.error(`La suma dels percentatges ha de ser exactament 100%. Actualment és ${totalPercent.toFixed(2)}%`);
        return;
      }
    }
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticat");

      const dataToSave: any = {
        project_id: projectId,
        budget_type: budgetData.budget_type,
        pem_justified: budgetData.budget_type === "justified" ? pem : null,
        pem_unjustified: budgetData.pem_unjustified,
        coeficient_p_pr: budgetData.coeficient_p_pr,
        euro_per_m2: budgetData.euro_per_m2,
        updated_at: new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await supabase
          .from("project_budget_documentation")
          .update(dataToSave)
          .eq("id", existingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("project_budget_documentation")
          .insert({
            ...dataToSave,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        setExistingId(data.id);
      }

      // Save percentage lines if budget type is percentage
      if (budgetData.budget_type === "percentage") {
        // Delete existing percentage lines
        await supabase
          .from("project_budget_percentage_lines")
          .delete()
          .eq("project_id", projectId);

        // Insert new percentage lines
        const linesToInsert = percentageLines.map((line, index) => ({
          project_id: projectId,
          chapter_code: line.chapter_code,
          chapter_name: line.chapter_name,
          percentage: line.percentage,
          display_order: index,
        }));

        const { error: insertError } = await supabase
          .from("project_budget_percentage_lines")
          .insert(linesToInsert);

        if (insertError) throw insertError;
      }

      toast.success("Dades del pressupost guardades correctament");

      if (closeAfter) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving budget data:", error);
      toast.error("Error guardant les dades del pressupost");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return "";
    return value.toString();
  };

  const parseCurrency = (value: string): number | null => {
    if (!value || value.trim() === "") return null;
    const parsed = parseFloat(value.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  };

  // Parse decimal accepting both "." and "," as separators
  const parseDecimal = (value: string, defaultValue: number = 0): number => {
    if (!value || value.trim() === "") return defaultValue;
    const parsed = parseFloat(value.replace(",", "."));
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const formatNumber = (value: number): string => {
    return value.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const labelClasses = "text-sm font-semibold text-foreground mb-2 flex items-center gap-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
              <Calculator className="h-6 w-6 text-[#6b7c4c]" />
            </div>
            <div className="flex-1">
              <span className="block text-[#6b7c4c]">Pressupost</span>
              <span className="text-sm font-normal text-muted-foreground">
                Pressupost d'Execució Material (PEM)
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Modal per gestionar el pressupost del projecte
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
            <p className="text-base text-muted-foreground">Carregant dades...</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="p-8 space-y-6">
              {/* Tipus de pressupost */}
              <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6">
                <Label className={labelClasses}>
                  <Calculator className="h-4 w-4 text-[#6b7c4c]" />
                  Tipus de pressupost
                </Label>
                <RadioGroup
                  value={budgetData.budget_type}
                  onValueChange={(value: BudgetType) => setBudgetData({ ...budgetData, budget_type: value })}
                  className="mt-4 space-y-4"
                >
                  <div className="flex items-start space-x-3 p-4 rounded-lg border-2 border-muted hover:border-[#6b7c4c]/40 transition-colors">
                    <RadioGroupItem value="justified" id="justified" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="justified" className="text-base font-medium cursor-pointer">
                        Pressupost d'Execució Material a partir de Taules (justificat)
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Pressupost detallat amb justificació de partides i amidaments
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-lg border-2 border-muted hover:border-[#6b7c4c]/40 transition-colors">
                    <RadioGroupItem value="percentage" id="percentage" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="percentage" className="text-base font-medium cursor-pointer">
                        Pressupost d'Execució Material per percentatges
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Distribució del pressupost per capítols segons percentatges
                      </p>
                    </div>
                  </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border-2 border-muted hover:border-[#6b7c4c]/40 transition-colors">
                    <RadioGroupItem value="unjustified" id="unjustified" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="unjustified" className="text-base font-medium cursor-pointer">
                        Pressupost d'Execució Material
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Import global sense desglossament de partides
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Camp segons selecció */}
              {budgetData.budget_type === "justified" && (
                <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <Label className={labelClasses}>
                      <Euro className="h-4 w-4 text-[#6b7c4c]" />
                      Taula de Pressupost Justificat per mòduls
                    </Label>
                    <Button
                      onClick={handleAddLine}
                      size="sm"
                      className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Afegir fila
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[140px] text-xs font-semibold">Zona-Planta</TableHead>
                          <TableHead className="w-[90px] text-xs font-semibold text-right">Superfície (m²)</TableHead>
                          <TableHead className="w-[110px] text-xs font-semibold text-right">Mb {new Date().getFullYear()} (€/m²)</TableHead>
                          <TableHead className="w-[65px] text-xs font-semibold text-center">Cg</TableHead>
                          <TableHead className="w-[65px] text-xs font-semibold text-center">Ct</TableHead>
                          <TableHead className="w-[65px] text-xs font-semibold text-center">Cq</TableHead>
                          <TableHead className="w-[65px] text-xs font-semibold text-center">Cu</TableHead>
                          <TableHead className="w-[120px] text-xs font-semibold text-right">Pressupost (€)</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {budgetLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                              No hi ha files. Clica "Afegir fila" per començar.
                            </TableCell>
                          </TableRow>
                        ) : (
                          budgetLines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell className="p-1">
                                <Input
                                  value={line.zona_planta}
                                  onChange={(e) => updateLineField(line.id, 'zona_planta', e.target.value)}
                                  className="h-8 text-sm"
                                  placeholder="Zona/Planta"
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.superficie ? Number(line.superficie).toFixed(2) : ''}
                                  onChange={(e) => updateLineField(line.id, 'superficie', parseDecimal(e.target.value, 0))}
                                  className="h-8 text-sm text-right w-[80px]"
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.modul_basic || ''}
                                  onChange={(e) => updateLineField(line.id, 'modul_basic', parseDecimal(e.target.value, 0))}
                                  className="h-8 text-sm text-right w-[100px]"
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.cg}
                                  onChange={(e) => updateLineField(line.id, 'cg', parseDecimal(e.target.value, 1))}
                                  className="h-8 text-sm text-center w-[80px]"
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.ct}
                                  onChange={(e) => updateLineField(line.id, 'ct', parseDecimal(e.target.value, 1))}
                                  className="h-8 text-sm text-center w-[80px]"
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.cq}
                                  onChange={(e) => updateLineField(line.id, 'cq', parseDecimal(e.target.value, 1))}
                                  className="h-8 text-sm text-center w-[80px]"
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.cu}
                                  onChange={(e) => updateLineField(line.id, 'cu', parseDecimal(e.target.value, 1))}
                                  className="h-8 text-sm text-center w-[80px]"
                                />
                              </TableCell>
                              <TableCell className="p-1 text-right font-medium text-sm bg-muted/30">
                                {formatNumber(calculatePressupost(line))} €
                              </TableCell>
                              <TableCell className="p-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteLine(line.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary section */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">Superfície Total:</span>
                        <span className="text-sm font-bold">{superficieTotal.toFixed(2)} m²</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">Pr (Suma Pressupostos):</span>
                        <span className="text-sm font-bold">{formatNumber(pr)} €</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
                        <span className="text-sm font-medium">Coeficient P/Pr:</span>
                        <Input
                          type="number"
                          step="0.1"
                          value={budgetData.coeficient_p_pr}
                          onChange={(e) => updateCoeficient(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          className="w-24 h-8 text-sm text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#6b7c4c]/10 rounded-lg border-2 border-[#6b7c4c]/30">
                        <span className="text-sm font-semibold text-[#6b7c4c]">PEM (Pr × Coef.):</span>
                        <span className="text-lg font-bold text-[#6b7c4c]">{formatNumber(pem)} €</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {budgetData.budget_type === "percentage" && (
                <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6 space-y-6">
                  <Label className={labelClasses}>
                    <Percent className="h-4 w-4 text-[#6b7c4c]" />
                    Taula de Pressupost Justificat per percentatges
                  </Label>

                  {/* €/m2 input */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-sm font-medium mb-2 block">Valor €/m² construït</Label>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={budgetData.euro_per_m2 !== null ? budgetData.euro_per_m2 : ''}
                          onChange={(e) => setBudgetData({ ...budgetData, euro_per_m2: parseCurrency(e.target.value) })}
                          placeholder="0,00"
                          className="text-lg pr-16"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                          €/m²
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-sm font-medium mb-2 block">Superfície construïda total (del Quadre)</Label>
                      <div className="text-lg font-bold text-[#6b7c4c]">
                        {formatNumber(builtAreaTotal)} m²
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prové del Quadre de superfícies construïdes
                      </p>
                    </div>
                  </div>

                  {/* Percentage Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[80px] text-xs font-semibold">Codi</TableHead>
                          <TableHead className="text-xs font-semibold">Capítol</TableHead>
                          <TableHead className="w-[120px] text-xs font-semibold text-right">Percentatge (%)</TableHead>
                          <TableHead className="w-[150px] text-xs font-semibold text-right">Pressupost (€)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {percentageLines.map((line) => (
                          <TableRow key={line.chapter_code}>
                            <TableCell className="font-mono text-sm">{line.chapter_code}</TableCell>
                            <TableCell className="text-sm">{line.chapter_name}</TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={line.percentage || ''}
                                onChange={(e) => updatePercentageLine(line.chapter_code, parseDecimal(e.target.value, 0))}
                                className="h-8 text-sm text-right w-[100px]"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm bg-muted/30">
                              {formatNumber(calculateChapterBudget(line.percentage))} €
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total row */}
                        <TableRow className="bg-[#6b7c4c]/10 font-semibold">
                          <TableCell colSpan={2} className="text-right text-sm">TOTAL</TableCell>
                          <TableCell className="text-right text-sm">
                            <span className={percentageTotalPercent !== 100 ? "text-destructive" : "text-[#6b7c4c]"}>
                              {formatNumber(percentageTotalPercent)} %
                            </span>
                            {percentageTotalPercent !== 100 && (
                              <p className="text-xs text-destructive font-normal">Ha de sumar 100%</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-lg font-bold text-[#6b7c4c]">
                            {formatNumber(percentagePEM)} €
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary */}
                  <div className="flex items-center justify-between p-4 bg-[#6b7c4c]/10 rounded-lg border-2 border-[#6b7c4c]/30">
                    <span className="text-sm font-semibold text-[#6b7c4c]">PEM (€/m² × m²):</span>
                    <span className="text-lg font-bold text-[#6b7c4c]">{formatNumber(percentagePEM)} €</span>
                  </div>
                </div>
              )}

              {budgetData.budget_type === "unjustified" && (
                <div className="bg-card border-2 border-[#6b7c4c]/20 rounded-xl p-6">
                  <Label className={labelClasses}>
                    <Euro className="h-4 w-4 text-[#6b7c4c]" />
                    Pressupost d'Execució Material
                  </Label>
                  <div className="relative mt-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={formatCurrency(budgetData.pem_unjustified)}
                      onChange={(e) => setBudgetData({ ...budgetData, pem_unjustified: parseCurrency(e.target.value) })}
                      placeholder="0,00"
                      className="text-lg pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      €
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Import total del pressupost d'execució material
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Footer amb 3 botons */}
        <div className="px-8 py-4 border-t bg-muted/30 flex justify-between">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel·lar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || loading}
              className="border-[#6b7c4c]/30 text-[#6b7c4c] hover:bg-[#6b7c4c]/10 hover:border-[#6b7c4c]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || loading}
              className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Guardar i sortir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

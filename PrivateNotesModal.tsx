import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PrivateNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  currentNotes: string | null;
  onNotesUpdated: (newNotes: string | null) => void;
}

export function PrivateNotesModal({
  open,
  onOpenChange,
  budgetId,
  currentNotes,
  onNotesUpdated,
}: PrivateNotesModalProps) {
  const [notes, setNotes] = useState(currentNotes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("supplier_budgets")
        .update({ private_notes: notes.trim() || null })
        .eq("id", budgetId);

      if (error) throw error;

      onNotesUpdated(notes.trim() || null);
      toast.success("Notes privades desades correctament");
      onOpenChange(false);
    } catch (error) {
      console.error("Error desant notes:", error);
      toast.error("Error al desar les notes privades");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[300] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Notes privades</DialogTitle>
          <DialogDescription>
            Aquestes notes només són visibles per tu. No es comparteixen amb el client.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Escriu les teves notes privades aquí..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            className="resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel·lar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Desant..." : "Desar notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

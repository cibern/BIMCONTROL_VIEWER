import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { useViewerState } from "@/contexts/ViewerStateContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface OverlayModel {
  id: string;
  name: string;
  ifc_file_url: string;
  display_order: number;
  visible?: boolean;
}

interface OverlayModelsManagerProps {
  centerId: string;
  onOverlaysChange: (overlays: OverlayModel[]) => void;
}

export const OverlayModelsManager = ({ centerId, onOverlaysChange }: OverlayModelsManagerProps) => {
  const { t } = useLanguage();
  const { limits, currentOverlayCount, canAddOverlay, canUploadOverlay, refreshLimits } = useSubscriptionLimits();
  const [overlays, setOverlays] = useState<OverlayModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [temporaryOverlay, setTemporaryOverlay] = useState<OverlayModel | null>(null);

  useEffect(() => {
    if (centerId) {
      loadOverlays();
    }
  }, [centerId]);

  const loadOverlays = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('overlay_models')
        .select('*')
        .eq('center_id', centerId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Load visibility state from database
      const loadedOverlays = (data || []);
      setOverlays(loadedOverlays);
      onOverlaysChange(loadedOverlays);
    } catch (error) {
      console.error('Error loading overlays:', error);
      toast.error(t("viewer.errorLoadingOverlays"));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, saveToDb: boolean) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    
    if (!canUploadOverlay(fileSizeMB)) {
      toast.error(`${t("viewer.fileTooLarge")} ${limits.max_overlay_file_size_mb}MB`);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.ifc')) {
      toast.error(t("viewer.invalidFileFormat"));
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${centerId}/overlay_${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('ifc-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ifc-files')
        .getPublicUrl(fileName);

      if (saveToDb && limits.can_save_overlays) {
        const nextOrder = overlays.length + 1;
        const { data: newOverlay, error: insertError } = await supabase
          .from('overlay_models')
          .insert({
            center_id: centerId,
            user_id: user.id,
            name: file.name.replace('.ifc', ''),
            ifc_file_url: publicUrl,
            display_order: nextOrder
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const updatedOverlays = [...overlays, { ...newOverlay, visible: true }];
        setOverlays(updatedOverlays);
        onOverlaysChange(updatedOverlays);
        await refreshLimits();
        toast.success(t("viewer.overlayAdded"));
      } else {
        // Temporary overlay (Standard plan)
        const tempOverlay: OverlayModel = {
          id: `temp-${Date.now()}`,
          name: file.name.replace('.ifc', ''),
          ifc_file_url: publicUrl,
          display_order: overlays.length + 1,
          visible: true
        };
        setTemporaryOverlay(tempOverlay);
        onOverlaysChange([...overlays, tempOverlay]);
        toast.success(t("viewer.temporaryOverlayLoaded"));
      }
    } catch (error) {
      console.error('Error uploading overlay:', error);
      toast.error(t("viewer.uploadError"));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (id.startsWith('temp-')) {
        setTemporaryOverlay(null);
        const updatedOverlays = overlays.filter(o => o.id !== id);
        setOverlays(updatedOverlays);
        onOverlaysChange(updatedOverlays);
        toast.success(t("viewer.overlayRemoved"));
        return;
      }

      const { error } = await supabase
        .from('overlay_models')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const updatedOverlays = overlays.filter(o => o.id !== id);
      setOverlays(updatedOverlays);
      onOverlaysChange(updatedOverlays);
      await refreshLimits();
      toast.success(t("viewer.overlayRemoved"));
    } catch (error) {
      console.error('Error deleting overlay:', error);
      toast.error(t("viewer.deleteError"));
    }
  };

  const toggleVisibility = async (id: string) => {
    // Handle temporary overlay separately (not in DB)
    if (id.startsWith('temp-')) {
      if (temporaryOverlay?.id === id) {
        const newVisible = !temporaryOverlay.visible;
        const updatedTemp = { ...temporaryOverlay, visible: newVisible };
        setTemporaryOverlay(updatedTemp);
        onOverlaysChange([...overlays, updatedTemp]);
      }
      return;
    }

    // Update database for permanent overlays
    const overlay = overlays.find(o => o.id === id);
    if (!overlay) return;

    const newVisible = !overlay.visible;

    try {
      // Update database
      const { error } = await supabase
        .from('overlay_models')
        .update({ visible: newVisible })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      const updatedOverlays = overlays.map(o => 
        o.id === id ? { ...o, visible: newVisible } : o
      );
      
      setOverlays(updatedOverlays);
      const allUpdated = temporaryOverlay ? [...updatedOverlays, temporaryOverlay] : updatedOverlays;
      onOverlaysChange(allUpdated);
      
      console.info("[OverlayModelsManager] Visibilitat actualitzada a BD:", { 
        id, 
        visible: newVisible 
      });
    } catch (error) {
      console.error('Error updating overlay visibility:', error);
      toast.error(t("viewer.updateError"));
    }
  };

  const allOverlays = temporaryOverlay ? [...overlays, temporaryOverlay] : overlays;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t("viewer.overlayModels")}</CardTitle>
        <CardDescription>
          {t("viewer.overlayModelsDescription")} ({currentOverlayCount}/{limits.max_overlay_models})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {allOverlays.map((overlay) => (
                <div key={overlay.id} className="flex items-center gap-2 p-2 border rounded">
                  <span className="flex-1 text-sm truncate">{overlay.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleVisibility(overlay.id)}
                  >
                    {overlay.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(overlay.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {canAddOverlay && (
              <div className="space-y-2">
                <Label htmlFor="overlay-upload">
                  {limits.can_save_overlays 
                    ? t("viewer.addOverlayModel") 
                    : t("viewer.loadTemporaryOverlay")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="overlay-upload"
                    type="file"
                    accept=".ifc"
                    onChange={(e) => handleFileUpload(e, limits.can_save_overlays)}
                    disabled={uploading}
                  />
                  {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("viewer.maxFileSize")}: {limits.max_overlay_file_size_mb}MB
                  {!limits.can_save_overlays && ` (${t("viewer.notSavedToDB")})`}
                </p>
              </div>
            )}

            {!canAddOverlay && (
              <p className="text-sm text-muted-foreground">
                {t("viewer.overlayLimitReached")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

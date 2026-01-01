import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Upload, FolderPlus, FileStack } from 'lucide-react';

interface AnnexesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

interface Section {
  id: string;
  name: string;
  display_order: number;
  is_document_section: boolean;
}

interface AnnexFile {
  id: string;
  section_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_FILES = 15;

export const AnnexesModal = ({ isOpen, onClose, projectId }: AnnexesModalProps) => {
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [files, setFiles] = useState<AnnexFile[]>([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      loadData();
    }
  }, [isOpen, projectId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sectionsRes, filesRes] = await Promise.all([
        supabase
          .from('project_annexes_sections')
          .select('id, name, display_order, is_document_section')
          .eq('project_id', projectId)
          .order('display_order'),
        supabase
          .from('project_annexes_files')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at')
      ]);

      if (sectionsRes.error) throw sectionsRes.error;
      if (filesRes.error) throw filesRes.error;

      setSections((sectionsRes.data || []).map(s => ({
        ...s,
        is_document_section: s.is_document_section ?? false
      })));
      setFiles(filesRes.data || []);
    } catch (error) {
      console.error('Error loading annexes:', error);
      toast({
        title: 'Error',
        description: 'No s\'han pogut carregar els annexos',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) {
      toast({
        title: 'Error',
        description: 'Cal introduir un nom per la secció',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticat');

      const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order)) : 0;

      const { data, error } = await supabase
        .from('project_annexes_sections')
        .insert({
          project_id: projectId,
          name: newSectionName.trim(),
          display_order: maxOrder + 1,
          created_by: user.id,
          is_document_section: true // Sempre secció independent
        })
        .select()
        .single();

      if (error) throw error;

      setSections([...sections, data]);
      setNewSectionName('');
      toast({
        title: 'Secció creada',
        description: `S'ha creat la secció "${data.name}"`
      });
    } catch (error) {
      console.error('Error creating section:', error);
      toast({
        title: 'Error',
        description: 'No s\'ha pogut crear la secció',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    const sectionFiles = files.filter(f => f.section_id === sectionId);
    if (sectionFiles.length > 0) {
      toast({
        title: 'Error',
        description: 'No es pot eliminar una secció amb arxius. Elimina primer els arxius.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('project_annexes_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      setSections(sections.filter(s => s.id !== sectionId));
      toast({
        title: 'Secció eliminada',
        description: 'S\'ha eliminat la secció correctament'
      });
    } catch (error) {
      console.error('Error deleting section:', error);
      toast({
        title: 'Error',
        description: 'No s\'ha pogut eliminar la secció',
        variant: 'destructive'
      });
    }
  };

  // Removed handleToggleDocumentSection - all sections are now independent by default

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedSectionId) {
      toast({
        title: 'Error',
        description: 'Cal seleccionar una secció abans de pujar un arxiu',
        variant: 'destructive'
      });
      return;
    }

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Error',
        description: 'Només es permeten arxius PDF',
        variant: 'destructive'
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Error',
        description: 'L\'arxiu supera el límit de 3MB',
        variant: 'destructive'
      });
      return;
    }

    if (files.length >= MAX_FILES) {
      toast({
        title: 'Error',
        description: `S'ha assolit el límit màxim de ${MAX_FILES} arxius`,
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticat');

      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('project-annexes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('project-annexes')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('project_annexes_files')
        .insert({
          project_id: projectId,
          section_id: selectedSectionId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setFiles([...files, data]);
      toast({
        title: 'Arxiu pujat',
        description: `S'ha pujat "${file.name}" correctament`
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: 'No s\'ha pogut pujar l\'arxiu',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteFile = async (file: AnnexFile) => {
    try {
      // Extract file path from URL
      const urlParts = file.file_url.split('/project-annexes/');
      if (urlParts.length > 1) {
        await supabase.storage
          .from('project-annexes')
          .remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('project_annexes_files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;

      setFiles(files.filter(f => f.id !== file.id));
      toast({
        title: 'Arxiu eliminat',
        description: 'S\'ha eliminat l\'arxiu correctament'
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: 'No s\'ha pogut eliminar l\'arxiu',
        variant: 'destructive'
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Annexos del projecte</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-6 space-y-6">
            {/* Create new section */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Crear una nova secció del projecte</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Normativa, justificacions, Plànols, residus, estudis de seguretat..."
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                />
                <Button 
                  onClick={handleAddSection} 
                  size="sm"
                  className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Afegir
                </Button>
              </div>
            </div>

            {/* Upload file */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pujar arxiu PDF (màx. 3MB)</Label>
              <div className="flex gap-2">
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecciona una secció..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedSectionId || isUploading || files.length >= MAX_FILES}
                  onClick={() => document.getElementById('annex-file-input')?.click()}
                  className="border-[#6b7c4c] text-[#6b7c4c] hover:bg-[#6b7c4c]/10"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Pujant...' : 'Pujar PDF'}
                </Button>
                <input
                  id="annex-file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {files.length} de {MAX_FILES} arxius
              </p>
            </div>

            {/* Sections and files list */}
            <div className="border rounded-lg p-4">
              {isLoading ? (
                <p className="text-center text-muted-foreground">Carregant...</p>
              ) : sections.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  No hi ha seccions creades. Crea una secció per començar a pujar arxius.
                </p>
              ) : (
                <div className="space-y-4">
                  {sections.map((section) => {
                    const sectionFiles = files.filter(f => f.section_id === section.id);
                    return (
                      <div key={section.id} className="border rounded-lg p-3 border-primary/50 bg-primary/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileStack className="h-4 w-4 text-primary" />
                            <h4 className="font-medium">{section.name}</h4>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSection(section.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {sectionFiles.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Cap arxiu en aquesta secció</p>
                        ) : (
                          <div className="space-y-2">
                            {sectionFiles.map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center justify-between bg-muted/50 rounded p-2"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                                  <a
                                    href={file.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm truncate hover:underline"
                                  >
                                    {file.file_name}
                                  </a>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                    ({formatFileSize(file.file_size)})
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive flex-shrink-0"
                                  onClick={() => handleDeleteFile(file)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end px-6 py-4 border-t shrink-0">
          <Button 
            onClick={onClose}
            className="bg-[#6b7c4c] hover:bg-[#5a6a3f] text-white"
          >
            Guardar i sortir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

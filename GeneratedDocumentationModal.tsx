import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileDown, 
  Loader2, 
  Download, 
  FileText,
  AlertCircle,
  GripVertical,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ca, es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface GeneratedDocument {
  id: string;
  documentation_type_name: string;
  title: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  parent_id: string | null;
  display_order: number;
}

interface GeneratedDocumentationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName?: string;
}

interface DocumentWithChildren extends GeneratedDocument {
  children: DocumentWithChildren[];
  isExpanded?: boolean;
}

interface SortableDocumentRowProps {
  doc: DocumentWithChildren;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onDownload: (doc: GeneratedDocument) => void;
  onRemoveFromParent: (id: string) => void;
  formatFileSize: (bytes: number | null) => string;
  isDragging?: boolean;
  isDropTarget?: boolean;
  language: 'ca' | 'es';
}

const SortableDocumentRow = ({
  doc,
  depth,
  isExpanded,
  onToggleExpand,
  onDownload,
  onRemoveFromParent,
  formatFileSize,
  isDragging,
  isDropTarget,
  language,
}: SortableDocumentRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = doc.children.length > 0;
  const displayTitle = doc.title || doc.documentation_type_name;
  const isChild = depth > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all group",
        isDragging && "opacity-50 bg-muted border-dashed",
        isDropTarget && "bg-[#6b7c4c]/20 border-[#6b7c4c] border-2 shadow-lg",
        !isDragging && !isDropTarget && "bg-card hover:bg-accent/50 border-border"
      )}
    >
      {/* Drag Handle */}
      <div 
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Indentation indicator for children */}
      {isChild && (
        <div className="flex items-center text-muted-foreground">
          <CornerDownRight className="h-4 w-4" />
        </div>
      )}

      {/* Expand/Collapse button */}
      {hasChildren ? (
        <button 
          onClick={() => onToggleExpand(doc.id)}
          className="p-1 hover:bg-muted rounded flex-shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[#6b7c4c]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#6b7c4c]" />
          )}
        </button>
      ) : (
        <span className="w-6 flex-shrink-0" />
      )}

      {/* Document Icon */}
      <div className={cn(
        "p-2 rounded-lg flex-shrink-0",
        isChild ? "bg-amber-100 dark:bg-amber-900/30" : "bg-[#6b7c4c]/10"
      )}>
        <FileDown className={cn(
          "h-4 w-4",
          isChild ? "text-amber-600 dark:text-amber-400" : "text-[#6b7c4c]"
        )} />
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{displayTitle}</span>
          {isChild && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex-shrink-0">
              {language === 'ca' ? 'Document fill' : 'Documento hijo'}
            </span>
          )}
          {hasChildren && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#6b7c4c]/10 text-[#6b7c4c] flex-shrink-0">
              {doc.children.length} {doc.children.length === 1 
                ? (language === 'ca' ? 'fill' : 'hijo') 
                : (language === 'ca' ? 'fills' : 'hijos')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{doc.documentation_type_name}</span>
          <span>•</span>
          <span>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: language === 'ca' ? ca : es })}</span>
          <span>•</span>
          <span>{formatFileSize(doc.file_size)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isChild && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemoveFromParent(doc.id)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            title={language === 'ca' ? "Treure de la jerarquia" : "Quitar de la jerarquía"}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDownload(doc)}
          className="h-8 w-8 p-0 text-[#6b7c4c] hover:text-[#6b7c4c] hover:bg-[#6b7c4c]/10"
          title={language === 'ca' ? "Descarregar" : "Descargar"}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const GeneratedDocumentationModal = ({
  open,
  onOpenChange,
  projectId,
  projectName,
}: GeneratedDocumentationModalProps) => {
  const { language } = useLanguage();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedProjectName, setFetchedProjectName] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const lastOverIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open && projectId) {
      loadDocuments();
      if (!projectName) {
        loadProjectName();
      }
    }
  }, [open, projectId, projectName]);

  const loadProjectName = async () => {
    if (!projectId) return;
    
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    
    if (data?.name) {
      setFetchedProjectName(data.name);
    }
  };

  const loadDocuments = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("generated_documentation")
        .select("id, documentation_type_name, title, file_url, file_name, file_size, created_at, parent_id, display_order")
        .eq("project_id", projectId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading generated documents:", error);
        toast.error(language === 'ca' ? "Error carregant els documents generats" : "Error cargando los documentos generados");
        return;
      }

      setDocuments(data || []);
      
      // Auto-expand all parents
      const parentsWithChildren = new Set<string>();
      (data || []).forEach(doc => {
        if (doc.parent_id) {
          parentsWithChildren.add(doc.parent_id);
        }
      });
      setExpandedIds(parentsWithChildren);
    } catch (error) {
      console.error("Error:", error);
      toast.error(language === 'ca' ? "Error carregant els documents" : "Error cargando los documentos");
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical tree from flat list
  const buildTree = useCallback((docs: GeneratedDocument[]): DocumentWithChildren[] => {
    const map = new Map<string, DocumentWithChildren>();
    const roots: DocumentWithChildren[] = [];

    // First pass: create nodes
    docs.forEach(doc => {
      map.set(doc.id, { ...doc, children: [], isExpanded: expandedIds.has(doc.id) });
    });

    // Second pass: build tree
    docs.forEach(doc => {
      const node = map.get(doc.id)!;
      if (doc.parent_id && map.has(doc.parent_id)) {
        map.get(doc.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children by display_order
    const sortChildren = (nodes: DocumentWithChildren[]) => {
      nodes.sort((a, b) => a.display_order - b.display_order);
      nodes.forEach(node => sortChildren(node.children));
    };
    sortChildren(roots);

    return roots;
  }, [expandedIds]);

  // Flatten tree for rendering (respecting expansion state)
  const flattenTree = useCallback((nodes: DocumentWithChildren[], depth = 0): { doc: DocumentWithChildren; depth: number }[] => {
    const result: { doc: DocumentWithChildren; depth: number }[] = [];
    nodes.forEach(node => {
      result.push({ doc: node, depth });
      if (expandedIds.has(node.id) && node.children.length > 0) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    });
    return result;
  }, [expandedIds]);

  const tree = buildTree(documents);
  const flatList = flattenTree(tree);

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = (doc: GeneratedDocument) => {
    window.open(doc.file_url, "_blank");
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    lastOverIdRef.current = null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const id = (event.over?.id as string | undefined) ?? null;
    setOverId(id);
    lastOverIdRef.current = id;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    const resolvedOverId = (over?.id as string | undefined) ?? lastOverIdRef.current ?? null;

    setActiveId(null);
    setOverId(null);
    lastOverIdRef.current = null;

    if (!resolvedOverId || active.id === resolvedOverId) return;

    const activeDoc = documents.find(d => d.id === active.id);
    const overDoc = documents.find(d => d.id === resolvedOverId);

    if (!activeDoc || !overDoc) return;

    // Prevent dropping a parent onto its own child
    const isDescendant = (parentId: string, childId: string): boolean => {
      const child = documents.find(d => d.id === childId);
      if (!child || !child.parent_id) return false;
      if (child.parent_id === parentId) return true;
      return isDescendant(parentId, child.parent_id);
    };

    if (isDescendant(active.id as string, resolvedOverId)) {
      toast.error(language === 'ca' ? "No es pot moure un document dins d'un dels seus fills" : "No se puede mover un documento dentro de uno de sus hijos");
      return;
    }

    try {
      // Make the active document a child of the over document
      const newParentId = overDoc.id;
      
      // Get the max display_order among siblings
      const siblings = documents.filter(d => d.parent_id === newParentId);
      const maxOrder = siblings.length > 0 
        ? Math.max(...siblings.map(s => s.display_order)) 
        : -1;

      const { error } = await supabase
        .from("generated_documentation")
        .update({ 
          parent_id: newParentId,
          display_order: maxOrder + 1
        })
        .eq("id", activeDoc.id);

      if (error) throw error;

      // Expand the parent to show the new child
      setExpandedIds(prev => new Set(prev).add(newParentId));
      
      // Reload documents
      await loadDocuments();
      toast.success(language === 'ca' 
        ? `"${activeDoc.title || activeDoc.documentation_type_name}" ara és fill de "${overDoc.title || overDoc.documentation_type_name}"` 
        : `"${activeDoc.title || activeDoc.documentation_type_name}" ahora es hijo de "${overDoc.title || overDoc.documentation_type_name}"`);
    } catch (error) {
      console.error("Error updating document hierarchy:", error);
      toast.error(language === 'ca' ? "Error actualitzant la jerarquia" : "Error actualizando la jerarquía");
    }
  };

  const handleRemoveFromParent = async (docId: string) => {
    try {
      const doc = documents.find(d => d.id === docId);
      if (!doc || !doc.parent_id) return;

      // Get max display_order at root level
      const rootDocs = documents.filter(d => !d.parent_id);
      const maxOrder = rootDocs.length > 0 
        ? Math.max(...rootDocs.map(d => d.display_order)) 
        : -1;

      const { error } = await supabase
        .from("generated_documentation")
        .update({ 
          parent_id: null,
          display_order: maxOrder + 1
        })
        .eq("id", docId);

      if (error) throw error;

      await loadDocuments();
      toast.success(language === 'ca' ? "Document extret de la jerarquia" : "Documento extraído de la jerarquía");
    } catch (error) {
      console.error("Error removing from parent:", error);
      toast.error(language === 'ca' ? "Error actualitzant el document" : "Error actualizando el documento");
    }
  };

  const displayProjectName = projectName || fetchedProjectName;
  const activeDoc = flatList.find(item => item.doc.id === activeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-[#6b7c4c]/10 to-[#6b7c4c]/5">
          <DialogTitle className="flex items-center gap-4 text-xl">
            <div className="p-3 rounded-xl bg-[#6b7c4c]/20">
              <FileText className="h-6 w-6 text-[#6b7c4c]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[#6b7c4c]">
                {language === 'ca' ? 'Documentació generada' : 'Documentación generada'}
              </span>
              {displayProjectName && (
                <span className="text-sm font-normal text-muted-foreground truncate block">
                  {displayProjectName}
                </span>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'ca' 
              ? 'Registre de documents PDF generats per aquest projecte. Arrossega documents per organitzar-los jeràrquicament.'
              : 'Registro de documentos PDF generados para este proyecto. Arrastra documentos para organizarlos jerárquicamente.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(85vh - 150px)' }}>
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-[#6b7c4c]" />
                <p className="text-base text-muted-foreground">
                  {language === 'ca' ? 'Carregant documents...' : 'Cargando documentos...'}
                </p>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="p-4 rounded-full bg-muted">
                  <AlertCircle className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {language === 'ca' ? 'Cap document generat' : 'Ningún documento generado'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ca' 
                      ? "Encara no s'ha generat cap document PDF per aquest projecte."
                      : "Aún no se ha generado ningún documento PDF para este proyecto."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm text-muted-foreground">
                  <strong>{language === 'ca' ? 'Consell:' : 'Consejo:'}</strong> {language === 'ca' 
                    ? "Arrossega un document i deixa'l anar sobre un altre per crear una jerarquia (pare-fill)."
                    : "Arrastra un documento y suéltalo sobre otro para crear una jerarquía (padre-hijo)."}
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={rectIntersection}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={flatList.map(item => item.doc.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {flatList.map(({ doc, depth }) => (
                        <div 
                          key={doc.id} 
                          style={{ marginLeft: depth > 0 ? `${depth * 32}px` : 0 }}
                        >
                          <SortableDocumentRow
                            doc={doc}
                            depth={depth}
                            isExpanded={expandedIds.has(doc.id)}
                            onToggleExpand={toggleExpand}
                            onDownload={handleDownload}
                            onRemoveFromParent={handleRemoveFromParent}
                            formatFileSize={formatFileSize}
                            isDragging={activeId === doc.id}
                            isDropTarget={overId === doc.id && activeId !== doc.id}
                            language={language}
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeDoc && (
                      <div className="bg-background border-2 border-[#6b7c4c] rounded-lg p-3 shadow-xl">
                        <div className="flex items-center gap-2">
                          <FileDown className="h-4 w-4 text-[#6b7c4c]" />
                          <span className="font-medium">
                            {activeDoc.doc.title || activeDoc.doc.documentation_type_name}
                          </span>
                        </div>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

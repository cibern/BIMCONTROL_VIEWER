import { 
  NestedDialog, NestedDialogContent, NestedDialogHeader, 
  NestedDialogTitle, NestedDialogDescription 
} from "@/components/ui/nested-dialog";
import { 
  Layers, Box, FileText, Plus, GripVertical, 
  BarChart3, CheckCircle2, TrendingUp,
  Settings2, Target, Zap, Ruler, Sparkles, Hash, Eye
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BudgetStructureTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetStructureTutorial({ open, onOpenChange }: BudgetStructureTutorialProps) {
  const { language } = useLanguage();

  return (
    <NestedDialog open={open} onOpenChange={onOpenChange}>
      <NestedDialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <NestedDialogHeader className="border-b border-border pb-4">
          <NestedDialogTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80">
              <Layers className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-foreground">
                {language === "ca" ? "Edició de medicions" : "Edición de mediciones"}
              </span>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                {language === "ca" 
                  ? "Organitza i gestiona les partides del projecte" 
                  : "Organiza y gestiona las partidas del proyecto"}
              </p>
            </div>
          </NestedDialogTitle>
        </NestedDialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Flux visual del procés */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {language === "ca" ? "Flux de treball" : "Flujo de trabajo"}
            </h3>
            <div className="relative">
              {/* Línia de connexió */}
              <div className="absolute top-8 left-8 right-8 h-0.5 bg-gradient-to-r from-blue-500 via-amber-500 to-violet-500 opacity-30 hidden sm:block" />
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  { step: 1, icon: Box, title: language === "ca" ? "Partides IFC" : "Partidas IFC", desc: language === "ca" ? "Des del model 3D" : "Desde el modelo 3D", color: "bg-blue-500" },
                  { step: 2, icon: Plus, title: language === "ca" ? "Partides manuals" : "Partidas manuales", desc: language === "ca" ? "Elements addicionals" : "Elementos adicionales", color: "bg-amber-500" },
                  { step: 3, icon: Sparkles, title: language === "ca" ? "Descripcions" : "Descripciones", desc: language === "ca" ? "Tècniques amb IA" : "Técnicas con IA", color: "bg-violet-500" },
                  { step: 4, icon: GripVertical, title: language === "ca" ? "Organitzar" : "Organizar", desc: language === "ca" ? "Ordre i estructura" : "Orden y estructura", color: "bg-emerald-500" },
                ].map((item) => (
                  <div key={item.step} className="relative flex flex-col items-center text-center">
                    <div className={`relative z-10 w-12 h-12 ${item.color} rounded-xl flex items-center justify-center shadow-lg mb-2`}>
                      <item.icon className="h-5 w-5 text-white" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-background border-2 border-current text-xs font-bold rounded-full flex items-center justify-center text-foreground">
                        {item.step}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tipus de partides - Destacat */}
          <div className="bg-gradient-to-br from-blue-500/10 via-background to-amber-500/10 rounded-xl border-2 border-primary/20 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              {language === "ca" ? "Tipus de partides (ordre d'aparició)" : "Tipos de partidas (orden de aparición)"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">1r</div>
                  <span className="font-bold text-blue-700 dark:text-blue-400">
                    {language === "ca" ? "Partides IFC" : "Partidas IFC"}
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span>{language === "ca" ? "Extretes automàticament del model 3D" : "Extraídas automáticamente del modelo 3D"}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span>{language === "ca" ? "Quantitats calculades des de l'IFC" : "Cantidades calculadas desde el IFC"}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span>{language === "ca" ? "Vinculades als elements del visor" : "Vinculadas a los elementos del visor"}</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold text-sm">2n</div>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {language === "ca" ? "Partides manuals" : "Partidas manuales"}
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>{language === "ca" ? "Creades manualment per l'usuari" : "Creadas manualmente por el usuario"}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>{language === "ca" ? "Per elements no modelats: ajudes, mà d'obra..." : "Para elementos no modelados: ayudas, mano de obra..."}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>{language === "ca" ? "Es poden editar i eliminar" : "Se pueden editar y eliminar"}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Funcionalitats principals */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              {language === "ca" ? "Funcionalitats principals" : "Funcionalidades principales"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Ruler, title: language === "ca" ? "Línies d'amidament" : "Líneas de medición", desc: language === "ca" ? "Veure el detall de cada element amb les seves dimensions i comentaris" : "Ver el detalle de cada elemento con sus dimensiones y comentarios", color: "text-blue-600" },
                { icon: Plus, title: language === "ca" ? "Afegir partides" : "Añadir partidas", desc: language === "ca" ? "Crea partides manuals dins de qualsevol sub-subcapítol" : "Crea partidas manuales dentro de cualquier sub-subcapítulo", color: "text-amber-600" },
                { icon: GripVertical, title: language === "ca" ? "Reordenar" : "Reordenar", desc: language === "ca" ? "Arrossega les partides per canviar l'ordre dins de cada secció" : "Arrastra las partidas para cambiar el orden dentro de cada sección", color: "text-violet-600" },
                { icon: Sparkles, title: language === "ca" ? "Descripcions IA" : "Descripciones IA", desc: language === "ca" ? "Genera descripcions tècniques automàtiques amb intel·ligència artificial" : "Genera descripciones técnicas automáticas con inteligencia artificial", color: "text-emerald-600" },
                { icon: Eye, title: language === "ca" ? "Visualitzar elements" : "Visualizar elementos", desc: language === "ca" ? "Les partides IFC estan vinculades als elements del visor 3D" : "Las partidas IFC están vinculadas a los elementos del visor 3D", color: "text-cyan-600" },
              ].map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted/70 transition-colors"
                >
                  <div className={`p-1.5 rounded-md bg-background ${item.color}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estructura jeràrquica */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              {language === "ca" ? "Estructura jeràrquica de 3 nivells" : "Estructura jerárquica de 3 niveles"}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border-2 border-primary/30">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">1</div>
                <div className="flex-1">
                  <span className="font-semibold text-foreground">{language === "ca" ? "Capítol" : "Capítulo"}</span>
                  <span className="text-xs text-muted-foreground ml-2">{language === "ca" ? "Ex: 20 - Sistema estructural" : "Ej: 20 - Sistema estructural"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border-2 border-blue-500/30 ml-6">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold">2</div>
                <div className="flex-1">
                  <span className="font-semibold text-foreground">{language === "ca" ? "Subcapítol" : "Subcapítulo"}</span>
                  <span className="text-xs text-muted-foreground ml-2">{language === "ca" ? "Ex: 20.20 - Estructura" : "Ej: 20.20 - Estructura"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 ml-12">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold">3</div>
                <div className="flex-1">
                  <span className="font-semibold text-foreground">{language === "ca" ? "Sub-subcapítol" : "Sub-subcapítulo"}</span>
                  <span className="text-xs text-muted-foreground ml-2">{language === "ca" ? "Ex: 20.20.10 - Estructura vertical" : "Ej: 20.20.10 - Estructura vertical"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Característiques */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {language === "ca" ? "Característiques destacades" : "Características destacadas"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                language === "ca" ? "Codificació automàtica" : "Codificación automática",
                language === "ca" ? "Estadístiques IFC vs Manual" : "Estadísticas IFC vs Manual",
                language === "ca" ? "Ordre personalitzable" : "Orden personalizable",
                language === "ca" ? "Línies d'amidament detallades" : "Líneas de medición detalladas",
                language === "ca" ? "Generació de descripcions IA" : "Generación de descripciones IA",
                language === "ca" ? "Vinculació amb el visor 3D" : "Vinculación con el visor 3D",
              ].map((highlight, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {highlight}
                </span>
              ))}
            </div>
          </div>

          {/* Beneficis */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              {language === "ca" ? "Beneficis d'ús" : "Beneficios de uso"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: BarChart3, title: language === "ca" ? "Visió global" : "Visión global", desc: language === "ca" ? "Estadístiques de partides IFC vs manuals per capítol" : "Estadísticas de partidas IFC vs manuales por capítulo" },
                { icon: Hash, title: language === "ca" ? "Codificació estandarditzada" : "Codificación estandarizada", desc: language === "ca" ? "Sistema de codis jeràrquic per a cada partida" : "Sistema de códigos jerárquico para cada partida" },
                { icon: Sparkles, title: language === "ca" ? "Automatització" : "Automatización", desc: language === "ca" ? "Descripcions tècniques generades amb IA" : "Descripciones técnicas generadas con IA" },
                { icon: Layers, title: language === "ca" ? "Organització clara" : "Organización clara", desc: language === "ca" ? "Estructura jeràrquica de capítols, subcapítols i partides" : "Estructura jerárquica de capítulos, subcapítulos y partidas" },
              ].map((item, index) => (
                <div 
                  key={index} 
                  className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-emerald-500/5 border border-primary/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1 rounded-md bg-primary/20">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </NestedDialogContent>
    </NestedDialog>
  );
}

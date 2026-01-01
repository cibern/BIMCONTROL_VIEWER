import { useState } from "react";
import { NestedDialog, NestedDialogContent, NestedDialogHeader, NestedDialogTitle, NestedDialogDescription } from "@/components/ui/nested-dialog";
import { 
  BookOpen, FileText, Home, Clock, CheckCircle, XCircle, Eye, Send, FileEdit, 
  EyeOff, AlertCircle, Calculator, Bell, HelpCircle, Sparkles, TrendingUp, 
  Award, Target, ChevronDown, ChevronRight, FileDown, Lightbulb, ArrowRight,
  BarChart3, Settings, User, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TutorialSectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function TutorialSection({ icon, title, subtitle, color, children, defaultOpen = false }: TutorialSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    primary: { bg: "bg-primary/5", border: "border-primary/30", text: "text-primary", iconBg: "bg-primary/10" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", iconBg: "bg-blue-100" },
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", iconBg: "bg-green-100" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", iconBg: "bg-purple-100" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", iconBg: "bg-orange-100" },
    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", iconBg: "bg-indigo-100" },
    rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", iconBg: "bg-rose-100" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", iconBg: "bg-amber-100" },
  };

  const classes = colorClasses[color] || colorClasses.primary;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md",
          classes.bg, classes.border,
          isOpen && "shadow-md"
        )}>
          <div className={cn("p-3 rounded-xl", classes.iconBg)}>
            {icon}
          </div>
          <div className="flex-1 text-left">
            <h3 className={cn("font-bold text-lg", classes.text)}>{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn("p-2 rounded-lg", classes.iconBg)}>
            {isOpen ? (
              <ChevronDown className={cn("h-5 w-5", classes.text)} />
            ) : (
              <ChevronRight className={cn("h-5 w-5", classes.text)} />
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn("mt-2 p-5 rounded-xl border-2 border-t-0 rounded-t-none -mt-2", classes.border, "bg-background")}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  highlight?: boolean;
}

function StepCard({ number, title, description, highlight }: StepCardProps) {
  return (
    <div className={cn(
      "flex items-start gap-4 p-4 rounded-xl border-2",
      highlight ? "bg-green-50 border-green-200" : "bg-muted/30 border-muted"
    )}>
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
        highlight ? "bg-green-600" : "bg-primary"
      )}>
        {highlight ? <CheckCircle className="h-5 w-5" /> : number}
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: "blue" | "green" | "orange" | "amber" | "rose";
}

function InfoCard({ icon, title, items, color }: InfoCardProps) {
  const colorClasses = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", itemText: "text-blue-800" },
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900", itemText: "text-green-800" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900", itemText: "text-orange-800" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", itemText: "text-amber-800" },
    rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900", itemText: "text-rose-800" },
  };

  const classes = colorClasses[color];

  return (
    <div className={cn("p-4 rounded-xl border-2", classes.bg, classes.border)}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className={cn("font-bold", classes.text)}>{title}</h4>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className={cn("flex items-start gap-2 text-sm", classes.itemText)}>
            <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TutorialModal({ open, onOpenChange }: TutorialModalProps) {
  const { language } = useLanguage();
  
  const handleExportPDF = () => {
    // TODO: Implementar exportació PDF
    console.log("Export PDF - Pendent d'implementar");
  };

  return (
    <NestedDialog open={open} onOpenChange={onOpenChange}>
      <NestedDialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0">
        {/* Header */}
        <NestedDialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary rounded-xl shadow-lg">
                <BookOpen className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <NestedDialogTitle className="text-2xl font-bold">
                  {language === "ca" ? "Guia del Portal Industrial" : "Guía del Portal Industrial"}
                </NestedDialogTitle>
                <NestedDialogDescription className="text-base mt-1">
                  {language === "ca" 
                    ? "Tot el que necessites saber per gestionar els teus pressupostos" 
                    : "Todo lo que necesitas saber para gestionar tus presupuestos"}
                </NestedDialogDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleExportPDF}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              {language === "ca" ? "Exportar PDF" : "Exportar PDF"}
            </Button>
          </div>
        </NestedDialogHeader>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-4 pt-6 max-w-5xl mx-auto">
            
            {/* Benvinguda - Sempre obert */}
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-2xl border-2 border-primary/30 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                <h2 className="text-2xl font-bold text-primary">
                  {language === "ca" ? "Benvingut/da!" : "¡Bienvenido/a!"}
                </h2>
              </div>
              <p className="text-muted-foreground mb-6">
                {language === "ca" 
                  ? "Aquesta plataforma et permet rebre sol·licituds de pressupostos, valorar partides i enviar ofertes als clients de forma senzilla."
                  : "Esta plataforma te permite recibir solicitudes de presupuestos, valorar partidas y enviar ofertas a los clientes de forma sencilla."}
              </p>
              
              {/* Flux visual */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-4 bg-background rounded-xl border-2 border-primary/20 hover:shadow-md transition-all">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-bold text-sm">{language === "ca" ? "1. Rep" : "1. Recibe"}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ca" ? "Sol·licituds de pressupostos" : "Solicitudes de presupuestos"}
                  </p>
                </div>
                
                <div className="text-center p-4 bg-background rounded-xl border-2 border-blue-200 hover:shadow-md transition-all">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-bold text-sm text-blue-900">{language === "ca" ? "2. Valora" : "2. Valora"}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ca" ? "Posa preus a les partides" : "Pon precios a las partidas"}
                  </p>
                </div>
                
                <div className="text-center p-4 bg-background rounded-xl border-2 border-green-200 hover:shadow-md transition-all">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                    <Send className="h-6 w-6 text-green-600" />
                  </div>
                  <h4 className="font-bold text-sm text-green-900">{language === "ca" ? "3. Envia" : "3. Envía"}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ca" ? "La teva oferta al client" : "Tu oferta al cliente"}
                  </p>
                </div>
                
                <div className="text-center p-4 bg-background rounded-xl border-2 border-purple-200 hover:shadow-md transition-all">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-100 flex items-center justify-center">
                    <Award className="h-6 w-6 text-purple-600" />
                  </div>
                  <h4 className="font-bold text-sm text-purple-900">{language === "ca" ? "4. Segueix" : "4. Sigue"}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ca" ? "L'estat dels pressupostos" : "El estado de los presupuestos"}
                  </p>
                </div>
              </div>
            </div>

            {/* Seccions expandibles */}
            <TutorialSection
              icon={<Home className="h-6 w-6 text-blue-600" />}
              title="Pàgina d'Inici"
              subtitle="El teu panel de control amb totes les estadístiques"
              color="blue"
              defaultOpen={false}
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  La pàgina d'inici et mostra un resum de tots els teus pressupostos organitzats per estat.
                </p>
                
                {/* Estadístiques visuals */}
                <div className="grid grid-cols-5 gap-2">
                  <div className="p-3 rounded-lg border-2 bg-muted/30 text-center">
                    <Badge variant="secondary" className="mb-2">Tots</Badge>
                    <p className="text-xs text-muted-foreground">Total projectes</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-orange-200 bg-orange-50 text-center">
                    <Badge className="mb-2 bg-orange-500">Pendents</Badge>
                    <p className="text-xs text-muted-foreground">Per enviar</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50 text-center">
                    <Badge className="mb-2 bg-blue-500">Enviats</Badge>
                    <p className="text-xs text-muted-foreground">Esperant resposta</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-green-200 bg-green-50 text-center">
                    <Badge className="mb-2 bg-green-500">Acceptats</Badge>
                    <p className="text-xs text-muted-foreground">Aprovats!</p>
                  </div>
                  <div className="p-3 rounded-lg border-2 border-red-200 bg-red-50 text-center">
                    <Badge className="mb-2 bg-red-500">Rebutjats</Badge>
                    <p className="text-xs text-muted-foreground">No acceptats</p>
                  </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-900 mb-1">Consell</h4>
                      <p className="text-sm text-amber-800">
                        Fes clic a qualsevol estadística per filtrar directament per aquell estat. 
                        Els últims 3 projectes pendents es mostren a sota per accés ràpid.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TutorialSection>

            <TutorialSection
              icon={<FileText className="h-6 w-6 text-green-600" />}
              title="Els Meus Pressupostos"
              subtitle="Gestiona tots els pressupostos des d'un sol lloc"
              color="green"
            >
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <InfoCard
                    icon={<Clock className="h-5 w-5 text-orange-600" />}
                    title="Pendents"
                    items={[
                      "Projectes rebuts sense pressupost enviat",
                      "Agrupats per categoria d'especialitat",
                      "Botó per visualitzar i valorar partides"
                    ]}
                    color="orange"
                  />
                  <InfoCard
                    icon={<Send className="h-5 w-5 text-blue-600" />}
                    title="Enviats"
                    items={[
                      "Pressupostos esperant resposta del client",
                      "Codi d'oferta únic per referència",
                      "Data d'enviament i validesa visible"
                    ]}
                    color="blue"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <InfoCard
                    icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                    title="Acceptats"
                    items={[
                      "Pressupostos aprovats pel client",
                      "Dades de contacte disponibles",
                      "Historial complet de l'oferta"
                    ]}
                    color="green"
                  />
                  <InfoCard
                    icon={<XCircle className="h-5 w-5 text-rose-600" />}
                    title="Rebutjats"
                    items={[
                      "Pressupostos no acceptats o expirats",
                      "Motiu del rebuig visible",
                      "Opció d'ocultar per mantenir llista neta"
                    ]}
                    color="rose"
                  />
                </div>
              </div>
            </TutorialSection>

            <TutorialSection
              icon={<Calculator className="h-6 w-6 text-purple-600" />}
              title="Valoració i Enviament"
              subtitle="Com crear i enviar un pressupost pas a pas"
              color="purple"
            >
              <div className="space-y-4">
                <StepCard 
                  number={1} 
                  title="Accedeix al projecte" 
                  description="Fes clic a 'Visualitzar i Valorar' des de la llista de pendents"
                />
                <StepCard 
                  number={2} 
                  title="Valora les partides" 
                  description="Introdueix preus unitaris per cada partida de la teva especialitat. El total es calcula automàticament."
                />
                <StepCard 
                  number={3} 
                  title="Configura les condicions" 
                  description="Selecciona les condicions generals que apliquen a la teva oferta"
                />
                <StepCard 
                  number={4} 
                  title="Afegeix notes (opcional)" 
                  description="Informació addicional per al client sobre l'oferta"
                />
                <StepCard 
                  number={5} 
                  title="Envia el pressupost" 
                  description="Revisa i confirma. El client rebrà la teva oferta!"
                  highlight
                />

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Validacions automàtiques
                    </h4>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li>• Perfil d'empresa completat</li>
                      <li>• Totes les partides valorades</li>
                      <li>• Import total calculat</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                    <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Important
                    </h4>
                    <ul className="space-y-1 text-sm text-amber-800">
                      <li>• Revisa bé abans d'enviar</li>
                      <li>• No es pot modificar després</li>
                      <li>• La validesa compta des de l'enviament</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TutorialSection>

            <TutorialSection
              icon={<FileEdit className="h-6 w-6 text-indigo-600" />}
              title="Notes Privades"
              subtitle="Apunts personals que només tu pots veure"
              color="indigo"
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Les notes privades són apunts personals que pots afegir a cada pressupost. El client no té accés a aquestes notes.
                </p>
                
                <div className="bg-muted/30 border-2 border-muted rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Exemples d'ús:</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2 text-sm">
                      <Star className="h-4 w-4 text-amber-500 mt-0.5" />
                      <span>"Client va demanar materials de marca X"</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Star className="h-4 w-4 text-amber-500 mt-0.5" />
                      <span>"Pendent confirmar disponibilitat"</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Star className="h-4 w-4 text-amber-500 mt-0.5" />
                      <span>"Projecte similar al de carrer Major"</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Star className="h-4 w-4 text-amber-500 mt-0.5" />
                      <span>"Prefereix comunicació per WhatsApp"</span>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                  <h4 className="font-semibold text-indigo-900 mb-2">Com afegir notes</h4>
                  <div className="flex items-center gap-3 text-sm text-indigo-800">
                    <span>Taula de pressupostos</span>
                    <ArrowRight className="h-4 w-4" />
                    <span>Botó "Afegir/Editar"</span>
                    <ArrowRight className="h-4 w-4" />
                    <span>Escriu i guarda</span>
                  </div>
                </div>
              </div>
            </TutorialSection>

            <TutorialSection
              icon={<XCircle className="h-6 w-6 text-rose-600" />}
              title="Gestió de Rebutjats"
              subtitle="Aprèn dels rebutjos per millorar"
              color="rose"
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Quan un pressupost és rebutjat, pots veure el motiu i utilitzar aquesta informació per millorar les teves futures ofertes.
                </p>

                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
                  <h4 className="font-semibold text-rose-900 mb-3 flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Motius de rebuig habituals
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["Pressupost elevat", "Condicions excessives", "Data de validesa", "Requisits tècnics", "Temps execució", "Motius personals"].map((motiu) => (
                      <div key={motiu} className="flex items-center gap-2 text-sm text-rose-800 bg-white px-3 py-2 rounded-lg border">
                        <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                        <span>{motiu}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 border-2 border-muted rounded-xl p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <EyeOff className="h-4 w-4" />
                      Ocultar pressupostos
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Mantén la llista neta ocultant pressupostos que ja no necessites revisar. 
                      Sempre pots veure'ls de nou amb el botó "Mostrar ocults".
                    </p>
                  </div>
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                    <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Millora contínua
                    </h4>
                    <p className="text-sm text-amber-800">
                      Si sempre et rebutgen pel mateix motiu, cal ajustar l'estratègia. 
                      Analitza els patrons i aprèn de cada rebuig.
                    </p>
                  </div>
                </div>
              </div>
            </TutorialSection>

            {/* Consells finals - Destacat */}
            <div className="bg-gradient-to-br from-green-50 via-background to-red-50 rounded-2xl border-2 border-muted p-6">
              <div className="flex items-center gap-3 mb-5">
                <Award className="h-7 w-7 text-primary" />
                <h2 className="text-xl font-bold">Consells per Tenir Èxit</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Bones pràctiques
                  </h4>
                  <ul className="space-y-2 text-sm text-green-800">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Completa el perfil al 100% abans d'enviar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Respon ràpidament (les primeres ofertes tenen avantatge)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Sigues competitiu però realista amb els preus</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Utilitza les notes privades per mantenir context</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    Errors a evitar
                  </h4>
                  <ul className="space-y-2 text-sm text-red-800">
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Enviar amb perfil incomplet</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Deixar projectes massa temps sense respondre</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Preus excessius sense justificació</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>No revisar els detalls abans de valorar</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-5 bg-primary/10 border-2 border-primary/30 rounded-xl p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-primary font-bold text-lg mb-2">
                  <Sparkles className="h-5 w-5" />
                  <span>Molt d'èxit amb els teus pressupostos!</span>
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Ja tens totes les eines per gestionar els teus pressupostos de forma professional.
                </p>
              </div>
            </div>

          </div>
        </div>
      </NestedDialogContent>
    </NestedDialog>
  );
}

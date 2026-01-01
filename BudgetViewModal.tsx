import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle, User, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface BudgetValuation {
  full_code: string;
  item_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface BudgetData {
  id: string;
  offer_code: string | null;
  category: string;
  total_amount: number;
  validity_days: number;
  submitted_at: string;
  expires_at: string | null;
  notes: string | null;
  status: string;
  valuations: BudgetValuation[];
  condition_scope: boolean;
  condition_economic: boolean;
  condition_deadlines: boolean;
  condition_execution: boolean;
  condition_materials: boolean;
  condition_safety: boolean;
  condition_coordination: boolean;
  condition_documentation: boolean;
  condition_suspension: boolean;
  condition_jurisdiction: boolean;
  projects: {
    name: string;
    city: string | null;
    created_by: string;
  };
}

interface ContactInfo {
  full_name: string | null;
  email: string;
  phone: string | null;
}

interface BudgetViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetData | null;
}

export function BudgetViewModal({
  open,
  onOpenChange,
  budget,
}: BudgetViewModalProps) {
  const { language } = useLanguage();
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  const texts = {
    budget: language === 'es' ? 'Presupuesto' : 'Pressupost',
    code: language === 'es' ? 'Código' : 'Codi',
    budgetTab: language === 'es' ? 'Presupuesto' : 'Pressupost',
    conditions: language === 'es' ? 'Condiciones' : 'Condicions',
    contact: language === 'es' ? 'Contacto' : 'Contacte',
    submissionDate: language === 'es' ? 'Fecha envío' : 'Data enviament',
    validity: language === 'es' ? 'Validez' : 'Validesa',
    days: language === 'es' ? 'días' : 'dies',
    expired: language === 'es' ? 'Plazo agotado' : 'Termini esgotat',
    totalAmount: language === 'es' ? 'Importe Total' : 'Import Total',
    codeCol: language === 'es' ? 'Código' : 'Codi',
    descriptionCol: language === 'es' ? 'Descripción' : 'Descripció',
    quantity: language === 'es' ? 'Cantidad' : 'Quantitat',
    unitPrice: language === 'es' ? 'Precio Unitario' : 'Preu Unitari',
    totalAmountCol: language === 'es' ? 'Importe Total' : 'Import Total',
    observations: language === 'es' ? 'Observaciones:' : 'Observacions:',
    budgetConditions: language === 'es' ? 'Condiciones del Presupuesto' : 'Condicions del Pressupost',
    clientContact: language === 'es' ? 'Datos de Contacto del Cliente' : 'Dades de Contacte del Client',
    fullName: language === 'es' ? 'Nombre completo' : 'Nom complet',
    email: 'Email',
    phone: language === 'es' ? 'Teléfono' : 'Telèfon',
    loadingError: language === 'es' ? 'No se han podido cargar los datos de contacto.' : "No s'han pogut carregar les dades de contacte.",
    // Conditions
    condition1Title: language === 'es' ? '1️⃣ Objeto y alcance' : '1️⃣ Objecte i abast',
    condition1Text1: language === 'es' ? 'Este presupuesto se refiere exclusivamente a los trabajos y suministros detallados en las partidas adjuntas.' : 'Aquest pressupost es refereix exclusivament als treballs i subministraments detallats en les partides adjuntes.',
    condition1Text2: language === 'es' ? 'Cualquier modificación, ampliación o trabajo adicional no especificado será objeto de valoración aparte.' : 'Qualsevol modificació, ampliació o treball addicional no especificat serà objecte de valoració a part.',
    condition1Text3: language === 'es' ? 'Los precios incluyen mano de obra, materiales y medios propios necesarios para la ejecución correcta, excepto si se indica lo contrario.' : "Els preus inclouen mà d'obra, materials i mitjans propis necessaris per a l'execució correcta, excepte si s'indica el contrari.",
    condition2Title: language === 'es' ? '2️⃣ Condiciones económicas' : '2️⃣ Condicions econòmiques',
    condition2Text1: language === 'es' ? 'Los precios no incluyen IVA y son válidos durante 30 días desde la fecha del presupuesto.' : 'Els preus no inclouen IVA i són vàlids durant 30 dies des de la data del pressupost.',
    condition2Text2: language === 'es' ? 'Las certificaciones y pagos se harán según el avance real de los trabajos, con un plazo máximo de pago de 30 días desde su aprobación.' : "Les certificacions i pagaments es faran segons l'avanç real dels treballs, amb un termini màxim de pagament de 30 dies des de la seva aprovació.",
    condition2Text3: language === 'es' ? 'La empresa se reserva el derecho de aplicar intereses por demora según la Ley 3/2004 de lucha contra la morosidad.' : "L'empresa es reserva el dret d'aplicar interessos per demora segons la Llei 3/2004 de lluita contra la morositat.",
    condition3Title: language === 'es' ? '3️⃣ Plazos y planificación' : '3️⃣ Terminis i planificació',
    condition3Text1: language === 'es' ? "Los plazos de ejecución se entienden orientativos y condicionados a la correcta coordinación de oficios, entrega de zonas de obra, permisos, suministros y condiciones meteorológicas." : "Els terminis d'execució s'entenen orientatius i condicionats a la correcta coordinació d'oficis, lliurament de zones d'obra, permisos, subministraments i condicions meteorològiques.",
    condition3Text2: language === 'es' ? "La empresa no será responsable de retrasos derivados de causas ajenas o cambios de orden de ejecución." : "L'empresa no serà responsable de retards derivats de causes alienes o canvis d'ordre d'execució.",
    condition4Title: language === 'es' ? "4️⃣ Condiciones de ejecución" : "4️⃣ Condicions d'execució",
    condition4Text1: language === 'es' ? "Los trabajos se ejecutarán según el proyecto o las instrucciones recibidas, siempre que sean técnicamente viables y seguras." : "Els treballs s'executaran segons el projecte o les instruccions rebudes, sempre que siguin tècnicament viables i segures.",
    condition4Text2: language === 'es' ? "Si se detectan incoherencias, riesgos o errores de proyecto, la empresa lo comunicará a la Dirección Facultativa." : "Si es detecten incoherències, riscos o errades de projecte, l'empresa ho comunicarà a la Direcció Facultativa.",
    condition5Title: language === 'es' ? "5️⃣ Materiales y garantías" : "5️⃣ Materials i garanties",
    condition5Text1: language === 'es' ? "Los materiales utilizados serán de primera calidad y con marcado CE." : "Els materials utilitzats seran de primera qualitat i amb marcat CE.",
    condition5Text2: language === 'es' ? "Las garantías de los materiales o equipos serán las del fabricante." : "Les garanties dels materials o equips seran les del fabricant.",
    condition6Title: language === 'es' ? "6️⃣ Seguridad y medio ambiente" : "6️⃣ Seguretat i medi ambient",
    condition6Text1: language === 'es' ? "La empresa cumple con el Plan de Seguridad y Salud y con la normativa vigente en materia laboral y medioambiental." : "L'empresa compleix amb el Pla de Seguretat i Salut i amb la normativa vigent en matèria laboral i mediambiental.",
    condition7Title: language === 'es' ? "7️⃣ Coordinación y responsabilidades" : "7️⃣ Coordinació i responsabilitats",
    condition7Text1: language === 'es' ? "La empresa se compromete a coordinarse con el resto de industriales, pero no asume responsabilidad por daños o repasos derivados de otros oficios." : "L'empresa es compromet a coordinar-se amb la resta d'industrials, però no assumeix responsabilitat per danys o repassos derivats d'altres oficis.",
    condition8Title: language === 'es' ? "8️⃣ Documentación y recepción" : "8️⃣ Documentació i recepció",
    condition8Text1: language === 'es' ? "Al finalizar los trabajos, se emitirá un certificado de obra ejecutada y se entregarán las fichas técnicas y garantías." : "En finalitzar els treballs, s'emetrà un certificat d'obra executada i es lliuraran les fitxes tècniques i garanties.",
    condition9Title: language === 'es' ? "9️⃣ Causas de suspensión o resolución" : "9️⃣ Causes de suspensió o resolució",
    condition9Text1: language === 'es' ? "La empresa podrá suspender o rescindir el contrato si no se cumplen los plazos de pago acordados." : "L'empresa podrà suspendre o rescindir el contracte si no es compleixen els terminis de pagament acordats.",
    condition10Title: language === 'es' ? "🔟 Jurisdicción" : "🔟 Jurisdicció",
    condition10Text1: language === 'es' ? "Cualquier discrepancia se resolverá preferentemente por vía amistosa, y en caso contrario, ante los tribunales del lugar de ejecución de la obra." : "Qualsevol discrepància es resoldrà preferentment per via amistosa, i en cas contrari, davant els tribunals del lloc d'execució de l'obra.",
  };

  useEffect(() => {
    if (budget?.status === "accepted" && budget.projects?.created_by) {
      loadContactInfo(budget.projects.created_by);
    }
  }, [budget]);

  const loadContactInfo = async (userId: string) => {
    setLoadingContact(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error carregant informació de contacte:", error);
      } else {
        setContactInfo(data);
      }
    } catch (error) {
      console.error("Error carregant contacte:", error);
    } finally {
      setLoadingContact(false);
    }
  };

  if (!budget) return null;

  const isExpired = budget.expires_at && new Date(budget.expires_at) < new Date();
  const showContactTab = budget.status === "accepted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0 z-[100] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30 flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">
            {texts.budget}: {budget.projects?.name}
          </DialogTitle>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {budget.offer_code && (
              <span className="font-mono font-semibold text-primary">
                {texts.code}: {budget.offer_code}
              </span>
            )}
            {budget.projects?.city && (
              <span>📍 {budget.projects.city}</span>
            )}
            <Badge variant="outline">{budget.category}</Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="pressupost" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 flex-shrink-0">
            <TabsTrigger value="pressupost">{texts.budgetTab}</TabsTrigger>
            <TabsTrigger value="condicions">{texts.conditions}</TabsTrigger>
            {showContactTab && (
              <TabsTrigger value="contacte">{texts.contact}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="pressupost" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="px-6 space-y-4 pb-6">
                {/* Info del pressupost */}
                <Card className="p-4 bg-muted/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{texts.submissionDate}</p>
                      <div className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(budget.submitted_at), "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{texts.validity}</p>
                      <p className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
                        {budget.expires_at 
                          ? format(new Date(budget.expires_at), "dd/MM/yyyy")
                          : `${budget.validity_days} ${texts.days}`}
                      </p>
                      {isExpired && (
                        <p className="text-xs text-destructive">{texts.expired}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">{texts.totalAmount}</p>
                      <p className="text-2xl font-bold text-primary">
                        {new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'ca-ES', {
                          style: 'currency',
                          currency: 'EUR'
                        }).format(budget.total_amount)}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Taula de partides */}
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{texts.codeCol}</TableHead>
                        <TableHead>{texts.descriptionCol}</TableHead>
                        <TableHead className="text-right">{texts.quantity}</TableHead>
                        <TableHead className="text-right">{texts.unitPrice}</TableHead>
                        <TableHead className="text-right">{texts.totalAmountCol}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budget.valuations.map((valuation, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">
                            {valuation.full_code}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{valuation.item_name}</p>
                              {valuation.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {valuation.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {valuation.quantity.toFixed(2)} {valuation.unit}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'ca-ES', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(valuation.unit_price)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'ca-ES', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(valuation.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Notes */}
                {budget.notes && (
                  <Card className="p-4">
                    <p className="text-sm font-semibold mb-2">{texts.observations}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {budget.notes}
                    </p>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="condicions" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="px-6 space-y-6 pb-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-base">{texts.budgetConditions}</h3>
                  
                  <div className="space-y-4">
                    {budget.condition_scope && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition1Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition1Text1}</p>
                            <p>{texts.condition1Text2}</p>
                            <p>{texts.condition1Text3}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_economic && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition2Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition2Text1}</p>
                            <p>{texts.condition2Text2}</p>
                            <p>{texts.condition2Text3}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_deadlines && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition3Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition3Text1}</p>
                            <p>{texts.condition3Text2}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_execution && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition4Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition4Text1}</p>
                            <p>{texts.condition4Text2}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_materials && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition5Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition5Text1}</p>
                            <p>{texts.condition5Text2}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_safety && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition6Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition6Text1}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_coordination && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition7Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition7Text1}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_documentation && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition8Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition8Text1}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_suspension && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition9Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition9Text1}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {budget.condition_jurisdiction && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="grid gap-1.5 leading-none">
                          <p className="text-sm font-medium">{texts.condition10Title}</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{texts.condition10Text1}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {showContactTab && (
            <TabsContent value="contacte" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
              <ScrollArea className="h-full">
                <div className="px-6 space-y-6 pb-6">
                  <Card className="p-6 bg-muted/50">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      {texts.clientContact}
                    </h3>
                    {loadingContact ? (
                      <div className="space-y-3">
                        <div className="h-10 bg-muted animate-pulse rounded" />
                        <div className="h-10 bg-muted animate-pulse rounded" />
                        <div className="h-10 bg-muted animate-pulse rounded" />
                      </div>
                    ) : contactInfo ? (
                      <div className="space-y-4">
                        {contactInfo.full_name && (
                          <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                            <User className="h-5 w-5 text-primary flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">{texts.fullName}</p>
                              <p className="font-medium">{contactInfo.full_name}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                          <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">{texts.email}</p>
                            <a 
                              href={`mailto:${contactInfo.email}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {contactInfo.email}
                            </a>
                          </div>
                        </div>
                        {contactInfo.phone && (
                          <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                            <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">{texts.phone}</p>
                              <a 
                                href={`tel:${contactInfo.phone}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {contactInfo.phone}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {texts.loadingError}
                      </p>
                    )}
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
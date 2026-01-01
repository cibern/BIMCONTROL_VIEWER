import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Scale, 
  Loader2, 
  AlertCircle, 
  MapPin, 
  Building2,
  ExternalLink,
  Info,
  FileText,
  Globe,
  CheckCircle2,
  Layers
} from "lucide-react";
import { getAutonomousCommunityFromProvince, utmToLatLon } from "@/lib/geoUtils";
import { useLanguage } from "@/contexts/LanguageContext";

interface NormativaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface ProjectData {
  cadastral_reference: string | null;
  street: string | null;
  street_number: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  autonomous_community: string | null;
  utm_x: number | null;
  utm_y: number | null;
  utm_zone: string | null;
}

interface UrbanismeData {
  success: boolean;
  ccaa: string;
  classificacio?: {
    codi: string;
    descripcio: string;
    tipus: string;
  };
  qualificacio?: {
    codi: string;
    clau: string;
    descripcio: string;
    zona: string;
  };
  sector?: {
    nom: string;
    tipus: string;
  };
  raw?: Record<string, unknown>;
  error?: string;
}

interface UrbanViewer {
  name: string;
  url: string;
  description: string;
  type: "wms" | "visor" | "portal";
}

// Mapa de visors urbanístics per comunitat autònoma
const URBAN_VIEWERS: Record<string, UrbanViewer[]> = {
  "Catalunya": [
    {
      name: "Registre d'Urbanisme de Catalunya (RUC)",
      url: "https://sig.gencat.cat/visors/hipermapa.html",
      description: "Visor oficial de planejament urbanístic de la Generalitat de Catalunya",
      type: "visor"
    },
    {
      name: "ICGC - Visor urbanístic",
      url: "https://www.icgc.cat/Administracio-i-empresa/Eines/Visualitzadors/ICGC-urban",
      description: "Institut Cartogràfic i Geològic de Catalunya",
      type: "visor"
    },
    {
      name: "Mapa Urbanístic de Catalunya (MUC)",
      url: "https://territori.gencat.cat/ca/06_territori_i_urbanisme/planejament_urbanistic/muc/",
      description: "Portal oficial del Mapa Urbanístic de Catalunya",
      type: "portal"
    }
  ],
  "Comunidad de Madrid": [
    {
      name: "Visor de Planeamiento Urbanístico",
      url: "https://idem.madrid.org/visor/?v=planeamiento",
      description: "Infraestructura de Datos Espaciales de la Comunidad de Madrid",
      type: "visor"
    },
    {
      name: "Portal de Urbanismo de Madrid",
      url: "https://www.comunidad.madrid/servicios/urbanismo-medio-ambiente",
      description: "Portal oficial de urbanismo de la Comunidad de Madrid",
      type: "portal"
    }
  ],
  "País Vasco": [
    {
      name: "GeoEuskadi - Urbanismo",
      url: "https://www.geo.euskadi.eus/geobisorea/",
      description: "Visor geográfico del Gobierno Vasco",
      type: "visor"
    },
    {
      name: "UDALPLAN",
      url: "https://www.geo.euskadi.eus/udalplan/",
      description: "Sistema de información del planeamiento municipal",
      type: "portal"
    }
  ],
  "Andalucía": [
    {
      name: "SIPUA - Sistema de Información de Planeamiento",
      url: "https://www.juntadeandalucia.es/institutodeestadisticaycartografia/SIPUA/",
      description: "Sistema de Información del Planeamiento Urbanístico de Andalucía",
      type: "visor"
    },
    {
      name: "IDE Andalucía",
      url: "https://www.ideandalucia.es/portal/",
      description: "Infraestructura de Datos Espaciales de Andalucía",
      type: "portal"
    }
  ],
  "Comunitat Valenciana": [
    {
      name: "Visor Cartogràfic de la GVA",
      url: "https://visor.gva.es/visor/",
      description: "Visor cartográfico de la Generalitat Valenciana",
      type: "visor"
    },
    {
      name: "Plataforma Urbanística Digital",
      url: "https://politicaterritorial.gva.es/es/web/urbanisme/plataforma-urbanistica-digital",
      description: "Plataforma oficial de urbanismo valenciano",
      type: "portal"
    }
  ],
  "Galicia": [
    {
      name: "SIOTUGA",
      url: "https://siotuga.xunta.gal/siotuga/",
      description: "Sistema de Información de Ordenación do Territorio e Urbanismo de Galicia",
      type: "visor"
    },
    {
      name: "IDE Galicia",
      url: "https://mapas.xunta.gal/visores/ide/",
      description: "Infraestructura de Datos Espaciales de Galicia",
      type: "portal"
    }
  ],
  "Castilla y León": [
    {
      name: "IDECYL - Urbanismo",
      url: "https://idecyl.jcyl.es/",
      description: "Infraestructura de Datos Espaciales de Castilla y León",
      type: "visor"
    }
  ],
  "Castilla-La Mancha": [
    {
      name: "IDE CLM - Urbanismo",
      url: "https://ide.jccm.es/",
      description: "Infraestructura de Datos Espaciales de Castilla-La Mancha",
      type: "visor"
    },
    {
      name: "SIPUCAM",
      url: "https://urbanismo.castillalamancha.es/",
      description: "Sistema de Información de Planeamiento Urbanístico",
      type: "portal"
    }
  ],
  "Aragón": [
    {
      name: "IDEAragon",
      url: "https://idearagon.aragon.es/",
      description: "Infraestructura de Datos Espaciales de Aragón",
      type: "visor"
    },
    {
      name: "SIUA - Sistema de Información Urbanística",
      url: "https://www.aragon.es/organismos/departamento-de-urbanismo-vivienda-y-transportes",
      description: "Portal de urbanismo del Gobierno de Aragón",
      type: "portal"
    }
  ],
  "Illes Balears": [
    {
      name: "IDEIB - Urbanismo",
      url: "https://ideib.caib.es/visor/",
      description: "Infraestructura de Dades Espacials de les Illes Balears",
      type: "visor"
    }
  ],
  "Canarias": [
    {
      name: "IDE Canarias - Urbanismo",
      url: "https://visor.grafcan.es/visorweb/",
      description: "Infraestructura de Datos Espaciales de Canarias",
      type: "visor"
    }
  ],
  "Región de Murcia": [
    {
      name: "IDERM - Urbanismo",
      url: "https://iderm.carm.es/",
      description: "Infraestructura de Datos Espaciales de la Región de Murcia",
      type: "visor"
    }
  ],
  "Principado de Asturias": [
    {
      name: "IDEAS - Urbanismo",
      url: "https://ideas.asturias.es/",
      description: "Infraestructura de Datos Espaciales del Principado de Asturias",
      type: "visor"
    }
  ],
  "Cantabria": [
    {
      name: "MapaCantabria",
      url: "https://mapas.cantabria.es/",
      description: "Portal cartográfico de Cantabria",
      type: "visor"
    }
  ],
  "La Rioja": [
    {
      name: "IDERioja",
      url: "https://www.iderioja.larioja.org/",
      description: "Infraestructura de Datos Espaciales de La Rioja",
      type: "visor"
    }
  ],
  "Comunidad Foral de Navarra": [
    {
      name: "IDENA - SITNA",
      url: "https://idena.navarra.es/",
      description: "Sistema de Información Territorial de Navarra",
      type: "visor"
    }
  ],
  "Extremadura": [
    {
      name: "IDEEX",
      url: "https://ideex.juntaex.es/",
      description: "Infraestructura de Datos Espaciales de Extremadura",
      type: "visor"
    }
  ]
};

// Visor nacional (per a totes les comunitats)
const NATIONAL_VIEWERS: UrbanViewer[] = [
  {
    name: "Sistema de Información Urbana (SIU)",
    url: "https://www.mitma.gob.es/portal-del-suelo-y-politicas-urbanas/sistema-de-informacion-urbana/sistema-de-informacion-urbana-siu",
    description: "Ministerio de Transportes - Información urbanística nacional",
    type: "portal"
  },
  {
    name: "Sede Electrónica del Catastro",
    url: "https://www.sedecatastro.gob.es/",
    description: "Consulta de datos catastrales oficiales",
    type: "portal"
  },
  {
    name: "Visor del Catastro",
    url: "https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx",
    description: "Visor cartográfico del Catastro",
    type: "visor"
  }
];

export const NormativaModal = ({
  open,
  onOpenChange,
  projectId,
}: NormativaModalProps) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [loadingUrbanisme, setLoadingUrbanisme] = useState(false);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [urbanismeData, setUrbanismeData] = useState<UrbanismeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autonomousCommunity, setAutonomousCommunity] = useState<string>("");

  useEffect(() => {
    if (open && projectId) {
      loadProjectData();
    }
  }, [open, projectId]);

  const loadProjectData = async () => {
    setLoading(true);
    setError(null);
    setUrbanismeData(null);
    try {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("cadastral_reference, street, street_number, postal_code, city, province, autonomous_community, utm_x, utm_y, utm_zone")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      if (!project?.cadastral_reference) {
        setError(language === 'ca' 
          ? "Aquest projecte no té referència cadastral. Cal afegir-la primer a 'Emplaçament i situació'."
          : "Este proyecto no tiene referencia catastral. Es necesario añadirla primero en 'Emplazamiento y situación'.");
        setLoading(false);
        return;
      }

      setProjectData(project);
      
      // Determinar comunitat autònoma
      let ccaa = project.autonomous_community || 
        getAutonomousCommunityFromProvince(project.province || "");
      
      // Si no tenim ccaa però tenim zona UTM 31N (Catalunya/Aragó/Navarra), 
      // intentem detectar Catalunya per referència cadastral o coordenades
      if (!ccaa && project.utm_zone === "31N" && project.utm_x && project.utm_y) {
        // Les coordenades UTM de Catalunya estan aproximadament entre:
        // X: 260.000 - 530.000, Y: 4.490.000 - 4.750.000
        if (project.utm_x >= 260000 && project.utm_x <= 530000 && 
            project.utm_y >= 4490000 && project.utm_y <= 4750000) {
          ccaa = "Catalunya";
        }
      }
      
      setAutonomousCommunity(ccaa);

      // Si és Catalunya i tenim coordenades UTM, convertim a lat/lon i consultem el WFS
      // Passem també la referència cadastral per poder calcular el centroide de la parcel·la
      if (ccaa === "Catalunya" && project.utm_x && project.utm_y && project.utm_zone) {
        const latLon = utmToLatLon(project.utm_x, project.utm_y, project.utm_zone);
        await loadUrbanismeData(latLon.latitude, latLon.longitude, ccaa, project.cadastral_reference || undefined);
      }

    } catch (err) {
      console.error("Error loading project data:", err);
      setError(language === 'ca' ? "Error carregant les dades del projecte" : "Error cargando los datos del proyecto");
      toast.error(language === 'ca' ? "Error carregant les dades del projecte" : "Error cargando los datos del proyecto");
    } finally {
      setLoading(false);
    }
  };

  const loadUrbanismeData = async (lat: number, lon: number, ccaa: string, cadastralRef?: string) => {
    setLoadingUrbanisme(true);
    try {
      const { data, error: funcError } = await supabase.functions.invoke("urbanisme-lookup", {
        body: { lat, lon, ccaa, cadastralRef }
      });

      if (funcError) {
        console.error("Error calling urbanisme-lookup:", funcError);
        return;
      }

      console.log("Urbanisme data received:", data);
      setUrbanismeData(data);

    } catch (err) {
      console.error("Error loading urbanisme data:", err);
    } finally {
      setLoadingUrbanisme(false);
    }
  };

  const getViewersForCommunity = (): UrbanViewer[] => {
    return URBAN_VIEWERS[autonomousCommunity] || [];
  };

  const getViewerTypeColor = (type: UrbanViewer["type"]) => {
    switch (type) {
      case "visor": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "portal": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "wms": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getViewerTypeLabel = (type: UrbanViewer["type"]) => {
    switch (type) {
      case "visor": return "Visor";
      case "portal": return "Portal";
      case "wms": return "WMS";
      default: return type;
    }
  };

  const communityViewers = getViewersForCommunity();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl text-amber-600">
            <Scale className="w-6 h-6" />
            {language === 'ca' ? 'Normativa Urbanística' : 'Normativa Urbanística'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ca' 
              ? "Consulta la qualificació urbanística i normativa aplicable a la parcel·la"
              : "Consulta la calificación urbanística y normativa aplicable a la parcela"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
                <p className="text-base text-muted-foreground">
                  {language === 'ca' ? 'Carregant dades del projecte...' : 'Cargando datos del proyecto...'}
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-base text-destructive font-medium">{error}</p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {language === 'ca' ? 'Tancar' : 'Cerrar'}
                </Button>
              </div>
            ) : projectData ? (
              <>
                {/* Dades de la parcel·la */}
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
                    <Building2 className="w-5 h-5" />
                    {language === 'ca' ? 'Dades de la parcel·la' : 'Datos de la parcela'}
                  </h3>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {language === 'ca' ? 'Referència cadastral' : 'Referencia catastral'}
                        </p>
                        <p className="font-mono font-semibold text-foreground">
                          {projectData.cadastral_reference}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {language === 'ca' ? 'Comunitat Autònoma' : 'Comunidad Autónoma'}
                        </p>
                        <p className="font-semibold text-foreground">
                          {autonomousCommunity || (language === 'ca' ? "No determinada" : "No determinada")}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">
                          {language === 'ca' ? 'Adreça' : 'Dirección'}
                        </p>
                        <p className="font-medium text-foreground">
                          {[
                            projectData.street,
                            projectData.street_number,
                            projectData.postal_code,
                            projectData.city,
                            projectData.province
                          ].filter(Boolean).join(", ") || (language === 'ca' ? "No disponible" : "No disponible")}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Dades urbanístiques WFS (només Catalunya per ara) */}
                {autonomousCommunity === "Catalunya" && (
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-emerald-600">
                      <Layers className="w-5 h-5" />
                      {language === 'ca' ? 'Qualificació urbanística' : 'Calificación urbanística'}
                    </h3>

                    {loadingUrbanisme ? (
                      <div className="flex items-center gap-3 p-5 bg-muted/50 rounded-xl border border-border">
                        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                        <p className="text-muted-foreground">
                          {language === 'ca' ? 'Consultant el servei WFS de Catalunya...' : 'Consultando el servicio WFS de Cataluña...'}
                        </p>
                      </div>
                    ) : urbanismeData?.success ? (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800 space-y-4">
                        {/* Classificació del sòl */}
                        {urbanismeData.classificacio && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-600 text-white">
                                {language === 'ca' ? 'Classificació' : 'Clasificación'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2 border-l-2 border-emerald-300">
                              {urbanismeData.classificacio.codi && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ca' ? 'Codi' : 'Código'}
                                  </p>
                                  <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                    {urbanismeData.classificacio.codi}
                                  </p>
                                </div>
                              )}
                              {urbanismeData.classificacio.descripcio && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ca' ? 'Descripció' : 'Descripción'}
                                  </p>
                                  <p className="font-medium text-foreground">
                                    {urbanismeData.classificacio.descripcio}
                                  </p>
                                </div>
                              )}
                              {urbanismeData.classificacio.tipus && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ca' ? 'Tipus' : 'Tipo'}
                                  </p>
                                  <p className="text-foreground">{urbanismeData.classificacio.tipus}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Qualificació urbanística */}
                        {urbanismeData.qualificacio && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-600 text-white">
                                {language === 'ca' ? 'Qualificació' : 'Calificación'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2 border-l-2 border-blue-300">
                              {urbanismeData.qualificacio.clau && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ca' ? 'Clau' : 'Clave'}
                                  </p>
                                  <p className="font-mono font-semibold text-blue-700 dark:text-blue-400 text-lg">
                                    {urbanismeData.qualificacio.clau}
                                  </p>
                                </div>
                              )}
                              {urbanismeData.qualificacio.codi && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ca' ? 'Codi' : 'Código'}
                                  </p>
                                  <p className="font-mono text-foreground">{urbanismeData.qualificacio.codi}</p>
                                </div>
                              )}
                              {urbanismeData.qualificacio.descripcio && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ca' ? 'Descripció' : 'Descripción'}
                                  </p>
                                  <p className="font-medium text-foreground">
                                    {urbanismeData.qualificacio.descripcio}
                                  </p>
                                </div>
                              )}
                              {urbanismeData.qualificacio.zona && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Zona</p>
                                  <p className="text-foreground">{urbanismeData.qualificacio.zona}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Sector */}
                        {urbanismeData.sector?.nom && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Sector</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2 border-l-2 border-border">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {language === 'ca' ? 'Nom' : 'Nombre'}
                                </p>
                                <p className="font-medium text-foreground">{urbanismeData.sector.nom}</p>
                              </div>
                              {urbanismeData.sector.tipus && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ca' ? 'Tipus' : 'Tipo'}
                                  </p>
                                  <p className="text-foreground">{urbanismeData.sector.tipus}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 text-sm text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {language === 'ca' 
                              ? 'Dades obtingudes del Mapa Urbanístic de Catalunya (MUC)'
                              : 'Datos obtenidos del Mapa Urbanístico de Cataluña (MUC)'}
                          </span>
                        </div>
                      </div>
                    ) : urbanismeData?.error ? (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
                        <div className="flex gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-amber-700 dark:text-amber-400">{urbanismeData.error}</p>
                            <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                              {language === 'ca' 
                                ? 'Consulteu manualment els visors oficials a continuació.'
                                : 'Consulte manualmente los visores oficiales a continuación.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : !projectData.utm_x || !projectData.utm_y ? (
                      <div className="bg-muted/50 rounded-xl p-5 border border-border">
                        <p className="text-muted-foreground">
                          {language === 'ca' 
                            ? 'No hi ha coordenades disponibles per aquesta parcel·la. Afegiu-les a "Emplaçament i situació" per consultar automàticament la qualificació urbanística.'
                            : 'No hay coordenadas disponibles para esta parcela. Añádalas en "Emplazamiento y situación" para consultar automáticamente la calificación urbanística.'}
                        </p>
                      </div>
                    ) : null}
                  </section>
                )}

                {autonomousCommunity === "Catalunya" && <Separator />}

                {/* Informació important */}
                <section className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
                    <div className="flex gap-3">
                      <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="font-medium text-blue-700 dark:text-blue-400">
                          {language === 'ca' ? 'Sobre la consulta urbanística' : 'Sobre la consulta urbanística'}
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          {autonomousCommunity === "Catalunya" 
                            ? (language === 'ca' 
                                ? "Les dades s'obtenen del servei WFS del Mapa Urbanístic de Catalunya (MUC) de la Generalitat."
                                : "Los datos se obtienen del servicio WFS del Mapa Urbanístico de Cataluña (MUC) de la Generalitat.")
                            : (language === 'ca'
                                ? "A Espanya no existeix una API única per consultar la qualificació urbanística. Cada comunitat autònoma disposa dels seus propis visors i serveis cartogràfics."
                                : "En España no existe una API única para consultar la calificación urbanística. Cada comunidad autónoma dispone de sus propios visores y servicios cartográficos.")
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Visors de la comunitat autònoma */}
                {communityViewers.length > 0 && (
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
                      <MapPin className="w-5 h-5" />
                      {language === 'ca' ? `Visors de ${autonomousCommunity}` : `Visores de ${autonomousCommunity}`}
                    </h3>
                    
                    <div className="grid gap-3">
                      {communityViewers.map((viewer, index) => (
                        <a
                          key={index}
                          href={viewer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-amber-300 transition-all"
                        >
                          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground group-hover:text-amber-600 transition-colors">
                                {viewer.name}
                              </p>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getViewerTypeColor(viewer.type)}`}
                              >
                                {getViewerTypeLabel(viewer.type)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {viewer.description}
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 shrink-0 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {communityViewers.length === 0 && autonomousCommunity && (
                  <section className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-5 border border-border text-center">
                      <p className="text-muted-foreground">
                        {language === 'ca' 
                          ? `No disposem de visors específics per a ${autonomousCommunity}. Consulteu els visors nacionals a continuació.`
                          : `No disponemos de visores específicos para ${autonomousCommunity}. Consulte los visores nacionales a continuación.`}
                      </p>
                    </div>
                  </section>
                )}

                <Separator />

                {/* Visors nacionals */}
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
                    <FileText className="w-5 h-5" />
                    {language === 'ca' ? 'Recursos nacionals' : 'Recursos nacionales'}
                  </h3>
                  
                  <div className="grid gap-3">
                    {NATIONAL_VIEWERS.map((viewer, index) => (
                      <a
                        key={index}
                        href={viewer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-amber-300 transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center shrink-0">
                          <Globe className="w-5 h-5 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground group-hover:text-amber-600 transition-colors">
                              {viewer.name}
                            </p>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getViewerTypeColor(viewer.type)}`}
                            >
                              {getViewerTypeLabel(viewer.type)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {viewer.description}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 shrink-0 transition-colors" />
                      </a>
                    ))}
                  </div>
                </section>

                {/* Nota sobre pròximes funcionalitats - només si no és Catalunya */}
                {autonomousCommunity !== "Catalunya" && (
                  <section className="space-y-4 mt-6">
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
                      <div className="flex gap-3">
                        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="font-medium text-amber-700 dark:text-amber-400">
                            {language === 'ca' ? 'Pròximament' : 'Próximamente'}
                          </p>
                          <p className="text-sm text-amber-600 dark:text-amber-300">
                            {language === 'ca' 
                              ? "Estem treballant en la integració directa amb els serveis WFS d'altres comunitats autònomes. Catalunya ja està disponible amb consulta automàtica del Mapa Urbanístic de Catalunya (MUC)."
                              : "Estamos trabajando en la integración directa con los servicios WFS de otras comunidades autónomas. Cataluña ya está disponible con consulta automática del Mapa Urbanístico de Cataluña (MUC)."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === 'ca' ? 'Tancar' : 'Cerrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

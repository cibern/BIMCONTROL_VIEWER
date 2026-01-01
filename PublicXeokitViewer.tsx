import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  XKTLoaderPlugin,
  CxConverterIFCLoaderPlugin,
  NavCubePlugin,
  FastNavPlugin
} from "@xeokit/xeokit-sdk";
import * as CxConverter from "@creooxag/cxconverter";
import { Loader2, RotateCcw, ZoomIn, ZoomOut, Move, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PublicXeokitViewerProps {
  ifcUrl: string;
  projectName?: string;
}

export const PublicXeokitViewer = ({ ifcUrl, projectName }: PublicXeokitViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const xktLoaderRef = useRef<XKTLoaderPlugin | null>(null);
  const ifcLoaderRef = useRef<CxConverterIFCLoaderPlugin | null>(null);
  const navCubeRef = useRef<NavCubePlugin | null>(null);
  const currentModelRef = useRef<any>(null);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const initStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const loadingProgressRef = useRef(0);

  const [viewerReady, setViewerReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("Inicialitzant visor...");
  const [error, setError] = useState<string | null>(null);
  const [gyroscopeEnabled, setGyroscopeEnabled] = useState(false);
  const [gyroscopeAvailable, setGyroscopeAvailable] = useState(false);
  const gyroRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);
  const initialGyroRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);

  // Check if gyroscope is available
  useEffect(() => {
    const checkGyroscope = () => {
      if (typeof DeviceOrientationEvent !== "undefined") {
        // Check if we need to request permission (iOS 13+)
        if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
          setGyroscopeAvailable(true);
        } else {
          // Try to detect if the device actually supports orientation
          const handleTest = (event: DeviceOrientationEvent) => {
            if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
              setGyroscopeAvailable(true);
            }
            window.removeEventListener("deviceorientation", handleTest);
          };
          window.addEventListener("deviceorientation", handleTest, { once: true });
          // Timeout fallback
          setTimeout(() => {
            window.removeEventListener("deviceorientation", handleTest);
          }, 1000);
        }
      }
    };

    checkGyroscope();
  }, []);

  // Handle gyroscope
  useEffect(() => {
    if (!gyroscopeEnabled || !viewerRef.current) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const { alpha, beta, gamma } = event;
      if (alpha === null || beta === null || gamma === null) return;

      // Store initial position on first reading
      if (!initialGyroRef.current) {
        initialGyroRef.current = { alpha, beta, gamma };
        return;
      }

      gyroRef.current = { alpha, beta, gamma };

      // Calculate delta from initial position
      const deltaAlpha = (alpha - initialGyroRef.current.alpha) * 0.01;
      const deltaBeta = (beta - initialGyroRef.current.beta) * 0.01;

      const viewer = viewerRef.current;
      if (!viewer) return;

      const camera = viewer.camera;
      const eye = camera.eye.slice();
      const look = camera.look.slice();

      // Rotate camera based on device orientation
      const yaw = deltaAlpha * Math.PI;
      const pitch = deltaBeta * Math.PI * 0.5;

      // Calculate new eye position
      const eyeToLook = [
        look[0] - eye[0],
        look[1] - eye[1],
        look[2] - eye[2]
      ];

      const dist = Math.sqrt(
        eyeToLook[0] ** 2 + eyeToLook[1] ** 2 + eyeToLook[2] ** 2
      );

      // Apply rotation
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      const newEyeToLook = [
        eyeToLook[0] * cosYaw - eyeToLook[2] * sinYaw,
        eyeToLook[1] * cosPitch - (eyeToLook[0] * sinYaw + eyeToLook[2] * cosYaw) * sinPitch,
        eyeToLook[0] * sinYaw + eyeToLook[2] * cosYaw
      ];

      // Normalize and apply distance
      const newDist = Math.sqrt(
        newEyeToLook[0] ** 2 + newEyeToLook[1] ** 2 + newEyeToLook[2] ** 2
      );
      
      if (newDist > 0) {
        camera.eye = [
          look[0] - (newEyeToLook[0] / newDist) * dist,
          look[1] - (newEyeToLook[1] / newDist) * dist,
          look[2] - (newEyeToLook[2] / newDist) * dist
        ];
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [gyroscopeEnabled]);

  // Toggle gyroscope
  const toggleGyroscope = async () => {
    if (!gyroscopeAvailable) {
      toast.error("El giroscopi no està disponible en aquest dispositiu");
      return;
    }

    if (gyroscopeEnabled) {
      setGyroscopeEnabled(false);
      initialGyroRef.current = null;
      toast.info("Giroscopi desactivat");
      return;
    }

    // Check if we need permission (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === "granted") {
          setGyroscopeEnabled(true);
          toast.success("Giroscopi activat - Mou el dispositiu per rotar el model");
        } else {
          toast.error("Permís denegat per accedir al giroscopi");
        }
      } catch (err) {
        console.error("[PublicViewer] Gyroscope permission error:", err);
        toast.error("Error sol·licitant permís del giroscopi");
      }
    } else {
      setGyroscopeEnabled(true);
      toast.success("Giroscopi activat - Mou el dispositiu per rotar el model");
    }
  };

  // Track WebGL2 support
  const hasWebGL2Ref = useRef<boolean>(false);

  // Initialize viewer - waits for canvas to be in DOM
  useEffect(() => {
    let isMounted = true;
    let initTimeout: ReturnType<typeof setTimeout> | null = null;

    const tryInit = () => {
      // Ensure canvas exists in DOM before initializing
      const canvas = document.getElementById("publicViewerCanvas");
      if (!canvas) {
        console.log("[PublicViewer] Canvas not in DOM yet, retrying...");
        initTimeout = setTimeout(tryInit, 50);
        return;
      }

      // Prevent double init (React StrictMode)
      if (initStartedRef.current) {
        if (viewerRef.current) {
          setViewerReady(true);
        }
        return;
      }
      initStartedRef.current = true;
      isMountedRef.current = true;

      const initViewer = async () => {
        console.log("[PublicViewer] Initializing viewer...");

        // Check WebGL support (WebGL2 preferred, but WebGL1 fallback for mobile)
        const supportCanvas = document.createElement("canvas");
        const hasWebGL2 = !!supportCanvas.getContext("webgl2");
        hasWebGL2Ref.current = hasWebGL2;
        const gl =
          (hasWebGL2 ? supportCanvas.getContext("webgl2") : null) ||
          supportCanvas.getContext("webgl") ||
          supportCanvas.getContext("experimental-webgl");

        if (!gl) {
          console.error("[PublicViewer] WebGL not supported");
          if (isMounted) {
            setError("El teu dispositiu no suporta WebGL. El visor 3D necessita un navegador amb WebGL activat.");
            setLoading(false);
          }
          return;
        }

        console.log("[PublicViewer] WebGL support:", { hasWebGL2, isMobile: /Mobi|Android/i.test(navigator.userAgent) });

        try {
          const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          
          // Create viewer - disable all advanced features on mobile or without WebGL2
          const viewer = new Viewer({
            canvasId: "publicViewerCanvas",
            transparent: true,
            saoEnabled: hasWebGL2 && !isMobile,
            pbrEnabled: hasWebGL2 && !isMobile,
            dtxEnabled: hasWebGL2 && !isMobile,
            // Disable features that require materialEmissive on mobile
            logarithmicDepthBufferEnabled: hasWebGL2,
            colorTextureEnabled: !isMobile
          });

          // Configure camera for mobile-friendly controls
          viewer.camera.perspective.fov = 60;
          viewer.camera.ortho.scale = 50;

          // Enable touch controls
          viewer.cameraControl.navMode = "orbit";
          viewer.cameraControl.followPointer = true;

          // Fast navigation - only if WebGL2 available and not on mobile
          if (hasWebGL2 && !isMobile) {
            new FastNavPlugin(viewer, {
              hideEdges: true,
              hideSAO: true,
              hideColorTexture: true,
              hidePBR: true,
              hideTransparentObjects: false,
              scaleCanvasResolution: true,
              scaleCanvasResolutionFactor: 0.5
            });
          }

          // Nav cube for orientation
          const navCubeCanvas = document.getElementById("publicNavCubeCanvas");
          if (navCubeCanvas && !navCubeRef.current) {
            navCubeRef.current = new NavCubePlugin(viewer, {
              canvasId: "publicNavCubeCanvas",
              visible: true
            });
          }

          // XKT loader
          xktLoaderRef.current = new XKTLoaderPlugin(viewer, {
            maxGeometryBatchSize: 50000000
          });

          // IFC loader with CxConverter (same as main viewer)
          try {
            const ifcLoader = new CxConverterIFCLoaderPlugin(viewer);
            // @ts-ignore - setCxConverterModule exists in runtime but not in types
            ifcLoader.setCxConverterModule(CxConverter);
            ifcLoaderRef.current = ifcLoader;
            console.log("[PublicViewer] CxConverter IFC loader initialized");
          } catch (ifcErr) {
            console.warn("[PublicViewer] CxConverter IFC loader failed, XKT-only mode:", ifcErr);
          }

          viewerRef.current = viewer;
          if (isMounted) {
            setViewerReady(true);
            console.log("[PublicViewer] Viewer initialized successfully (WebGL2:", hasWebGL2, ")");
          }

        } catch (err) {
          console.error("[PublicViewer] Error initializing viewer:", err);
          const errMsg = (err as any)?.message || String(err);
          if (isMounted) {
            setError(`Error inicialitzant el visor 3D: ${errMsg}`);
            setLoading(false);
          }
        }
      };

      initViewer();
    };

    // Start trying to init
    tryInit();

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      if (initTimeout) clearTimeout(initTimeout);
      // Reset initStartedRef on unmount so StrictMode remount can reinit
      if (!viewerRef.current) {
        initStartedRef.current = false;
      }
    };
  }, []);

  // Load model - runs once when viewer is ready and ifcUrl is set
  useEffect(() => {
    if (!viewerReady || !viewerRef.current || !ifcUrl) return;

    // Prevent duplicate loads (React StrictMode, small state updates, etc.)
    if (lastLoadedUrlRef.current === ifcUrl) {
      console.log("[PublicViewer] Model already loaded for this URL, skipping");
      return;
    }

    lastLoadedUrlRef.current = ifcUrl;
    currentModelRef.current = null;

    const loadModel = async () => {
      if (!isMountedRef.current) return;

      setError(null);
      setModelReady(false);
      setLoading(true);
      setLoadingProgress(0);
      loadingProgressRef.current = 0;
      setLoadingText("Carregant model...");

      let finalized = false;
      
      // Helper function to initialize materials with default emissive property
      // This prevents "materialEmissive" shader errors on mobile devices
      const initializeMaterialEmissive = (viewer: any) => {
        try {
          const scene = viewer?.scene;
          if (!scene) return;
          
          // Iterate through all models and their objects to set default emissive
          const models = scene.models;
          if (models) {
            Object.values(models).forEach((model: any) => {
              // Some xeokit versions expose materials at model level
              if (model.meshes) {
                Object.values(model.meshes).forEach((mesh: any) => {
                  if (mesh.material && !mesh.material.emissive) {
                    mesh.material.emissive = [0, 0, 0];
                  }
                });
              }
            });
          }
          
          // Also check scene-level objects
          const objects = scene.objects;
          if (objects) {
            Object.values(objects).forEach((obj: any) => {
              if (obj.material && !obj.material.emissive) {
                obj.material.emissive = [0, 0, 0];
              }
              // Some objects have meshes with their own materials
              if (obj.meshes) {
                obj.meshes.forEach((mesh: any) => {
                  if (mesh.material && !mesh.material.emissive) {
                    mesh.material.emissive = [0, 0, 0];
                  }
                });
              }
            });
          }
          
          console.log("[PublicViewer] Materials initialized with default emissive values");
        } catch (err) {
          console.warn("[PublicViewer] Error initializing material emissive:", err);
        }
      };
      
      const finalizeModelSetup = (model: any) => {
        if (!isMountedRef.current || finalized) return;
        finalized = true;

        currentModelRef.current = model;
        console.log("[PublicViewer] Model loaded successfully");

        // Initialize materials with default emissive to prevent shader errors
        initializeMaterialEmissive(viewerRef.current);

        try {
          const aabb = model?.aabb;
          if (aabb) {
            viewerRef.current?.cameraFlight.flyTo({ aabb, duration: 0.5 });
          }
        } catch (e) {
          console.warn("[PublicViewer] flyTo failed:", e);
        }

        setModelReady(true);
        setLoading(false);
        setLoadingProgress(100);
        loadingProgressRef.current = 100;
      };

      const scheduleFinalizeFromScene = () => {
        if (!isMountedRef.current || finalized) return;
        const viewer = viewerRef.current;
        const models = viewer?.scene?.models ? Object.values(viewer.scene.models) : [];
        const firstModel = models.find((m: any) => m && (m as any).aabb) || models[0];
        if (firstModel) {
          finalizeModelSetup(firstModel);
          return;
        }
        // Try a few times - in some cases IFC conversion reaches 100% before the model is registered.
        window.setTimeout(scheduleFinalizeFromScene, 250);
      };

      try {
        // Detect file extension - handle Lighthouse/IPFS URLs that have no extension
        let ext = ifcUrl.toLowerCase().split(".").pop() || "";
        
        // If the "extension" is too long or contains path separators, it's not a real extension
        // Also handle Lighthouse IPFS URLs which don't have extensions
        const isLighthouseUrl = ifcUrl.includes("lighthouse.storage") || ifcUrl.includes("/ipfs/");
        const isValidExtension = ext.length <= 4 && !ext.includes("/") && (ext === "ifc" || ext === "xkt");
        
        if (!isValidExtension || isLighthouseUrl) {
          // Assume IFC for Lighthouse/IPFS URLs or URLs without valid extensions
          ext = "ifc";
          console.log("[PublicViewer] URL sense extensió detectada, assumint IFC");
        }

        const isXKT = ext === "xkt";
        const isIFC = ext === "ifc";

        console.log("[PublicViewer] Loading model:", ifcUrl, { isXKT, isIFC, ext });

        // Best-effort HEAD check
        try {
          const testResponse = await fetch(ifcUrl, { method: "HEAD" });
          if (!testResponse.ok) {
            console.error(
              "[PublicViewer] URL not accessible:",
              testResponse.status,
              testResponse.statusText
            );
            throw new Error(`El fitxer no és accessible (${testResponse.status})`);
          }
        } catch (fetchErr) {
          console.warn("[PublicViewer] Fetch test failed (continuing anyway):", fetchErr);
        }

        // Clean up any previous model(s)
        try {
          if (currentModelRef.current?.destroy) {
            currentModelRef.current.destroy();
          }
          const sceneModels = viewerRef.current?.scene?.models;
          if (sceneModels) {
            Object.values(sceneModels).forEach((m: any) => {
              try {
                m?.destroy?.();
              } catch {
                // ignore
              }
            });
          }
        } catch {
          // ignore
        }
        currentModelRef.current = null;

        let sceneModel: any = null;

        if (isIFC && ifcLoaderRef.current) {
          console.log("[PublicViewer] Loading IFC with CxConverter...");
          setLoadingText("Processant fitxer IFC...");

          let finalizeScheduled = false;

          sceneModel = await ifcLoaderRef.current.load({
            src: ifcUrl,
            progressCallback: (progress: number) => {
              if (!isMountedRef.current) return;
              const rounded = Math.round(progress);
              loadingProgressRef.current = rounded;
              setLoadingProgress(rounded);
              setLoadingText(`Carregant model... ${rounded}%`);

              // If conversion reports ~100% but the Promise doesn't resolve (rare), finalize from the scene.
              if (rounded >= 99 && !finalizeScheduled) {
                finalizeScheduled = true;
                window.setTimeout(() => {
                  if (!finalized && isMountedRef.current && loadingProgressRef.current >= 99) {
                    scheduleFinalizeFromScene();
                  }
                }, 400);
              }
            },
            // Some builds of the plugin call this (types may miss it)
            // @ts-ignore
            progressTextCallback: (text: string) => {
              if (!isMountedRef.current) return;
              if (text) setLoadingText(text);
            }
          });

          if (sceneModel) {
            finalizeModelSetup(sceneModel);
          } else {
            // Fallback: try to finalize from scene if model got registered anyway
            scheduleFinalizeFromScene();
          }
        } else if (isXKT && xktLoaderRef.current) {
          const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          console.log("[PublicViewer] Loading XKT...", { isMobile, hasWebGL2: hasWebGL2Ref.current });
          sceneModel = xktLoaderRef.current.load({
            id: "publicModel",
            src: ifcUrl,
            edges: false,
            dtxEnabled: hasWebGL2Ref.current && !isMobile,
            saoEnabled: hasWebGL2Ref.current && !isMobile,
            pbrEnabled: hasWebGL2Ref.current && !isMobile
          });

          if (!sceneModel) {
            throw new Error("No s'ha pogut carregar el model");
          }

          if (sceneModel?.on) {
            let loadedHandled = false;

            sceneModel.on("loaded", () => {
              if (loadedHandled) return;
              loadedHandled = true;
              finalizeModelSetup(sceneModel);
            });

            sceneModel.on("error", (err: any) => {
              console.error("[PublicViewer] Model load error:", err);
              if (isMountedRef.current) {
                setError(`Error carregant el model: ${err?.message || String(err)}`);
                setLoading(false);
                setModelReady(false);
                lastLoadedUrlRef.current = null;
              }
            });

            // Fallback timeout
            window.setTimeout(() => {
              if (!loadedHandled && isMountedRef.current) {
                loadedHandled = true;
                finalizeModelSetup(sceneModel);
              }
            }, 8000);
          } else {
            finalizeModelSetup(sceneModel);
          }
        } else {
          throw new Error("Format de fitxer no suportat o loader no disponible");
        }
      } catch (err) {
        console.error("[PublicViewer] Exception loading model:", err);
        if (isMountedRef.current) {
          const msg = (err as any)?.message || String(err);
          setError(`Error carregant el model: ${msg}`);
          setLoading(false);
          setModelReady(false);
          lastLoadedUrlRef.current = null;
        }
      }
    };

    loadModel();
  }, [ifcUrl, viewerReady]);

  // Control handlers
  const handleResetView = () => {
    if (!viewerRef.current || !currentModelRef.current) return;
    viewerRef.current.cameraFlight.flyTo({
      aabb: currentModelRef.current.aabb,
      duration: 0.8
    });
  };

  const handleZoomIn = () => {
    if (!viewerRef.current) return;
    const camera = viewerRef.current.camera;
    const eye = camera.eye;
    const look = camera.look;
    const dir = [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]];
    const dist = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
    const factor = 0.2;
    camera.eye = [
      eye[0] + dir[0] * factor,
      eye[1] + dir[1] * factor,
      eye[2] + dir[2] * factor
    ];
  };

  const handleZoomOut = () => {
    if (!viewerRef.current) return;
    const camera = viewerRef.current.camera;
    const eye = camera.eye;
    const look = camera.look;
    const dir = [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]];
    const factor = -0.2;
    camera.eye = [
      eye[0] + dir[0] * factor,
      eye[1] + dir[1] * factor,
      eye[2] + dir[2] * factor
    ];
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-background to-muted/30">
      {/* Main viewer canvas - always visible so xeokit can init */}
      <canvas
        id="publicViewerCanvas"
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full touch-none transition-opacity duration-500 ${
          modelReady ? "opacity-100" : "opacity-0"
        }`}
        style={{ touchAction: "none" }}
      />

      {/* NavCube canvas - always visible and outside opacity container */}
      <canvas
        id="publicNavCubeCanvas"
        className={`absolute bottom-20 right-2 sm:bottom-24 sm:right-4 z-30 transition-opacity duration-500 ${
          modelReady ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: "80px", height: "80px" }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground mb-2">{loadingText}</p>
          <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-20 p-4">
          <p className="text-destructive text-center">{error}</p>
        </div>
      )}

      {/* Controls - Mobile friendly */}
      {modelReady && !loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border border-border z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleZoomOut}
            title="Allunyar"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleResetView}
            title="Restablir vista"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleZoomIn}
            title="Apropar"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>

          {gyroscopeAvailable && (
            <Button
              variant={gyroscopeEnabled ? "default" : "ghost"}
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={toggleGyroscope}
              title={gyroscopeEnabled ? "Desactivar giroscopi" : "Activar giroscopi"}
            >
              <Smartphone
                className={`h-5 w-5 ${gyroscopeEnabled ? "animate-pulse" : ""}`}
              />
            </Button>
          )}
        </div>
      )}

      {/* Instruccions touch */}
      {modelReady && !loading && !error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/70 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-muted-foreground z-10">
          <Move className="h-3 w-3" />
          <span>1 dit: rotar • 2 dits: zoom/moure</span>
        </div>
      )}
    </div>
  );
};

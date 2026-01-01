import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three-stdlib";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import { RoomDashboardPanel } from "./RoomDashboardPanel";
import { supabase } from "@/integrations/supabase/client";

interface IFCViewerProps {
  ifcUrl?: string;
}

export const IFCViewer = ({ ifcUrl }: IFCViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    cssRenderer: CSS3DRenderer;
    controls: any;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    ifcLoader?: IFCLoader;
    modelID?: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Setup CSS3D renderer
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = '0';
    cssRenderer.domElement.style.pointerEvents = 'none';
    containerRef.current.appendChild(cssRenderer.domElement);

    // Setup raycaster for interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 100);
    scene.add(gridHelper);

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Basic orbit controls (simple implementation)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      camera.position.x += deltaX * 0.01;
      camera.position.y -= deltaY * 0.01;
      camera.lookAt(0, 0, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      camera.position.z += e.deltaY * zoomSpeed;
      camera.position.z = Math.max(2, Math.min(100, camera.position.z));
    };

    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    renderer.domElement.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("mouseup", handleMouseUp);
    renderer.domElement.addEventListener("wheel", handleWheel);

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      cssRenderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { scene, camera, renderer, cssRenderer, controls: null, raycaster, mouse };

    // Click handler to detect walls with Marca parameter
    const handleClick = async (event: MouseEvent) => {
      if (!sceneRef.current || !containerRef.current) return;
      if (!sceneRef.current.ifcLoader || sceneRef.current.modelID === undefined) return;

      const rect = containerRef.current.getBoundingClientRect();
      sceneRef.current.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      sceneRef.current.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
      
      // Find IFC model in scene
      const ifcModel = sceneRef.current.scene.children.find(child => child.userData.isIFCModel);
      if (!ifcModel) return;

      const intersects = sceneRef.current.raycaster.intersectObject(ifcModel, true);

      if (intersects.length > 0) {
        const intersect = intersects[0];
        const mesh = intersect.object as THREE.Mesh;

        if (mesh.geometry?.attributes?.expressID) {
          const index = intersect.faceIndex;
          if (index !== undefined) {
            const expressID = mesh.geometry.attributes.expressID.getX(index * 3);
            
            try {
              const ifcManager = sceneRef.current.ifcLoader.ifcManager;
              const modelID = sceneRef.current.modelID;
              
              // Get properties and check for Marca parameter
              const psets = await ifcManager.getPropertySets(modelID, expressID);
              
              for (const pset of psets) {
                if (pset.HasProperties) {
                  for (const prop of pset.HasProperties) {
                    const propData = await ifcManager.getItemProperties(modelID, prop.value);
                    if (propData.Name?.value === 'Marca') {
                      const marcaValue = propData.NominalValue?.value;
                      if (marcaValue) {
                        alert(`🎯 ${language === "ca" ? "Mur detectat!" : "¡Muro detectado!"}\n\nMarca: ${marcaValue}`);
                        return;
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.error('[IFC] Error checking Marca:', err);
            }
          }
        }
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      renderer.domElement.removeEventListener("mousedown", handleMouseDown);
      renderer.domElement.removeEventListener("mousemove", handleMouseMove);
      renderer.domElement.removeEventListener("mouseup", handleMouseUp);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      renderer.domElement.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
      if (containerRef.current) {
        if (containerRef.current.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement);
        }
        if (containerRef.current.contains(cssRenderer.domElement)) {
          containerRef.current.removeChild(cssRenderer.domElement);
        }
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!ifcUrl || !sceneRef.current) return;

    const loadIFC = async () => {
      setLoading(true);
      setError(null);

      try {
        const ifcLoader = new IFCLoader();
        await ifcLoader.ifcManager.setWasmPath("https://unpkg.com/web-ifc@0.0.44/");

        ifcLoader.load(
          ifcUrl,
          async (ifcModel) => {
            if (!sceneRef.current) return;

            // Store ifcLoader and modelID for click detection
            sceneRef.current.ifcLoader = ifcLoader;
            sceneRef.current.modelID = ifcModel.modelID;

            // Remove previous models and dashboards
            const previousModels = sceneRef.current.scene.children.filter(
              (child) => child.userData.isIFCModel || child.userData.isDashboard
            );
            previousModels.forEach((model) => sceneRef.current!.scene.remove(model));

            // Add new model
            ifcModel.userData.isIFCModel = true;
            sceneRef.current.scene.add(ifcModel);

            // Center camera on model
            const box = new THREE.Box3().setFromObject(ifcModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = sceneRef.current.camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
            cameraZ *= 1.5;

            sceneRef.current.camera.position.set(
              center.x + cameraZ,
              center.y + cameraZ,
              center.z + cameraZ
            );
            sceneRef.current.camera.lookAt(center);

            // Process IFC to find rooms and walls with Marca parameter
            await processIFCForDashboards(ifcModel, ifcLoader);

            setLoading(false);
          },
          (progress) => {
            console.log((progress.loaded / progress.total) * 100 + "% loaded");
          },
          (error) => {
            console.error("Error loading IFC:", error);
            setError(t("viewer.noModel"));
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Error:", err);
        setError(t("viewer.noModel"));
        setLoading(false);
      }
    };

    loadIFC();
  }, [ifcUrl, t]);

  // Process IFC model to find rooms and render dashboards on walls
  const processIFCForDashboards = async (ifcModel: any, ifcLoader: IFCLoader) => {
    if (!sceneRef.current) return;

    console.log('[IFC] Starting dashboard processing...');

    try {
      const ifcManager = ifcLoader.ifcManager;
      const modelID = ifcModel.modelID;

      // Find all IFCSPACE (rooms/habitacions)
      const spaces = await ifcManager.getAllItemsOfType(modelID, 3856911033, false); // IFCSPACE = 3856911033
      console.log(`[IFC] Found ${spaces.length} spaces`);

      for (const spaceID of spaces) {
        try {
          const spaceProps = await ifcManager.getItemProperties(modelID, spaceID);
          console.log('[IFC] Space props:', spaceProps);

          // Look for "Número" or name that contains room number
          let roomNumber: string | null = null;

          // Try to get psets
          const spacePsets = await ifcManager.getPropertySets(modelID, spaceID);
          console.log('[IFC] Space psets:', spacePsets);

          // Check in property sets for "Número" or extract from Name
          for (const pset of spacePsets) {
            if (pset.HasProperties) {
              for (const prop of pset.HasProperties) {
                const propData = await ifcManager.getItemProperties(modelID, prop.value);
                if (propData.Name?.value === 'Número' || propData.Name?.value === 'Reference') {
                  roomNumber = propData.NominalValue?.value || null;
                  console.log('[IFC] Found room number from property:', roomNumber);
                }
              }
            }
          }

          // If not found in psets, try to extract from space name
          if (!roomNumber && spaceProps.Name?.value) {
            const match = spaceProps.Name.value.match(/(\d{2,})/);
            if (match) {
              roomNumber = match[1];
              console.log('[IFC] Extracted room number from name:', roomNumber);
            }
          }

          if (!roomNumber) {
            console.log('[IFC] No room number found for space', spaceID);
            continue;
          }

          // Now search for wall with Marca = "Panel-{roomNumber}"
          const targetMarca = `Panel-${roomNumber}`;
          console.log(`[IFC] Looking for wall with Marca = "${targetMarca}"`);

          const walls = await ifcManager.getAllItemsOfType(modelID, 297479502, false); // IFCWALL = 297479502
          console.log(`[IFC] Found ${walls.length} walls`);

          for (const wallID of walls) {
            const wallProps = await ifcManager.getItemProperties(modelID, wallID);
            const wallPsets = await ifcManager.getPropertySets(modelID, wallID);

            for (const pset of wallPsets) {
              if (pset.HasProperties) {
                for (const prop of pset.HasProperties) {
                  const propData = await ifcManager.getItemProperties(modelID, prop.value);
                  if (propData.Name?.value === 'Marca' && propData.NominalValue?.value === targetMarca) {
                    console.log(`[IFC] ✅ Found wall with ${targetMarca}!`);

                    // Get wall geometry
                    const wallMesh = await findMeshByExpressID(ifcModel, wallID);
                    if (wallMesh) {
                      await renderDashboardOnWall(wallMesh, roomNumber, spaceProps);
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('[IFC] Error processing space:', err);
        }
      }
    } catch (err) {
      console.error('[IFC] Error in processIFCForDashboards:', err);
    }
  };

  // Find mesh by ExpressID
  const findMeshByExpressID = async (ifcModel: any, expressID: number): Promise<THREE.Mesh | null> => {
    let foundMesh: THREE.Mesh | null = null;
    
    ifcModel.traverse((child: any) => {
      if (child.isMesh && child.geometry?.attributes?.expressID) {
        const expressIDs = child.geometry.attributes.expressID.array;
        for (let i = 0; i < expressIDs.length; i++) {
          if (expressIDs[i] === expressID) {
            foundMesh = child;
            break;
          }
        }
      }
    });

    return foundMesh;
  };

  // Render dashboard on wall
  const renderDashboardOnWall = async (wallMesh: THREE.Mesh, roomNumber: string, spaceProps: any) => {
    if (!sceneRef.current) return;

    console.log('[IFC] Rendering dashboard for room:', roomNumber);

    // Get wall bounding box and center
    const box = new THREE.Box3().setFromObject(wallMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Get wall normal (direction it faces)
    const worldDirection = new THREE.Vector3();
    wallMesh.getWorldDirection(worldDirection);
    worldDirection.normalize();

    // Load room data from database
    const roomName = spaceProps.LongName?.value || spaceProps.Name?.value || (language === "ca" ? `Habitació ${roomNumber}` : `Habitación ${roomNumber}`);
    const roomDevices = await loadRoomDevices(roomNumber);

    // Create HTML element for dashboard
    const dashboardDiv = document.createElement('div');
    dashboardDiv.style.width = '1600px';
    dashboardDiv.style.height = '1200px';
    dashboardDiv.style.pointerEvents = 'auto';
    dashboardDiv.style.cursor = 'pointer';

    // Render React component into the div
    const root = createRoot(dashboardDiv);
    root.render(
      <RoomDashboardPanel
        roomName={roomName}
        roomArea={spaceProps.Area?.value}
        roomDevices={roomDevices}
        city="Girona"
        country="ES"
      />
    );

    // Create CSS3DObject
    const cssObject = new CSS3DObject(dashboardDiv);
    cssObject.position.copy(center);
    
    // Offset dashboard slightly in front of wall
    cssObject.position.add(worldDirection.multiplyScalar(0.1));

    // Orient dashboard to face outward from wall
    cssObject.lookAt(center.clone().add(worldDirection));

    // Scale to fit wall
    const scale = Math.min(size.x, size.y, size.z) * 0.002;
    cssObject.scale.set(scale, scale, scale);

    cssObject.userData.isDashboard = true;
    cssObject.userData.roomNumber = roomNumber;

    sceneRef.current.scene.add(cssObject);
    console.log('[IFC] Dashboard added to scene');

    // Add double-click detection
    const handleDoubleClick = (event: MouseEvent) => {
      if (!sceneRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      sceneRef.current.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      sceneRef.current.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      sceneRef.current.raycaster.setFromCamera(sceneRef.current.mouse, sceneRef.current.camera);
      const intersects = sceneRef.current.raycaster.intersectObject(wallMesh, true);

      if (intersects.length > 0) {
        alert(`🎯 ${language === "ca" ? "Aquest mur té un dashboard associat!" : "¡Este muro tiene un dashboard asociado!"}\n\nMarca: Panel-${roomNumber}\n${language === "ca" ? "Habitació" : "Habitación"}: ${roomName}`);
      }
    };

    sceneRef.current.renderer.domElement.addEventListener('dblclick', handleDoubleClick);
  };

  // Load room devices from database
  const loadRoomDevices = async (roomNumber: string) => {
    try {
      const { data, error }: any = await supabase
        .from('room_devices')
        .select(`
          id,
          device_id,
          device_identifier,
          notes,
          is_on,
          device:devices(
            id,
            brand,
            model,
            device_types(name, category)
          )
        `)
        .eq('room_id', roomNumber);

      if (error) {
        console.error('[DB] Error loading room devices:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[DB] Exception loading room devices:', err);
      return [];
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("viewer.loading")}</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {!ifcUrl && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">{t("viewer.selectCenter")}</p>
        </div>
      )}
    </div>
  );
};

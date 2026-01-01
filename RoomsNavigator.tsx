import { useState, useEffect } from "react";
import { Building2, ChevronUp, X, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { RoomDashboard } from "./RoomDashboard";

interface Room {
  id: string;
  name: string;
  customName?: string;
  level: string;
  area: number;
  maxOccupancy?: number;
  aabb?: number[];
}

interface RoomDevice {
  id: string;
  device_id: string;
  device_identifier: string | null;
  notes: string | null;
  is_on?: boolean;
  device?: {
    id: string;
    brand: string;
    model: string;
    device_types?: {
      name: string;
      category: string;
    };
  };
}

interface RoomsNavigatorProps {
  rooms: Room[];
  onRoomClick: (room: Room) => void;
  city?: string;
  country?: string;
}

export const RoomsNavigator = ({ rooms, onRoomClick, city, country }: RoomsNavigatorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [roomDevices, setRoomDevices] = useState<RoomDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [localRooms, setLocalRooms] = useState<Room[]>(rooms);

  // Sync local rooms with props
  useEffect(() => {
    setLocalRooms(rooms);
  }, [rooms]);

  // Listen for room name updates
  useEffect(() => {
    const handleRoomNameUpdate = (event: CustomEvent) => {
      const { roomId, roomName, customName } = event.detail;
      
      console.log("[RoomsNavigator] Room name updated:", { roomId, roomName, customName });
      
      setLocalRooms(prevRooms => 
        prevRooms.map(room => {
          // Match by ID first, then by name as fallback
          if (room.id === roomId || room.name === roomName) {
            return { ...room, customName: customName || undefined };
          }
          return room;
        })
      );

      // Update selected room if it matches
      setSelectedRoom(prevSelected => {
        if (prevSelected && (prevSelected.id === roomId || prevSelected.name === roomName)) {
          return { ...prevSelected, customName: customName || undefined };
        }
        return prevSelected;
      });
    };

    window.addEventListener("room-name-updated", handleRoomNameUpdate as EventListener);
    
    return () => {
      window.removeEventListener("room-name-updated", handleRoomNameUpdate as EventListener);
    };
  }, []);

  // Group rooms by level
  const roomsByLevel = localRooms.reduce((acc, room) => {
    if (!acc[room.level]) {
      acc[room.level] = [];
    }
    acc[room.level].push(room);
    return acc;
  }, {} as Record<string, Room[]>);

  // Sort levels from highest to lowest (superior a inferior)
  const sortedLevels = Object.keys(roomsByLevel).sort((a, b) => {
    // Extract numbers from level names (e.g., "Planta 1" -> 1)
    const numA = parseInt(a.match(/\d+/)?.[0] || "0");
    const numB = parseInt(b.match(/\d+/)?.[0] || "0");
    return numB - numA; // Descending order
  });

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const loadRoomDevices = async (room: Room) => {
    setLoadingDevices(true);
    try {
      let roomId = room.id;
      
      if (!roomId) {
        console.warn("[RoomsNavigator] Room ID not found, searching by name:", room.name);
        const { data: dbRooms, error: roomsError } = await supabase
          .from("rooms")
          .select("id, name, custom_name")
          .eq("name", room.name)
          .limit(1);

        if (roomsError || !dbRooms || dbRooms.length === 0) {
          console.error("[RoomsNavigator] Room not found in database:", room.name);
          setRoomDevices([]);
          return;
        }

        roomId = dbRooms[0].id;
      }

      console.log("[RoomsNavigator] Loading devices for room ID:", roomId);

      // Get devices for this room with proper join to ensure they belong to the user
      const { data: deviceData, error: devicesError } = await supabase
        .from("room_devices")
        .select(`
          id,
          device_id,
          device_identifier,
          notes,
          is_on,
          devices!inner (
            id,
            brand,
            model,
            device_types (
              name,
              category
            )
          )
        `)
        .eq("room_id", roomId);

      if (devicesError) {
        console.error("[RoomsNavigator] Error loading devices:", devicesError);
        setRoomDevices([]);
        return;
      }

      // Transform the data structure to match expected format
      const transformedData = deviceData?.map(rd => ({
        id: rd.id,
        device_id: rd.device_id,
        device_identifier: rd.device_identifier,
        notes: rd.notes,
        is_on: rd.is_on ?? false,
        device: rd.devices
      })) || [];

      console.log("[RoomsNavigator] ✓ Dispositius carregats:", transformedData.length);
      setRoomDevices(transformedData);
    } catch (error) {
      console.error("[RoomsNavigator] Error loading room devices:", error);
      setRoomDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleDashboardClick = async (room: Room) => {
    setSelectedRoom(room);
    await loadRoomDevices(room);
    setIsDashboardOpen(true);
  };

  if (localRooms.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleExpanded}
        className="bg-background/80 backdrop-blur-sm"
        title={isExpanded ? "Amagar habitacions" : "Mostrar habitacions"}
      >
        <Building2 className="h-4 w-4" />
      </Button>

      {isExpanded && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-background border border-border rounded-lg p-4 min-w-[500px] max-w-3xl max-h-[70vh] overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Habitacions ({localRooms.length})</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleExpanded}
              className="h-6 w-6"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
          
          {sortedLevels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No s'han trobat habitacions</p>
          ) : (
            <div className="space-y-4">
              {sortedLevels.map((level) => (
                <div key={level}>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase">{level}</h4>
                  <div className="flex flex-wrap gap-2">
                    {roomsByLevel[level].map((room) => (
                      <div key={room.id} className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRoomClick(room)}
                          className="h-auto py-2 px-3 text-xs"
                          title={`${room.customName || room.name}${room.customName ? `\n(IFC: ${room.name})` : ''}\nÀrea: ${room.area.toFixed(2)} m²`}
                        >
                          <span className="truncate">{room.customName || room.name}</span>
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDashboardClick(room)}
                          className="h-auto py-2 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                          title="Obrir dashboard"
                        >
                          <LayoutDashboard className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dashboard Modal */}
      {selectedRoom && (
        <RoomDashboard
          isOpen={isDashboardOpen}
          onClose={() => {
            setIsDashboardOpen(false);
            setSelectedRoom(null);
            setRoomDevices([]);
          }}
          roomName={selectedRoom.customName || selectedRoom.name}
          roomArea={selectedRoom.area}
          roomDevices={roomDevices}
          city={city}
          country={country}
        />
      )}
    </div>
  );
};

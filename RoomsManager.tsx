import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Pencil, Lightbulb, LightbulbOff, Loader2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Room {
  id?: string;
  name: string;
  customName?: string;
  level: string;
  area: number;
  maxOccupancy?: number;
  levelId?: string;
}

interface Device {
  id: string;
  device_id: string;
  brand: string;
  model: string;
}

interface RoomDevice {
  id: string;
  room_id: string;
  device_id: string;
  device_identifier: string | null;
  notes: string | null;
  meross_device_id: string | null;
  meross_channel: number | null;
  device?: Device;
}

interface RoomsManagerProps {
  centerId: string;
  extractedRooms: Room[];
  onExtractRooms: () => void;
}

export function RoomsManager({ centerId, extractedRooms, onExtractRooms }: RoomsManagerProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [roomDevices, setRoomDevices] = useState<Record<string, RoomDevice[]>>({});
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [newDeviceIdentifier, setNewDeviceIdentifier] = useState<string>("");
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRoomDevice, setEditingRoomDevice] = useState<RoomDevice | null>(null);
  const [isEditDeviceOpen, setIsEditDeviceOpen] = useState(false);
  const [togglingDevices, setTogglingDevices] = useState<Set<string>>(new Set());
  const [editFormData, setEditFormData] = useState({
    device_identifier: "",
    notes: "",
    meross_device_id: "",
    meross_channel: 0,
  });
  const [deviceStates, setDeviceStates] = useState<Record<string, boolean>>({});
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editCustomName, setEditCustomName] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (extractedRooms.length > 0) {
      setRooms(extractedRooms);
      loadRoomDevices();
    }
  }, [extractedRooms]);

  const loadDevices = async () => {
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .order("brand", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "No s'han pogut carregar els dispositius",
        variant: "destructive",
      });
      return;
    }

    setDevices(data || []);
  };

  const loadRoomDevices = async () => {
    try {
      console.log("[RoomsManager] Loading room devices for center:", centerId);
      
      // Get the building_id for this center
      const { data: buildings, error: buildingsError } = await supabase
        .from("buildings")
        .select("id")
        .eq("center_id", centerId)
        .limit(1);

      if (buildingsError || !buildings || buildings.length === 0) {
        console.log("[RoomsManager] No buildings found for center");
        return;
      }

      const buildingId = buildings[0].id;

      // Get all levels for this building
      const { data: levels, error: levelsError } = await supabase
        .from("levels")
        .select("id, name")
        .eq("building_id", buildingId);

      if (levelsError || !levels) {
        console.log("[RoomsManager] No levels found");
        return;
      }

      // Get all rooms for these levels with custom_name
      const { data: dbRooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name, custom_name, level_id, area, max_occupancy")
        .in("level_id", levels.map(l => l.id));

      if (roomsError || !dbRooms) {
        console.log("[RoomsManager] No rooms found");
        return;
      }

      console.log("[RoomsManager] Found rooms in DB:", dbRooms.length);

      // Update local rooms state with custom names and IDs from database
      setRooms(prevRooms => {
        return prevRooms.map(room => {
          const dbRoom = dbRooms.find(dr => dr.name === room.name);
          if (dbRoom) {
            return { 
              ...room, 
              id: dbRoom.id, 
              customName: dbRoom.custom_name || undefined,
              area: dbRoom.area || room.area,
              maxOccupancy: dbRoom.max_occupancy || room.maxOccupancy
            };
          }
          return room;
        });
      });

      // Get all room_devices for these rooms with inner join to ensure devices belong to user
      const { data: roomDevicesData, error: roomDevicesError } = await supabase
        .from("room_devices")
        .select(`
          id,
          room_id,
          device_id,
          device_identifier,
          notes,
          meross_device_id,
          meross_channel,
          devices!inner (
            id,
            device_id,
            brand,
            model
          )
        `)
        .in("room_id", dbRooms.map(r => r.id));

      if (roomDevicesError) {
        console.error("[RoomsManager] Error loading devices:", roomDevicesError);
        return;
      }

      console.log("[RoomsManager] Found room_devices:", roomDevicesData?.length || 0);

      // Group room_devices by room ID
      const devicesByRoomId: Record<string, RoomDevice[]> = {};
      
      roomDevicesData?.forEach((rd: any) => {
        const room = dbRooms.find(r => r.id === rd.room_id);
        if (room) {
          if (!devicesByRoomId[room.id]) {
            devicesByRoomId[room.id] = [];
          }
          devicesByRoomId[room.id].push({
            id: rd.id,
            room_id: rd.room_id,
            device_id: rd.device_id,
            device_identifier: rd.device_identifier,
            notes: rd.notes,
            meross_device_id: rd.meross_device_id,
            meross_channel: rd.meross_channel,
            device: rd.devices,
          });
        }
      });

      console.log("[RoomsManager] ✓ Dispositius agrupats per habitació:", Object.keys(devicesByRoomId).length);
      setRoomDevices(devicesByRoomId);
    } catch (error) {
      console.error("[RoomsManager] Error loading room devices:", error);
    }
  };

  const saveRoomsToDatabase = async () => {
    setIsSaving(true);
    try {
      // First, get or create building_id for this center
      let { data: buildings, error: buildingsError } = await supabase
        .from("buildings")
        .select("id")
        .eq("center_id", centerId)
        .limit(1);

      if (buildingsError) throw buildingsError;
      
      let buildingId: string;
      
      if (!buildings || buildings.length === 0) {
        // Create a default building for this center
        const { data: newBuilding, error: createBuildingError } = await supabase
          .from("buildings")
          .insert({
            center_id: centerId,
            name: "Edifici Principal",
          })
          .select()
          .single();

        if (createBuildingError) throw createBuildingError;
        buildingId = newBuilding.id;
      } else {
        buildingId = buildings[0].id;
      }

      // Get or create levels
      for (const room of rooms) {
        // Check if level exists
        let { data: existingLevel, error: levelError } = await supabase
          .from("levels")
          .select("id")
          .eq("building_id", buildingId)
          .eq("name", room.level)
          .limit(1);

        if (levelError) throw levelError;

        let levelId: string;
        if (existingLevel && existingLevel.length > 0) {
          levelId = existingLevel[0].id;
        } else {
          // Create new level
          const { data: newLevel, error: createLevelError } = await supabase
            .from("levels")
            .insert({
              building_id: buildingId,
              name: room.level,
              elevation: 0,
            })
            .select()
            .single();

          if (createLevelError) throw createLevelError;
          levelId = newLevel.id;
        }

        // Check if room already exists
        const { data: existingRoom, error: roomError } = await supabase
          .from("rooms")
          .select("id")
          .eq("level_id", levelId)
          .eq("name", room.name)
          .limit(1);

        if (roomError) throw roomError;

        if (!existingRoom || existingRoom.length === 0) {
          // Create room with all properties including max_occupancy
          await supabase.from("rooms").insert({
            level_id: levelId,
            name: room.name,
            area: room.area,
            max_occupancy: room.maxOccupancy,
          });
        } else {
          // Update existing room to include max_occupancy
          await supabase.from("rooms")
            .update({
              area: room.area,
              max_occupancy: room.maxOccupancy,
            })
            .eq("id", existingRoom[0].id);
        }
      }

      toast({
        title: "Èxit",
        description: "Habitacions guardades correctament",
      });
      
      // Reload room devices after saving
      loadRoomDevices();
    } catch (error) {
      console.error("Error saving rooms:", error);
      toast({
        title: "Error",
        description: "No s'han pogut guardar les habitacions",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateCustomName = async (roomId: string, customName: string) => {
    try {
      const trimmedName = customName.trim();
      
      // Find the room to get its original name
      const room = rooms.find(r => r.id === roomId);
      
      // Update in database using the room ID directly
      const { error } = await supabase
        .from("rooms")
        .update({ custom_name: trimmedName || null })
        .eq("id", roomId);

      if (error) throw error;

      // Update local state
      setRooms(rooms.map(r => 
        r.id === roomId 
          ? { ...r, customName: trimmedName || undefined }
          : r
      ));

      toast({
        title: "Nom actualitzat",
        description: trimmedName 
          ? "El nom personalitzat s'ha guardat correctament"
          : "S'ha restaurat el nom de l'IFC",
      });

      setEditingRoomId(null);
      setEditCustomName("");
      
      // Dispatch event to notify other components (XeokitViewer, RoomsNavigator, etc.)
      window.dispatchEvent(new CustomEvent("room-name-updated", {
        detail: {
          roomId: roomId,
          roomName: room?.name,
          customName: trimmedName || null
        }
      }));
      
      // Reload room devices to ensure consistency
      await loadRoomDevices();
    } catch (error) {
      console.error("Error updating room name:", error);
      toast({
        title: "Error",
        description: "No s'ha pogut actualitzar el nom de l'habitació",
        variant: "destructive",
      });
    }
  };

  const startEditingRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setEditCustomName(room.customName || "");
  };

  const cancelEditingRoom = () => {
    setEditingRoomId(null);
    setEditCustomName("");
  };

  const addDeviceToRoom = async () => {
    if (!selectedRoom || !selectedDeviceId) return;

    try {
      // Get or create building for this center
      let { data: buildings } = await supabase
        .from("buildings")
        .select("id")
        .eq("center_id", centerId)
        .limit(1);

      let buildingId: string;
      if (!buildings || buildings.length === 0) {
        // Create a default building for this center
        const { data: newBuilding, error: createBuildingError } = await supabase
          .from("buildings")
          .insert({
            center_id: centerId,
            name: "Edifici Principal",
          })
          .select()
          .single();

        if (createBuildingError) throw createBuildingError;
        buildingId = newBuilding.id;
      } else {
        buildingId = buildings[0].id;
      }

      // Get or create level
      let { data: levels } = await supabase
        .from("levels")
        .select("id")
        .eq("building_id", buildingId)
        .eq("name", selectedRoom.level)
        .limit(1);

      let levelId: string;
      if (!levels || levels.length === 0) {
        // Create new level
        const { data: newLevel, error: createLevelError } = await supabase
          .from("levels")
          .insert({
            building_id: buildingId,
            name: selectedRoom.level,
            elevation: 0,
          })
          .select()
          .single();

        if (createLevelError) throw createLevelError;
        levelId = newLevel.id;
      } else {
        levelId = levels[0].id;
      }

      // Get or create room
      let { data: dbRooms } = await supabase
        .from("rooms")
        .select("id")
        .eq("level_id", levelId)
        .eq("name", selectedRoom.name)
        .limit(1);

      let roomId: string;
      if (!dbRooms || dbRooms.length === 0) {
        // Create room automatically
        const { data: newRoom, error: createRoomError } = await supabase
          .from("rooms")
          .insert({
            level_id: levelId,
            name: selectedRoom.name,
            area: selectedRoom.area,
            max_occupancy: selectedRoom.maxOccupancy,
          })
          .select()
          .single();

        if (createRoomError) throw createRoomError;
        roomId = newRoom.id;
      } else {
        roomId = dbRooms[0].id;
      }

      // Add device to room
      const { error } = await supabase.from("room_devices").insert({
        room_id: roomId,
        device_id: selectedDeviceId,
        device_identifier: newDeviceIdentifier.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Èxit",
        description: "Dispositiu afegit a l'habitació",
      });

      setIsAddDeviceOpen(false);
      setSelectedDeviceId("");
      setNewDeviceIdentifier("");
      setSelectedRoom(null);
      
      // Reload room devices
      loadRoomDevices();
    } catch (error) {
      console.error("Error adding device:", error);
      toast({
        title: "Error",
        description: "No s'ha pogut afegir el dispositiu",
        variant: "destructive",
      });
    }
  };

  const removeDeviceFromRoom = async (roomDeviceId: string, roomId: string) => {
    try {
      const { error } = await supabase
        .from("room_devices")
        .delete()
        .eq("id", roomDeviceId);

      if (error) throw error;

      toast({
        title: "Èxit",
        description: "Dispositiu eliminat de l'habitació",
      });

      // Reload room devices to update state
      await loadRoomDevices();
    } catch (error) {
      console.error("Error removing device:", error);
      toast({
        title: "Error",
        description: "No s'ha pogut eliminar el dispositiu",
        variant: "destructive",
      });
    }
  };

  const openEditDeviceDialog = (roomDevice: RoomDevice) => {
    setEditingRoomDevice(roomDevice);
    setEditFormData({
      device_identifier: roomDevice.device_identifier || "",
      notes: roomDevice.notes || "",
      meross_device_id: roomDevice.meross_device_id || "",
      meross_channel: roomDevice.meross_channel || 0,
    });
    setIsEditDeviceOpen(true);
  };

  const updateRoomDevice = async () => {
    if (!editingRoomDevice) return;

    try {
      const { error } = await supabase
        .from("room_devices")
        .update({
          device_identifier: editFormData.device_identifier?.trim() || null,
          notes: editFormData.notes?.trim() || null,
          meross_device_id: editFormData.meross_device_id?.trim() || null,
          meross_channel: editFormData.meross_channel || 0,
        })
        .eq("id", editingRoomDevice.id);

      if (error) throw error;

      toast({
        title: "Èxit",
        description: "Dispositiu actualitzat correctament",
      });

      setIsEditDeviceOpen(false);
      setEditingRoomDevice(null);
      loadRoomDevices();
    } catch (error) {
      console.error("Error updating device:", error);
      toast({
        title: "Error",
        description: "No s'ha pogut actualitzar el dispositiu",
        variant: "destructive",
      });
    }
  };

  const toggleMerossDevice = async (roomDeviceId: string) => {
    try {
      const response = await supabase.functions.invoke('meross-control', {
        body: { action: 'toggle', roomDeviceId },
      });

      if (response.error) throw response.error;
      
      const data = response.data;
      if (!data.ok) {
        throw new Error(data.error || "Error al controlar el dispositiu");
      }

      // Update local state
      setDeviceStates(prev => ({
        ...prev,
        [roomDeviceId]: data.state === 'on',
      }));

      toast({
        title: "Èxit",
        description: `Dispositiu ${data.state === 'on' ? 'encès' : 'apagat'}`,
      });
    } catch (error: any) {
      console.error("Error toggling device:", error);
      toast({
        title: "Error",
        description: error.message || "No s'ha pogut controlar el dispositiu",
        variant: "destructive",
      });
    }
  };

  const loadDeviceState = async (roomDeviceId: string) => {
    try {
      const response = await supabase.functions.invoke('meross-control', {
        body: { action: 'state', roomDeviceId },
      });

      if (response.error) return;
      
      const data = response.data;
      if (data.ok) {
        setDeviceStates(prev => ({
          ...prev,
          [roomDeviceId]: data.isOn,
        }));
      }
    } catch (error) {
      // Silently fail for state loading
      console.error("Error loading device state:", error);
    }
  };

  // Load states for all devices with Meross config
  useEffect(() => {
    const devicesWithMeross = Object.values(roomDevices)
      .flat()
      .filter(rd => rd.meross_device_id);
    
    devicesWithMeross.forEach(rd => {
      loadDeviceState(rd.id);
    });
  }, [roomDevices]);

  // Group rooms by level
  const roomsByLevel = rooms.reduce((acc, room) => {
    if (!acc[room.level]) {
      acc[room.level] = [];
    }
    acc[room.level].push(room);
    return acc;
  }, {} as Record<string, Room[]>);

  // Sort levels from highest to lowest (assuming numeric level names or that can be sorted)
  const sortedLevels = Object.keys(roomsByLevel).sort((a, b) => {
    // Try to extract numeric values from level names
    const numA = parseFloat(a.match(/-?\d+(\.\d+)?/)?.[0] || "0");
    const numB = parseFloat(b.match(/-?\d+(\.\d+)?/)?.[0] || "0");
    return numB - numA; // Descending order (highest first)
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Gestió d'espais</h2>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Carrega un model IFC al visor per detectar automàticament els espais
        </div>
      ) : (
        <div className="space-y-6">
          {sortedLevels.map((level) => {
            const levelRooms = roomsByLevel[level];
            return (
            <div key={level} className="space-y-2">
              <h3 className="text-lg font-semibold bg-muted px-4 py-2 rounded-md">
                {level}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Nom</TableHead>
                    <TableHead className="w-[120px]">Superfície (m²)</TableHead>
                    <TableHead className="w-[120px]">Ocupació Màx.</TableHead>
                    <TableHead>Dispositius</TableHead>
                    <TableHead className="w-[140px]">Accions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levelRooms.map((room, index) => (
                    <TableRow key={`${level}-${index}`} className="group">
                      <TableCell className="font-medium min-w-[280px]">
                        {editingRoomId === room.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <Input
                              value={editCustomName}
                              onChange={(e) => setEditCustomName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateCustomName(room.id!, editCustomName);
                                } else if (e.key === 'Escape') {
                                  cancelEditingRoom();
                                }
                              }}
                              placeholder="Nom personalitzat (prem Enter per guardar)"
                              className="flex-1"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateCustomName(room.id!, editCustomName)}
                              className="h-8 w-8 p-0 shrink-0"
                              title="Guardar"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditingRoom}
                              className="h-8 w-8 p-0 shrink-0"
                              title="Cancel·lar"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{room.customName || room.name}</span>
                              {room.customName && (
                                <span className="text-xs text-muted-foreground block">
                                  IFC: {room.name}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingRoom(room)}
                              className="h-8 w-8 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Editar nom"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{room.area.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={room.maxOccupancy || ""}
                          onChange={(e) => {
                            const newRooms = [...rooms];
                            const roomIndex = newRooms.findIndex(
                              r => r.name === room.name && r.level === room.level
                            );
                            if (roomIndex !== -1) {
                              newRooms[roomIndex].maxOccupancy = parseInt(e.target.value) || undefined;
                              setRooms(newRooms);
                            }
                          }}
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {room.id && roomDevices[room.id]?.map((rd) => (
                            <div key={rd.id} className="flex items-start gap-2 p-3 border rounded-lg bg-secondary/30 hover:bg-secondary/40 transition-colors">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">
                                    {rd.device?.brand} {rd.device?.model}
                                  </span>
                                  {rd.device_identifier && (
                                    <Badge variant="outline" className="text-xs font-mono">
                                      ID: {rd.device_identifier}
                                    </Badge>
                                  )}
                                  {rd.meross_device_id ? (
                                    <Badge className="text-xs bg-green-600 hover:bg-green-700">
                                      <Lightbulb className="w-3 h-3 mr-1" />
                                      Meross configurat
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      Meross no configurat
                                    </Badge>
                                  )}
                                </div>
                                {rd.notes && (
                                  <p className="text-xs text-muted-foreground">{rd.notes}</p>
                                )}
                              </div>
                              <div className="flex gap-1 items-start">
                                {rd.meross_device_id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-9 w-9 p-0 border-2 transition-all ${
                                      deviceStates[rd.id] 
                                        ? 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600 text-white' 
                                        : 'bg-background hover:bg-secondary border-border'
                                    }`}
                                    onClick={() => {
                                      setTogglingDevices(prev => new Set(prev).add(rd.id));
                                      toggleMerossDevice(rd.id).finally(() => {
                                        setTogglingDevices(prev => {
                                          const next = new Set(prev);
                                          next.delete(rd.id);
                                          return next;
                                        });
                                      });
                                    }}
                                    disabled={togglingDevices.has(rd.id)}
                                    title={deviceStates[rd.id] ? "Apagar" : "Encendre"}
                                  >
                                    {togglingDevices.has(rd.id) ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : deviceStates[rd.id] ? (
                                      <Lightbulb className="w-4 h-4 fill-current" />
                                    ) : (
                                      <LightbulbOff className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-9 p-0"
                                  onClick={() => openEditDeviceDialog(rd)}
                                  title="Editar dispositiu"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-9 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => removeDeviceFromRoom(rd.id, room.id!)}
                                  title="Eliminar dispositiu"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog open={isAddDeviceOpen && selectedRoom?.name === room.name} onOpenChange={(open) => {
                          setIsAddDeviceOpen(open);
                          if (open) setSelectedRoom(room);
                          else {
                            setSelectedRoom(null);
                            setSelectedDeviceId("");
                            setNewDeviceIdentifier("");
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="default" 
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Dispositiu
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Afegir Dispositiu a {selectedRoom?.customName || selectedRoom?.name || room.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Selecciona un dispositiu</Label>
                                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Tria un dispositiu" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {devices.map((device) => (
                                      <SelectItem key={device.id} value={device.id}>
                                        {device.brand} {device.model} ({device.device_id})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="new_device_identifier">Nom identificatiu</Label>
                                <Input
                                  id="new_device_identifier"
                                  value={newDeviceIdentifier}
                                  onChange={(e) => setNewDeviceIdentifier(e.target.value)}
                                  placeholder="Ex: Impressora 3D, Endoll Principal..."
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Aquest nom apareixerà al dashboard de l'estança
                                </p>
                              </div>
                              <Button onClick={addDeviceToRoom} disabled={!selectedDeviceId}>
                                Afegir
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            );
          })}
        </div>
      )}

      {/* Edit Device Dialog */}
      <Dialog open={isEditDeviceOpen} onOpenChange={setIsEditDeviceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Dispositiu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipus de Dispositiu</Label>
              <p className="text-sm font-medium mt-1">
                {editingRoomDevice?.device?.brand} {editingRoomDevice?.device?.model}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="device_identifier">ID del Dispositiu</Label>
              <Input
                id="device_identifier"
                value={editFormData.device_identifier}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, device_identifier: e.target.value })
                }
                placeholder="Introdueix l'ID del dispositiu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Comentaris</Label>
              <Textarea
                id="notes"
                value={editFormData.notes}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, notes: e.target.value })
                }
                placeholder="Notes sobre aquest dispositiu"
                rows={3}
              />
            </div>
            
            {/* Meross Configuration - SIMPLIFICAT */}
            <div className="border-t pt-4 space-y-3 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-base font-semibold text-amber-900 dark:text-amber-100">
                    Control Remot Meross
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configura l'UUID del teu endoll per veure el botó de control 💡
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="meross_device_id" className="text-sm font-medium">
                  UUID del dispositiu Meross
                </Label>
                <Input
                  id="meross_device_id"
                  value={editFormData.meross_device_id || ''}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, meross_device_id: e.target.value.trim() })
                  }
                  placeholder="2307060288289725448548e1e9153ae6"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  📱 El trobaràs a l'app Meross (comença amb 2307...)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meross_channel" className="text-sm font-medium">
                  Canal <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="meross_channel"
                  type="number"
                  min="0"
                  max="10"
                  value={editFormData.meross_channel ?? 0}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, meross_channel: parseInt(e.target.value) || 0 })
                  }
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Normalment 0 per endolls individuals
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDeviceOpen(false);
                setEditingRoomDevice(null);
              }}
            >
              Cancel·lar
            </Button>
            <Button onClick={updateRoomDevice}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

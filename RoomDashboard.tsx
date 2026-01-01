import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Clock } from 'lucide-react';
import { DeviceWidget } from './DeviceWidget';
import { supabase } from '@/integrations/supabase/client';

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

interface WeatherData {
  temperature: number | null;
  humidity: number | null;
}

interface RoomDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  roomArea?: number;
  roomDevices: RoomDevice[];
  city?: string;
  country?: string;
}

export function RoomDashboard({ isOpen, onClose, roomName, roomArea, roomDevices, city, country }: RoomDashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Actualizar reloj cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      if (!city || !country) return;
      try {
        const { data, error } = await supabase.functions.invoke("weather", {
          body: { city, country },
        });
        if (error) throw error;
        setWeather({
          temperature: data?.temperature ?? null,
          humidity: data?.humidity ?? null,
        });
      } catch (err) {
        console.warn("[Weather] Error:", err);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, [city, country]);

  const formatTime = () => {
    return currentTime.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('es-ES', { 
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-slate-700 overflow-hidden">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50"
          onClick={onClose}
        >
          <X className="h-6 w-6 text-red-500" />
        </Button>

        {/* Content */}
        <div className="h-full overflow-y-auto p-6">
          {/* Header - Main Panel */}
          <div className="mb-4">
            <Card className="bg-gradient-to-br from-slate-800/80 to-slate-700/80 dark:from-slate-900/80 dark:to-slate-800/80 border-slate-600 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">{roomName}</h1>
                  {roomArea && (
                    <p className="text-slate-300 text-sm">Àrea: {roomArea.toFixed(2)} m²</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <div className="text-3xl font-bold text-white font-mono">{formatTime()}</div>
                  </div>
                  <div className="text-slate-300 text-sm">{formatDate()}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Interior Section - Only show if devices exist */}
          {roomDevices.length > 0 && (
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white mb-3">Interior</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {roomDevices.map((rd) => {
                  const deviceType = rd.device?.device_types?.name || 'Unknown';
                  const brand = rd.device?.brand || '';
                  const model = rd.device?.model || '';
                  const deviceName = rd.device_identifier || '';
                  const isOn = rd.is_on ?? false;
                  
                  return (
                    <DeviceWidget
                      key={rd.id}
                      deviceType={deviceType}
                      deviceName={deviceName}
                      brand={brand}
                      model={model}
                      initialIsOn={isOn}
                      roomDeviceId={rd.id}
                      onChange={(value) => {
                        console.log(`Device ${rd.id} changed to:`, value);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Exterior Section */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Exterior</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {/* Weather Widget */}
              <Card className="bg-gradient-to-br from-blue-900/80 to-blue-800/80 dark:from-blue-950/80 dark:to-blue-900/80 border-blue-700 p-3 flex flex-col justify-between min-h-[160px]">
                <div>
                  <h3 className="text-white font-semibold text-xs mb-1">Clima Exterior</h3>
                  <p className="text-slate-400 text-xs mb-2">{city || 'Exterior'}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-xs">Temperatura:</span>
                    <span className="text-white font-mono text-lg">
                      {weather?.temperature !== null && weather?.temperature !== undefined
                        ? `${weather.temperature.toFixed(1)}°C`
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-xs">Humitat:</span>
                    <span className="text-white font-mono text-lg">
                      {weather?.humidity !== null && weather?.humidity !== undefined
                        ? `${weather.humidity.toFixed(0)}%`
                        : '--'}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Footer info */}
          <div className="mt-3 text-center">
            <p className="text-slate-400 text-xs">
              Total dispositius: {roomDevices.length}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

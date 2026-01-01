import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface WeatherData {
  city: string;
  timezone: string;
  temperature: number | null;
  humidity: number | null;
  units: {
    temperature: string;
    humidity: string;
  };
}

interface AirData {
  co: number | null;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  aqi_eu: number | null;
  aqi_us: number | null;
  units: {
    carbon_monoxide: string;
    pm2_5: string;
    pm10: string;
    ozone: string;
    nitrogen_dioxide: string;
    sulphur_dioxide: string;
  };
}

const LS_VISIBLE = "weather.visible";
const LS_MODE = "envMode";

interface WeatherWidgetProps {
  city?: string;
  country?: string;
  visible?: boolean;
  onTemperatureChange?: (temp: number) => void;
}

export function WeatherWidget({ city, country, visible = true, onTemperatureChange }: WeatherWidgetProps) {
  const [localVisible, setLocalVisible] = useState(() => {
    const saved = localStorage.getItem(LS_VISIBLE);
    return saved === null ? true : saved === "true";
  });
  const [extended, setExtended] = useState(() => {
    const saved = localStorage.getItem(LS_MODE);
    return saved === "extended";
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [air, setAir] = useState<AirData | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  const formatTime = useCallback((timezone: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: timezone,
      }).format(new Date());
    } catch {
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    if (!city || !country) return;
    try {
      const { data, error } = await supabase.functions.invoke("weather", {
        body: { city, country },
      });
      if (error) throw error;
      setWeather(data);
      // Update temperature for measurements
      if (data?.temperature !== null && data?.temperature !== undefined && onTemperatureChange) {
        onTemperatureChange(data.temperature);
      }
    } catch (err) {
      console.warn("[Weather] Error:", err);
    }
  }, [city, country, onTemperatureChange]);

  const fetchAir = useCallback(async () => {
    if (!city || !country) return;
    try {
      const { data, error } = await supabase.functions.invoke("air", {
        body: { city, country },
      });
      if (error) throw error;
      setAir(data);
    } catch (err) {
      console.warn("[Air] Error:", err);
    }
  }, [city, country]);

  useEffect(() => {
    fetchWeather();
    fetchAir();
    const weatherInterval = setInterval(fetchWeather, 5 * 60 * 1000);
    const airInterval = setInterval(fetchAir, 5 * 60 * 1000);
    return () => {
      clearInterval(weatherInterval);
      clearInterval(airInterval);
    };
  }, [fetchWeather, fetchAir]);

  useEffect(() => {
    const updateClock = () => {
      if (weather?.timezone) {
        setCurrentTime(formatTime(weather.timezone));
      }
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, [weather?.timezone, formatTime]);

  const toggleVisible = () => {
    const newVisible = !localVisible;
    setLocalVisible(newVisible);
    localStorage.setItem(LS_VISIBLE, String(newVisible));
  };

  const toggleMode = () => {
    const newExtended = !extended;
    setExtended(newExtended);
    localStorage.setItem(LS_MODE, newExtended ? "extended" : "simple");
  };

  // Don't show if no city/country provided or not visible
  if (!city || !country || !visible) {
    return null;
  }

  if (!localVisible) {
    return (
      <Button
        onClick={toggleVisible}
        variant="outline"
        size="sm"
        className="absolute top-[116px] right-4 z-10"
      >
        Mostrar Meteo
      </Button>
    );
  }

  return (
    <Card className="absolute top-[116px] right-4 z-10 p-4 min-w-[280px] bg-card/95 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">{weather?.city || city}</h3>
          <p className="text-xs text-muted-foreground">{currentTime}</p>
        </div>
        <div className="flex gap-1">
          <Button onClick={toggleMode} variant="ghost" size="sm">
            {extended ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button onClick={toggleVisible} variant="ghost" size="sm">
            ✕
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Temperatura:</span>
          <span className="font-medium">
            {weather?.temperature !== null && weather?.temperature !== undefined
              ? `${weather.temperature.toFixed(1)} ${weather.units.temperature}`
              : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Humitat:</span>
          <span className="font-medium">
            {weather?.humidity !== null && weather?.humidity !== undefined
              ? `${weather.humidity.toFixed(0)} ${weather.units.humidity}`
              : "--"}
          </span>
        </div>

        {extended && air && (
          <>
            <div className="border-t border-border my-3 pt-3">
              <h4 className="text-xs font-semibold mb-2">Qualitat de l'aire</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CO:</span>
                  <span>{air.co !== null && air.co !== undefined ? `${air.co.toFixed(0)} ${air.units.carbon_monoxide}` : "--"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PM2.5:</span>
                  <span>{air.pm25 !== null && air.pm25 !== undefined ? `${air.pm25.toFixed(0)} ${air.units.pm2_5}` : "--"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PM10:</span>
                  <span>{air.pm10 !== null && air.pm10 !== undefined ? `${air.pm10.toFixed(0)} ${air.units.pm10}` : "--"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">O₃:</span>
                  <span>{air.o3 !== null && air.o3 !== undefined ? `${air.o3.toFixed(0)} ${air.units.ozone}` : "--"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NO₂:</span>
                  <span>{air.no2 !== null && air.no2 !== undefined ? `${air.no2.toFixed(0)} ${air.units.nitrogen_dioxide}` : "--"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SO₂:</span>
                  <span>{air.so2 !== null && air.so2 !== undefined ? `${air.so2.toFixed(0)} ${air.units.sulphur_dioxide}` : "--"}</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-border flex justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">AQI EU:</span>
                  <span className="ml-2 font-medium">{air.aqi_eu ?? "--"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">AQI US:</span>
                  <span className="ml-2 font-medium">{air.aqi_us ?? "--"}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface DeviceWidgetProps {
  deviceType: string;
  deviceName: string;
  brand?: string;
  model?: string;
  initialValue?: number;
  initialIsOn?: boolean;
  roomDeviceId?: string;
  onChange?: (value: number | boolean) => void;
}

export function DeviceWidget({ deviceType, deviceName, brand, model, initialValue, initialIsOn = false, roomDeviceId, onChange }: DeviceWidgetProps) {
  const [value, setValue] = useState<number>(initialValue || 0);
  const [isOn, setIsOn] = useState<boolean>(initialIsOn);

  // Use real brand and model from database
  const displayBrand = brand && brand.trim() !== '' ? brand : 'Dispositiu';
  const displayModel = model && model.trim() !== '' ? model : 'Genèric';

  // Save state to database when isOn changes
  useEffect(() => {
    const saveState = async () => {
      if (!roomDeviceId) return;
      
      try {
        const { error } = await supabase
          .from('room_devices')
          .update({ is_on: isOn })
          .eq('id', roomDeviceId);
        
        if (error) {
          console.error('[DeviceWidget] Error saving state:', error);
        } else {
          console.log('[DeviceWidget] State saved:', { roomDeviceId, isOn });
        }
      } catch (err) {
        console.error('[DeviceWidget] Exception saving state:', err);
      }
    };

    saveState();
  }, [isOn, roomDeviceId]);

  // Initialize with slightly different values for each device
  useEffect(() => {
    let initialVal = 0;
    switch (deviceType) {
      case 'Sensor de Temperatura':
        initialVal = 20 + Math.random() * 6; // 20-26°C
        break;
      case 'Sensor de Humedad':
        initialVal = 45 + Math.random() * 25; // 45-70%
        break;
      case 'Sensor de CO2':
        initialVal = 400 + Math.random() * 400; // 400-800 ppm
        break;
      case 'Sensor de CO':
        initialVal = 10 + Math.random() * 20; // 10-30 ppm
        break;
      case 'Termostato':
        initialVal = 20 + Math.random() * 3; // 20-23°C
        break;
      case 'Interruptor Inteligente':
        // Use initial state from database, don't randomize
        initialVal = Math.random() * 100; // For brightness
        break;
      case 'Enchufe Inteligente':
        // Use initial state from database, don't randomize
        break;
      case 'Alarma':
      case 'Alarma de Intrusión':
      case 'Alarma de Incendios':
        // Use initial state from database, don't randomize
        break;
      case 'Válvula':
      case 'Vàlvula':
        // Use initial state from database, don't randomize
        break;
      default:
        initialVal = 0;
    }
    setValue(initialVal);
  }, [deviceType]);

  // Simulate realistic gradual changes every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setValue((prevValue) => {
        let change = 0;
        let newValue = prevValue;

        switch (deviceType) {
          case 'Sensor de Temperatura':
            // Change by ±0.1 to ±0.3°C
            change = (Math.random() - 0.5) * 0.6;
            newValue = Math.max(18, Math.min(28, prevValue + change));
            break;
          case 'Sensor de Humedad':
            // Change by ±0.5 to ±2%
            change = (Math.random() - 0.5) * 4;
            newValue = Math.max(40, Math.min(80, prevValue + change));
            break;
          case 'Sensor de CO2':
            // Change by ±5 to ±20 ppm
            change = (Math.random() - 0.5) * 40;
            newValue = Math.max(350, Math.min(1200, prevValue + change));
            break;
          case 'Sensor de CO':
            // Change by ±0.5 to ±2 ppm
            change = (Math.random() - 0.5) * 4;
            newValue = Math.max(5, Math.min(50, prevValue + change));
            break;
          case 'Termostato':
            // Change by ±0.1°C
            change = (Math.random() - 0.5) * 0.2;
            newValue = Math.max(18, Math.min(26, prevValue + change));
            break;
          default:
            newValue = prevValue;
        }

        return newValue;
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [deviceType]);

  // Render functions for each device type
  const renderTemperatureSensor = () => (
    <Card className="bg-gradient-to-br from-red-900/80 to-orange-800/80 dark:from-red-950/80 dark:to-orange-900/80 border-red-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center">
        <div className="text-white text-3xl font-bold font-mono">{value.toFixed(1)}°C</div>
      </div>
    </Card>
  );

  const renderHumiditySensor = () => (
    <Card className="bg-gradient-to-br from-blue-900/80 to-cyan-800/80 dark:from-blue-950/80 dark:to-cyan-900/80 border-blue-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center">
        <div className="text-white text-3xl font-bold font-mono">{value.toFixed(0)}%</div>
      </div>
    </Card>
  );

  const renderCO2Sensor = () => (
    <Card className="bg-gradient-to-br from-green-900/80 to-emerald-800/80 dark:from-green-950/80 dark:to-emerald-900/80 border-green-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center">
        <div className="text-white text-3xl font-bold font-mono">{value.toFixed(0)}</div>
        <div className="text-slate-300 text-xs mt-1">ppm</div>
      </div>
    </Card>
  );

  const renderCOSensor = () => (
    <Card className="bg-gradient-to-br from-yellow-900/80 to-amber-800/80 dark:from-yellow-950/80 dark:to-amber-900/80 border-yellow-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center">
        <div className="text-white text-3xl font-bold font-mono">{value.toFixed(0)}</div>
        <div className="text-slate-300 text-xs mt-1">ppm</div>
      </div>
    </Card>
  );

  const renderSmartPlug = () => (
    <Card className="bg-gradient-to-br from-purple-900/80 to-pink-800/80 dark:from-purple-950/80 dark:to-pink-900/80 border-purple-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-green-500' : 'bg-red-500'} shadow-lg`} />
          <Switch
            checked={isOn}
            onCheckedChange={(checked) => {
              setIsOn(checked);
              onChange?.(checked ? 1 : 0);
            }}
            className="scale-110"
          />
        </div>
        <p className="text-white text-xs">{isOn ? 'Encès' : 'Apagat'}</p>
      </div>
    </Card>
  );

  const renderSmartLight = () => (
    <Card className="bg-gradient-to-br from-yellow-900/80 to-amber-800/80 dark:from-yellow-950/80 dark:to-amber-900/80 border-yellow-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="space-y-2">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-green-500' : 'bg-red-500'} shadow-lg`} />
            <Switch
              checked={isOn}
              onCheckedChange={(checked) => {
                setIsOn(checked);
                onChange?.(checked ? value : 0);
              }}
              className="scale-90"
            />
          </div>
          <p className="text-white text-xs">{isOn ? 'Encesa' : 'Apagada'}</p>
        </div>
        {isOn && (
          <div className="space-y-1">
            <Label className="text-white text-xs">Intensitat: {value}%</Label>
            <Slider
              value={[value]}
              onValueChange={([newValue]) => {
                setValue(newValue);
                onChange?.(newValue);
              }}
              min={0}
              max={100}
              step={1}
            />
          </div>
        )}
      </div>
    </Card>
  );

  const renderThermostat = () => (
    <Card className="bg-gradient-to-br from-orange-900/80 to-red-800/80 dark:from-orange-950/80 dark:to-red-900/80 border-orange-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center">
        <div className="text-white text-3xl font-bold font-mono">{value.toFixed(1)}°C</div>
        <div className="flex gap-1 justify-center mt-2">
          <button 
            className="px-2 py-1 bg-blue-500/30 text-white text-xs rounded"
            onClick={() => {
              const newValue = value - 0.5;
              setValue(newValue);
              onChange?.(newValue);
            }}
          >
            -
          </button>
          <button 
            className="px-2 py-1 bg-red-500/30 text-white text-xs rounded"
            onClick={() => {
              const newValue = value + 0.5;
              setValue(newValue);
              onChange?.(newValue);
            }}
          >
            +
          </button>
        </div>
      </div>
    </Card>
  );

  const renderAlarm = () => (
    <Card className="bg-gradient-to-br from-red-900/80 to-pink-800/80 dark:from-red-950/80 dark:to-pink-900/80 border-red-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-green-500' : 'bg-red-500'} shadow-lg`} />
          <Switch
            checked={isOn}
            onCheckedChange={(checked) => {
              setIsOn(checked);
              onChange?.(checked ? 1 : 0);
            }}
            className="scale-90"
          />
        </div>
        <p className="text-white text-xs">{isOn ? 'Armada' : 'Desarmada'}</p>
      </div>
    </Card>
  );

  const renderValve = () => (
    <Card className="bg-gradient-to-br from-cyan-900/80 to-blue-800/80 dark:from-cyan-950/80 dark:to-blue-900/80 border-cyan-700 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-green-500' : 'bg-red-500'} shadow-lg`} />
          <Switch
            checked={isOn}
            onCheckedChange={(checked) => {
              setIsOn(checked);
              onChange?.(checked ? 1 : 0);
            }}
            className="scale-90"
          />
        </div>
        <p className="text-white text-xs">{isOn ? 'Oberta' : 'Tancada'}</p>
      </div>
    </Card>
  );

  const renderGenericDevice = () => (
    <Card className="bg-gradient-to-br from-slate-800/80 to-slate-700/80 dark:from-slate-900/80 dark:to-slate-800/80 border-slate-600 p-3 flex flex-col justify-between min-h-[160px]">
      <div>
        {deviceName && <h3 className="text-white font-bold text-sm mb-1">{deviceName}</h3>}
        <h3 className="text-white font-semibold text-xs mb-1">{deviceType}</h3>
        <p className="text-slate-300 text-xs">{displayBrand}</p>
        <p className="text-slate-400 text-xs mb-2">{displayModel}</p>
      </div>
      <div className="text-center">
        <div className="text-white text-xs">Dispositiu Configurat</div>
      </div>
    </Card>
  );

  // Renderizar según el tipo de dispositivo
  switch (deviceType) {
    case 'Sensor de Temperatura':
      return renderTemperatureSensor();
    case 'Sensor de Humedad':
      return renderHumiditySensor();
    case 'Sensor de CO2':
      return renderCO2Sensor();
    case 'Sensor de CO':
      return renderCOSensor();
    case 'Interruptor Inteligente':
      return renderSmartLight();
    case 'Enchufe Inteligente':
      return renderSmartPlug();
    case 'Termostato':
      return renderThermostat();
    case 'Alarma':
    case 'Alarma de Intrusión':
    case 'Alarma de Incendios':
      return renderAlarm();
    case 'Válvula':
    case 'Vàlvula':
      return renderValve();
    default:
      return renderGenericDevice();
  }
}

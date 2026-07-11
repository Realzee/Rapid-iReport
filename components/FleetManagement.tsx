import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Navigation, 
  Play, 
  Square, 
  Settings, 
  Terminal, 
  Send, 
  RefreshCw, 
  AlertTriangle, 
  Activity, 
  FileText, 
  Compass, 
  Battery, 
  Zap, 
  Info,
  Sliders,
  Power,
  RotateCw,
  Gauge
} from 'lucide-react';
import { Profile } from '../types';
import { useToast } from '../contexts/ToastContext';

// Interfaces for our simulated Fleet
interface TK116Device {
  id: string;
  name: string;
  plate: string;
  imei: string;
  status: 'moving' | 'stationary' | 'offline';
  lat: number;
  lng: number;
  speed: number;
  course: number;
  batteryVoltage: number; // in mV, e.g. 12400mV
  batteryPercent: number; // e.g. 85%
  accStatus: boolean; // Ignition ON/OFF
  fuelCut: boolean; // Relay ON/OFF (Fuel Cut Triggered)
  mileage: number; // in meters
  fuelLevel: number; // in percentage
  lastUpdate: string;
  speedLimit: number; // custom speed limit set by command
  pathHistory: [number, number][];
  alerts: string[];
}

interface RawPacket {
  id: string;
  timestamp: string;
  imei: string;
  direction: 'UP' | 'DOWN';
  pid: string; // "0x01", "0x03", "0x12", "0x15", "0x80", etc.
  pidName: string; // e.g. "Location Package", "Command Package"
  rawHex: string;
  decoded: Record<string, any>;
}

// Coordinate paths for continuous simulation loop around JHB
const JOHANNESBURG_PATHS: Record<string, [number, number][]> = {
  alpha: [
    [-26.2041, 28.0473], [-26.2010, 28.0490], [-26.1980, 28.0515], [-26.1950, 28.0540],
    [-26.1910, 28.0565], [-26.1880, 28.0550], [-26.1850, 28.0510], [-26.1840, 28.0460],
    [-26.1860, 28.0410], [-26.1895, 28.0380], [-26.1930, 28.0375], [-26.1970, 28.0400],
    [-26.2010, 28.0435], [-26.2041, 28.0473]
  ],
  bravo: [
    [-26.2580, 27.8520], [-26.2590, 27.8540], [-26.2610, 27.8560], [-26.2630, 27.8590],
    [-26.2650, 27.8620], [-26.2660, 27.8600], [-26.2640, 27.8550], [-26.2610, 27.8510],
    [-26.2580, 27.8520]
  ],
  supervisor: [
    [-26.1076, 28.0567], [-26.1040, 28.0610], [-26.1010, 28.0670], [-26.0980, 28.0720],
    [-26.0950, 28.0700], [-26.0970, 28.0650], [-26.1010, 28.0590], [-26.1045, 28.0540],
    [-26.1076, 28.0567]
  ],
  armed: [
    [-26.1243, 28.1022], [-26.1265, 28.1060], [-26.1290, 28.1110], [-26.1320, 28.1150],
    [-26.1350, 28.1120], [-26.1330, 28.1070], [-26.1295, 28.1010], [-26.1260, 28.0980],
    [-26.1243, 28.1022]
  ]
};

// Component to dynamically adjust map view when a vehicle is selected
const MapCenterController: React.FC<{ coords: [number, number]; zoom?: number }> = ({ coords, zoom = 14 }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(coords, zoom, { animate: true });
  }, [coords, map, zoom]);
  return null;
};

// Hex helper functions
const toHex8 = (val: number): string => {
  const v = Math.max(0, Math.min(255, Math.floor(val)));
  return v.toString(16).padStart(2, '0').toUpperCase();
};

const toHex16 = (val: number): string => {
  const v = Math.max(0, Math.min(65535, Math.floor(val)));
  return v.toString(16).padStart(4, '0').toUpperCase();
};

const toHex32 = (val: number): string => {
  const v = Math.max(0, Math.min(4294967295, Math.floor(val)));
  return v.toString(16).padStart(8, '0').toUpperCase();
};

const stringToHex = (str: string): string => {
  return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join('');
};

interface FleetManagementProps {
  profile: Profile;
}

export const FleetManagement: React.FC<FleetManagementProps> = ({ profile }) => {
  const { addToast } = useToast();
  const [vehicles, setVehicles] = useState<TK116Device[]>([
    {
      id: '1',
      name: 'Armed Response 1',
      plate: 'HW82GP-GP',
      imei: '354188046036385',
      status: 'moving',
      lat: -26.2041,
      lng: 28.0473,
      speed: 48,
      course: 145,
      batteryVoltage: 12600,
      batteryPercent: 96,
      accStatus: true,
      fuelCut: false,
      mileage: 142850,
      fuelLevel: 82,
      lastUpdate: new Date().toLocaleTimeString(),
      speedLimit: 120,
      pathHistory: [[-26.2041, 28.0473]],
      alerts: []
    },
    {
      id: '2',
      name: 'Supervisor Unit',
      plate: 'TX11GP-GP',
      imei: '354188046036393',
      status: 'moving',
      lat: -26.1076,
      lng: 28.0567,
      speed: 64,
      course: 60,
      batteryVoltage: 13200,
      batteryPercent: 99,
      accStatus: true,
      fuelCut: false,
      mileage: 210450,
      fuelLevel: 58,
      lastUpdate: new Date().toLocaleTimeString(),
      speedLimit: 120,
      pathHistory: [[-26.1076, 28.0567]],
      alerts: []
    },
    {
      id: '3',
      name: 'Patrol Cruiser Alpha',
      plate: 'BB44GP-GP',
      imei: '354188046036401',
      status: 'stationary',
      lat: -26.2580,
      lng: 27.8520,
      speed: 0,
      course: 0,
      batteryVoltage: 11900,
      batteryPercent: 78,
      accStatus: false,
      fuelCut: false,
      mileage: 89400,
      fuelLevel: 45,
      lastUpdate: new Date().toLocaleTimeString(),
      speedLimit: 120,
      pathHistory: [[-26.2580, 27.8520]],
      alerts: []
    },
    {
      id: '4',
      name: 'Community Patrol Unit B',
      plate: 'VV71GP-GP',
      imei: '354188046036419',
      status: 'moving',
      lat: -26.1243,
      lng: 28.1022,
      speed: 128, // Speeding warning!
      course: 220,
      batteryVoltage: 12400,
      batteryPercent: 88,
      accStatus: true,
      fuelCut: false,
      mileage: 114300,
      fuelLevel: 71,
      lastUpdate: new Date().toLocaleTimeString(),
      speedLimit: 100,
      pathHistory: [[-26.1243, 28.1022]],
      alerts: ['High Speed Alert']
    },
    {
      id: '5',
      name: 'Tactical Support Vehicle',
      plate: 'ZZ99GP-GP',
      imei: '354188046036427',
      status: 'offline',
      lat: -26.1850,
      lng: 28.0350,
      speed: 0,
      course: 270,
      batteryVoltage: 0,
      batteryPercent: 0,
      accStatus: false,
      fuelCut: false,
      mileage: 320100,
      fuelLevel: 14,
      lastUpdate: 'Yesterday 18:42',
      speedLimit: 120,
      pathHistory: [[-26.1850, 28.0350]],
      alerts: ['Power Cut-off Alert']
    }
  ]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('1');
  const [activeSubTab, setActiveSubTab] = useState<'map' | 'simulator' | 'terminal'>('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [rawPackets, setRawPackets] = useState<RawPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<RawPacket | null>(null);
  
  // Simulator command state
  const [simCommand, setSimCommand] = useState<string>('RESET#');
  const [simCustomParam, setSimCustomParam] = useState<string>('');
  const [simLogs, setSimLogs] = useState<{ time: string; text: string; type: 'info' | 'out' | 'in' | 'error' }[]>([]);
  const [isTransmitting, setIsSimTransmitting] = useState(false);
  const [generatedHexCmd, setGeneratedHexCmd] = useState<string>('');
  const [responseHexCmd, setResponseHexCmd] = useState<string>('');
  const [simSequence, setSimSequence] = useState<number>(101);

  // References for periodic counters
  const simSequenceRef = useRef(101);
  const pathIndices = useRef<Record<string, number>>({ alpha: 0, bravo: 0, supervisor: 0, armed: 0 });

  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => 
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.imei.includes(searchTerm)
    );
  }, [vehicles, searchTerm]);

  // Terminal autoscroll helper
  const terminalEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rawPackets]);

  // Helper to generate beautifully parsed/formatted Eelink Hex Packets
  const generateEelinkPacket = (type: string, device: TK116Device, seq: number): RawPacket => {
    const timestamp = new Date().toLocaleTimeString();
    let rawHex = '';
    let decoded: Record<string, any> = {};
    let pidName = '';

    const mark = '6767';
    const seqHex = toHex16(seq);

    switch (type) {
      case '0x01': { // Login
        pidName = 'Login Package';
        const imeiHex = stringToHex(device.imei.slice(0, 8)); // Mock IMEIBcd/Hex
        const sizeHex = toHex16(16); // Size of Sequence and Content (Sequence(2) + IMEI(8) + Language(1) + Timezone(1) + SysVer(2) + AppVer(2) = 16)
        rawHex = `${mark}01${sizeHex}${seqHex}${imeiHex}010002050205`;
        decoded = {
          Mark: '0x67 0x67',
          PID: '0x01 (Login)',
          Size: 16,
          Sequence: seq,
          IMEI: device.imei,
          Language: '0x01 (English)',
          Timezone: 'UTC+0',
          'System Version': 'V2.0.5',
          'Application Version': 'V2.0.5'
        };
        break;
      }
      case '0x03': { // Heartbeat
        pidName = 'Heartbeat Package';
        const sizeHex = toHex16(4); // Sequence(2) + Status(2) = 4
        // Status bits: ACC, Engine fired, Designed for car, GPS fixed, etc.
        const statusVal = (device.accStatus ? 4 : 0) | (device.speed > 0 ? 1 : 0) | 2; 
        const statusHex = toHex16(statusVal);
        rawHex = `${mark}03${sizeHex}${seqHex}${statusHex}`;
        decoded = {
          Mark: '0x67 0x67',
          PID: '0x03 (Heartbeat)',
          Size: 4,
          Sequence: seq,
          'Device Status Bitmask': `0x${statusHex}`,
          'GPS Fixed': (statusVal & 1) ? 'Yes' : 'No',
          'Car Designed': (statusVal & 2) ? 'Yes' : 'No',
          'ACC Ignition': (statusVal & 4) ? 'ON' : 'OFF',
          'Relay Triggered': device.fuelCut ? 'Yes (Fuel Cut)' : 'No'
        };
        break;
      }
      case '0x12': { // Location
        pidName = 'Location Package';
        // Size = Sequence(2) + LocationCompound(N) + Status(2) + Battery(2) + AIN0(2) + AIN1(2) + Mileage(4) + Sensors... Let's use 38 bytes total
        const sizeHex = toHex16(34);
        
        // Mock Location compounds (Lat/Lng mapped to integer representations)
        const latVal = Math.floor(device.lat * 180000); 
        const lngVal = Math.floor(device.lng * 180000);
        const latHex = toHex32(latVal < 0 ? 0xFFFFFFFF + latVal + 1 : latVal);
        const lngHex = toHex32(lngVal < 0 ? 0xFFFFFFFF + lngVal + 1 : lngVal);

        const speedHex = toHex16(device.speed);
        const courseHex = toHex16(device.course);
        const satVal = toHex8(device.status === 'offline' ? 0 : 8);
        const statusHex = toHex16((device.accStatus ? 4 : 0) | (device.fuelCut ? 64 : 0));
        const batteryHex = toHex16(device.batteryVoltage);
        const mileageHex = toHex32(device.mileage);
        const fuelHex = toHex8(device.fuelLevel);

        rawHex = `${mark}12${sizeHex}${seqHex}01${latHex}${lngHex}${speedHex}${courseHex}${satVal}${statusHex}${batteryHex}00000000${mileageHex}${fuelHex}`;
        decoded = {
          Mark: '0x67 0x67',
          PID: '0x12 (Location)',
          Size: 34,
          Sequence: seq,
          'GPS Mask': '0x01 (GPS Enabled)',
          Latitude: device.lat.toFixed(6),
          Longitude: device.lng.toFixed(6),
          'Speed (km/h)': device.speed,
          'Heading (Course)': `${device.course}°`,
          Satellites: device.status === 'offline' ? 0 : 8,
          'Device Status': device.accStatus ? 'ACC ON' : 'ACC OFF',
          'Fuel Cut Relay': device.fuelCut ? 'Triggered (Engine Disabled)' : 'Normal',
          'Battery Voltage': `${(device.batteryVoltage / 1000).toFixed(2)}V`,
          'Battery Percentage': `${device.batteryPercent}%`,
          'Odometer Mileage': `${(device.mileage / 1000).toFixed(2)} km`,
          'Fuel Tank level': `${device.fuelLevel}%`
        };
        break;
      }
      case '0x15': { // Report Package (ACC State Change)
        pidName = 'Report Package';
        const sizeHex = toHex16(5); // Sequence(2) + Location(N/A) + ReportType(1) + Status(2) = 5
        const reportTypeHex = toHex8(device.accStatus ? 1 : 2); // 0x01 ACC on, 0x02 ACC off
        const statusHex = toHex16(device.accStatus ? 4 : 0);
        rawHex = `${mark}15${sizeHex}${seqHex}${reportTypeHex}${statusHex}`;
        decoded = {
          Mark: '0x67 0x67',
          PID: '0x15 (Report)',
          Size: 5,
          Sequence: seq,
          'Report Event': device.accStatus ? '0x01 (ACC turned ON)' : '0x02 (ACC turned OFF)',
          'ACC status': device.accStatus ? 'Ignition Active' : 'Ignition Idle'
        };
        break;
      }
      default:
        pidName = 'Protocol Packet';
        rawHex = `${mark}030004${seqHex}0000`;
        decoded = { Mark: '0x67 0x67', PID: '0x03', Sequence: seq };
    }

    return {
      id: Math.random().toString(),
      timestamp,
      imei: device.imei,
      direction: 'UP',
      pid: type,
      pidName,
      rawHex,
      decoded
    };
  };

  // Run periodic movement and live protocol telemetry logs
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles(currentVehicles => {
        return currentVehicles.map(veh => {
          // If offline, don't move or update
          if (veh.status === 'offline') return veh;

          let pathKey = 'alpha';
          if (veh.id === '2') pathKey = 'supervisor';
          if (veh.id === '3') pathKey = 'bravo';
          if (veh.id === '4') pathKey = 'armed';

          const path = JOHANNESBURG_PATHS[pathKey];
          let currentIdx = pathIndices.current[pathKey] || 0;
          
          // Increment path position
          let nextIdx = currentIdx + 1;
          if (nextIdx >= path.length) nextIdx = 0;
          pathIndices.current[pathKey] = nextIdx;

          const nextCoords = path[nextIdx];
          const prevCoords = path[currentIdx];

          // Compute angle/heading
          let angle = veh.course;
          if (prevCoords && nextCoords) {
            const dy = nextCoords[0] - prevCoords[0];
            const dx = Math.cos(-26.2 * Math.PI / 180) * (nextCoords[1] - prevCoords[1]);
            angle = Math.floor(Math.atan2(dx, dy) * 180 / Math.PI);
            if (angle < 0) angle += 360;
          }

          // If stationary, speed is 0 and engine is OFF or idle
          const isStationary = veh.status === 'stationary';
          const calculatedSpeed = isStationary ? 0 : (veh.id === '4' ? 112 : 52); // Keep Unit B speeding
          const updatedACC = !isStationary;
          const mileageDelta = isStationary ? 0 : Math.floor(calculatedSpeed * 1.38); // simulate distance covered

          // Check speeding warning limit
          const alerts: string[] = [];
          if (calculatedSpeed > veh.speedLimit) {
            alerts.push(`High Speed Alert (> ${veh.speedLimit} km/h)`);
          }
          if (veh.fuelCut) {
            alerts.push('Relay Active: Fuel line cut');
          }

          const updatedVehicle: TK116Device = {
            ...veh,
            lat: isStationary ? veh.lat : nextCoords[0],
            lng: isStationary ? veh.lng : nextCoords[1],
            speed: calculatedSpeed,
            course: angle,
            accStatus: updatedACC,
            mileage: veh.mileage + mileageDelta,
            fuelLevel: Math.max(10, veh.fuelLevel - (isStationary ? 0.01 : 0.05)),
            batteryVoltage: updatedACC ? 13800 : 12300, // higher when alternator runs
            batteryPercent: Math.min(100, veh.batteryPercent + (updatedACC ? 0.2 : -0.05)),
            lastUpdate: new Date().toLocaleTimeString(),
            pathHistory: [...veh.pathHistory, [nextCoords[0], nextCoords[1]]].slice(-40), // limit breadcrumbs to 40
            alerts
          };

          // Periodically emit Eelink protocol telemetry packets (UP packages from device to server)
          // 40% chance of location pkg, 10% of heartbeat/report
          const r = Math.random();
          let pkgType = '';
          if (r < 0.3) {
            pkgType = '0x12'; // Location
          } else if (r < 0.4) {
            pkgType = '0x03'; // Heartbeat
          } else if (r < 0.45 && !isStationary) {
            pkgType = '0x15'; // ACC report
          }

          if (pkgType) {
            simSequenceRef.current += 1;
            const newPacket = generateEelinkPacket(pkgType, updatedVehicle, simSequenceRef.current);
            setRawPackets(prev => [newPacket, ...prev].slice(0, 100)); // limit log list to last 100
          }

          return updatedVehicle;
        });
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Dispatch custom simulated Eelink commands
  const handleSendCommand = () => {
    if (selectedVehicle.status === 'offline') {
      addToast("Cannot transmit command. Selected vehicle's device is offline.", "error");
      return;
    }

    setIsSimTransmitting(true);
    const seq = simSequence;
    setSimSequence(prev => prev + 1);

    // Build the instruction payload
    let commandText = simCommand;
    if (simCommand === 'CUSTOM') {
      commandText = simCustomParam || 'STATUS?';
    } else if (simCommand === 'SPEED') {
      const limit = simCustomParam ? parseInt(simCustomParam) : 100;
      commandText = `SPEED,0,${limit}#`;
    }

    const commandHex = stringToHex(commandText);
    const mark = '6767';
    const pid = '80'; // Instruction Package
    const seqHex = toHex16(seq);
    const typeHex = '01'; // 0x01: device command
    const uidHex = '00001B3C'; // Unique instruction UID
    
    // Size = Sequence(2) + Type(1) + UID(4) + Content(N)
    const contentLen = commandText.length;
    const size = 2 + 1 + 4 + contentLen;
    const sizeHex = toHex16(size);

    const generatedHex = `${mark}${pid}${sizeHex}${seqHex}${typeHex}${uidHex}${commandHex}`;
    setGeneratedHexCmd(generatedHex);

    const time = new Date().toLocaleTimeString();
    
    // Add Tx log
    setSimLogs(prev => [
      ...prev,
      { time, text: `[TX] Sent Eelink Instruction PID 0x80: "${commandText}" to IMEI ${selectedVehicle.imei}`, type: 'out' }
    ]);

    // Periodically simulate the packet travel delay over cellular TCP/UDP link
    setTimeout(() => {
      let resultText = 'SET OK';
      let success = true;

      // Core Eelink TK116 Protocol Action Responses defined by EELINK V2.0 Documentation
      if (commandText.startsWith('RESET')) {
        resultText = 'Reset OK';
        // reboot simulation
        setVehicles(current => current.map(v => v.id === selectedVehicle.id ? { 
          ...v, 
          status: 'offline', 
          lastUpdate: 'Rebooting...' 
        } : v));
        setTimeout(() => {
          setVehicles(current => current.map(v => v.id === selectedVehicle.id ? { 
            ...v, 
            status: 'stationary',
            speed: 0,
            accStatus: false,
            lastUpdate: new Date().toLocaleTimeString(),
            alerts: []
          } : v));
          setSimLogs(prev => [
            ...prev,
            { time: new Date().toLocaleTimeString(), text: `[SYSTEM] IMEI ${selectedVehicle.imei} booted successfully and established new TCP connection (Login 0x01 uploaded).`, type: 'info' }
          ]);
        }, 6000);

      } else if (commandText.startsWith('RELAY,1')) {
        resultText = 'Relay enable OK\n> Fuel Cut Active';
        setVehicles(current => current.map(v => v.id === selectedVehicle.id ? { 
          ...v, 
          fuelCut: true,
          status: 'stationary',
          speed: 0,
          accStatus: false
        } : v));
      } else if (commandText.startsWith('RELAY,0')) {
        resultText = 'Relay disable OK\n> Fuel Restored';
        setVehicles(current => current.map(v => v.id === selectedVehicle.id ? { 
          ...v, 
          fuelCut: false,
          status: 'moving',
          speed: 40,
          accStatus: true
        } : v));
      } else if (commandText.startsWith('SPEED')) {
        const parts = commandText.replace('#', '').split(',');
        const limitVal = parseInt(parts[2] || '120');
        resultText = 'SET SPEED OK';
        setVehicles(current => current.map(v => v.id === selectedVehicle.id ? { 
          ...v, 
          speedLimit: limitVal 
        } : v));
      } else if (commandText.startsWith('STATUS')) {
        resultText = `BATTERY:100%\nGPRS:SUCCESS\nGSM:MED,18\nGPS:FIXED,8\nACC:${selectedVehicle.accStatus ? 'ON' : 'OFF'}\nRELAY:${selectedVehicle.fuelCut ? 'ON' : 'OFF'}\nMS:LIS3DH`;
      } else if (commandText.startsWith('VERSION')) {
        resultText = `IMEI:${selectedVehicle.imei}\nIMSI:946001666829743\nICCID:8986011685100944475\nSYSTEM:M6130_V2.0.5\nVERSION:MXAPP_V2.0.5\nBUILD:May 20 2026 10:14:15`;
      }

      // Outward packet
      const respMark = '6767';
      const respPid = '80';
      const respResultHex = stringToHex(resultText);
      const respSizeHex = toHex16(2 + 1 + 4 + resultText.length);
      const generatedRespHex = `${respMark}${respPid}${respSizeHex}${seqHex}${typeHex}${uidHex}${respResultHex}`;
      setResponseHexCmd(generatedRespHex);

      // Add Rx log
      setSimLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), text: `[RX] Received Eelink Reply [PID 0x80] from IMEI ${selectedVehicle.imei}:\n${resultText.replace(/\n/g, ' | ')}`, type: 'in' }
      ]);

      // Insert command interaction into raw packet list
      const cmdTxPacket: RawPacket = {
        id: Math.random().toString(),
        timestamp: time,
        imei: selectedVehicle.imei,
        direction: 'DOWN',
        pid: '0x80',
        pidName: 'Instruction Command',
        rawHex: generatedHex,
        decoded: {
          Mark: '0x67 0x67',
          PID: '0x80 (Instruction)',
          Size: size,
          Sequence: seq,
          'Instruction Type': '0x01 (Device Command)',
          UID: '0x00001B3C',
          Command: commandText
        }
      };

      const cmdRxPacket: RawPacket = {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        imei: selectedVehicle.imei,
        direction: 'UP',
        pid: '0x80',
        pidName: 'Instruction Reply',
        rawHex: generatedRespHex,
        decoded: {
          Mark: '0x67 0x67',
          PID: '0x80 (Instruction Response)',
          Size: 2 + 1 + 4 + resultText.length,
          Sequence: seq,
          'Instruction Type': '0x01 (Device Command)',
          UID: '0x00001B3C',
          Result: resultText
        }
      };

      setRawPackets(prev => [cmdRxPacket, cmdTxPacket, ...prev].slice(0, 100));
      setIsSimTransmitting(false);
      addToast("Eelink TK116 command executed successfully.", "success");
    }, 1800);
  };

  // Helper to format raw hex visually grouped by bytes
  const formatHexGrouped = (hex: string) => {
    if (!hex) return '';
    const match = hex.match(/.{1,2}/g);
    return match ? match.join(' ') : hex;
  };

  // Map markers styled with Leaflet L.divIcon
  const createVehicleIcon = (vehicle: TK116Device, isSelected: boolean) => {
    const isOffline = vehicle.status === 'offline';
    const isStationary = vehicle.status === 'stationary';
    
    // Choose marker color
    const color = isOffline 
      ? '#6B7280' // Gray 
      : (vehicle.fuelCut 
        ? '#EF4444' // Red
        : (isStationary ? '#F59E0B' : '#10B981')); // Amber vs Emerald

    const size = isSelected ? 48 : 38;
    const shadowFilter = `drop-shadow(0 2px 4px rgba(0,0,0,0.4))`;
    const glowFilter = isSelected ? `drop-shadow(0 0 8px ${color})` : '';

    // Beautiful rotation indicator SVG
    const iconHtml = `
      <div style="width: ${size}px; height: ${size}px; display: flex; justify-content: center; align-items: center; position: relative;">
        <!-- Base Marker Pulse -->
        ${!isOffline && !isStationary ? `<div class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-25"></div>` : ''}
        
        <!-- Directional arrow / circle -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 100%; height: 100%; filter: ${shadowFilter} ${glowFilter};">
          <circle cx="12" cy="12" r="9" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" />
          <g transform="translate(12, 12) rotate(${vehicle.course})">
            <!-- Navigation pointer -->
            <path d="M0 -6 L4 3 L0 1 L-4 3 Z" fill="#FFFFFF" />
          </g>
        </svg>
      </div>
    `;

    return new L.DivIcon({
      html: iconHtml,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  };

  return (
    <div className="flex-grow flex flex-col pt-16 bg-gray-50 dark:bg-gray-900 transition-colors duration-300" id="fleet-management-dashboard">
      
      {/* Top Banner Stats */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800/80 px-6 py-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-500" />
              Eelink TK116 Fleet Management
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Visualize real-time cellular tracking, monitor raw telemetry GPRS package streams, and dispatch OTA instructions over TCP/UDP.
            </p>
          </div>
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-200/50 dark:border-gray-800/40">
            <div className="px-4 py-1 border-r border-gray-200 dark:border-gray-800 last:border-0 text-center sm:text-left">
              <span className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500">Total Fleet</span>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{vehicles.length}</p>
            </div>
            <div className="px-4 py-1 border-r border-gray-200 dark:border-gray-800 last:border-0 text-center sm:text-left">
              <span className="text-[10px] uppercase font-semibold text-emerald-500 dark:text-emerald-400">Moving</span>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {vehicles.filter(v => v.status === 'moving').length}
              </p>
            </div>
            <div className="px-4 py-1 border-r border-gray-200 dark:border-gray-800 last:border-0 text-center sm:text-left">
              <span className="text-[10px] uppercase font-semibold text-amber-500 dark:text-amber-400">Stationary</span>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {vehicles.filter(v => v.status === 'stationary').length}
              </p>
            </div>
            <div className="px-4 py-1 last:border-0 text-center sm:text-left">
              <span className="text-[10px] uppercase font-semibold text-red-500 dark:text-red-400">Alerts Active</span>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 animate-pulse">
                {vehicles.filter(v => v.alerts.length > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-140px)]">
        
        {/* Left Side: Vehicle List Panel */}
        <div className="lg:col-span-4 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800/80 flex flex-col overflow-hidden h-full">
          {/* Search Box */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-950">
            <div className="relative">
              <input
                type="text"
                placeholder="Search plate, name, or IMEI..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-100 placeholder-gray-400 rounded-lg py-2 pl-3 pr-8"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 text-xs pointer-events-none">🔍</span>
            </div>
          </div>

          {/* List Scroll Area */}
          <div className="flex-grow overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/40 p-2">
            {filteredVehicles.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">No matching fleet vehicles found.</div>
            ) : (
              filteredVehicles.map(veh => {
                const isSel = veh.id === selectedVehicleId;
                const isOffline = veh.status === 'offline';
                const isStationary = veh.status === 'stationary';

                return (
                  <button
                    key={veh.id}
                    onClick={() => setSelectedVehicleId(veh.id)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all mb-1 border ${
                      isSel 
                        ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 shadow-sm' 
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${
                            isOffline ? 'bg-gray-400' : (veh.fuelCut ? 'bg-red-500' : (isStationary ? 'bg-amber-400' : 'bg-emerald-500'))
                          }`} />
                          <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {veh.name}
                          </h3>
                          <span className="text-[9px] font-semibold font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {veh.plate}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                          IMEI: {veh.imei}
                        </p>
                      </div>

                      {/* Speed Badge */}
                      {!isOffline && (
                        <div className="text-right">
                          <span className={`text-xs font-black tracking-tight ${
                            veh.speed > veh.speedLimit ? 'text-red-500 font-bold animate-pulse' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {veh.speed} <span className="text-[9px] font-medium text-gray-400">km/h</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sensor Summary Badges */}
                    <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                      {/* Battery Sensor */}
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-mono">
                        <Battery className={`w-3.5 h-3.5 ${isOffline ? 'text-gray-300' : 'text-blue-500'}`} />
                        <span>{isOffline ? '--' : `${veh.batteryPercent}%`}</span>
                      </div>

                      {/* ACC Ignition badge */}
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-mono">
                        <Zap className={`w-3.5 h-3.5 ${isOffline ? 'text-gray-300' : (veh.accStatus ? 'text-amber-500' : 'text-gray-400')}`} />
                        <span>{isOffline ? '--' : (veh.accStatus ? 'IGN ON' : 'IGN OFF')}</span>
                      </div>

                      {/* Fuel Tank */}
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-mono">
                        <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{isOffline ? '--' : `${Math.floor(veh.fuelLevel)}%`}</span>
                      </div>
                    </div>

                    {/* Alerts panel if active */}
                    {veh.alerts.length > 0 && (
                      <div className="mt-2.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg p-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 truncate">
                          {veh.alerts[0]}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Connected Device Info Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950 text-xs text-gray-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" /> TK116 Gateway
            </span>
            <span className="font-mono text-[10px]">Active Port: 32001 (TCP)</span>
          </div>
        </div>

        {/* Right Side: Main Interactive Control Panel */}
        <div className="lg:col-span-8 flex flex-col overflow-hidden h-full">
          
          {/* Navigation Sub-Tabs */}
          <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 flex justify-between items-center shrink-0">
            <div className="flex gap-1.5 py-2">
              <button
                onClick={() => setActiveSubTab('map')}
                className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeSubTab === 'map'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-950'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Live Map
              </button>
              
              <button
                onClick={() => setActiveSubTab('simulator')}
                className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeSubTab === 'simulator'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-950'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                TK116 Instruction Console
              </button>

              <button
                onClick={() => setActiveSubTab('terminal')}
                className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeSubTab === 'terminal'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-950'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                GPRS Decoded Packet Log
              </button>
            </div>

            <div className="text-[10px] font-mono text-gray-400 font-semibold bg-gray-50 dark:bg-gray-900 border border-gray-200/50 dark:border-gray-800 px-2 py-0.5 rounded-md hidden md:block">
              Selected: <span className="text-blue-500">{selectedVehicle.name}</span>
            </div>
          </div>

          {/* Tab Sub-Content Windows */}
          <div className="flex-grow overflow-hidden relative">
            
            {/* TAB 1: Live Interactive Leaflet Map */}
            {activeSubTab === 'map' && (
              <div className="w-full h-full relative" style={{ minHeight: '300px' }}>
                <MapContainer
                  center={[-26.2041, 28.0473]}
                  zoom={11}
                  scrollWheelZoom={true}
                  className="w-full h-full z-10"
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Focus center control */}
                  {selectedVehicle && selectedVehicle.status !== 'offline' && (
                    <MapCenterController coords={[selectedVehicle.lat, selectedVehicle.lng]} />
                  )}

                  {/* Draw Polyline trails for historical breadcrumbs */}
                  {vehicles.map(veh => (
                    veh.status !== 'offline' && veh.pathHistory.length > 1 && (
                      <Polyline
                        key={`trail-${veh.id}`}
                        positions={veh.pathHistory}
                        color={veh.id === selectedVehicleId ? '#3B82F6' : '#9CA3AF'}
                        weight={veh.id === selectedVehicleId ? 3.5 : 2.0}
                        opacity={veh.id === selectedVehicleId ? 0.8 : 0.4}
                        dashArray={veh.id === selectedVehicleId ? undefined : '5, 5'}
                      />
                    )
                  ))}

                  {/* Device markers */}
                  {vehicles.map(veh => (
                    <Marker
                      key={`marker-${veh.id}`}
                      position={[veh.lat, veh.lng]}
                      icon={createVehicleIcon(veh, veh.id === selectedVehicleId)}
                    >
                      <Popup>
                        <div className="p-2 text-xs">
                          <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              veh.status === 'offline' ? 'bg-gray-400' : 'bg-emerald-500'
                            }`} />
                            {veh.name} ({veh.plate})
                          </h4>
                          
                          <table className="w-full text-[10px] divide-y divide-gray-100 dark:divide-gray-800">
                            <tbody>
                              <tr>
                                <td className="py-1 text-gray-400">IMEI</td>
                                <td className="py-1 font-mono text-right">{veh.imei}</td>
                              </tr>
                              <tr>
                                <td className="py-1 text-gray-400">Speed</td>
                                <td className="py-1 text-right font-bold">{veh.speed} km/h</td>
                              </tr>
                              <tr>
                                <td className="py-1 text-gray-400">Heading</td>
                                <td className="py-1 text-right">{veh.course}°</td>
                              </tr>
                              <tr>
                                <td className="py-1 text-gray-400">Acc status</td>
                                <td className="py-1 text-right font-bold">{veh.accStatus ? 'ON (Fired)' : 'OFF'}</td>
                              </tr>
                              <tr>
                                <td className="py-1 text-gray-400">Engine Relay</td>
                                <td className="py-1 text-right font-bold">{veh.fuelCut ? 'FUEL CUT' : 'RESTORED'}</td>
                              </tr>
                              <tr>
                                <td className="py-1 text-gray-400">Battery</td>
                                <td className="py-1 text-right font-mono">{(veh.batteryVoltage / 1000).toFixed(2)}V ({veh.batteryPercent}%)</td>
                              </tr>
                            </tbody>
                          </table>
                          <div className="mt-2 text-[10px] text-gray-400 text-center font-mono">
                            Last Refreshed: {veh.lastUpdate}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>

                {/* Overlaid Map Legend HUD */}
                <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-gray-950/95 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-md z-[500] backdrop-blur-sm pointer-events-none max-w-xs text-[10px]">
                  <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-1.5">TK116 Map Overlay Legend</h5>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-gray-600 dark:text-gray-400">Active &amp; Moving Unit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-gray-600 dark:text-gray-400">Stationary (Engine OFF/Idle)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-gray-600 dark:text-gray-400">Active Warning / Fuel Cut Activated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Device Offline / Power Loss</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TK116 Instruction Console */}
            {activeSubTab === 'simulator' && (
              <div className="w-full h-full p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Send Command Box */}
                <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs uppercase font-extrabold text-blue-500 mb-3 tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4" />
                      Eelink Command Dispatcher
                    </h3>
                    
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
                      Build standard command commands adhering strictly to the **Eelink Protocol V2.0** format. Commands are sent as short message string payloads.
                    </p>

                    <div className="space-y-4">
                      {/* Select command */}
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                          Select Command Action
                        </label>
                        <select
                          value={simCommand}
                          onChange={e => {
                            setSimCommand(e.target.value);
                            setSimCustomParam('');
                          }}
                          className="w-full text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-100 rounded-lg p-2"
                        >
                          <option value="RESET#">RESET# - Reboot TK116 Hardware</option>
                          <option value="RELAY,1#">RELAY,1# - Activate Relay (Cut Engine/Fuel Line)</option>
                          <option value="RELAY,0#">RELAY,0# - Deactivate Relay (Restore Fuel Line)</option>
                          <option value="STATUS#">STATUS# - Query Full Device Status Metrics</option>
                          <option value="VERSION#">VERSION# - Query Device Firmware Versions</option>
                          <option value="SPEED">SPEED - Configure Maximum Speed Limit Alarm</option>
                          <option value="CUSTOM">CUSTOM - Custom Plaintext ASCII Command</option>
                        </select>
                      </div>

                      {/* Custom parameter input if custom or speed */}
                      {(simCommand === 'CUSTOM' || simCommand === 'SPEED') && (
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                            {simCommand === 'SPEED' ? 'Enter Speed Limit (km/h)' : 'Enter ASCII Command Content (omitting #)'}
                          </label>
                          <input
                            type="text"
                            value={simCustomParam}
                            onChange={e => setSimCustomParam(e.target.value)}
                            placeholder={simCommand === 'SPEED' ? 'e.g. 100' : 'e.g. FENCE,1,OR,,,500'}
                            className="w-full text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-100 rounded-lg p-2 font-mono"
                          />
                        </div>
                      )}

                      {/* Targeted device specs */}
                      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200/50 dark:border-gray-800 p-3 rounded-xl space-y-1.5">
                        <h4 className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Target Device Information</h4>
                        <div className="grid grid-cols-2 text-[10px] font-mono gap-1 text-gray-500">
                          <div>Vehicle Name:</div>
                          <div className="text-right text-gray-800 dark:text-gray-200 font-bold">{selectedVehicle.name}</div>
                          <div>Device IMEI:</div>
                          <div className="text-right text-gray-800 dark:text-gray-200">{selectedVehicle.imei}</div>
                          <div>ACC State:</div>
                          <div className="text-right text-gray-800 dark:text-gray-200">{selectedVehicle.accStatus ? 'ON (Engine Running)' : 'OFF'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={handleSendCommand}
                      disabled={isTransmitting || selectedVehicle.status === 'offline'}
                      className="w-full btn-primary py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isTransmitting ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          Transmitting OTA Command...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Transmit Instruction Packet (0x80)
                        </>
                      )}
                    </button>
                    {selectedVehicle.status === 'offline' && (
                      <p className="text-[9px] text-center text-red-500 mt-1 font-semibold">
                        This vehicle's device is currently offline. Cannot establish connection.
                      </p>
                    )}
                  </div>
                </div>

                {/* Packet Construction / Diagnostic logs */}
                <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col h-full overflow-hidden">
                  <h3 className="text-xs uppercase font-extrabold text-blue-500 mb-3 tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-4 h-4" />
                    OTA Packet Inspector
                  </h3>

                  {/* Packet details display */}
                  <div className="flex-grow space-y-4 overflow-y-auto pr-1">
                    {generatedHexCmd ? (
                      <div className="space-y-3.5">
                        {/* Outgoing hex */}
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3.5">
                          <h4 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Outgoing Packet Hex [PID 0x80]
                          </h4>
                          <p className="text-[11px] font-mono break-all text-gray-700 dark:text-gray-300 font-semibold tracking-wide">
                            {formatHexGrouped(generatedHexCmd)}
                          </p>
                          <div className="grid grid-cols-3 gap-2 mt-3 text-[9px] font-mono border-t border-blue-200/30 dark:border-blue-900/20 pt-2 text-gray-500">
                            <div>Mark: <span className="font-bold text-gray-800 dark:text-gray-200">67 67</span></div>
                            <div>PID: <span className="font-bold text-gray-800 dark:text-gray-200">80</span></div>
                            <div>Type: <span className="font-bold text-gray-800 dark:text-gray-200">01</span></div>
                          </div>
                        </div>

                        {/* Incoming response hex */}
                        {responseHexCmd && (
                          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3.5">
                            <h4 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Incoming Device Reply Hex [PID 0x80]
                            </h4>
                            <p className="text-[11px] font-mono break-all text-gray-700 dark:text-gray-300 font-semibold tracking-wide">
                              {formatHexGrouped(responseHexCmd)}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-400">
                        <Info className="w-8 h-8 mb-2 stroke-1" />
                        <p className="text-[11px]">No commands transmitted yet.</p>
                        <p className="text-[9px] mt-0.5 max-w-[200px]">Send an OTA instruction on the left to inspect raw Eelink protocol bytes.</p>
                      </div>
                    )}

                    {/* Sim Action logs */}
                    {simLogs.length > 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Cellular Link Audit logs</h4>
                        <div className="bg-gray-50 dark:bg-gray-900/80 border border-gray-200/50 dark:border-gray-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[9px] space-y-1.5 divide-y divide-gray-100 dark:divide-gray-800/40">
                          {simLogs.map((log, idx) => (
                            <div key={idx} className="pt-1.5 first:pt-0">
                              <span className="text-gray-400 mr-1.5">[{log.time}]</span>
                              <span className={
                                log.type === 'out' ? 'text-blue-500' : (log.type === 'in' ? 'text-emerald-500' : 'text-gray-300')
                              }>
                                {log.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Real-Time Protocol Packet Stream */}
            {activeSubTab === 'terminal' && (
              <div className="w-full h-full p-4 overflow-hidden bg-gray-950 flex flex-col lg:flex-row gap-4">
                
                {/* Scrollable Packet Log Console */}
                <div className="flex-grow flex flex-col h-full bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center justify-between text-[11px] font-mono font-bold text-gray-300">
                    <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-blue-400" /> Incoming cellular packets (GPRS Port 32001)</span>
                    <button 
                      onClick={() => setRawPackets([])}
                      className="text-[10px] hover:text-white bg-gray-800 px-2 py-0.5 rounded cursor-pointer"
                    >
                      Clear Log
                    </button>
                  </div>
                  
                  {/* Console lines */}
                  <div className="flex-grow p-3 overflow-y-auto font-mono text-[10px] space-y-1.5">
                    {rawPackets.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center">
                        <Activity className="w-8 h-8 mb-2 animate-pulse text-gray-600" />
                        <p>Awaiting raw GPRS packet frame stream...</p>
                        <p className="text-[9px] mt-0.5">Eelink TK116 devices upload location frames periodically.</p>
                      </div>
                    ) : (
                      rawPackets.map(pkg => {
                        const isSelected = selectedPacket?.id === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            onClick={() => setSelectedPacket(pkg)}
                            className={`w-full text-left p-2 rounded transition-all block border ${
                              isSelected 
                                ? 'bg-blue-950/40 border-blue-800 text-white' 
                                : 'bg-transparent border-transparent hover:bg-gray-900/50 text-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[9px] text-gray-400 mb-1">
                              <span className="flex items-center gap-1 font-bold">
                                {pkg.direction === 'UP' ? (
                                  <span className="text-emerald-400">▲ UP</span>
                                ) : (
                                  <span className="text-blue-400">▼ DOWN</span>
                                )}
                                <span className="bg-gray-800 text-gray-300 px-1.5 py-0.2 rounded uppercase">
                                  {pkg.pidName} ({pkg.pid})
                                </span>
                              </span>
                              <span>{pkg.timestamp}</span>
                            </div>
                            
                            <p className="break-all font-mono font-bold text-[10px] tracking-wide text-gray-200">
                              {formatHexGrouped(pkg.rawHex)}
                            </p>
                            
                            <div className="mt-1 flex items-center justify-between text-[9px] text-gray-500">
                              <span>IMEI: {pkg.imei}</span>
                              <span className="text-blue-400 hover:underline">Click to decode byte sequence</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </div>

                {/* Right Panel: Packet Byte-by-Byte Decoder */}
                <div className="w-full lg:w-96 shrink-0 bg-gray-900/60 border border-gray-800 rounded-xl flex flex-col overflow-hidden h-full">
                  <div className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 text-[11px] font-mono font-bold text-gray-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Protocol Byte-by-Byte Decoder
                  </div>

                  <div className="flex-grow p-4 overflow-y-auto">
                    {selectedPacket ? (
                      <div className="space-y-4">
                        <div className="border-b border-gray-800 pb-3">
                          <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Packet Overview</h4>
                          <div className="text-[11px] font-mono text-gray-300">
                            <div>Frame Class: <span className="font-bold text-white">{selectedPacket.pidName}</span></div>
                            <div>Identifier PID: <span className="font-bold text-blue-400">{selectedPacket.pid}</span></div>
                            <div>Device IMEI: <span className="font-bold text-white">{selectedPacket.imei}</span></div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2">Decoded Frame Fields</h4>
                          <div className="bg-black/40 border border-gray-800/80 rounded-xl p-3 space-y-2.5 max-h-[300px] overflow-y-auto">
                            {Object.entries(selectedPacket.decoded).map(([key, val]) => (
                              <div key={key} className="text-[10px] font-mono">
                                <span className="text-gray-500 block leading-tight">{key}</span>
                                <span className="text-white font-bold break-all leading-tight">{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-gray-900/80 border border-gray-800/50 p-3 rounded-lg text-[9px] text-gray-400 space-y-1.5 font-mono">
                          <h5 className="font-bold text-gray-300 uppercase">Eelink V2 Frame Structure</h5>
                          <p>
                            Bytes [0-1]: Mark (0x67 0x67)<br />
                            Byte [2]: Packet ID (PID)<br />
                            Bytes [3-4]: size of sequence + content<br />
                            Bytes [5-6]: Sequence number
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                        <Info className="w-8 h-8 mb-2 stroke-1" />
                        <p className="text-[11px]">No GPRS package frame selected.</p>
                        <p className="text-[9px] mt-0.5">Click any live packet frame in the log console to parse its full structure byte-by-byte.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default FleetManagement;

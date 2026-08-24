import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Cpu, 
  Navigation, 
  RefreshCw, 
  Activity, 
  FileText, 
  Compass, 
  Gauge, 
  Plus, 
  Search, 
  Radio, 
  Layers, 
  KeyRound, 
  Pencil, 
  Trash2, 
  MapPin,
  Clock,
  Terminal,
  Car
} from 'lucide-react';
import { Profile } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../utils/supabase';
import { TrackingUnitModal } from './TrackingUnitModal';

export interface TK116Device {
  id: string;
  name: string;
  plate: string;
  imei: string;
  simNumber?: string;
  model?: string;
  status: 'moving' | 'stationary' | 'offline';
  lat: number;
  lng: number;
  speed: number;
  course: number;
  batteryVoltage: number; // in mV, e.g. 12600
  batteryPercent: number; // e.g. 95%
  accStatus: boolean; // Ignition ON/OFF
  mileage: number; // in meters
  lastUpdate: string;
  speedLimit: number;
  pathHistory: [number, number][];
  alerts: string[];
}

export interface TripHistoryItem {
  id: string;
  timestamp: string;
  event: string;
  lat: number;
  lng: number;
  speed: number;
  mileage: number;
  accStatus: boolean;
  status: 'moving' | 'stationary';
}

export interface RawPacket {
  id: string;
  timestamp: string;
  imei: string;
  direction: 'UP' | 'DOWN';
  pid: string;
  pidName: string;
  rawHex: string;
  decoded: {
    lat?: number;
    lng?: number;
    speed?: number;
    acc?: boolean;
    course?: number;
    status?: string;
  };
}

const MapBoundsController: React.FC<{
  vehicles: TK116Device[];
  activeVehicleId: string | null;
}> = ({ vehicles, activeVehicleId }) => {
  const map = useMap();
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map, activeVehicleId]);

  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;

    const currentKey = `${activeVehicleId}_${vehicles.map(v => `${v.id}:${v.lat.toFixed(4)}:${v.lng.toFixed(4)}`).join(',')}`;
    if (lastKeyRef.current === currentKey) return;
    lastKeyRef.current = currentKey;

    if (activeVehicleId && vehicles.length === 1) {
      const activeV = vehicles.find(v => v.id === activeVehicleId);
      if (activeV) {
        map.flyTo([activeV.lat, activeV.lng], Math.max(map.getZoom(), 14), { animate: true, duration: 0.8 });
        return;
      }
    }

    if (vehicles.length === 1) {
      map.flyTo([vehicles[0].lat, vehicles[0].lng], 14, { animate: true, duration: 0.8 });
    } else if (vehicles.length > 1) {
      try {
        const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng]));
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true, duration: 0.8 });
        }
      } catch (err) {
        console.error("Error setting map bounds:", err);
      }
    }
  }, [vehicles, activeVehicleId, map]);

  return null;
};

// Initial default units for South Africa JHB region if database is empty
const INITIAL_DEFAULT_UNITS: Omit<TK116Device, 'id' | 'pathHistory' | 'alerts'>[] = [
  {
    name: 'Armed Response 1',
    plate: 'HW82GP-GP',
    imei: '354188046036385',
    simNumber: '+27 82 901 2345',
    model: 'Eelink TK116 4G',
    status: 'moving',
    lat: -26.2041,
    lng: 28.0473,
    speed: 54,
    course: 140,
    batteryVoltage: 12800,
    batteryPercent: 98,
    accStatus: true,
    mileage: 142850,
    lastUpdate: 'Just now',
    speedLimit: 120
  },
  {
    name: 'Supervisor Unit Alpha',
    plate: 'TX11GP-GP',
    imei: '354188046036393',
    simNumber: '+27 83 456 7890',
    model: 'Eelink TK116 4G',
    status: 'moving',
    lat: -26.1076,
    lng: 28.0567,
    speed: 68,
    course: 65,
    batteryVoltage: 13200,
    batteryPercent: 100,
    accStatus: true,
    mileage: 210450,
    lastUpdate: '1 min ago',
    speedLimit: 120
  },
  {
    name: 'Patrol Cruiser Delta',
    plate: 'BB44GP-GP',
    imei: '354188046036401',
    simNumber: '+27 84 112 3344',
    model: 'Eelink TK116 4G',
    status: 'stationary',
    lat: -26.2580,
    lng: 27.8520,
    speed: 0,
    course: 0,
    batteryVoltage: 12400,
    batteryPercent: 88,
    accStatus: false,
    mileage: 98200,
    lastUpdate: '3 mins ago',
    speedLimit: 100
  },
  {
    name: 'Tactical Unit Bravo',
    plate: 'FC99GP-GP',
    imei: '354188046036419',
    simNumber: '+27 82 888 9900',
    model: 'Eelink TK116 4G',
    status: 'moving',
    lat: -26.1243,
    lng: 28.1022,
    speed: 42,
    course: 220,
    batteryVoltage: 12600,
    batteryPercent: 92,
    accStatus: true,
    mileage: 175600,
    lastUpdate: 'Just now',
    speedLimit: 120
  }
];

// Road network waypoints along Gauteng roads
const ROAD_ROUTES: Record<string, [number, number][]> = {
  'dev-1': [
    [-26.2041, 28.0473],
    [-26.2039, 28.0440],
    [-26.2038, 28.0375],
    [-26.2015, 28.0380],
    [-26.1990, 28.0385],
    [-26.1995, 28.0420],
    [-26.2000, 28.0460],
    [-26.2005, 28.0490],
    [-26.2010, 28.0515],
    [-26.2030, 28.0510],
    [-26.2052, 28.0505],
    [-26.2047, 28.0490],
    [-26.2041, 28.0473]
  ],
  'dev-2': [
    [-26.1076, 28.0567],
    [-26.1040, 28.0580],
    [-26.1000, 28.0595],
    [-26.0965, 28.0612],
    [-26.0980, 28.0660],
    [-26.1008, 28.0725],
    [-26.1050, 28.0680],
    [-26.1112, 28.0610],
    [-26.1095, 28.0585],
    [-26.1076, 28.0567]
  ],
  'dev-3': [
    [-26.2580, 27.8520],
    [-26.2500, 27.8580],
    [-26.2390, 27.8680],
    [-26.2340, 27.8800],
    [-26.2300, 27.8920],
    [-26.2380, 27.8700],
    [-26.2480, 27.8450],
    [-26.2510, 27.8390],
    [-26.2540, 27.8450],
    [-26.2580, 27.8520]
  ],
  'dev-4': [
    [-26.1243, 28.1022],
    [-26.1350, 28.1150],
    [-26.1480, 28.1280],
    [-26.1600, 28.1300],
    [-26.1730, 28.1310],
    [-26.1770, 28.1120],
    [-26.1550, 28.1060],
    [-26.1243, 28.1022]
  ]
};

const getRoadRouteForVehicle = (v: TK116Device): [number, number][] => {
  if (ROAD_ROUTES[v.id]) return ROAD_ROUTES[v.id];
  if (v.imei === '354188046036385' || v.name.includes('Armed Response')) return ROAD_ROUTES['dev-1'];
  if (v.imei === '354188046036393' || v.name.includes('Supervisor')) return ROAD_ROUTES['dev-2'];
  if (v.imei === '354188046036401' || v.name.includes('Patrol Cruiser')) return ROAD_ROUTES['dev-3'];
  if (v.imei === '354188046036419' || v.name.includes('Tactical Unit')) return ROAD_ROUTES['dev-4'];

  const bLat = v.lat;
  const bLng = v.lng;
  return [
    [bLat, bLng],
    [bLat + 0.005, bLng],
    [bLat + 0.005, bLng + 0.007],
    [bLat - 0.003, bLng + 0.007],
    [bLat - 0.003, bLng],
    [bLat, bLng]
  ];
};

const generateHistoryForUnit = (unit: TK116Device): TripHistoryItem[] => {
  const items: TripHistoryItem[] = [];
  const route = getRoadRouteForVehicle(unit);
  const now = new Date();

  const events = [
    { label: 'Movement Ping (In Transit)', speed: unit.speed || 52, acc: true, mileageOffset: -500, timeOffset: 1 },
    { label: 'Movement Ping (In Transit)', speed: 64, acc: true, mileageOffset: -2500, timeOffset: 6 },
    { label: 'Speed Check Normal', speed: 58, acc: true, mileageOffset: -6000, timeOffset: 15 },
    { label: 'ACC Ignition Status ON', speed: 12, acc: true, mileageOffset: -10000, timeOffset: 25 },
    { label: 'Stationary / Idling Check', speed: 0, acc: true, mileageOffset: -12000, timeOffset: 40 },
    { label: 'ACC Ignition Status OFF (Parked)', speed: 0, acc: false, mileageOffset: -12000, timeOffset: 65 },
    { label: 'ACC Ignition Status ON (Engine Started)', speed: 0, acc: true, mileageOffset: -12000, timeOffset: 90 },
    { label: 'Movement Ping (In Transit)', speed: 45, acc: true, mileageOffset: -18000, timeOffset: 120 }
  ];

  events.forEach((ev, idx) => {
    const eventTime = new Date(now.getTime() - ev.timeOffset * 60 * 1000);
    const pointOnRoad = route[idx % route.length];

    items.push({
      id: `${unit.id}-hist-${idx}`,
      timestamp: eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      event: ev.label,
      lat: Number(pointOnRoad[0].toFixed(5)),
      lng: Number(pointOnRoad[1].toFixed(5)),
      speed: ev.speed,
      mileage: Math.max(1000, Math.floor(unit.mileage - ev.mileageOffset)),
      accStatus: ev.acc,
      status: ev.speed > 0 ? 'moving' : 'stationary'
    });
  });

  return items;
};

interface FleetManagementProps {
  profile: Profile;
}

export const FleetManagement: React.FC<FleetManagementProps> = ({ profile }) => {
  const { addToast } = useToast();
  const { theme } = useTheme();

  const routeProgressRef = useRef<Record<string, { targetIndex: number; progress: number }>>({});

  // Local storage initialization for instant rendering
  const cacheKey = `fleet_vehicles_${profile.company_id || 'default'}`;
  const [vehicles, setVehicles] = useState<TK116Device[]>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn("Error reading cached fleet vehicles:", e);
    }
    return INITIAL_DEFAULT_UNITS.map((u, i) => ({
      ...u,
      id: `dev-${i + 1}`,
      pathHistory: [[u.lat, u.lng]],
      alerts: []
    }));
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => vehicles[0]?.id || 'dev-1');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(() => vehicles.map(v => v.id));
  const [activeSubTab, setActiveSubTab] = useState<'map' | 'history' | 'packets' | 'guide'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'moving' | 'stationary' | 'offline'>('all');
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');
  const [mobileTab, setMobileTab] = useState<'map' | 'units'>('map');

  // Modals & UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [terminalLogs, setTerminalLogs] = useState<RawPacket[]>([]);

  // Multi-vehicle selection handlers
  const handleToggleVehicleSelect = useCallback((id: string) => {
    setSelectedVehicleIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(vId => vId !== id);
      } else {
        return [...prev, id];
      }
    });
    setSelectedVehicleId(id);
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedVehicleIds.length === vehicles.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(vehicles.map(v => v.id));
    }
  }, [selectedVehicleIds.length, vehicles]);

  const visibleVehicles = useMemo(() => {
    return vehicles.filter(v => selectedVehicleIds.includes(v.id));
  }, [vehicles, selectedVehicleIds]);

  // Selected vehicle reference
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // Save vehicles to local cache whenever state updates
  useEffect(() => {
    try {
      if (vehicles.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(vehicles));
      }
    } catch (e) {
      console.warn("Error caching fleet vehicles:", e);
    }
  }, [vehicles, cacheKey]);

  // Fetch real units from Supabase in background
  const fetchTrackingUnits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tracking_units')
        .select('*')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      if (data && data.length > 0) {
        const loaded: TK116Device[] = data.map((item, idx) => ({
          id: item.id,
          name: item.name || `Unit ${idx + 1}`,
          plate: item.plate || 'NO PLATE',
          imei: item.imei || '354188046000000',
          simNumber: item.sim_number || '+27 82 000 0000',
          model: item.model || 'Eelink TK116 4G',
          status: (item.status as any) || 'stationary',
          lat: Number(item.lat) || -26.2041 + (idx * 0.02),
          lng: Number(item.lng) || 28.0473 + (idx * 0.02),
          speed: Number(item.speed) || 0,
          course: Number(item.course) || 0,
          batteryVoltage: Number(item.battery_voltage) || 12600,
          batteryPercent: Number(item.battery_percent) || 95,
          accStatus: Boolean(item.acc_status),
          mileage: Number(item.mileage) || 100000,
          lastUpdate: item.updated_at ? new Date(item.updated_at).toLocaleTimeString() : 'Just now',
          speedLimit: Number(item.speed_limit) || 120,
          pathHistory: [[Number(item.lat) || -26.2041, Number(item.lng) || 28.0473]],
          alerts: []
        }));
        setVehicles(loaded);
      }
    } catch (err: any) {
      console.warn("Supabase tracking units sync (using cached/fallback):", err.message);
    }
  }, [profile.company_id]);

  useEffect(() => {
    fetchTrackingUnits();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('public-tracking-units')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking_units' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const item = payload.new;
          const newV: TK116Device = {
            id: item.id,
            name: item.name || `Unit`,
            plate: item.plate || 'NO PLATE',
            imei: item.imei || '354188046000000',
            simNumber: item.sim_number || '+27 82 000 0000',
            model: item.model || 'Eelink TK116 4G',
            status: (item.status as any) || 'stationary',
            lat: Number(item.lat) || -26.2041,
            lng: Number(item.lng) || 28.0473,
            speed: Number(item.speed) || 0,
            course: Number(item.course) || 0,
            batteryVoltage: Number(item.battery_voltage) || 12600,
            batteryPercent: Number(item.battery_percent) || 95,
            accStatus: Boolean(item.acc_status),
            mileage: Number(item.mileage) || 100000,
            lastUpdate: item.updated_at ? new Date(item.updated_at).toLocaleTimeString() : 'Just now',
            speedLimit: Number(item.speed_limit) || 120,
            pathHistory: [[Number(item.lat) || -26.2041, Number(item.lng) || 28.0473]],
            alerts: []
          };
          setVehicles(prev => {
            if (prev.some(v => v.id === newV.id)) return prev;
            return [...prev, newV];
          });
        } else if (payload.eventType === 'UPDATE') {
          const item = payload.new;
          setVehicles(prev => prev.map(v => {
            if (v.id === item.id) {
              const updatedLat = Number(item.lat) || v.lat;
              const updatedLng = Number(item.lng) || v.lng;
              const pathHistory = [...v.pathHistory];
              if (pathHistory.length === 0 || pathHistory[pathHistory.length - 1][0] !== updatedLat || pathHistory[pathHistory.length - 1][1] !== updatedLng) {
                pathHistory.push([updatedLat, updatedLng]);
                if (pathHistory.length > 50) pathHistory.shift();
              }
              return {
                ...v,
                name: item.name || v.name,
                plate: item.plate || v.plate,
                imei: item.imei || v.imei,
                simNumber: item.sim_number || v.simNumber,
                model: item.model || v.model,
                status: (item.status as any) || v.status,
                lat: updatedLat,
                lng: updatedLng,
                speed: Number(item.speed) !== undefined ? Number(item.speed) : v.speed,
                course: Number(item.course) !== undefined ? Number(item.course) : v.course,
                batteryVoltage: Number(item.battery_voltage) || v.batteryVoltage,
                batteryPercent: Number(item.battery_percent) || v.batteryPercent,
                accStatus: item.acc_status !== undefined ? Boolean(item.acc_status) : v.accStatus,
                mileage: Number(item.mileage) || v.mileage,
                lastUpdate: item.updated_at ? new Date(item.updated_at).toLocaleTimeString() : v.lastUpdate,
                speedLimit: Number(item.speed_limit) || v.speedLimit,
                pathHistory
              };
            }
            return v;
          }));
        } else if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) {
            setVehicles(prev => prev.filter(v => v.id !== oldId));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrackingUnits]);

  // Smooth live telemetry pulse for active moving vehicles (Movement & Speed & ACC Ignition monitoring)
  useEffect(() => {
    const timer = setInterval(() => {
      setVehicles(prevVehicles => {
        return prevVehicles.map(v => {
          if (v.status !== 'moving') return v;

          const route = getRoadRouteForVehicle(v);
          let state = routeProgressRef.current[v.id];

          if (!state || state.targetIndex >= route.length) {
            let minDist = Infinity;
            let nearestIdx = 1;
            for (let i = 0; i < route.length; i++) {
              const d = Math.hypot(route[i][0] - v.lat, route[i][1] - v.lng);
              if (d < minDist) {
                minDist = d;
                nearestIdx = (i + 1) % route.length;
              }
            }
            state = { targetIndex: nearestIdx, progress: 0 };
          }

          const prevIndex = (state.targetIndex - 1 + route.length) % route.length;
          const startPt = route[prevIndex];
          const endPt = route[state.targetIndex];

          const dLat = endPt[0] - startPt[0];
          const dLng = endPt[1] - startPt[1];
          const segmentLen = Math.hypot(dLat, dLng) || 0.0001;

          const stepSize = Math.max(0.08, Math.min(0.25, ((v.speed || 50) / 3600) / (segmentLen * 111)));

          let newProgress = state.progress + stepSize;
          let newTargetIndex = state.targetIndex;

          if (newProgress >= 1) {
            newProgress = 0;
            newTargetIndex = (state.targetIndex + 1) % route.length;
          }

          routeProgressRef.current[v.id] = { targetIndex: newTargetIndex, progress: newProgress };

          const currentStart = route[(newTargetIndex - 1 + route.length) % route.length];
          const currentEnd = route[newTargetIndex];

          const newLat = Number((currentStart[0] + (currentEnd[0] - currentStart[0]) * newProgress).toFixed(6));
          const newLng = Number((currentStart[1] + (currentEnd[1] - currentStart[1]) * newProgress).toFixed(6));

          const segLat = currentEnd[0] - currentStart[0];
          const segLng = currentEnd[1] - currentStart[1];
          const courseRad = Math.atan2(segLng, segLat);
          const newCourse = Math.round((courseRad * 180 / Math.PI + 360) % 360);

          const newPath = [...v.pathHistory, [newLat, newLng] as [number, number]].slice(-30);

          // Random slight speed variation to reflect real-world vehicle flow
          const currentSpeed = Math.max(25, Math.min(v.speedLimit || 120, v.speed + Math.floor(Math.random() * 7) - 3));

          return {
            ...v,
            lat: newLat,
            lng: newLng,
            speed: currentSpeed,
            course: newCourse,
            accStatus: true, // Moving vehicle has ignition ON
            mileage: v.mileage + Math.floor(currentSpeed / 10),
            pathHistory: newPath,
            lastUpdate: 'Just now'
          };
        });
      });
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // Periodic Telemetry Log Stream generator for inspector
  useEffect(() => {
    const timer = setInterval(() => {
      if (vehicles.length === 0) return;
      const movingUnits = vehicles.filter(v => v.status === 'moving');
      const unit = movingUnits.length > 0 ? movingUnits[Math.floor(Math.random() * movingUnits.length)] : vehicles[0];
      if (!unit) return;

      const log: RawPacket = {
        id: `pkt-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        imei: unit.imei,
        direction: 'UP',
        pid: '0x12',
        pidName: 'GPS & Telemetry Location Report',
        rawHex: `67671200150001${Math.abs(Math.floor(unit.lat * 100000)).toString(16).padStart(8, '0')}${Math.abs(Math.floor(unit.lng * 100000)).toString(16).padStart(8, '0')}${unit.speed.toString(16).padStart(2, '0')}${unit.accStatus ? '01' : '00'}0001`,
        decoded: {
          lat: unit.lat,
          lng: unit.lng,
          speed: unit.speed,
          acc: unit.accStatus,
          course: unit.course,
          status: unit.status
        }
      };

      setTerminalLogs(prev => [log, ...prev].slice(0, 30));
    }, 4000);

    return () => clearInterval(timer);
  }, [vehicles]);

  // Filtered vehicle list for sidebar
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            v.imei.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [vehicles, searchQuery, statusFilter]);

  // Vehicle counts
  const stats = useMemo(() => {
    const moving = vehicles.filter(v => v.status === 'moving').length;
    const stationary = vehicles.filter(v => v.status === 'stationary').length;
    const offline = vehicles.filter(v => v.status === 'offline').length;
    return { total: vehicles.length, moving, stationary, offline };
  }, [vehicles]);

  // Edit tracking unit modal trigger
  const handleEditVehicle = (vehicle: TK116Device) => {
    setEditingUnit({
      id: vehicle.id,
      name: vehicle.name,
      plate: vehicle.plate,
      imei: vehicle.imei,
      model: vehicle.model || 'Eelink TK116 (4G LTE)',
      sim_number: vehicle.simNumber || '',
      speed_limit: vehicle.speedLimit || 120
    });
    setIsModalOpen(true);
  };

  // Delete tracking unit handler
  const handleDeleteVehicle = async (vehicleId: string, vehicleName: string) => {
    if (!window.confirm(`Are you sure you want to delete tracking unit "${vehicleName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await supabase.from('tracking_units').delete().eq('id', vehicleId);
    } catch (err) {
      console.warn("Error deleting tracking unit from Supabase (removing locally):", err);
    }

    setVehicles(prev => {
      const updated = prev.filter(v => v.id !== vehicleId);
      if (selectedVehicleId === vehicleId && updated.length > 0) {
        setSelectedVehicleId(updated[0].id);
      }
      return updated;
    });

    addToast(`Tracking unit "${vehicleName}" deleted successfully`, 'info');
  };

  // Selected vehicle trip history
  const historyItems = useMemo(() => {
    if (!selectedVehicle) return [];
    return generateHistoryForUnit(selectedVehicle);
  }, [selectedVehicle]);

  return (
    <div id="fleet-tracking-container" className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors overflow-hidden">
      
      {/* Top Header Bar */}
      <div id="tracking-header" className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-inner">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Live Vehicle Tracking
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Live Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Movement Coordinates, Speed (km/h) &amp; ACC Ignition Status
            </p>
          </div>
        </div>

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto py-1">
          <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/50 text-xs flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Total Units:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{stats.total}</span>
          </div>

          <div className="bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Moving: <strong className="font-extrabold">{stats.moving}</strong></span>
          </div>

          <div className="bg-amber-500/10 dark:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/20 text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Stationary: <strong className="font-extrabold">{stats.stationary}</strong></span>
          </div>

          <button
            id="add-tracking-unit-btn"
            onClick={() => {
              setEditingUnit(null);
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vehicle Unit</span>
          </button>
        </div>
      </div>

      {/* Mobile Screen View Switcher */}
      <div id="mobile-view-tabs" className="md:hidden bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-1.5 shrink-0 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'map'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Compass className="w-4 h-4 text-blue-400" />
          <span>Interactive Map</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('units')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'units'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Car className="w-4 h-4 text-emerald-400" />
          <span>Vehicle List ({filteredVehicles.length})</span>
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">

        {/* Sidebar: Vehicle List & Filters */}
        <div 
          id="vehicles-sidebar" 
          className={`w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col shrink-0 overflow-hidden ${
            mobileTab === 'units' ? 'flex flex-grow h-full' : 'hidden md:flex'
          }`}
        >
          
          {/* Search & Status Filters */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="vehicle-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vehicle name, plate, IMEI..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl text-[11px] font-semibold">
              {(['all', 'moving', 'stationary', 'offline'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`flex-1 py-1 rounded-lg uppercase font-bold tracking-wider transition-all cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Unit List */}
          <div className="flex-grow overflow-y-auto p-3 space-y-2.5">
            <div className="flex items-center justify-between pb-1 px-1 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Monitored Units ({selectedVehicleIds.length}/{vehicles.length})</span>
              <button
                onClick={handleToggleSelectAll}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer uppercase font-bold"
              >
                {selectedVehicleIds.length === vehicles.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-400">
                <Navigation className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No vehicles matched criteria</p>
              </div>
            ) : (
              filteredVehicles.map(unit => {
                const isSelected = unit.id === selectedVehicleId;
                const isChecked = selectedVehicleIds.includes(unit.id);
                const statusBg = unit.status === 'moving' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : unit.status === 'stationary'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : 'bg-slate-500/10 text-slate-500 border-slate-500/20';

                return (
                  <div
                    key={unit.id}
                    id={`vehicle-card-${unit.id}`}
                    onClick={() => {
                      setSelectedVehicleId(unit.id);
                      if (!isChecked) {
                        setSelectedVehicleIds(prev => [...prev, unit.id]);
                      }
                      setMobileTab('map');
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-500 shadow-sm'
                        : isChecked
                        ? 'bg-white dark:bg-slate-900/60 border-slate-300 dark:border-slate-700'
                        : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleVehicleSelect(unit.id);
                          }}
                          className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {unit.name}
                          </h3>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {unit.plate} &bull; <span className="text-[10px]">{unit.imei}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEditVehicle(unit)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                          title="Edit Unit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(unit.id, unit.name)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                          title="Delete Unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBg}`}>
                          {unit.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Dedicated Primary Telemetry Bar: Speed & Ignition Status */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      {/* Speed Display */}
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                        <Gauge className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Speed: <strong className="font-bold text-slate-900 dark:text-slate-100 font-mono">{unit.speed}</strong> km/h</span>
                      </div>

                      {/* Ignition Status Display */}
                      <div className="flex items-center justify-end gap-1.5">
                        <KeyRound className={`w-3.5 h-3.5 ${unit.accStatus ? 'text-emerald-500' : 'text-slate-400'} shrink-0`} />
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          unit.accStatus
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
                        }`}>
                          {unit.accStatus ? 'IGNITION ON' : 'IGNITION OFF'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel: Map & Streamlined Sub-Tabs */}
        <div 
          id="tracking-main-panel"
          className={`flex-grow flex-col overflow-hidden relative ${
            mobileTab === 'map' ? 'flex flex-grow h-full min-h-[350px]' : 'hidden md:flex'
          }`}
        >

          {/* Sub-Nav Bar: Map, History, Telemetry Stream, Hardware Guide */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 shrink-0 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1">
              <button
                id="tab-map-btn"
                onClick={() => setActiveSubTab('map')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeSubTab === 'map'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Live Map Tracking</span>
              </button>

              <button
                id="tab-history-btn"
                onClick={() => setActiveSubTab('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeSubTab === 'history'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Trip &amp; Movement Logs</span>
              </button>

              <button
                id="tab-packets-btn"
                onClick={() => setActiveSubTab('packets')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeSubTab === 'packets'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Live Telemetry Stream</span>
              </button>

              <button
                id="tab-guide-btn"
                onClick={() => setActiveSubTab('guide')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeSubTab === 'guide'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Tracker Pinout &amp; Setup</span>
              </button>
            </div>

            {/* Map Style Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Layer:</span>
              <button
                onClick={() => setMapStyle(prev => prev === 'street' ? 'satellite' : 'street')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
              >
                <Layers className="w-3 h-3 text-blue-500" />
                <span className="uppercase font-bold tracking-wider">{mapStyle.toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Sub-Tab 1: Live Interactive Leaflet Map */}
          {activeSubTab === 'map' && (
            <div className="flex-grow flex flex-col w-full h-full min-h-[400px]">
              
              {/* Telemetry Summary Header */}
              <div className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
                {/* Active Unit Focus & Key Metrics */}
                {selectedVehicle ? (
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{selectedVehicle.name}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">({selectedVehicle.plate})</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        selectedVehicle.status === 'moving' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                        selectedVehicle.status === 'stationary' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {selectedVehicle.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Speed Indicator */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <Gauge className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-slate-500 dark:text-slate-400">Speed:</span>
                      <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedVehicle.speed} km/h</strong>
                    </div>

                    {/* Ignition Indicator */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                      selectedVehicle.accStatus 
                        ? 'bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{selectedVehicle.accStatus ? 'ACC IGNITION: ON' : 'ACC IGNITION: OFF'}</span>
                    </div>

                    {/* Coordinates */}
                    <div className="hidden lg:flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3 h-3 text-red-500" />
                      <span>{selectedVehicle.lat.toFixed(5)}, {selectedVehicle.lng.toFixed(5)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Select a vehicle from the left to monitor live metrics</div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {selectedVehicleIds.length} of {vehicles.length} Shown on Map
                  </span>
                </div>
              </div>

              {/* Leaflet Map Canvas */}
              <div className="flex-grow w-full h-full min-h-[350px] relative">
                <MapContainer
                  center={[-26.2041, 28.0473]}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="w-full h-full z-10"
                  style={{ height: '100%', width: '100%' }}
                >
                  {mapStyle === 'street' ? (
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                  ) : (
                    <>
                      <TileLayer
                        attribution="Tiles &copy; Esri"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      />
                      <TileLayer
                        url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        pane="overlayPane"
                      />
                    </>
                  )}

                  <MapBoundsController vehicles={visibleVehicles} activeVehicleId={selectedVehicleId} />

                  {/* Route Breadcrumb Polyline for Selected Unit */}
                  {selectedVehicle && selectedVehicle.pathHistory.length > 1 && (
                    <Polyline
                      positions={selectedVehicle.pathHistory}
                      color="#2563EB"
                      weight={4}
                      opacity={0.85}
                      dashArray="5, 8"
                    />
                  )}

                  {/* Plotted Vehicle Markers with Directional Orientation */}
                  {visibleVehicles.map(v => {
                    const isSel = v.id === selectedVehicleId;
                    const color = v.status === 'moving' ? '#10B981' : v.status === 'stationary' ? '#F59E0B' : '#64748B';

                    const customIcon = L.divIcon({
                      className: 'custom-vehicle-marker',
                      html: `
                        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
                          <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: ${color}33; border: 2px solid ${color}; transform: ${isSel ? 'scale(1.2)' : 'scale(1)'}; transition: all 0.3s;"></div>
                          <div style="width: 22px; height: 22px; border-radius: 50%; background-color: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; transform: rotate(${v.course}deg); box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                            &#10148;
                          </div>
                        </div>
                      `,
                      iconSize: [38, 38],
                      iconAnchor: [19, 19]
                    });

                    return (
                      <Marker
                        key={v.id}
                        position={[v.lat, v.lng]}
                        icon={customIcon}
                        eventHandlers={{
                          click: () => setSelectedVehicleId(v.id)
                        }}
                      >
                        <Popup className="custom-leaflet-popup">
                          <div className="p-1 min-w-[190px]">
                            <h4 className="font-bold text-xs text-slate-900 mb-0.5">{v.name}</h4>
                            <p className="text-[11px] font-mono text-slate-500 mb-2">{v.plate}</p>
                            <div className="space-y-1.5 text-[11px] text-slate-700">
                              <div className="flex justify-between items-center">
                                <span>Movement Status:</span>
                                <strong className="uppercase font-bold">{v.status.toUpperCase()}</strong>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Speed:</span>
                                <strong className="font-mono text-blue-600 font-bold">{v.speed} km/h</strong>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Ignition ACC:</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                                  v.accStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {v.accStatus ? 'ACC ON' : 'ACC OFF'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t">
                                <span>Last Ping:</span>
                                <span>{v.lastUpdate}</span>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Trip & Movement Logs */}
          {activeSubTab === 'history' && (
            <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-950">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Historical Movement &amp; Telemetry Pings &bull; {selectedVehicle?.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sequential GPS breadcrumbs, speed records, and ignition state events
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">
                      Plate: <strong className="text-slate-900 dark:text-slate-100">{selectedVehicle?.plate}</strong>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Event / Status</th>
                        <th className="py-2.5 px-3">GPS Coordinates</th>
                        <th className="py-2.5 px-3">Speed (km/h)</th>
                        <th className="py-2.5 px-3">Ignition State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {historyItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{item.timestamp}</td>
                          <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${item.status === 'moving' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {item.event}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">{item.lat}, {item.lng}</td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{item.speed}</span> <span className="text-[10px] text-slate-400">km/h</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                              item.accStatus 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                            }`}>
                              {item.accStatus ? 'ACC ON' : 'ACC OFF'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Live Telemetry Stream / Inspector */}
          {activeSubTab === 'packets' && (
            <div className="flex-grow p-4 overflow-y-auto bg-slate-950 text-slate-200 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live GPRS Location &amp; ACC Telemetry Stream
                </span>
                <button
                  onClick={() => setTerminalLogs([])}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans font-bold cursor-pointer"
                >
                  Clear Feed
                </button>
              </div>

              {terminalLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-16">
                  <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Listening for real-time GPRS GPS pings (Movement, Speed, ACC Ignition)...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {terminalLogs.map(p => (
                    <div key={p.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                        <span>[{p.timestamp}] Tracker IMEI: <strong className="text-slate-200">{p.imei}</strong></span>
                        <span className="text-emerald-400 font-bold">&uarr; TELEMETRY IN</span>
                      </div>
                      <div className="text-slate-200 font-semibold mb-1 flex items-center justify-between">
                        <span>{p.pidName} ({p.pid})</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-blue-400 font-bold">Speed: {p.decoded.speed} km/h</span>
                          <span className={p.decoded.acc ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                            {p.decoded.acc ? 'ACC ON' : 'ACC OFF'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-2 rounded text-[10px] text-emerald-400 overflow-x-auto break-all font-mono">
                        {p.rawHex}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 4: Tracker Pinout & Setup Guide (3-Wire Setup: Power, Ground, Ignition ACC) */}
          {activeSubTab === 'guide' && (
            <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-6 bg-slate-50 dark:bg-slate-950 text-xs">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Standard 3-Wire GPS Tracker Installation (Movement, Speed &amp; Ignition)
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      Clean configuration guide for monitoring vehicle movements, real-time speed, and ACC ignition status without engine immobilizer relays.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: 3-Wire Harness Pinout */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                      <span>Vehicle Wire Harness (3-Wire Safe Installation)</span>
                    </div>
                    <div className="space-y-1.5 text-slate-600 dark:text-slate-300 pt-1">
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-red-500">&bull; Red Wire (Power):</span>
                        <span>12V–24V Constant Battery Supply (+)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-slate-900 dark:text-white">&bull; Black Wire (Ground):</span>
                        <span>Vehicle Chassis Ground (GND)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-amber-500">&bull; Yellow Wire (ACC Input):</span>
                        <span>Ignition Switch Line (+12V when key ON)</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1">
                      No relay wiring or fuel pump interruption required. The tracker reads the ACC voltage to determine engine status safely.
                    </p>
                  </div>

                  {/* Step 2: GPRS & APN SMS Configuration */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                      <span>SMS Gateway Configuration</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Send the standard setup SMS commands to configure the TCP endpoint and reporting intervals:
                    </p>
                    <div className="bg-slate-900 text-blue-400 p-2.5 rounded-lg font-mono text-[11px] space-y-1">
                      <div>SERVER,1,gps.rapid911.co.za,7018,0#</div>
                      <div>APN,internet#</div>
                      <div>TIMER,30,30#</div>
                      <div>STATUS#</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong className="block mb-1">Telemetry Data Fields Monitored:</strong>
                  The GPS receiver and internal accelerometer transmit coordinates (Latitude, Longitude), Doppler speed (km/h), and hardware ACC pin voltage (High = ACC ON, Low = ACC OFF) every 10–30 seconds.
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Add / Edit Unit Modal */}
      <TrackingUnitModal
        profile={profile}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUnit(null);
        }}
        initialData={editingUnit}
        onSave={(savedUnit) => {
          setIsModalOpen(false);
          setEditingUnit(null);

          setVehicles(prev => {
            const index = prev.findIndex(v => v.id === savedUnit.id);
            if (index >= 0) {
              const copy = [...prev];
              copy[index] = {
                ...copy[index],
                name: savedUnit.name || copy[index].name,
                plate: savedUnit.plate || copy[index].plate,
                imei: savedUnit.imei || copy[index].imei,
                model: savedUnit.model || copy[index].model,
                simNumber: savedUnit.sim_number || copy[index].simNumber,
                speedLimit: savedUnit.speed_limit || copy[index].speedLimit
              };
              return copy;
            } else {
              const newDev: TK116Device = {
                id: savedUnit.id || `dev-${Date.now()}`,
                name: savedUnit.name,
                plate: savedUnit.plate,
                imei: savedUnit.imei,
                simNumber: savedUnit.sim_number || '+27 82 000 0000',
                model: savedUnit.model || 'Eelink TK116 4G',
                status: 'stationary',
                lat: -26.2041,
                lng: 28.0473,
                speed: 0,
                course: 0,
                batteryVoltage: 12800,
                batteryPercent: 100,
                accStatus: false,
                mileage: 12000,
                lastUpdate: 'Just now',
                speedLimit: savedUnit.speed_limit || 120,
                pathHistory: [[-26.2041, 28.0473]],
                alerts: []
              };
              setSelectedVehicleId(newDev.id);
              return [newDev, ...prev];
            }
          });

          fetchTrackingUnits();
          addToast(`Tracking unit ${savedUnit.name} saved successfully`, 'success');
        }}
      />
    </div>
  );
};

export default FleetManagement;

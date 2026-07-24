import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Navigation, 
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
  Gauge,
  MapPin,
  Copy,
  Plus,
  Search,
  CheckCircle2,
  Radio,
  Layers,
  Fuel,
  KeyRound,
  Pencil,
  Trash2,
  Shield,
  Target,
  Bell,
  Check
} from 'lucide-react';
import { Profile } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../utils/supabase';
import { TrackingUnitModal } from './TrackingUnitModal';
import { TripSummaryCard } from './TripSummaryCard';
import { GeofenceModal, GeofenceZone } from './GeofenceModal';

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
  fuelCut: boolean; // Relay ON/OFF (Fuel Cut Triggered)
  mileage: number; // in meters
  fuelLevel: number; // in percentage
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
  fuelLevel: number;
  accStatus: boolean;
  status: string;
}

export interface RawPacket {
  id: string;
  timestamp: string;
  imei: string;
  direction: 'UP' | 'DOWN';
  pid: string; // "0x12", "0x13", "0x80", etc.
  pidName: string;
  rawHex: string;
  decoded: Record<string, any>;
}

const MapBoundsController: React.FC<{
  vehicles: TK116Device[];
  activeVehicleId: string | null;
}> = ({ vehicles, activeVehicleId }) => {
  const map = useMap();
  const lastKeyRef = useRef<string>('');

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
          map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true, duration: 0.8 });
        }
      } catch (err) {
        console.error("Error setting map bounds:", err);
      }
    }
  }, [vehicles, activeVehicleId, map]);

  return null;
};

// Haversine distance calculation in meters
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Ray-casting point-in-polygon algorithm
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false;
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const MapClickHandler: React.FC<{
  isDrawing: boolean;
  onMapClick: (coords: [number, number]) => void;
}> = ({ isDrawing, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
};

const INITIAL_DEFAULT_GEOFENCES: GeofenceZone[] = [
  {
    id: 'gf-1',
    name: 'JHB CBD Central Patrol Precinct',
    type: 'circle',
    center: [-26.2041, 28.0473],
    radius: 1200,
    polygonPoints: [],
    targetUnitIds: ['all'],
    alertOnEntry: true,
    alertOnExit: true,
    color: '#3B82F6',
    status: 'active',
    description: 'Primary Dispatch Command & Central Response Radius'
  },
  {
    id: 'gf-2',
    name: 'Sandton Corporate Sector',
    type: 'circle',
    center: [-26.1076, 28.0567],
    radius: 1800,
    polygonPoints: [],
    targetUnitIds: ['all'],
    alertOnEntry: true,
    alertOnExit: true,
    color: '#10B981',
    status: 'active',
    description: 'High Value Commercial District Guard Zone'
  },
  {
    id: 'gf-3',
    name: 'Hillbrow High Risk Security Zone',
    type: 'polygon',
    center: [-26.188, 28.052],
    radius: 0,
    polygonPoints: [
      [-26.182, 28.042],
      [-26.182, 28.062],
      [-26.196, 28.062],
      [-26.196, 28.042]
    ],
    targetUnitIds: ['all'],
    alertOnEntry: true,
    alertOnExit: true,
    color: '#EF4444',
    status: 'active',
    description: 'Priority Rapid Response Sector'
  }
];

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
    speed: 52,
    course: 140,
    batteryVoltage: 12800,
    batteryPercent: 98,
    accStatus: true,
    fuelCut: false,
    mileage: 142850,
    fuelLevel: 84,
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
    fuelCut: false,
    mileage: 210450,
    fuelLevel: 62,
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
    fuelCut: false,
    mileage: 98200,
    fuelLevel: 91,
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
    fuelCut: false,
    mileage: 175600,
    fuelLevel: 45,
    lastUpdate: 'Just now',
    speedLimit: 120
  }
];

const generateHistoryForUnit = (unit: TK116Device): TripHistoryItem[] => {
  const items: TripHistoryItem[] = [];
  const baseLat = unit.lat;
  const baseLng = unit.lng;
  const now = new Date();

  const events = [
    { label: 'Routine Location Ping', speed: 48, acc: true, fuelOffset: 0.5, mileageOffset: -2000, timeOffset: 5 },
    { label: 'Speeding Alert (Over 120 km/h)', speed: 128, acc: true, fuelOffset: 1.2, mileageOffset: -8000, timeOffset: 25 },
    { label: 'Routine Location Ping', speed: 65, acc: true, fuelOffset: 2.0, mileageOffset: -14000, timeOffset: 50 },
    { label: 'ACC Ignition OFF', speed: 0, acc: false, fuelOffset: 2.1, mileageOffset: -18000, timeOffset: 90 },
    { label: 'ACC Ignition ON', speed: 0, acc: true, fuelOffset: 2.1, mileageOffset: -18000, timeOffset: 110 },
    { label: 'Geofence Exit: Depot Precinct', speed: 35, acc: true, fuelOffset: 3.5, mileageOffset: -25000, timeOffset: 150 },
    { label: 'Routine Location Ping', speed: 50, acc: true, fuelOffset: 4.8, mileageOffset: -32000, timeOffset: 210 },
  ];

  events.forEach((ev, idx) => {
    const eventTime = new Date(now.getTime() - ev.timeOffset * 60 * 1000);
    const latOffset = Math.sin(idx * 0.7) * 0.012;
    const lngOffset = Math.cos(idx * 0.7) * 0.012;

    items.push({
      id: `${unit.id}-hist-${idx}`,
      timestamp: eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      event: ev.label,
      lat: Number((baseLat + latOffset).toFixed(6)),
      lng: Number((baseLng + lngOffset).toFixed(6)),
      speed: ev.speed,
      mileage: Math.max(1000, Math.floor(unit.mileage - ev.mileageOffset)),
      fuelLevel: Math.min(100, Math.max(10, Math.floor(unit.fuelLevel - ev.fuelOffset))),
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

  // Instant local storage initialization
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
  const [activeSubTab, setActiveSubTab] = useState<'map' | 'geofence' | 'cmd' | 'guide' | 'packets' | 'history'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'moving' | 'stationary' | 'offline'>('all');
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');

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

  // Geofence states & alerts
  const geofenceCacheKey = `geofence_zones_${profile.company_id || 'default'}`;
  const [geofences, setGeofences] = useState<GeofenceZone[]>(() => {
    try {
      const cached = localStorage.getItem(geofenceCacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn("Error loading cached geofence zones:", e);
    }
    return INITIAL_DEFAULT_GEOFENCES;
  });

  const [geofenceAlerts, setGeofenceAlerts] = useState<Array<{
    id: string;
    timestamp: string;
    unitName: string;
    geofenceName: string;
    type: 'entry' | 'exit';
    color: string;
  }>>([]);

  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<GeofenceZone | null>(null);
  const [isDrawingGeofence, setIsDrawingGeofence] = useState(false);
  const [drawingGeofenceType, setDrawingGeofenceType] = useState<'circle' | 'polygon'>('circle');
  const [drawnGeofencePoints, setDrawnGeofencePoints] = useState<[number, number][]>([]);
  const geofenceStatesRef = useRef<{ [key: string]: boolean }>({});

  // Cache geofences
  useEffect(() => {
    try {
      localStorage.setItem(geofenceCacheKey, JSON.stringify(geofences));
    } catch (e) {
      console.warn("Error caching geofences:", e);
    }
  }, [geofences, geofenceCacheKey]);
  
  // Modals & UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [commandInput, setCommandInput] = useState('');
  const [speedLimitInput, setSpeedLimitInput] = useState('120');
  const [isSendingCmd, setIsSendingCmd] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<RawPacket[]>([]);

  // Selected vehicle reference
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // Geofence Boundary Check Engine
  useEffect(() => {
    if (vehicles.length === 0 || geofences.length === 0) return;

    const activeZones = geofences.filter(g => g.status === 'active');

    activeZones.forEach(gf => {
      vehicles.forEach(v => {
        const isTargeted = gf.targetUnitIds.includes('all') || gf.targetUnitIds.includes(v.id);
        if (!isTargeted) return;

        let isInside = false;
        if (gf.type === 'circle') {
          const dist = getDistanceMeters(v.lat, v.lng, gf.center[0], gf.center[1]);
          isInside = dist <= gf.radius;
        } else if (gf.type === 'polygon' && gf.polygonPoints.length >= 3) {
          isInside = isPointInPolygon([v.lat, v.lng], gf.polygonPoints);
        }

        const key = `${v.id}_${gf.id}`;
        const prevState = geofenceStatesRef.current[key];

        if (prevState !== undefined) {
          // Entry Event
          if (!prevState && isInside && gf.alertOnEntry) {
            const alertText = `🚨 GEOFENCE ENTRY: ${v.name} (${v.plate}) entered "${gf.name}"`;
            addToast(alertText, 'warning');

            const alertLog = {
              id: `gf-alert-${Date.now()}-${Math.random()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              unitName: v.name,
              geofenceName: gf.name,
              type: 'entry' as const,
              color: gf.color
            };

            setGeofenceAlerts(prev => [alertLog, ...prev].slice(0, 50));
            setVehicles(prevVehicles =>
              prevVehicles.map(unit =>
                unit.id === v.id
                  ? { ...unit, alerts: [alertText, ...unit.alerts].slice(0, 10) }
                  : unit
              )
            );
          }

          // Exit Event
          if (prevState && !isInside && gf.alertOnExit) {
            const alertText = `⚠️ GEOFENCE EXIT: ${v.name} (${v.plate}) exited "${gf.name}"`;
            addToast(alertText, 'info');

            const alertLog = {
              id: `gf-alert-${Date.now()}-${Math.random()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              unitName: v.name,
              geofenceName: gf.name,
              type: 'exit' as const,
              color: gf.color
            };

            setGeofenceAlerts(prev => [alertLog, ...prev].slice(0, 50));
            setVehicles(prevVehicles =>
              prevVehicles.map(unit =>
                unit.id === v.id
                  ? { ...unit, alerts: [alertText, ...unit.alerts].slice(0, 10) }
                  : unit
              )
            );
          }
        }

        geofenceStatesRef.current[key] = isInside;
      });
    });
  }, [vehicles, geofences, addToast]);

  const handleSaveGeofence = (zone: GeofenceZone) => {
    setGeofences(prev => {
      const idx = prev.findIndex(g => g.id === zone.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = zone;
        return copy;
      }
      return [zone, ...prev];
    });
    setIsGeofenceModalOpen(false);
    setEditingGeofence(null);
    setIsDrawingGeofence(false);
    setDrawnGeofencePoints([]);
    addToast(`Geofence zone "${zone.name}" saved successfully`, 'success');
  };

  const handleToggleGeofenceStatus = (id: string) => {
    setGeofences(prev => prev.map(g => {
      if (g.id === id) {
        const newStatus = g.status === 'active' ? 'inactive' : 'active';
        addToast(`Geofence "${g.name}" ${newStatus}`, 'info');
        return { ...g, status: newStatus };
      }
      return g;
    }));
  };

  const handleDeleteGeofence = (id: string) => {
    const zone = geofences.find(g => g.id === id);
    if (zone && window.confirm(`Are you sure you want to delete geofence "${zone.name}"?`)) {
      setGeofences(prev => prev.filter(g => g.id !== id));
      addToast(`Geofence "${zone.name}" deleted`, 'info');
    }
  };

  const handleMapGeofenceClick = (coords: [number, number]) => {
    if (drawingGeofenceType === 'circle') {
      setEditingGeofence(null);
      setDrawnGeofencePoints([coords]);
      setIsGeofenceModalOpen(true);
    } else {
      setDrawnGeofencePoints(prev => [...prev, coords]);
    }
  };

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
          fuelCut: Boolean(item.fuel_cut),
          mileage: Number(item.mileage) || 100000,
          fuelLevel: Number(item.fuel_level) || 80,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking_units' }, () => {
        fetchTrackingUnits();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrackingUnits]);

  // Smooth live telemetry pulse for active moving vehicles
  useEffect(() => {
    const timer = setInterval(() => {
      setVehicles(prevVehicles => {
        return prevVehicles.map(v => {
          if (v.status !== 'moving') return v;

          // Tiny GPS movement delta
          const speedFactor = (v.speed || 40) / 36000;
          const rad = (v.course * Math.PI) / 180;
          const dLat = Math.cos(rad) * speedFactor;
          const dLng = Math.sin(rad) * speedFactor;

          const newLat = Number((v.lat + dLat).toFixed(6));
          const newLng = Number((v.lng + dLng).toFixed(6));
          const newPath = [...v.pathHistory, [newLat, newLng] as [number, number]].slice(-25);

          return {
            ...v,
            lat: newLat,
            lng: newLng,
            mileage: v.mileage + Math.floor(v.speed / 10),
            pathHistory: newPath,
            lastUpdate: 'Just now'
          };
        });
      });
    }, 4000);

    return () => clearInterval(timer);
  }, []);

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
    const fuelCutActive = vehicles.filter(v => v.fuelCut).length;
    return { total: vehicles.length, moving, stationary, offline, fuelCutActive };
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

  // Handle Eelink TK116 Relay Fuel Cut / Engine Kill toggle
  const handleToggleEngineRelay = async (vehicle: TK116Device) => {
    const newFuelCutState = !vehicle.fuelCut;
    const cmdText = newFuelCutState ? 'RELAY,1#' : 'RELAY,0#';

    setIsSendingCmd(true);
    addToast(
      `Sending Eelink TK116 command '${cmdText}' to IMEI ${vehicle.imei}...`,
      'info'
    );

    setTimeout(async () => {
      setIsSendingCmd(false);

      // Local update
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, fuelCut: newFuelCutState, status: newFuelCutState ? 'stationary' : v.status } : v));

      // Attempt DB update
      try {
        await supabase.from('tracking_units').update({ fuel_cut: newFuelCutState }).eq('id', vehicle.id);
      } catch (e) {
        // silent
      }

      // Log packet in terminal
      const packet: RawPacket = {
        id: `pkt-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        imei: vehicle.imei,
        direction: 'DOWN',
        pid: '0x80',
        pidName: 'Eelink Relay Cut Command',
        rawHex: `676780000A0001${stringToHex(cmdText)}0001`,
        decoded: { command: cmdText, status: 'ACK RECEIVED - OK', response: newFuelCutState ? 'RELAY,1,OK#' : 'RELAY,0,OK#' }
      };
      setTerminalLogs(prev => [packet, ...prev].slice(0, 30));

      addToast(
        newFuelCutState 
          ? `Engine Relay CUT triggered for ${vehicle.name} (${vehicle.plate})`
          : `Engine Relay RESTORED for ${vehicle.name} (${vehicle.plate})`,
        newFuelCutState ? 'warning' : 'success'
      );
    }, 1200);
  };

  // Send custom TK116 command
  const handleSendCustomCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !selectedVehicle) return;

    const rawCmd = commandInput.trim().toUpperCase();
    setIsSendingCmd(true);

    setTimeout(() => {
      setIsSendingCmd(false);
      setCommandInput('');

      const log: RawPacket = {
        id: `pkt-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        imei: selectedVehicle.imei,
        direction: 'DOWN',
        pid: '0x80',
        pidName: 'Custom Command Package',
        rawHex: `67678000100001${stringToHex(rawCmd)}`,
        decoded: { command: rawCmd, response: `${rawCmd},OK#` }
      };
      setTerminalLogs(prev => [log, ...prev].slice(0, 30));
      addToast(`Command '${rawCmd}' sent successfully to ${selectedVehicle.name}`, 'success');
    }, 800);
  };

  // Helper string to hex converter
  function stringToHex(str: string): string {
    return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join('');
  }

  // Selected vehicle trip history
  const historyItems = useMemo(() => {
    if (!selectedVehicle) return [];
    return generateHistoryForUnit(selectedVehicle);
  }, [selectedVehicle]);

  // Dynamic tile URL based on current active app theme & user selection
  const tileUrl = useMemo(() => {
    if (mapStyle === 'satellite') {
      return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }
    if (theme === 'dark' || theme === 'matrix') {
      return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    }
    return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  }, [mapStyle, theme]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors overflow-hidden">
      
      {/* Top Bar Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-inner">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Vehicle &amp; Asset Tracking
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Eelink TK116 Ready
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live GPRS Telemetry, Remote Engine Immobilizer &amp; Fleet Analytics
            </p>
          </div>
        </div>

        {/* Stats Badges */}
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

          {stats.fuelCutActive > 0 && (
            <div className="bg-red-500/10 dark:bg-red-500/20 px-3 py-1.5 rounded-xl border border-red-500/20 text-xs flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Relay Cut: {stats.fuelCutActive}</span>
            </div>
          )}

          <button
            onClick={() => {
              setEditingUnit(null);
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add TK116 Unit</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">

        {/* Sidebar: Vehicle List & Filters */}
        <div className="w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden">
          
          {/* Search & Status Filters */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search unit name, plate, IMEI..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl text-[11px] font-semibold">
              {(['all', 'moving', 'stationary', 'offline'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`flex-1 py-1 rounded-lg uppercase font-bold tracking-wider transition-all ${
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
              <span>Plotted Assets ({selectedVehicleIds.length}/{vehicles.length})</span>
              <button
                onClick={handleToggleSelectAll}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer uppercase"
              >
                {selectedVehicleIds.length === vehicles.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-400">
                <Cpu className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No tracking units matched</p>
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
                    onClick={() => {
                      setSelectedVehicleId(unit.id);
                      if (!isChecked) {
                        setSelectedVehicleIds(prev => [...prev, unit.id]);
                      }
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
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                            {unit.name}
                            {unit.fuelCut && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500 text-white animate-pulse shrink-0">
                                RELAY CUT
                              </span>
                            )}
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

                    {/* Telemetry Bar */}
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <Gauge className="w-3 h-3 text-blue-500" />
                        <span className="font-bold text-slate-900 dark:text-slate-100">{unit.speed}</span> km/h
                      </div>

                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <KeyRound className={`w-3 h-3 ${unit.accStatus ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span>ACC: <strong className={unit.accStatus ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>{unit.accStatus ? 'ON' : 'OFF'}</strong></span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 justify-end">
                        <Battery className="w-3 h-3 text-amber-500" />
                        <span>{(unit.batteryVoltage / 1000).toFixed(1)}V</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel: Map & Sub-Tabs */}
        <div className="flex-grow flex flex-col overflow-hidden relative">

          {/* Sub-Nav Bar */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 shrink-0 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveSubTab('map')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'map'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Live Map View
              </button>

              <button
                onClick={() => setActiveSubTab('geofence')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'geofence'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Geofences &amp; Alerts</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300">
                  {geofences.filter(g => g.status === 'active').length}
                </span>
              </button>

              <button
                onClick={() => setActiveSubTab('cmd')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'cmd'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                TK116 Command Center
              </button>

              <button
                onClick={() => setActiveSubTab('guide')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'guide'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                Real Hardware Guide
              </button>

              <button
                onClick={() => setActiveSubTab('packets')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'packets'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                GPRS Packets ({terminalLogs.length})
              </button>

              <button
                onClick={() => setActiveSubTab('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'history'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Trip Logs
              </button>
            </div>

            {/* Map Style Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Map Layer:</span>
              <button
                onClick={() => setMapStyle(prev => prev === 'street' ? 'satellite' : 'street')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200/60 dark:border-slate-700/60"
              >
                <Layers className="w-3 h-3 text-blue-500" />
                <span className="uppercase font-bold tracking-wider">{mapStyle.toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Live Interactive Leaflet Map */}
          {activeSubTab === 'map' && (
            <div className="flex-grow flex flex-col w-full h-full min-h-[400px]">
              
              {/* Dedicated Top Toolbar Bar (No Overlays on Map Canvas) */}
              <div className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
                {/* Left: Plotted Assets & Active Unit Telemetry Header */}
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shrink-0">
                    <Compass className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedVehicleIds.length} of {vehicles.length} Assets Plotted
                    </span>
                    <button
                      onClick={handleToggleSelectAll}
                      className="ml-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase"
                    >
                      {selectedVehicleIds.length === vehicles.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {selectedVehicle && (
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs min-w-0">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate">{selectedVehicle.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({selectedVehicle.plate})</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        selectedVehicle.status === 'moving' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                        selectedVehicle.status === 'stationary' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {selectedVehicle.status.toUpperCase()}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 font-mono font-bold text-[11px] hidden sm:inline">{selectedVehicle.speed} km/h</span>

                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleEditVehicle(selectedVehicle)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Edit Unit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(selectedVehicle.id, selectedVehicle.name)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Delete Unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleEngineRelay(selectedVehicle)}
                          disabled={isSendingCmd}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 uppercase transition-all ${
                            selectedVehicle.fuelCut ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                          }`}
                          title="Remote Engine Relay Control"
                        >
                          <Power className="w-3 h-3" />
                          <span>{selectedVehicle.fuelCut ? 'Restore Engine' : 'Cut Engine'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Geofence Tools */}
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button
                    onClick={() => {
                      setIsDrawingGeofence(true);
                      setDrawingGeofenceType('circle');
                      setDrawnGeofencePoints([]);
                      addToast('Click anywhere on the map to set circular geofence center point', 'info');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                      isDrawingGeofence && drawingGeofenceType === 'circle'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5 text-blue-500" />
                    <span>Draw Circle Zone</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDrawingGeofence(true);
                      setDrawingGeofenceType('polygon');
                      setDrawnGeofencePoints([]);
                      addToast('Click points on the map to build polygon vertices', 'info');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                      isDrawingGeofence && drawingGeofenceType === 'polygon'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-500" />
                    <span>Draw Polygon Zone</span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('geofence')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span>Geofences ({geofences.filter(g => g.status === 'active').length})</span>
                  </button>
                </div>
              </div>

              {/* Active Geofence Drawing Guidance Banner */}
              {isDrawingGeofence && (
                <div className="bg-blue-900 text-white px-4 py-2 flex items-center justify-between text-xs font-medium border-b border-blue-700 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span>
                      {drawingGeofenceType === 'circle'
                        ? 'Click on the map to set circular geofence center point'
                        : `Drawing Polygon Zone: ${drawnGeofencePoints.length} vertices selected`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {drawingGeofenceType === 'polygon' && drawnGeofencePoints.length >= 3 && (
                      <button
                        onClick={() => setIsGeofenceModalOpen(true)}
                        className="px-3 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs transition-colors"
                      >
                        Complete Polygon
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsDrawingGeofence(false);
                        setDrawnGeofencePoints([]);
                      }}
                      className="px-3 py-0.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Clean Leaflet Map Canvas (No Floating Overlays) */}
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

                  <MapClickHandler isDrawing={isDrawingGeofence} onMapClick={handleMapGeofenceClick} />

                  <MapBoundsController vehicles={visibleVehicles} activeVehicleId={selectedVehicleId} />

                  {/* Render Plotted Breadcrumb Route */}
                  {selectedVehicle && selectedVehicle.pathHistory.length > 1 && (
                    <Polyline
                      positions={selectedVehicle.pathHistory}
                      color="#3B82F6"
                      weight={4}
                      opacity={0.8}
                      dashArray="6, 8"
                    />
                  )}

                  {/* Polygon Drawing Live Lines Preview */}
                  {isDrawingGeofence && drawingGeofenceType === 'polygon' && drawnGeofencePoints.length > 0 && (
                    <>
                      <Polyline
                        positions={drawnGeofencePoints}
                        color="#3B82F6"
                        weight={3}
                        dashArray="4, 4"
                      />
                      {drawnGeofencePoints.map((pt, idx) => (
                        <Marker
                          key={`draw-pt-${idx}`}
                          position={pt}
                          icon={L.divIcon({
                            className: 'custom-draw-pt',
                            html: `<div style="width: 12px; height: 12px; border-radius: 50%; background: #3B82F6; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
                            iconSize: [12, 12],
                            iconAnchor: [6, 6]
                          })}
                        />
                      ))}
                    </>
                  )}

                  {/* Render Active Geofence Zones on Map */}
                  {geofences.filter(g => g.status === 'active').map(gf => {
                    if (gf.type === 'circle') {
                      return (
                        <Circle
                          key={gf.id}
                          center={gf.center}
                          radius={gf.radius}
                          pathOptions={{
                            color: gf.color,
                            fillColor: gf.color,
                            fillOpacity: 0.18,
                            weight: 2,
                            dashArray: '4, 6'
                          }}
                        >
                          <Popup className="custom-leaflet-popup">
                            <div className="p-1.5 min-w-[190px]">
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gf.color }} />
                                <h4 className="font-bold text-xs text-slate-900">{gf.name}</h4>
                              </div>
                              <p className="text-[11px] text-slate-600 mb-1 font-mono">
                                Radius: {gf.radius >= 1000 ? `${(gf.radius / 1000).toFixed(1)} km` : `${gf.radius}m`}
                              </p>
                              <p className="text-[10px] text-slate-500 mb-2">
                                {gf.description || 'Geofence Perimeter active'}
                              </p>
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                                <button
                                  onClick={() => {
                                    setEditingGeofence(gf);
                                    setIsGeofenceModalOpen(true);
                                  }}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold"
                                >
                                  Edit Zone
                                </button>
                                <button
                                  onClick={() => handleDeleteGeofence(gf.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </Circle>
                      );
                    } else if (gf.type === 'polygon' && gf.polygonPoints.length >= 3) {
                      return (
                        <Polygon
                          key={gf.id}
                          positions={gf.polygonPoints}
                          pathOptions={{
                            color: gf.color,
                            fillColor: gf.color,
                            fillOpacity: 0.18,
                            weight: 2,
                            dashArray: '4, 6'
                          }}
                        >
                          <Popup className="custom-leaflet-popup">
                            <div className="p-1.5 min-w-[190px]">
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gf.color }} />
                                <h4 className="font-bold text-xs text-slate-900">{gf.name}</h4>
                              </div>
                              <p className="text-[11px] text-slate-600 mb-1 font-mono">
                                Polygon Area ({gf.polygonPoints.length} vertices)
                              </p>
                              <p className="text-[10px] text-slate-500 mb-2">
                                {gf.description || 'Geofence Perimeter active'}
                              </p>
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                                <button
                                  onClick={() => {
                                    setEditingGeofence(gf);
                                    setIsGeofenceModalOpen(true);
                                  }}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold"
                                >
                                  Edit Zone
                                </button>
                                <button
                                  onClick={() => handleDeleteGeofence(gf.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </Polygon>
                      );
                    }
                    return null;
                  })}

                  {/* Render Plotted Vehicle Markers */}
                  {visibleVehicles.map(v => {
                    const isSel = v.id === selectedVehicleId;
                    const color = v.status === 'moving' ? '#10B981' : v.status === 'stationary' ? '#F59E0B' : '#64748B';

                    const customIcon = L.divIcon({
                      className: 'custom-vehicle-marker',
                      html: `
                        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
                          <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: ${color}33; border: 2px solid ${color}; transform: ${isSel ? 'scale(1.2)' : 'scale(1)'}; transition: all 0.3s;"></div>
                          <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; transform: rotate(${v.course}deg);">
                            &#10148;
                          </div>
                        </div>
                      `,
                      iconSize: [36, 36],
                      iconAnchor: [18, 18]
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
                          <div className="p-1 min-w-[180px]">
                            <h4 className="font-bold text-xs text-slate-900 mb-0.5">{v.name}</h4>
                            <p className="text-[11px] font-mono text-slate-500 mb-2">{v.plate}</p>
                            <div className="space-y-1 text-[11px] text-slate-700">
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <strong className="uppercase font-bold">{v.status.toUpperCase()}</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Speed:</span>
                                <strong>{v.speed} km/h</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Battery:</span>
                                <strong>{(v.batteryVoltage / 1000).toFixed(1)} V ({v.batteryPercent}%)</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Ignition:</span>
                                <strong>{v.accStatus ? 'ACC ON' : 'ACC OFF'}</strong>
                              </div>
                              {v.fuelCut && (
                                <div className="text-red-600 font-bold text-center pt-1 border-t">
                                  RELAY CUT ACTIVE
                                </div>
                              )}
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

          {/* Tab: Geofence Zones & Live Boundary Alerts */}
          {activeSubTab === 'geofence' && (
            <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-6 bg-slate-50 dark:bg-slate-950">
              
              {/* Top Summary Banner */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Geofence Boundary &amp; Perimeter Monitoring
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Automated entry and exit boundary triggers for tracking units
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingGeofence(null);
                      setDrawnGeofencePoints([]);
                      setIsGeofenceModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Geofence Zone</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSubTab('map');
                      setIsDrawingGeofence(true);
                      setDrawingGeofenceType('circle');
                      setDrawnGeofencePoints([]);
                      addToast('Click anywhere on the map to set zone center', 'info');
                    }}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Target className="w-4 h-4 text-blue-500" />
                    <span>Draw Circle Zone</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSubTab('map');
                      setIsDrawingGeofence(true);
                      setDrawingGeofenceType('polygon');
                      setDrawnGeofencePoints([]);
                      addToast('Click map points to build polygon perimeter vertices', 'info');
                    }}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-purple-500" />
                    <span>Draw Polygon Zone</span>
                  </button>
                </div>
              </div>

              {/* Main Grid: Left Zone Cards, Right Alert Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Geofence Zones List */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-500" />
                      Configured Geofences ({geofences.length})
                    </h3>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      {geofences.filter(g => g.status === 'active').length} Active Zones
                    </span>
                  </div>

                  {geofences.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center text-slate-400">
                      <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-bold">No Geofences configured yet</p>
                      <p className="text-[11px] mt-1">Create a circular or polygon geofence zone to start boundary monitoring.</p>
                    </div>
                  ) : (
                    geofences.map(gf => (
                      <div
                        key={gf.id}
                        className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all shadow-xs ${
                          gf.status === 'active'
                            ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            : 'border-slate-200/50 dark:border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full shrink-0 border border-white shadow-xs"
                              style={{ backgroundColor: gf.color }}
                            />
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {gf.name}
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                  {gf.type}
                                </span>
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {gf.type === 'circle'
                                  ? `Radius: ${gf.radius >= 1000 ? `${(gf.radius / 1000).toFixed(1)} km` : `${gf.radius}m`}`
                                  : `Polygon Vertices: ${gf.polygonPoints.length} points`}
                                {gf.description ? ` &bull; ${gf.description}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleGeofenceStatus(gf.id)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                                gf.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              }`}
                            >
                              {gf.status === 'active' ? 'ACTIVE' : 'DISABLED'}
                            </button>

                            <button
                              onClick={() => {
                                setEditingGeofence(gf);
                                setIsGeofenceModalOpen(true);
                              }}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                              title="Edit Geofence"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteGeofence(gf.id)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                              title="Delete Geofence"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Alert Triggers & Assigned Units Badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>Triggers:</span>
                            {gf.alertOnEntry && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                                Entry Alert
                              </span>
                            )}
                            {gf.alertOnExit && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                Exit Alert
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[11px]">Monitored Units:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {gf.targetUnitIds.includes('all') ? 'All Fleet Units' : `${gf.targetUnitIds.length} Vehicles`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Geofence Live Alert Log Feed */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 h-fit">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Live Geofence Event Log
                      </h3>
                    </div>
                    {geofenceAlerts.length > 0 && (
                      <button
                        onClick={() => setGeofenceAlerts([])}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {geofenceAlerts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Shield className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                        <p className="text-xs font-semibold">No boundary events logged</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Alerts will trigger automatically as tracking units enter or exit active geofence zones.
                        </p>
                      </div>
                    ) : (
                      geofenceAlerts.map(log => (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                              log.type === 'entry'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            }`}>
                              {log.type === 'entry' ? '🚨 ENTRY' : '⚠️ EXIT'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {log.unitName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {log.type === 'entry' ? 'Entered' : 'Exited'} geofence <strong className="text-slate-700 dark:text-slate-300">"{log.geofenceName}"</strong>
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Tab 2: TK116 Command Center */}
          {activeSubTab === 'cmd' && selectedVehicle && (
            <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-6 bg-slate-50 dark:bg-slate-950">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Eelink TK116 Commands &bull; {selectedVehicle.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Target IMEI: {selectedVehicle.imei}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    GPRS TCP Connected
                  </span>
                </div>

                {/* Quick Action Commands Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleToggleEngineRelay(selectedVehicle)}
                    disabled={isSendingCmd}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      selectedVehicle.fuelCut
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-500'
                        : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800/60 hover:border-red-500'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <Zap className={`w-5 h-5 ${selectedVehicle.fuelCut ? 'text-emerald-600' : 'text-red-600'}`} />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 font-bold">
                        {selectedVehicle.fuelCut ? 'RELAY,0#' : 'RELAY,1#'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                        {selectedVehicle.fuelCut ? 'Restore Engine Fuel Relay' : 'Cut Engine Fuel Relay'}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedVehicle.fuelCut ? 'Re-enable fuel pump output' : 'Trigger remote vehicle immobilizer'}
                      </p>
                    </div>
                  </button>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <Gauge className="w-5 h-5 text-blue-500" />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 font-bold">
                        SPEED,ON,120#
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                        Speed Limit Alert Threshold
                      </h4>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={speedLimitInput}
                          onChange={(e) => setSpeedLimitInput(e.target.value)}
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                        />
                        <button
                          onClick={() => {
                            const cmd = `SPEED,ON,${speedLimitInput}#`;
                            setCommandInput(cmd);
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Set
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <MapPin className="w-5 h-5 text-amber-500" />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 font-bold">
                        WHERE#
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                        Instant Location Ping
                      </h4>
                      <button
                        onClick={() => {
                          setCommandInput('WHERE#');
                        }}
                        className="mt-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Request Position
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom ASCII/HEX Command Terminal Input */}
                <form onSubmit={handleSendCustomCommand} className="pt-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Send Direct Eelink TK116 Command
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      placeholder="e.g. STATUS#, RESET#, SERVER,1,gps.rapid911.co.za,7018,0#"
                      className="flex-grow font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={isSendingCmd || !commandInput.trim()}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Trip Summary Card */}
              <TripSummaryCard vehicle={selectedVehicle} />
            </div>
          )}

          {/* Tab 3: Eelink TK116 Integration Guide */}
          {activeSubTab === 'guide' && (
            <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-6 bg-slate-50 dark:bg-slate-950 text-xs">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Real Eelink TK116 Hardware Setup &amp; Configuration
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      Step-by-step instructions for pairing real Eelink TK116 4G GPRS GPS trackers
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Server Config */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                      <span>SMS Gateway Configuration</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Insert a 4G SIM card into the TK116 unit. Send the following SMS commands to set the server IP and APN:
                    </p>
                    <div className="bg-slate-900 text-blue-400 p-2.5 rounded-lg font-mono text-[11px] space-y-1">
                      <div>SERVER,1,gps.rapid911.co.za,7018,0#</div>
                      <div>APN,internet#</div>
                      <div>TIMER,30,30#</div>
                    </div>
                  </div>

                  {/* Step 2: Wiring Diagram */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                      <span>Vehicle Wire Harness Pinout</span>
                    </div>
                    <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between items-center p-1.5 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-red-500">&bull; Red Wire:</span>
                        <span>12V-24V Constant Battery Power</span>
                      </div>
                      <div className="flex justify-between items-center p-1.5 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-slate-900 dark:text-white">&bull; Black Wire:</span>
                        <span>Chassis Ground (GND)</span>
                      </div>
                      <div className="flex justify-between items-center p-1.5 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-amber-500">&bull; Yellow Wire:</span>
                        <span>Ignition ACC Detection Input</span>
                      </div>
                      <div className="flex justify-between items-center p-1.5 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-blue-500">&bull; White Wire:</span>
                        <span>Immobilizer Relay Control Output</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong className="block mb-1">Eelink Binary Protocol Overview:</strong>
                  The Eelink TK116 device sends binary TCP packets starting with magic header <code className="font-mono font-bold bg-blue-100 dark:bg-blue-900/50 px-1 rounded">0x67 0x67</code>. Packet ID <code className="font-mono font-bold bg-blue-100 dark:bg-blue-900/50 px-1 rounded">0x12</code> contains location coordinates, speed, course angle, battery voltage, and ignition status. Packet ID <code className="font-mono font-bold bg-blue-100 dark:bg-blue-900/50 px-1 rounded">0x80</code> handles server command requests.
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: GPRS Decoded Terminal Logs */}
          {activeSubTab === 'packets' && (
            <div className="flex-grow p-4 overflow-y-auto bg-slate-950 text-slate-200 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Eelink TK116 GPRS TCP Stream (Port 7018)
                </span>
                <button
                  onClick={() => setTerminalLogs([])}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                >
                  Clear Logs
                </button>
              </div>

              {terminalLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-12">
                  No packets logged yet. Send a command from the TK116 Command Center or wait for location pings.
                </div>
              ) : (
                <div className="space-y-2">
                  {terminalLogs.map(p => (
                    <div key={p.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>[{p.timestamp}] IMEI: <strong className="text-slate-200">{p.imei}</strong></span>
                        <span className={p.direction === 'UP' ? 'text-blue-400' : 'text-amber-400'}>
                          {p.direction === 'UP' ? '&uarr; GPRS IN' : '&darr; COMMAND OUT'}
                        </span>
                      </div>
                      <div className="text-slate-300 font-semibold mb-1">{p.pidName} ({p.pid})</div>
                      <div className="bg-slate-950 p-2 rounded text-[10px] text-emerald-400 overflow-x-auto break-all">
                        {p.rawHex}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Location & Trip History */}
          {activeSubTab === 'history' && (
            <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-950">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                  Historical Location Breadcrumbs &amp; Events &bull; {selectedVehicle?.name}
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Event / Ping</th>
                        <th className="py-2.5 px-3">Latitude, Longitude</th>
                        <th className="py-2.5 px-3">Speed</th>
                        <th className="py-2.5 px-3">Ignition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {historyItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-slate-500">{item.timestamp}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{item.event}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">{item.lat}, {item.lng}</td>
                          <td className="py-2.5 px-3 font-bold">{item.speed} km/h</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.accStatus ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}>
                              {item.accStatus ? 'ON' : 'OFF'}
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
                fuelCut: false,
                mileage: 12000,
                fuelLevel: 100,
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

      {/* Geofence Configuration Modal */}
      <GeofenceModal
        isOpen={isGeofenceModalOpen}
        onClose={() => {
          setIsGeofenceModalOpen(false);
          setEditingGeofence(null);
          setIsDrawingGeofence(false);
          setDrawnGeofencePoints([]);
        }}
        initialData={editingGeofence}
        vehicles={vehicles}
        mapCenter={selectedVehicle ? [selectedVehicle.lat, selectedVehicle.lng] : [-26.2041, 28.0473]}
        drawnPoints={drawnGeofencePoints}
        onSave={handleSaveGeofence}
      />
    </div>
  );
};

export default FleetManagement;

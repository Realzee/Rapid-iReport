import React, { useState, useEffect } from 'react';
import { Shield, X, MapPin, Target, Bell, Layers, Check, Sliders } from 'lucide-react';
import { TK116Device } from './FleetManagement';

export interface GeofenceZone {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  center: [number, number];
  radius: number; // in meters
  polygonPoints: [number, number][];
  targetUnitIds: string[]; // ['all'] or vehicle IDs
  alertOnEntry: boolean;
  alertOnExit: boolean;
  color: string;
  status: 'active' | 'inactive';
  description?: string;
}

interface GeofenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (geofence: GeofenceZone) => void;
  initialData?: GeofenceZone | null;
  vehicles: TK116Device[];
  mapCenter?: [number, number];
  drawnPoints?: [number, number][];
}

const COLOR_OPTIONS = [
  { name: 'Blue', value: '#3B82F6', bg: 'bg-blue-500' },
  { name: 'Red Warning', value: '#EF4444', bg: 'bg-red-500' },
  { name: 'Emerald Safe', value: '#10B981', bg: 'bg-emerald-500' },
  { name: 'Amber Caution', value: '#F59E0B', bg: 'bg-amber-500' },
  { name: 'Purple Patrol', value: '#8B5CF6', bg: 'bg-purple-500' },
];

export const GeofenceModal: React.FC<GeofenceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  vehicles,
  mapCenter = [-26.2041, 28.0473],
  drawnPoints = []
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'circle' | 'polygon'>('circle');
  const [lat, setLat] = useState(mapCenter[0]);
  const [lng, setLng] = useState(mapCenter[1]);
  const [radius, setRadius] = useState(800);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [targetUnitIds, setTargetUnitIds] = useState<string[]>(['all']);
  const [alertOnEntry, setAlertOnEntry] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);
  const [color, setColor] = useState('#3B82F6');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setLat(initialData.center[0]);
      setLng(initialData.center[1]);
      setRadius(initialData.radius || 800);
      setPolygonPoints(initialData.polygonPoints || []);
      setTargetUnitIds(initialData.targetUnitIds || ['all']);
      setAlertOnEntry(initialData.alertOnEntry ?? true);
      setAlertOnExit(initialData.alertOnExit ?? true);
      setColor(initialData.color || '#3B82F6');
      setDescription(initialData.description || '');
    } else {
      setName('');
      setType(drawnPoints.length > 2 ? 'polygon' : 'circle');
      setLat(mapCenter[0]);
      setLng(mapCenter[1]);
      setRadius(800);
      setPolygonPoints(drawnPoints.length > 0 ? drawnPoints : [
        [mapCenter[0] + 0.01, mapCenter[1] - 0.01],
        [mapCenter[0] + 0.01, mapCenter[1] + 0.01],
        [mapCenter[0] - 0.01, mapCenter[1] + 0.01],
        [mapCenter[0] - 0.01, mapCenter[1] - 0.01],
      ]);
      setTargetUnitIds(['all']);
      setAlertOnEntry(true);
      setAlertOnExit(true);
      setColor('#3B82F6');
      setDescription('');
    }
  }, [initialData, isOpen, mapCenter, drawnPoints]);

  if (!isOpen) return null;

  const handleUnitToggle = (unitId: string) => {
    if (unitId === 'all') {
      setTargetUnitIds(['all']);
      return;
    }

    setTargetUnitIds(prev => {
      const filtered = prev.filter(id => id !== 'all');
      if (filtered.includes(unitId)) {
        const next = filtered.filter(id => id !== unitId);
        return next.length === 0 ? ['all'] : next;
      } else {
        return [...filtered, unitId];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newZone: GeofenceZone = {
      id: initialData?.id || `gf-${Date.now()}`,
      name: name.trim(),
      type,
      center: [Number(lat), Number(lng)],
      radius: Number(radius),
      polygonPoints,
      targetUnitIds,
      alertOnEntry,
      alertOnExit,
      color,
      status: initialData?.status || 'active',
      description: description.trim()
    };

    onSave(newZone);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden my-8 animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {initialData ? 'Edit Geofence Boundary' : 'Create New Geofence Zone'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define perimeter boundaries and boundary entry/exit alerts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          
          {/* Zone Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Geofence Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Central Depot Precinct, Sandton High Risk Corridor"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setType('circle')}
              className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                type === 'circle'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Circular Zone</span>
            </button>
            <button
              type="button"
              onClick={() => setType('polygon')}
              className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                type === 'polygon'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Polygon Area</span>
            </button>
          </div>

          {/* Circle Parameters */}
          {type === 'circle' && (
            <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 dark:text-slate-300">Zone Radius:</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                  {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} meters`}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Center Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Center Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Polygon Parameters */}
          {type === 'polygon' && (
            <div className="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Polygon Corner Vertices:</span>
                <span className="font-bold text-slate-500">{polygonPoints.length} Points</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                You can click directly on the Leaflet map to adjust vertices, or use pre-configured bounding points.
              </p>
            </div>
          )}

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Zone Boundary Color
            </label>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    color === c.value
                      ? 'border-slate-900 dark:border-white ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full ${c.bg}`} />
                  <span className="text-slate-700 dark:text-slate-300">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Units Assignment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Monitored Units
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => handleUnitToggle('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                  targetUnitIds.includes('all')
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {targetUnitIds.includes('all') && <Check className="w-3 h-3" />}
                <span>All Fleet Units</span>
              </button>

              {vehicles.map(v => {
                const isSel = targetUnitIds.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleUnitToggle(v.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                      isSel && !targetUnitIds.includes('all')
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {isSel && !targetUnitIds.includes('all') && <Check className="w-3 h-3" />}
                    <span>{v.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alert Options */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer">
              <input
                type="checkbox"
                checked={alertOnEntry}
                onChange={(e) => setAlertOnEntry(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold block text-slate-900 dark:text-slate-100">Alert on Entry</span>
                <span className="text-[10px] text-slate-500">Trigger alert when unit enters boundary</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer">
              <input
                type="checkbox"
                checked={alertOnExit}
                onChange={(e) => setAlertOnExit(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold block text-slate-900 dark:text-slate-100">Alert on Exit</span>
                <span className="text-[10px] text-slate-500">Trigger alert when unit exits boundary</span>
              </div>
            </label>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Restricted high security zone. Contact dispatch immediately upon entry."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 transition-colors"
            >
              {initialData ? 'Update Geofence' : 'Save Geofence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

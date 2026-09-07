import React, { useState, useEffect, useMemo } from 'react';
import { 
  Profile, 
  UserRole, 
  Report, 
  EmsDispatch, 
  EmsDispatchStatus, 
  EmsTriageLevel, 
  Responder, 
  ResponderStatus,
  LocationCoords
} from '../types';
import { supabase } from '../utils/supabase';
import { EMSReportGenerator } from './EMSReportGenerator';
import MapView from '../components/MapView';
import { HeartPulse, FileText, Edit2, Trash2, Plus, Building2, Truck, Phone, AlertCircle, X } from 'lucide-react';
import { 
  PlusIcon, 
  SearchIcon, 
  UsersIcon, 
  BuildingIcon, 
  ClockIcon, 
  AlertTriangleIcon, 
  MapIcon, 
  ChevronDownIcon, 
  RadioTowerIcon, 
  CarIcon, 
  WrenchIcon 
} from '../components/icons';
import { useToast } from '../contexts/ToastContext';

interface EMSDispatchPageProps {
  profile: Profile;
  allUsers?: Profile[];
  reports?: Report[];
  responders?: Responder[];
}

interface HospitalFacility {
  id: string;
  name: string;
  level: string;
  status: 'Open' | 'Busy' | 'Diversion' | 'Full';
  distanceEta: string;
  contact: string;
}

interface EMSUnit {
  id: string;
  name: string;
  type: string;
  status: ResponderStatus;
  callSign: string;
  cert: string;
}

const DEFAULT_HOSPITALS: HospitalFacility[] = [
  { id: 'h1', name: 'Charlotte Maxeke Academic Hospital', level: 'Level 1 Trauma', status: 'Open', distanceEta: '8.2 km (12 mins)', contact: '011 488 4911' },
  { id: 'h2', name: 'Chris Hani Baragwanath Hospital', level: 'Level 1 Trauma Center', status: 'Open', distanceEta: '14.5 km (20 mins)', contact: '011 933 8000' },
  { id: 'h3', name: 'Netcare Milpark Hospital', level: 'Private Trauma Unit', status: 'Open', distanceEta: '6.1 km (9 mins)', contact: '011 480 5600' },
  { id: 'h4', name: 'Sunninghill Hospital ER', level: 'Pediatric & Cardiac Unit', status: 'Busy', distanceEta: '11.0 km (16 mins)', contact: '011 806 1500' },
  { id: 'h5', name: 'Life Fourways Hospital', level: 'Level 2 Trauma Center', status: 'Open', distanceEta: '18.2 km (22 mins)', contact: '011 875 1000' },
];

const DEFAULT_UNITS: EMSUnit[] = [
  { id: 'u1', name: 'Medic Alpha-1 (ALS)', type: 'Advanced Life Support', status: ResponderStatus.AVAILABLE, callSign: 'A-1', cert: 'ALS' },
  { id: 'u2', name: 'Ambulance Bravo-2 (ILS)', type: 'Intermediate Life Support', status: ResponderStatus.EN_ROUTE, callSign: 'B-2', cert: 'ILS' },
  { id: 'u3', name: 'Medic Charlie-3 (ALS)', type: 'Rapid Response Vehicle', status: ResponderStatus.ON_SCENE, callSign: 'C-3', cert: 'ALS' },
  { id: 'u4', name: 'Ambulance Delta-4 (BLS)', type: 'Basic Life Support', status: ResponderStatus.AVAILABLE, callSign: 'D-4', cert: 'BLS' },
  { id: 'u5', name: 'Rescue Unit 1', type: 'Heavy Extrication', status: ResponderStatus.AVAILABLE, callSign: 'R-1', cert: 'RESCUE' },
];

export const EMSDispatchPage: React.FC<EMSDispatchPageProps> = ({ profile, allUsers = [], reports = [], responders = [] }) => {
  const { addToast } = useToast();
  const [dispatches, setDispatches] = useState<EmsDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [triageFilter, setTriageFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dispatches' | 'units' | 'hospitals' | 'map'>('dispatches');

  // Dynamic Fleet & Hospital State with LocalStorage persistence
  const [units, setUnits] = useState<EMSUnit[]>(() => {
    try {
      const saved = localStorage.getItem('ems_fleet_units');
      return saved ? JSON.parse(saved) : DEFAULT_UNITS;
    } catch {
      return DEFAULT_UNITS;
    }
  });

  const [hospitals, setHospitals] = useState<HospitalFacility[]>(() => {
    try {
      const saved = localStorage.getItem('ems_hospital_facilities');
      return saved ? JSON.parse(saved) : DEFAULT_HOSPITALS;
    } catch {
      return DEFAULT_HOSPITALS;
    }
  });

  // Persist fleet & hospitals
  useEffect(() => {
    localStorage.setItem('ems_fleet_units', JSON.stringify(units));
  }, [units]);

  useEffect(() => {
    localStorage.setItem('ems_hospital_facilities', JSON.stringify(hospitals));
  }, [hospitals]);

  // Modals
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [selectedPcrReport, setSelectedPcrReport] = useState<Report | null>(null);
  const [selectedDispatchForMap, setSelectedDispatchForMap] = useState<EmsDispatch | null>(null);

  // Fleet Unit Modal State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<EMSUnit | null>(null);
  const [unitForm, setUnitForm] = useState<{
    name: string;
    type: string;
    callSign: string;
    cert: string;
    status: ResponderStatus;
  }>({
    name: '',
    type: 'Advanced Life Support',
    callSign: '',
    cert: 'ALS',
    status: ResponderStatus.AVAILABLE,
  });

  // Hospital Facility Modal State
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<HospitalFacility | null>(null);
  const [hospitalForm, setHospitalForm] = useState<{
    name: string;
    level: string;
    status: 'Open' | 'Busy' | 'Diversion' | 'Full';
    distanceEta: string;
    contact: string;
  }>({
    name: '',
    level: 'Level 1 Trauma Center',
    status: 'Open',
    distanceEta: '',
    contact: '',
  });

  // New Call Form State
  const [newCallForm, setNewCallForm] = useState({
    caller_name: '',
    caller_phone: '',
    location: '',
    chief_complaint: '',
    triage_level: 'P2' as EmsTriageLevel,
    patient_count: 1,
    assigned_unit: '',
    receiving_facility: '',
    dispatch_notes: '',
    special_hazards: '',
  });

  // Fetch EMS Dispatches from Supabase
  const fetchDispatches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ems_dispatches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch ems_dispatches from DB, loading initial data:', error);
      } else if (data && data.length > 0) {
        setDispatches(data);
        setLoading(false);
        return;
      }

      // Fallback: create dispatches from existing medical emergency reports or defaults
      const initialDispatches: EmsDispatch[] = reports
        .filter(r => r.type === 'emergency' || (r.description && r.description.toLowerCase().includes('medical')))
        .map((r, idx) => ({
          id: `ems-${r.id}`,
          report_id: r.id,
          ob_number: r.ob_number,
          caller_name: (r as any).cos_name || 'Emergency Dispatcher',
          caller_phone: (r as any).cos_contact_number || '10111',
          location: r.location || 'Johannesburg Central',
          location_coords: r.location_coords || { lat: -26.2041, lng: 28.0473 },
          chief_complaint: r.description || 'Medical Emergency',
          triage_level: idx % 3 === 0 ? 'P1' : idx % 2 === 0 ? 'P2' : 'P3',
          patient_count: 1,
          assigned_unit: idx % 2 === 0 ? 'Medic Alpha-1 (ALS)' : undefined,
          receiving_facility: idx % 2 === 0 ? 'Netcare Milpark Hospital' : undefined,
          status: idx % 2 === 0 ? EmsDispatchStatus.EN_ROUTE : EmsDispatchStatus.PENDING,
          dispatch_notes: 'Priority dispatch logged by Controller',
          created_at: r.reported_at || new Date().toISOString()
        }));

      // Add default sample dispatches if empty
      if (initialDispatches.length === 0) {
        initialDispatches.push(
          {
            id: 'ems-sample-1',
            ob_number: 'EMS-2026/0101',
            caller_name: 'John Maluleke',
            caller_phone: '082 555 1234',
            location: 'M1 South & Riviera Rd Exit, Houghton',
            location_coords: { lat: -26.1782, lng: 28.0480 },
            chief_complaint: 'MVA 2 Vehicles - 1 Trapped, Severe Bleeding',
            triage_level: 'P1',
            patient_count: 2,
            assigned_unit: 'Medic Alpha-1 (ALS)',
            receiving_facility: 'Netcare Milpark Hospital',
            status: EmsDispatchStatus.EN_ROUTE,
            dispatch_notes: 'Rescue 1 requested for Jaws of Life',
            special_hazards: 'Fuel spill on roadway - Fire Dept en route',
            created_at: new Date(Date.now() - 15 * 60000).toISOString()
          },
          {
            id: 'ems-sample-2',
            ob_number: 'EMS-2026/0102',
            caller_name: 'Sarah Connor',
            caller_phone: '071 999 8822',
            location: '45 Rosebank Mall, Oxford Rd',
            location_coords: { lat: -26.1465, lng: 28.0435 },
            chief_complaint: 'Pedestrian Struck - Lower Limb Fracture',
            triage_level: 'P2',
            patient_count: 1,
            assigned_unit: 'Ambulance Bravo-2 (ILS)',
            receiving_facility: 'Charlotte Maxeke Academic Hospital',
            status: EmsDispatchStatus.DISPATCHED,
            dispatch_notes: 'Patient conscious, stable vitals reported',
            created_at: new Date(Date.now() - 35 * 60000).toISOString()
          }
        );
      }

      setDispatches(initialDispatches);
    } catch (err) {
      console.error('Error loading EMS dispatches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();

    // Subscribe to realtime changes on ems_dispatches
    const channel = supabase
      .channel('ems-dispatches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ems_dispatches' }, () => {
        fetchDispatches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered Dispatches
  const filteredDispatches = useMemo(() => {
    return dispatches.filter(d => {
      const matchesSearch = 
        (d.ob_number && d.ob_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.caller_name && d.caller_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.location && d.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.chief_complaint && d.chief_complaint.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.assigned_unit && d.assigned_unit.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchesTriage = triageFilter === 'all' || d.triage_level === triageFilter;

      return matchesSearch && matchesStatus && matchesTriage;
    });
  }, [dispatches, searchQuery, statusFilter, triageFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = dispatches.length;
    const p1Count = dispatches.filter(d => d.triage_level === 'P1').length;
    const activeCount = dispatches.filter(d => d.status !== EmsDispatchStatus.COMPLETED && d.status !== EmsDispatchStatus.CANCELLED).length;
    const pendingCount = dispatches.filter(d => d.status === EmsDispatchStatus.PENDING).length;
    return { total, p1Count, activeCount, pendingCount };
  }, [dispatches]);

  // Create New EMS Call
  const handleCreateNewCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCallForm.location || !newCallForm.chief_complaint) {
      addToast('Please enter both location and chief complaint.', 'error');
      return;
    }

    const obNum = `EMS-${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
    const newDispatch: Partial<EmsDispatch> = {
      company_id: profile.company_id,
      ob_number: obNum,
      caller_name: newCallForm.caller_name || 'Anonymous Caller',
      caller_phone: newCallForm.caller_phone || 'N/A',
      location: newCallForm.location,
      location_coords: { lat: -26.2041 + (Math.random() - 0.5) * 0.1, lng: 28.0473 + (Math.random() - 0.5) * 0.1 },
      chief_complaint: newCallForm.chief_complaint,
      triage_level: newCallForm.triage_level,
      patient_count: Number(newCallForm.patient_count) || 1,
      assigned_unit: newCallForm.assigned_unit || undefined,
      receiving_facility: newCallForm.receiving_facility || undefined,
      status: newCallForm.assigned_unit ? EmsDispatchStatus.DISPATCHED : EmsDispatchStatus.PENDING,
      dispatch_notes: newCallForm.dispatch_notes,
      special_hazards: newCallForm.special_hazards,
      dispatched_at: newCallForm.assigned_unit ? new Date().toISOString() : undefined,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('ems_dispatches').insert([newDispatch]).select();
      if (error) {
        console.warn('DB insert error (table may not exist yet), saving locally:', error);
        setDispatches(prev => [{ ...newDispatch, id: `local-${Date.now()}` } as EmsDispatch, ...prev]);
      } else if (data && data[0]) {
        setDispatches(prev => [data[0], ...prev]);
      }
      addToast(`EMS Call ${obNum} created successfully.`, 'success');
      setIsNewCallModalOpen(false);
      setNewCallForm({
        caller_name: '',
        caller_phone: '',
        location: '',
        chief_complaint: '',
        triage_level: 'P2',
        patient_count: 1,
        assigned_unit: '',
        receiving_facility: '',
        dispatch_notes: '',
        special_hazards: '',
      });
    } catch (err) {
      console.error('Error creating EMS dispatch:', err);
      addToast('Created dispatch locally.', 'info');
      setDispatches(prev => [{ ...newDispatch, id: `local-${Date.now()}` } as EmsDispatch, ...prev]);
      setIsNewCallModalOpen(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (id: string, newStatus: EmsDispatchStatus) => {
    const timestampKeyMap: Record<EmsDispatchStatus, string | null> = {
      [EmsDispatchStatus.DISPATCHED]: 'dispatched_at',
      [EmsDispatchStatus.EN_ROUTE]: 'dispatched_at',
      [EmsDispatchStatus.ON_SCENE]: 'arrived_on_scene_at',
      [EmsDispatchStatus.TRANSPORTING]: 'transport_started_at',
      [EmsDispatchStatus.AT_HOSPITAL]: 'arrived_hospital_at',
      [EmsDispatchStatus.COMPLETED]: 'completed_at',
      [EmsDispatchStatus.PENDING]: null,
      [EmsDispatchStatus.CANCELLED]: null,
    };

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    const tsKey = timestampKeyMap[newStatus];
    if (tsKey) {
      updatePayload[tsKey] = new Date().toISOString();
    }

    setDispatches(prev => prev.map(d => d.id === id ? { ...d, ...updatePayload } : d));

    try {
      await supabase.from('ems_dispatches').update(updatePayload).eq('id', id);
      addToast(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()}`, 'success');
    } catch (err) {
      console.warn('DB update failed, updated locally:', err);
    }
  };

  // Update Assigned Unit
  const handleAssignUnit = async (id: string, unitName: string) => {
    const updatePayload = {
      assigned_unit: unitName,
      status: unitName ? EmsDispatchStatus.DISPATCHED : EmsDispatchStatus.PENDING,
      dispatched_at: unitName ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    setDispatches(prev => prev.map(d => d.id === id ? { ...d, ...updatePayload } : d));

    try {
      await supabase.from('ems_dispatches').update(updatePayload).eq('id', id);
      addToast(unitName ? `Assigned unit: ${unitName}` : 'Unassigned unit', 'success');
    } catch (err) {
      console.warn('DB unit update failed:', err);
    }
  };

  // Update Receiving Facility
  const handleAssignFacility = async (id: string, facilityName: string) => {
    const updatePayload = {
      receiving_facility: facilityName,
      updated_at: new Date().toISOString()
    };

    setDispatches(prev => prev.map(d => d.id === id ? { ...d, ...updatePayload } : d));

    try {
      await supabase.from('ems_dispatches').update(updatePayload).eq('id', id);
      addToast(`Facility updated: ${facilityName}`, 'success');
    } catch (err) {
      console.warn('DB facility update failed:', err);
    }
  };

  // Fleet Unit CRUD Handlers
  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setUnitForm({
      name: '',
      type: 'Advanced Life Support',
      callSign: '',
      cert: 'ALS',
      status: ResponderStatus.AVAILABLE,
    });
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (unit: EMSUnit) => {
    setEditingUnit(unit);
    setUnitForm({
      name: unit.name,
      type: unit.type,
      callSign: unit.callSign,
      cert: unit.cert,
      status: unit.status,
    });
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitForm.name || !unitForm.callSign) {
      addToast('Unit name and call sign are required.', 'error');
      return;
    }

    if (editingUnit) {
      setUnits(prev => prev.map(u => u.id === editingUnit.id ? { ...u, ...unitForm } : u));
      addToast(`Updated unit: ${unitForm.name}`, 'success');
    } else {
      const newUnit: EMSUnit = {
        id: `u-${Date.now()}`,
        ...unitForm,
      };
      setUnits(prev => [...prev, newUnit]);
      addToast(`Added unit: ${unitForm.name}`, 'success');
    }
    setIsUnitModalOpen(false);
  };

  const handleDeleteUnit = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ambulance unit "${name}"?`)) {
      setUnits(prev => prev.filter(u => u.id !== id));
      addToast(`Deleted unit: ${name}`, 'info');
    }
  };

  // Hospital Facility CRUD Handlers
  const handleOpenAddHospital = () => {
    setEditingHospital(null);
    setHospitalForm({
      name: '',
      level: 'Level 1 Trauma Center',
      status: 'Open',
      distanceEta: '',
      contact: '',
    });
    setIsHospitalModalOpen(true);
  };

  const handleOpenEditHospital = (hospital: HospitalFacility) => {
    setEditingHospital(hospital);
    setHospitalForm({
      name: hospital.name,
      level: hospital.level,
      status: hospital.status,
      distanceEta: hospital.distanceEta,
      contact: hospital.contact,
    });
    setIsHospitalModalOpen(true);
  };

  const handleSaveHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalForm.name) {
      addToast('Hospital name is required.', 'error');
      return;
    }

    if (editingHospital) {
      setHospitals(prev => prev.map(h => h.id === editingHospital.id ? { ...h, ...hospitalForm } : h));
      addToast(`Updated facility: ${hospitalForm.name}`, 'success');
    } else {
      const newHospital: HospitalFacility = {
        id: `h-${Date.now()}`,
        ...hospitalForm,
      };
      setHospitals(prev => [...prev, newHospital]);
      addToast(`Added facility: ${hospitalForm.name}`, 'success');
    }
    setIsHospitalModalOpen(false);
  };

  const handleDeleteHospital = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete receiving facility "${name}"?`)) {
      setHospitals(prev => prev.filter(h => h.id !== id));
      addToast(`Deleted facility: ${name}`, 'info');
    }
  };

  // Helper for Triage Badges
  const renderTriageBadge = (level: EmsTriageLevel) => {
    switch (level) {
      case 'P1':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-600 text-white tracking-wider uppercase shadow-xs flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            P1 - CRITICAL
          </span>
        );
      case 'P2':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white tracking-wide uppercase shadow-xs">
            P2 - URGENT
          </span>
        );
      case 'P3':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white tracking-wide uppercase shadow-xs">
            P3 - STABLE
          </span>
        );
      case 'P4':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-white tracking-wide uppercase shadow-xs">
            P4 - DECEASED
          </span>
        );
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: EmsDispatchStatus) => {
    const colorMap: Record<EmsDispatchStatus, string> = {
      [EmsDispatchStatus.PENDING]: 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      [EmsDispatchStatus.DISPATCHED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      [EmsDispatchStatus.EN_ROUTE]: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      [EmsDispatchStatus.ON_SCENE]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      [EmsDispatchStatus.TRANSPORTING]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
      [EmsDispatchStatus.AT_HOSPITAL]: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
      [EmsDispatchStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      [EmsDispatchStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };

    return (
      <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${colorMap[status] || colorMap[EmsDispatchStatus.PENDING]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Prepare map report markers from dispatches
  const mapReports = useMemo(() => {
    return dispatches.map(d => ({
      id: d.id,
      ob_number: d.ob_number || 'EMS Call',
      title: d.chief_complaint,
      location: d.location,
      location_coords: d.location_coords || { lat: -26.2041, lng: 28.0473 },
      severity: d.triage_level === 'P1' ? 'critical' : d.triage_level === 'P2' ? 'high' : 'medium',
      status: d.status,
      type: 'emergency',
      reported_at: d.created_at,
      description: `[EMS Dispatch - ${d.triage_level}] Patient Count: ${d.patient_count} | Unit: ${d.assigned_unit || 'Unassigned'} | Caller: ${d.caller_name}`
    })) as Report[];
  }, [dispatches]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-500/20">
            <HeartPulse className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              EMS DISPATCH CONTROL
              <span className="px-2.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 text-xs font-bold rounded-full border border-red-200 dark:border-red-800">
                LIVE MODULE
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Emergency Medical Services Command, Ambulance Dispatch & Triage Dispatching
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsNewCallModalOpen(true)}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-red-500/20 transition-all flex items-center gap-2 active:scale-95"
          >
            <PlusIcon className="w-5 h-5" />
            + New Emergency Call
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Calls</span>
            <RadioTowerIcon className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">{stats.total}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">P1 Critical</span>
            <AlertTriangleIcon className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 mt-2">{stats.p1Count}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Unit</span>
            <ClockIcon className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">{stats.pendingCount}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Active Dispatches</span>
            <CarIcon className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-2">{stats.activeCount}</p>
        </div>
      </div>

      {/* Tabs & Filters Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-6 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0">
          <button
            onClick={() => setActiveTab('dispatches')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'dispatches'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <RadioTowerIcon className="w-4 h-4" /> Dispatches Queue ({filteredDispatches.length})
          </button>

          <button
            onClick={() => setActiveTab('units')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'units'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <CarIcon className="w-4 h-4" /> EMS Fleet & Responders ({units.length})
          </button>

          <button
            onClick={() => setActiveTab('hospitals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'hospitals'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <BuildingIcon className="w-4 h-4" /> Receiving Hospitals ({hospitals.length})
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'map'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <MapIcon className="w-4 h-4" /> Tactical Map
          </button>
        </div>

        {/* Search & Select Filters */}
        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search complaint, location, unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <select
            value={triageFilter}
            onChange={(e) => setTriageFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Triage Levels</option>
            <option value="P1">P1 - Critical</option>
            <option value="P2">P2 - Urgent</option>
            <option value="P3">P3 - Stable</option>
            <option value="P4">P4 - Deceased</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Statuses</option>
            <option value={EmsDispatchStatus.PENDING}>Pending</option>
            <option value={EmsDispatchStatus.DISPATCHED}>Dispatched</option>
            <option value={EmsDispatchStatus.EN_ROUTE}>En Route</option>
            <option value={EmsDispatchStatus.ON_SCENE}>On Scene</option>
            <option value={EmsDispatchStatus.TRANSPORTING}>Transporting</option>
            <option value={EmsDispatchStatus.AT_HOSPITAL}>At Hospital</option>
            <option value={EmsDispatchStatus.COMPLETED}>Completed</option>
          </select>
        </div>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === 'dispatches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main List */}
          <div className="lg:col-span-8 space-y-4">
            {filteredDispatches.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center text-gray-500 dark:text-gray-400">
                <HeartPulse className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                <p className="text-base font-bold text-gray-800 dark:text-gray-200">No EMS Dispatches Found</p>
                <p className="text-xs text-gray-400 mt-1">Create a new emergency call or adjust search filters.</p>
              </div>
            ) : (
              filteredDispatches.map((dispatch) => (
                <div
                  key={dispatch.id}
                  className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 shadow-xs transition-all ${
                    dispatch.triage_level === 'P1'
                      ? 'border-l-8 border-l-red-600 border-gray-200 dark:border-gray-800'
                      : dispatch.triage_level === 'P2'
                      ? 'border-l-8 border-l-amber-500 border-gray-200 dark:border-gray-800'
                      : 'border-l-8 border-l-emerald-500 border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {renderTriageBadge(dispatch.triage_level)}
                      <span className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">
                        {dispatch.ob_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderStatusBadge(dispatch.status)}
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {new Date(dispatch.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Complaint & Location */}
                  <h3 className="text-lg font-black text-gray-900 dark:text-white leading-snug mb-1">
                    {dispatch.chief_complaint}
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mb-3">
                    <MapIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                    {dispatch.location}
                  </p>

                  {/* Caller & Special Hazards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px] block">Caller / Contact</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {dispatch.caller_name} ({dispatch.caller_phone})
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px] block">Patients / Patients Count</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {dispatch.patient_count} Patient(s)
                      </span>
                    </div>

                    {dispatch.special_hazards && (
                      <div className="sm:col-span-2 text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                        <AlertTriangleIcon className="w-3.5 h-3.5" />
                        Hazards: {dispatch.special_hazards}
                      </div>
                    )}
                  </div>

                  {/* Dispatch Unit & Facility Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {/* Unit Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-1">
                        Assigned Ambulance Unit
                      </label>
                      <select
                        value={dispatch.assigned_unit || ''}
                        onChange={(e) => handleAssignUnit(dispatch.id, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">-- Select Ambulance / Unit --</option>
                        {units.map(u => (
                          <option key={u.id} value={u.name}>
                            {u.name} [{u.cert}]
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Facility Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-1">
                        Receiving Hospital Facility
                      </label>
                      <select
                        value={dispatch.receiving_facility || ''}
                        onChange={(e) => handleAssignFacility(dispatch.id, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">-- Select Receiving Hospital --</option>
                        {hospitals.map(h => (
                          <option key={h.id} value={h.name}>
                            {h.name} ({h.level})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Actions progression bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Progress:</span>

                      {dispatch.status === EmsDispatchStatus.PENDING && (
                        <button
                          onClick={() => handleUpdateStatus(dispatch.id, EmsDispatchStatus.DISPATCHED)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Dispatch Unit
                        </button>
                      )}

                      {dispatch.status === EmsDispatchStatus.DISPATCHED && (
                        <button
                          onClick={() => handleUpdateStatus(dispatch.id, EmsDispatchStatus.EN_ROUTE)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Mark En Route
                        </button>
                      )}

                      {dispatch.status === EmsDispatchStatus.EN_ROUTE && (
                        <button
                          onClick={() => handleUpdateStatus(dispatch.id, EmsDispatchStatus.ON_SCENE)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Arrived On Scene
                        </button>
                      )}

                      {dispatch.status === EmsDispatchStatus.ON_SCENE && (
                        <button
                          onClick={() => handleUpdateStatus(dispatch.id, EmsDispatchStatus.TRANSPORTING)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Transporting to Hospital
                        </button>
                      )}

                      {dispatch.status === EmsDispatchStatus.TRANSPORTING && (
                        <button
                          onClick={() => handleUpdateStatus(dispatch.id, EmsDispatchStatus.AT_HOSPITAL)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Arrived at ER
                        </button>
                      )}

                      {dispatch.status === EmsDispatchStatus.AT_HOSPITAL && (
                        <button
                          onClick={() => handleUpdateStatus(dispatch.id, EmsDispatchStatus.COMPLETED)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Complete / Available
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const mockReport: Report = {
                            id: dispatch.report_id || dispatch.id,
                            ob_number: dispatch.ob_number || 'EMS-REPORT',
                            title: dispatch.chief_complaint,
                            location: dispatch.location,
                            description: dispatch.chief_complaint,
                            emergency_type: 'medical' as any,
                            status: 'active' as any,
                            severity: dispatch.triage_level === 'P1' ? 'critical' as any : 'high' as any,
                            type: 'emergency',
                            reported_at: dispatch.created_at,
                            reported_by: profile.id
                          };
                          setSelectedPcrReport(mockReport);
                        }}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-red-500" /> Patient Care Report (PCR)
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Live Dispatch Log & Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-red-500" />
                Live Dispatch Timeline
              </h3>

              <div className="space-y-4 border-l-2 border-red-500/30 pl-4 text-xs">
                {dispatches.slice(0, 5).map((d) => (
                  <div key={d.id} className="relative">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 absolute -left-[21px] top-1 border-2 border-white dark:border-gray-900" />
                    <p className="font-bold text-gray-900 dark:text-white">{d.ob_number} - {d.triage_level}</p>
                    <p className="text-gray-500 dark:text-gray-400 truncate">{d.chief_complaint}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                      <span>Status: {d.status}</span>
                      <span>•</span>
                      <span>Unit: {d.assigned_unit || 'None'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNITS TAB */}
      {activeTab === 'units' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-xs">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-red-500" />
                EMS FLEET & AMBULANCE UNITS
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage response vehicles, paramedic certifications, and status allocations
              </p>
            </div>
            <button
              onClick={handleOpenAddUnit}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Ambulance Unit
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {units.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center text-gray-500">
                No units configured. Click "+ Add Ambulance Unit" to add one.
              </div>
            ) : (
              units.map(unit => (
                <div key={unit.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 font-black text-xs rounded-lg">
                        {unit.callSign}
                      </span>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs rounded-md">
                        {unit.status}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">{unit.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{unit.type} • Certification: <span className="font-bold text-red-600 dark:text-red-400">{unit.cert}</span></p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs gap-2">
                    <button
                      onClick={() => addToast(`Contacting unit ${unit.callSign}...`, 'info')}
                      className="px-3 py-1.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex items-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Unit
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditUnit(unit)}
                        className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition"
                        title="Edit Unit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUnit(unit.id, unit.name)}
                        className="p-1.5 bg-red-100 dark:bg-red-950/50 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg transition"
                        title="Delete Unit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* HOSPITALS TAB */}
      {activeTab === 'hospitals' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-xs">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-500" />
                RECEIVING HOSPITALS & ER TRAUMA CENTERS
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Monitor ER capacity, trauma bay diversion status, and emergency room contacts
              </p>
            </div>
            <button
              onClick={handleOpenAddHospital}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Hospital Facility
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospitals.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center text-gray-500">
                No receiving hospital facilities configured. Click "+ Add Hospital Facility" to add one.
              </div>
            ) : (
              hospitals.map(hospital => (
                <div key={hospital.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <BuildingIcon className="w-6 h-6 text-red-500" />
                      <span className={`px-2.5 py-0.5 font-bold text-xs rounded-md ${
                        hospital.status === 'Open' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        hospital.status === 'Busy' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        ER Status: {hospital.status}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">{hospital.name}</h3>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{hospital.level}</p>
                    <p className="text-xs text-gray-400 mb-4">{hospital.distanceEta} • {hospital.contact}</p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => addToast(`ER Dept notified for ${hospital.name}`, 'success')}
                      className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl transition"
                    >
                      Notify ER Trauma Bay
                    </button>

                    <button
                      onClick={() => handleOpenEditHospital(hospital)}
                      className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition"
                      title="Edit Hospital"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteHospital(hospital.id, hospital.name)}
                      className="p-2 bg-red-100 dark:bg-red-950/50 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl transition"
                      title="Delete Hospital"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MAP TAB */}
      {activeTab === 'map' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs min-h-[60vh]">
          <MapView
            reports={mapReports}
            onReportSelect={() => {}}
            selectedReportId={null}
            isGlobalView={true}
          />
        </div>
      )}

      {/* NEW EMERGENCY CALL INTAKE MODAL */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-lg">
                <HeartPulse className="w-6 h-6" />
                CREATE EMERGENCY EMS DISPATCH
              </div>
              <button
                onClick={() => setIsNewCallModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewCall} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Caller Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sipho Ndlovu"
                    value={newCallForm.caller_name}
                    onChange={e => setNewCallForm({ ...newCallForm, caller_name: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Caller Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 082 123 4567"
                    value={newCallForm.caller_phone}
                    onChange={e => setNewCallForm({ ...newCallForm, caller_phone: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Incident Location</label>
                <input
                  type="text"
                  required
                  placeholder="Exact address or GPS landmark"
                  value={newCallForm.location}
                  onChange={e => setNewCallForm({ ...newCallForm, location: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Chief Complaint / Medical Emergency</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Motor vehicle rollover, 2 unconscious victims, chest pain"
                  value={newCallForm.chief_complaint}
                  onChange={e => setNewCallForm({ ...newCallForm, chief_complaint: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Triage Priority Level</label>
                  <select
                    value={newCallForm.triage_level}
                    onChange={e => setNewCallForm({ ...newCallForm, triage_level: e.target.value as EmsTriageLevel })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                  >
                    <option value="P1">P1 - RED (Critical / Life Threat)</option>
                    <option value="P2">P2 - YELLOW (Urgent / ILS)</option>
                    <option value="P3">P3 - GREEN (Stable / BLS)</option>
                    <option value="P4">P4 - BLUE (Deceased / Expectant)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Patient Count</label>
                  <input
                    type="number"
                    min="1"
                    value={newCallForm.patient_count}
                    onChange={e => setNewCallForm({ ...newCallForm, patient_count: Number(e.target.value) })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Assign Ambulance Unit</label>
                  <select
                    value={newCallForm.assigned_unit}
                    onChange={e => setNewCallForm({ ...newCallForm, assigned_unit: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                  >
                    <option value="">-- Unassigned --</option>
                    {units.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Receiving Hospital</label>
                  <select
                    value={newCallForm.receiving_facility}
                    onChange={e => setNewCallForm({ ...newCallForm, receiving_facility: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                  >
                    <option value="">-- Unassigned --</option>
                    {hospitals.map(h => (
                      <option key={h.id} value={h.name}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Special Hazards / Scene Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Fuel leak, Armed standoff, SAPS on scene"
                  value={newCallForm.special_hazards}
                  onChange={e => setNewCallForm({ ...newCallForm, special_hazards: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-red-600"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewCallModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Dispatch & Log Call
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT FLEET UNIT MODAL */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-base">
                <Truck className="w-5 h-5" />
                {editingUnit ? 'EDIT AMBULANCE UNIT' : 'ADD NEW AMBULANCE UNIT'}
              </div>
              <button
                onClick={() => setIsUnitModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Unit Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medic Echo-5 (ALS)"
                  value={unitForm.name}
                  onChange={e => setUnitForm({ ...unitForm, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Radio Call Sign</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. E-5"
                    value={unitForm.callSign}
                    onChange={e => setUnitForm({ ...unitForm, callSign: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Certification Level</label>
                  <select
                    value={unitForm.cert}
                    onChange={e => setUnitForm({ ...unitForm, cert: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                  >
                    <option value="ALS">ALS (Advanced)</option>
                    <option value="ILS">ILS (Intermediate)</option>
                    <option value="BLS">BLS (Basic)</option>
                    <option value="RESCUE">RESCUE / Extrication</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Vehicle Description / Type</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Life Support Ambulance"
                  value={unitForm.type}
                  onChange={e => setUnitForm({ ...unitForm, type: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Status</label>
                <select
                  value={unitForm.status}
                  onChange={e => setUnitForm({ ...unitForm, status: e.target.value as ResponderStatus })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                >
                  <option value={ResponderStatus.AVAILABLE}>Available</option>
                  <option value={ResponderStatus.EN_ROUTE}>En Route</option>
                  <option value={ResponderStatus.ON_SCENE}>On Scene</option>
                  <option value={ResponderStatus.OFF_DUTY}>Off Duty / Offline</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  {editingUnit ? 'Save Changes' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT HOSPITAL FACILITY MODAL */}
      {isHospitalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-base">
                <Building2 className="w-5 h-5" />
                {editingHospital ? 'EDIT RECEIVING HOSPITAL' : 'ADD RECEIVING HOSPITAL'}
              </div>
              <button
                onClick={() => setIsHospitalModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHospital} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Facility Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Johannesburg General Hospital"
                  value={hospitalForm.name}
                  onChange={e => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Trauma Rating / Department Level</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Level 1 Trauma Center, Private ER"
                  value={hospitalForm.level}
                  onChange={e => setHospitalForm({ ...hospitalForm, level: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">ER Status</label>
                  <select
                    value={hospitalForm.status}
                    onChange={e => setHospitalForm({ ...hospitalForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                  >
                    <option value="Open">Open</option>
                    <option value="Busy">Busy</option>
                    <option value="Diversion">Diversion</option>
                    <option value="Full">Full</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. 011 488 4911"
                    value={hospitalForm.contact}
                    onChange={e => setHospitalForm({ ...hospitalForm, contact: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Distance & Estimated Travel Time</label>
                <input
                  type="text"
                  placeholder="e.g. 10.5 km (15 mins)"
                  value={hospitalForm.distanceEta}
                  onChange={e => setHospitalForm({ ...hospitalForm, distanceEta: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsHospitalModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  {editingHospital ? 'Save Changes' : 'Create Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PATIENT CARE REPORT MODAL */}
      {selectedPcrReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <EMSReportGenerator
              report={selectedPcrReport}
              profile={profile}
              onBack={() => setSelectedPcrReport(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EMSDispatchPage;

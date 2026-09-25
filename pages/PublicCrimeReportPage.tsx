import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Company, LocationCoords, Announcement } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import ThemeToggle from '../components/ThemeToggle';
import { LoadingSpinner } from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import { 
  CrimeIcon, 
  CarIcon, 
  AlertTriangleIcon, 
  MapPinIcon, 
  CrosshairIcon, 
  CheckIcon, 
  SearchIcon, 
  LockIcon, 
  UserIcon, 
  PhoneIcon, 
  BuildingIcon, 
  UploadCloudIcon, 
  XIcon, 
  ShareIcon,
  ZapIcon,
  ClockIcon
} from '../components/icons';
import { reverseGeocode } from '../components/LocationPicker';
import { Camera, FileText, ArrowRight, ShieldAlert, ShieldCheck, CheckCircle2, ChevronRight, Eye, PhoneCall } from 'lucide-react';

interface PublicCrimeReportPageProps {
  onBackToLogin: () => void;
  initialTab?: 'report' | 'bulletins' | 'track';
}

const CRIME_CATEGORIES = [
  { id: 'Hijacking / Carjacking', icon: '🚗', color: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400', desc: 'Armed vehicle theft or carjacking' },
  { id: 'Armed Robbery / Mugging', icon: '🦹', color: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400', desc: 'Robbery involving weapons or physical threat' },
  { id: 'House / Business Burglary', icon: '🏠', color: 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400', desc: 'Break-in, trespassing, or theft from property' },
  { id: 'Stolen Vehicle / Plate Sighting', icon: '🚙', color: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400', desc: 'Stolen vehicle, clone plate, or vehicle sighting' },
  { id: 'Suspicious Activity / Persons', icon: '👁️', color: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400', desc: 'Suspicious loitering, vehicle scoping, or scouting' },
  { id: 'Theft / Shoplifting', icon: '📦', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', desc: 'Petty theft, cable theft, or missing assets' },
  { id: 'Assault / Violence', icon: '💥', color: 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400', desc: 'Physical altercation, GBH, or domestic violence' },
  { id: 'Vandalism / Property Damage', icon: '⚠️', color: 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400', desc: 'Infrastructure damage, graffiti, or destruction' },
  { id: 'Medical / Rescue Emergency', icon: '🆘', color: 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400', desc: 'Medical trauma, vehicle collision, or fire' },
  { id: 'Other Community Incident', icon: '📝', color: 'border-gray-500 bg-gray-500/10 text-gray-700 dark:text-gray-300', desc: 'Other community safety concern or tip-off' },
];

export const PublicCrimeReportPage: React.FC<PublicCrimeReportPageProps> = ({ onBackToLogin, initialTab = 'report' }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'bulletins' | 'track'>(initialTab);
  const { mainLogoUrl, defaultLogoUrl } = useSettings();
  const { addToast } = useToast();

  // Form State
  const [category, setCategory] = useState<string>('Suspicious Activity / Persons');
  const [customTitle, setCustomTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [locationText, setLocationText] = useState('');
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [dateOfIncident, setDateOfIncident] = useState(() => new Date().toISOString().split('T')[0]);

  // Suspects & Vehicles
  const [hasSuspectDetails, setHasSuspectDetails] = useState(false);
  const [suspectDetails, setSuspectDetails] = useState('');
  const [vehicleInvolved, setVehicleInvolved] = useState(false);
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  // Reporter Info & Confidentiality
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Evidence Photos
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<{
    obNumber: string;
    reportId: string;
    reportedAt: string;
    category: string;
    location: string;
  } | null>(null);

  // Companies Directory & Announcements
  const [companies, setCompanies] = useState<Company[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // Tracking Search State
  const [trackQuery, setTrackQuery] = useState('');
  const [isSearchingTrack, setIsSearchingTrack] = useState(false);
  const [trackedReport, setTrackedReport] = useState<any | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Load Companies & Bulletins on Mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        if (supabase) {
          const { data: compData } = await supabase
            .from('companies')
            .select('id, name, logo_url, alias')
            .order('name')
            .limit(100);
          if (compData) setCompanies(compData);
        }
      } catch (e) {
        console.warn('Error loading companies for public portal:', e);
      }
    };
    loadInitialData();
  }, []);

  const loadBulletins = async () => {
    setLoadingAnnouncements(true);
    try {
      if (supabase) {
        const { data: announcementsData } = await supabase
          .from('announcements')
          .select('*')
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('created_at', { ascending: false })
          .limit(15);
        setAnnouncements(announcementsData || []);
      }
    } catch (e) {
      console.warn('Error loading public announcements:', e);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bulletins') {
      loadBulletins();
    }
  }, [activeTab]);

  // GPS Auto-detect
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser.', 'error');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const detectedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(detectedCoords);
        try {
          const address = await reverseGeocode(detectedCoords);
          setLocationText(address);
          addToast('Location pinned successfully!', 'success');
        } catch {
          setLocationText(`${detectedCoords.lat.toFixed(5)}, ${detectedCoords.lng.toFixed(5)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        addToast('Unable to detect GPS position. Please type the address or area manually.', 'warning');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Image Upload Handler (Converts to Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (evidenceImages.length + files.length > 5) {
      addToast('You can attach up to 5 photos per incident report.', 'warning');
      return;
    }

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) {
        addToast(`File ${file.name} is not a valid image.`, 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        addToast(`Image ${file.name} exceeds the 10MB limit.`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEvidenceImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setEvidenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Incident Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      addToast('Please provide an incident description or details.', 'warning');
      return;
    }
    if (!locationText.trim()) {
      addToast('Please specify the location or tap "Use My GPS".', 'warning');
      return;
    }
    if (!isAnonymous && !reporterPhone.trim() && !reporterEmail.trim()) {
      addToast('Please provide a phone number or email for non-anonymous submissions.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        crime_type: category,
        title: customTitle.trim() || `${category} - ${locationText.split(',')[0]}`,
        description: description.trim(),
        severity,
        location: locationText.trim(),
        location_coords: coords,
        date_of_incident: dateOfIncident,
        evidence_images: evidenceImages,
        vehicle_involved: vehicleInvolved,
        license_plate: vehicleInvolved ? licensePlate.trim().toUpperCase() : undefined,
        vehicle_make: vehicleInvolved ? vehicleMake.trim() : undefined,
        vehicle_model: vehicleInvolved ? vehicleModel.trim() : undefined,
        vehicle_color: vehicleInvolved ? vehicleColor.trim() : undefined,
        suspect_details: hasSuspectDetails ? suspectDetails.trim() : undefined,
        reporter_type: isAnonymous ? 'anonymous' : 'named',
        reporter_name: isAnonymous ? undefined : reporterName.trim(),
        reporter_phone: isAnonymous ? undefined : reporterPhone.trim(),
        reporter_email: isAnonymous ? undefined : reporterEmail.trim(),
        company_id: selectedCompanyId || undefined,
      };

      const res = await fetch('/api/public-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to submit report');
      }

      setSubmittedReport({
        obNumber: data.ob_number,
        reportId: data.report_id,
        reportedAt: data.reported_at || new Date().toISOString(),
        category,
        location: locationText,
      });

      addToast('Incident report logged successfully to the emergency response grid!', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Submission error:', err);
      addToast(err.message || 'Error transmitting report. Please try again or call 10111.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to submit another report
  const handleResetForm = () => {
    setSubmittedReport(null);
    setDescription('');
    setCustomTitle('');
    setSuspectDetails('');
    setHasSuspectDetails(false);
    setVehicleInvolved(false);
    setLicensePlate('');
    setVehicleMake('');
    setVehicleModel('');
    setVehicleColor('');
    setEvidenceImages([]);
    setLocationText('');
    setCoords(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Track Report Search Handler
  const handleTrackSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackQuery.trim()) {
      addToast('Please enter an OB reference number.', 'warning');
      return;
    }

    setIsSearchingTrack(true);
    setTrackError(null);
    setTrackedReport(null);

    try {
      const res = await fetch(`/api/public-report?ob_number=${encodeURIComponent(trackQuery.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setTrackError(data.error || 'No report found matching this reference code.');
      } else {
        setTrackedReport(data.report);
      }
    } catch (err: any) {
      setTrackError('Failed to communicate with tracking service. Please check your connection.');
    } finally {
      setIsSearchingTrack(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 relative">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-blue-500/5 dark:bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/3 right-10 w-80 h-80 bg-indigo-500/5 dark:bg-blue-600/5 blur-3xl pointer-events-none rounded-full" />

      {/* Emergency Hotline Header Banner */}
      <div className="bg-red-600 text-white text-xs font-semibold py-2 px-4 shadow-md flex items-center justify-between flex-wrap gap-2 z-30">
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>PUBLIC SAFETY EMERGENCY DISPATCH PORTAL</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <a href="tel:10111" className="hover:underline flex items-center gap-1 font-bold bg-white/20 px-2 py-0.5 rounded">
              <PhoneCall className="w-3 h-3 inline" /> Police: 10111
            </a>
            <a href="tel:112" className="hover:underline flex items-center gap-1 font-bold bg-white/20 px-2 py-0.5 rounded">
              <PhoneCall className="w-3 h-3 inline" /> Emergency: 112
            </a>
          </div>
        </div>
      </div>

      {/* Main Top Navigation */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={mainLogoUrl}
              alt="Rapid911 Logo"
              className="h-12 sm:h-14 w-auto object-contain cursor-pointer"
              onClick={() => setActiveTab('report')}
              onError={(e) => {
                e.currentTarget.src = defaultLogoUrl;
              }}
            />
            <div className="border-l border-gray-300 dark:border-gray-700 pl-3 sm:pl-4">
              <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                COMMUNITY CRIME DESK
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-mono">
                Rapid Incident & Tip-off Network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button
              onClick={onBackToLogin}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-all flex items-center gap-1.5 border border-gray-300/60 dark:border-gray-700"
            >
              <LockIcon className="w-3.5 h-3.5" />
              <span>Operator Login</span>
            </button>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 sm:space-x-4 border-t border-gray-100 dark:border-gray-850 pt-2 pb-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => { setActiveTab('report'); setSubmittedReport(null); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <CrimeIcon className="w-4 h-4" />
            <span>Report a Crime / Incident</span>
          </button>

          <button
            onClick={() => setActiveTab('track')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'track'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <SearchIcon className="w-4 h-4" />
            <span>Track Incident Status</span>
          </button>

          <button
            onClick={() => setActiveTab('bulletins')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'bulletins'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <ZapIcon className="w-4 h-4" />
            <span>Community Bulletins</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 z-10">

        {/* ----------------- VIEW 1: REPORT A CRIME FORM / SUCCESS ----------------- */}
        {activeTab === 'report' && (
          <div>
            {submittedReport ? (
              /* SUCCESS STATE CARD */
              <div className="bg-white dark:bg-gray-900 border border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10 animate-pulse" />
                </div>

                <div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold text-xs rounded-full uppercase tracking-wider">
                    Incident Dispatched & Logged
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-3">
                    Report Received Successfully
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2">
                    Your report has been logged in the central emergency dispatch grid and circulated to active response units in your area.
                  </p>
                </div>

                {/* OB Reference Box */}
                <div className="bg-slate-50 dark:bg-slate-950 border-2 border-blue-500/40 rounded-2xl p-6 max-w-md mx-auto shadow-sm">
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-400">Official OB Reference Number</p>
                  <p className="text-2xl sm:text-3xl font-mono font-black text-blue-600 dark:text-cyan-400 mt-1 select-all tracking-wider">
                    {submittedReport.obNumber}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Please save this reference number. You can provide it to police, insurance, or use it on this portal to track progress.
                  </p>
                </div>

                {/* Incident Summary Review */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto text-xs bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div>
                    <span className="text-gray-400">Category:</span>
                    <p className="font-bold text-gray-900 dark:text-white">{submittedReport.category}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Location:</span>
                    <p className="font-bold text-gray-900 dark:text-white truncate">{submittedReport.location}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(submittedReport.obNumber);
                      addToast('Reference number copied to clipboard!', 'success');
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-sm transition-all"
                  >
                    📋 Copy Reference Code
                  </button>

                  <button
                    onClick={() => {
                      setTrackQuery(submittedReport.obNumber);
                      setActiveTab('track');
                      handleTrackSearch();
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Track Status Live</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleResetForm}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    + File Another Incident Report
                  </button>
                </div>
              </div>
            ) : (
              /* REPORTING FORM */
              <form onSubmit={handleSubmitReport} className="space-y-8">
                {/* Intro Hero Banner */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-10 translate-y-10">
                    <ShieldAlert className="w-64 h-64" />
                  </div>
                  <div className="max-w-xl relative z-10">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-mono font-bold uppercase tracking-wider">
                      Public Incident Hotline
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
                      Report a Crime or Incident
                    </h2>
                    <p className="text-sm text-blue-100 mt-2 leading-relaxed">
                      Submit suspicious activity, theft, break-ins, or vehicle sightings in seconds. Reports are immediately relayed to active security patrols and control room dispatchers.
                    </p>
                  </div>
                </div>

                {/* STEP 1: Select Incident Category */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-mono">1</span>
                        Incident Category
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Select what best describes the situation</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CRIME_CATEGORIES.map((cat) => {
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setCategory(cat.id);
                            if (cat.id.includes('Vehicle') || cat.id.includes('Carjacking') || cat.id.includes('Hijacking')) {
                              setVehicleInvolved(true);
                            }
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-sm'
                              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-950/40'
                          }`}
                        >
                          <span className="text-2xl shrink-0 p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                            {cat.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug">{cat.id}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{cat.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Urgency / Severity Selection */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                      Urgency Level
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'critical', label: '🚨 Critical (In Progress)', desc: 'Active threat right now' },
                        { id: 'high', label: '⚡ Urgent / Recent', desc: 'Happened within 30 min' },
                        { id: 'medium', label: '⚠️ Standard Incident', desc: 'Happened today / earlier' },
                        { id: 'low', label: '📝 Tip-off / Past', desc: 'Information / Past log' },
                      ].map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setSeverity(lvl.id as any)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            severity === lvl.id
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/40 font-bold text-red-600 dark:text-red-400 ring-1 ring-red-500'
                              : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <p className="text-xs font-bold">{lvl.label}</p>
                          <p className="text-[10px] opacity-75 mt-0.5">{lvl.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STEP 2: Location & GPS */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-mono">2</span>
                        Location of Incident
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Where did this occur?</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isLocating}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-cyan-400 border border-blue-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {isLocating ? <LoadingSpinner size="xs" variant="themed" /> : <CrosshairIcon className="w-4 h-4" />}
                      <span>{isLocating ? 'Detecting GPS...' : '📍 Use My Current GPS'}</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                        Street Address, Suburb or Landmark *
                      </label>
                      <div className="relative">
                        <MapPinIcon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={locationText}
                          onChange={(e) => setLocationText(e.target.value)}
                          placeholder="e.g. 45 Main Rd, Bryanston, Sandton or Cnr 5th Ave & 2nd St"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                          Date of Incident
                        </label>
                        <input
                          type="date"
                          value={dateOfIncident}
                          onChange={(e) => setDateOfIncident(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                          Preferred Security Responder Grid (Optional)
                        </label>
                        <select
                          value={selectedCompanyId}
                          onChange={(e) => setSelectedCompanyId(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">General Emergency Dispatch (All Responders)</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 3: Incident Details & Suspect Info */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-mono">3</span>
                      Incident Details & Narrative
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Describe what occurred with as much detail as possible</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                      Incident Summary / Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. 2 suspects attempted gate break-in with crowbars"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                      Detailed Narrative / What Happened *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please explain the sequence of events, what was stolen or attempted, weapons seen, direction of flight, etc."
                      className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed font-sans"
                    />
                  </div>

                  {/* Toggle: Suspect Descriptions */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-950/60 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasSuspectDetails}
                          onChange={(e) => setHasSuspectDetails(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Add Suspect Descriptions (Clothing, Physical traits, Weapons)</span>
                      </label>
                    </div>

                    {hasSuspectDetails && (
                      <textarea
                        rows={2}
                        value={suspectDetails}
                        onChange={(e) => setSuspectDetails(e.target.value)}
                        placeholder="e.g. 2 males, one in black hoodie and blue jeans with silver handgun, fled on foot toward Main Road."
                        className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    )}
                  </div>

                  {/* Toggle: Vehicle Involved */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-950/60 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vehicleInvolved}
                          onChange={(e) => setVehicleInvolved(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Vehicle Involved / Suspect Getaway Vehicle</span>
                      </label>
                    </div>

                    {vehicleInvolved && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1">Registration Plate</label>
                          <input
                            type="text"
                            value={licensePlate}
                            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                            placeholder="e.g. CA 123-456"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1">Make</label>
                          <input
                            type="text"
                            value={vehicleMake}
                            onChange={(e) => setVehicleMake(e.target.value)}
                            placeholder="e.g. Toyota"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1">Model</label>
                          <input
                            type="text"
                            value={vehicleModel}
                            onChange={(e) => setVehicleModel(e.target.value)}
                            placeholder="e.g. Hilux / Polo"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1">Color</label>
                          <input
                            type="text"
                            value={vehicleColor}
                            onChange={(e) => setVehicleColor(e.target.value)}
                            placeholder="e.g. White / Silver"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* STEP 4: Photo / Evidence Uploads */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-mono">4</span>
                        Photo & Evidence Attachments
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Upload photos of suspect, vehicle, damage, or CCTV screenshots (Optional)</p>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {evidenceImages.map((img, idx) => (
                      <div key={idx} className="relative group rounded-2xl overflow-hidden aspect-video border border-gray-200 dark:border-gray-700 shadow-sm bg-black">
                        <img src={img} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full opacity-90 hover:opacity-100 transition-opacity"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {evidenceImages.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl flex flex-col items-center justify-center p-4 aspect-video bg-gray-50/50 dark:bg-gray-950/50 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                      >
                        <Camera className="w-6 h-6 mb-1" />
                        <span className="text-xs font-bold">+ Add Photo</span>
                        <span className="text-[10px] text-gray-400">Max 5 photos</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* STEP 5: Confidentiality & Reporter Info */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-mono">5</span>
                      Reporter Contact & Confidentiality
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">You may submit completely anonymously for your protection</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAnonymous(true)}
                      className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                        isAnonymous
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <LockIcon className="w-5 h-5" />
                      </span>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white">Report Anonymously</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                          100% confidential tip-off. No personal contact details required.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAnonymous(false)}
                      className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                        !isAnonymous
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <UserIcon className="w-5 h-5" />
                      </span>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white">Provide Contact Info</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                          Allow security dispatchers or investigators to call/SMS you for follow-up.
                        </p>
                      </div>
                    </button>
                  </div>

                  {!isAnonymous && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Your Full Name</label>
                        <input
                          type="text"
                          required={!isAnonymous}
                          value={reporterName}
                          onChange={(e) => setReporterName(e.target.value)}
                          placeholder="e.g. Sarah Jenkins"
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Phone Number *</label>
                        <input
                          type="tel"
                          required={!isAnonymous}
                          value={reporterPhone}
                          onChange={(e) => setReporterPhone(e.target.value)}
                          placeholder="e.g. 082 123 4567"
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Email (Optional)</label>
                        <input
                          type="email"
                          value={reporterEmail}
                          onChange={(e) => setReporterEmail(e.target.value)}
                          placeholder="e.g. sarah@example.com"
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Action Bar */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-blue-600 hover:from-red-700 hover:to-blue-700 text-white font-black text-base rounded-2xl shadow-xl shadow-red-600/20 hover:shadow-red-600/30 transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" variant="white" />
                        <span>Transmitting Report to Security Network...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-5 h-5" />
                        <span>Submit Incident Report to Emergency Grid</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-gray-500 dark:text-gray-400 mt-3 font-mono">
                    🔒 All submissions are encrypted and instantly forwarded to registered control rooms and emergency responders.
                  </p>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ----------------- VIEW 2: TRACK A REPORT ----------------- */}
        {activeTab === 'track' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                Track Incident Status
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Enter your OB Reference Number (e.g. <span className="font-mono font-bold">PUB0001/09/2026</span>) to view current response progress.
              </p>

              <form onSubmit={handleTrackSearch} className="mt-6 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value.toUpperCase())}
                    placeholder="Enter Reference (e.g. PUB0024/09/2026)"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-2xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingTrack}
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSearchingTrack ? <LoadingSpinner size="xs" variant="white" /> : <SearchIcon className="w-4 h-4" />}
                  <span>Check Status</span>
                </button>
              </form>

              {trackError && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400 text-sm">
                  {trackError}
                </div>
              )}

              {trackedReport && (
                <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 space-y-6">
                  {/* Status Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-widest text-blue-600 dark:text-cyan-400 font-bold">
                        Incident Reference
                      </span>
                      <h3 className="text-2xl font-mono font-black text-gray-900 dark:text-white">
                        {trackedReport.ob_number}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Reported: {new Date(trackedReport.reported_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="sm:text-right flex flex-col sm:items-end gap-1">
                      <StatusBadge status={trackedReport.status} size="lg" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                        {trackedReport.responding_agency}
                      </p>
                    </div>
                  </div>

                  {/* Visual Progress Stepper */}
                  <div className="p-6 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Response Progression</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      {[
                        { step: 1, title: '1. Logged & Dispatched' },
                        { step: 2, title: '2. Units En Route / Lookout' },
                        { step: 3, title: '3. Investigation on Scene' },
                        { step: 4, title: '4. Resolved & Concluded' },
                      ].map((s) => {
                        const isDone = trackedReport.status_info.stage >= s.step;
                        const isCurrent = trackedReport.status_info.stage === s.step;
                        return (
                          <div
                            key={s.step}
                            className={`p-3 rounded-xl border transition-all ${
                              isDone
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold'
                                : 'bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1 mb-1">
                              {isDone ? <CheckIcon className="w-4 h-4 text-emerald-500" /> : <ClockIcon className="w-3.5 h-3.5" />}
                              <span className="text-[10px] font-mono">STAGE {s.step}</span>
                            </div>
                            <p className="text-xs">{s.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Incident Details Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-1">
                      <span className="text-xs text-gray-400">Incident Category:</span>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{trackedReport.type}</p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-1">
                      <span className="text-xs text-gray-400">Location Area:</span>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{trackedReport.location}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    💡 <span className="font-bold">Status Detail:</span> {trackedReport.status_info.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- VIEW 3: COMMUNITY SAFETY BULLETINS ----------------- */}
        {activeTab === 'bulletins' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <ZapIcon className="w-6 h-6 text-blue-600" />
                    <span>Live Community Safety Bulletins</span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Official crime alerts, security notices, and safety announcements from authorized personnel.
                  </p>
                </div>
                <button
                  onClick={loadBulletins}
                  disabled={loadingAnnouncements}
                  className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  Refresh Feed
                </button>
              </div>

              {loadingAnnouncements ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <LoadingSpinner size="lg" variant="tactical" label="Loading bulletins feed..." />
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Clear in Your Area</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                    There are no active critical security warnings or high-priority lookouts right now.
                  </p>
                </div>
              ) : (
                <AnnouncementsPanel announcements={announcements} />
              )}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-800/80 bg-white/70 dark:bg-gray-950/70 py-6 px-4 text-center text-xs text-gray-500 dark:text-gray-400 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={mainLogoUrl} alt="Rapid911 Logo" className="h-5 w-auto opacity-70" onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} />
            <span>&copy; {new Date().getFullYear()} Rapid Emergency Incident & Crime Response Network</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <button onClick={() => { setActiveTab('report'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:underline">
              Report Crime
            </button>
            <button onClick={() => { setActiveTab('track'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:underline">
              Track Reference
            </button>
            <button onClick={onBackToLogin} className="hover:underline font-bold text-blue-600 dark:text-cyan-400">
              Operator Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCrimeReportPage;

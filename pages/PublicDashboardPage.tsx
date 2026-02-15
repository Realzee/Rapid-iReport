import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../utils/supabase';
import { Report, VehicleReport, Announcement, LegacyObEntry } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from '../components/ThemeToggle';
import { CarIcon, CrimeIcon, DatabaseIcon, ZapIcon } from '../components/icons';
import { formatDistanceToNow } from 'date-fns';
import StatusBadge from '../components/StatusBadge';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import LegacyObLog from '../components/LegacyObLog';
import PublicReportDetailModal from '../components/PublicReportDetailModal';
import LegacyObDetailModal from '../components/LegacyObDetailModal';
import MapStyleToggle, { MapStyle } from '../components/MapStyleToggle';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const createVehicleIcon = () => {
    const iconHtml = `<div class="relative w-8 h-8 bg-yellow-500 border-2 border-white/80 rounded-full shadow-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M14 16.5V14a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.5"/><path d="M20 10h-2.5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2H4"/><path d="M19 17h.01"/><path d="M5 17h.01"/><path d="M2 10l3.5-3.5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.5.5L22 10"/></svg>
    </div>`;
    return new L.DivIcon({ html: iconHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
};

const createCrimeIcon = () => {
    const iconHtml = `<div class="relative w-8 h-8 bg-red-500 border-2 border-white/80 rounded-full shadow-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9.5 14.5 5-5"/><path d="m9.5 9.5 5 5"/></svg>
    </div>`;
    return new L.DivIcon({ html: iconHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
};

const MapFocusController: React.FC<{ selectedReport: Report | undefined }> = ({ selectedReport }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedReport?.location_coords) {
            map.flyTo([selectedReport.location_coords.lat, selectedReport.location_coords.lng], 15, { animate: true, duration: 1.0 });
        }
    }, [selectedReport, map]);
    return null;
};

const PublicDashboardPage: React.FC<{ onBackToLogin: () => void }> = ({ onBackToLogin }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [detailReport, setDetailReport] = useState<Report | null>(null);
    const [activeTab, setActiveTab] = useState<'incidents' | 'legacy'>('incidents');
    const [selectedLegacyEntry, setSelectedLegacyEntry] = useState<LegacyObEntry | null>(null);
    const [mapStyle, setMapStyle] = useState<MapStyle>('street');
    const { theme } = useTheme();
    const { mainLogoUrl } = useSettings();

    const fetchData = async () => {
        const [
            { data: vehicleData, error: vError },
            { data: crimeData, error: cError },
            { data: announcementsData, error: aError }
        ] = await Promise.all([
            supabase.from('vehicle_reports').select('*'),
            supabase.from('crime_reports').select('*'),
            supabase.from('announcements').select('*').or('expires_at.is.null,expires_at.gt.now()').order('created_at', { ascending: false }).limit(5)
        ]);
        
        if (vError) console.error("Public fetch error (vehicles):", vError.message);
        if (cError) console.error("Public fetch error (crime):", cError.message);
        if (aError) console.error("Public fetch error (announcements):", aError.message);

        const combined = [...(vehicleData || []), ...(crimeData || [])]
            .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
        
        setReports(combined);
        setAnnouncements(announcementsData || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        
        const channel = supabase.channel('public-data')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);
    
    const handleSelectReport = (reportId: string) => {
        const report = reports.find(r => r.id === reportId);
        if (report) {
            setSelectedReportId(report.id);
            setDetailReport(report);
        }
    };
    
    const handleLegacyRowClick = (entry: LegacyObEntry) => {
        setSelectedLegacyEntry(entry);
    };

    const selectedReport = useMemo(() => reports.find(r => r.id === selectedReportId), [reports, selectedReportId]);
    
    const streetLightUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const streetDarkUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const satelliteUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const satelliteLabelsUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
    const streetAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    const satelliteAttribution = 'Tiles &copy; Esri';
    
    const tabButtonClasses = (tabName: 'incidents' | 'legacy') => 
        `w-1/2 py-2.5 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === tabName 
            ? 'bg-blue-600 text-white shadow-md' 
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
        }`;


    return (
        <>
            <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <header className="flex-shrink-0 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700/50 z-20">
                    <div className="px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img src={mainLogoUrl} alt="Logo" className="w-auto h-14 object-contain" />
                            <h1 className="text-xl font-bold hidden sm:block">Community Safety Map</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <button onClick={onBackToLogin} className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors">
                                Operator Login
                            </button>
                        </div>
                    </div>
                </header>
                <main className="flex-grow grid grid-cols-1 lg:grid-cols-10 gap-4 p-4 overflow-hidden h-[calc(100vh-5rem)]">
                    {/* Map Section */}
                    <div className="relative lg:col-span-6 h-[50vh] lg:h-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700/50 shadow-md">
                         <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}>
                            {mapStyle === 'street' ? (
                                <TileLayer
                                    key={`street-${theme}`}
                                    url={theme === 'dark' ? streetDarkUrl : streetLightUrl}
                                    attribution={streetAttribution}
                                />
                            ) : (
                                <>
                                    <TileLayer
                                        key="satellite-base"
                                        url={satelliteUrl}
                                        attribution={satelliteAttribution}
                                    />
                                    <TileLayer
                                        key="satellite-labels"
                                        url={satelliteLabelsUrl}
                                        pane="overlayPane"
                                    />
                                </>
                            )}
                            <MapFocusController selectedReport={selectedReport} />
                            {reports.map(report => {
                                if (!report.location_coords) return null;
                                return <Marker 
                                    key={report.id} 
                                    position={[report.location_coords.lat, report.location_coords.lng]} 
                                    icon={isVehicleReport(report) ? createVehicleIcon() : createCrimeIcon()}
                                    // FIX: Switched from 'eventHandlers' to 'onClick' to align with the installed react-leaflet types, which seem to expect an older API version.
                                    onClick={() => handleSelectReport(report.id)}
                                >
                                    <Popup>
                                        <div className="w-56">
                                            <h4 className="font-bold mb-1">{isVehicleReport(report) ? report.license_plate : report.title}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                                            <StatusBadge status={report.status} />
                                        </div>
                                    </Popup>
                                </Marker>
                            })}
                        </MapContainer>
                        <MapStyleToggle currentStyle={mapStyle} onStyleChange={setMapStyle} />
                    </div>
                    
                    {/* Content Section */}
                    <div className="lg:col-span-4 h-full flex flex-col bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border border-gray-200 dark:border-gray-700/50 rounded-2xl overflow-hidden shadow-md">
                        {/* Tabs */}
                        <div className="flex-shrink-0 p-2 border-b border-gray-200 dark:border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50">
                             <div className="flex bg-gray-200 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-lg p-1">
                                <button onClick={() => setActiveTab('incidents')} className={tabButtonClasses('incidents')}>
                                    <ZapIcon className="w-5 h-5"/> Live Incidents
                                </button>
                                <button onClick={() => setActiveTab('legacy')} className={tabButtonClasses('legacy')}>
                                    <DatabaseIcon className="w-5 h-5"/> Legacy OB Log
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-grow overflow-y-auto">
                            {activeTab === 'incidents' ? (
                                <>
                                    <div className="p-2">
                                        {loading ? (
                                            <div className="flex justify-center items-center h-full py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                                        ) : reports.length === 0 ? (
                                            <p className="text-center p-8 text-gray-500 dark:text-gray-400">No active public incidents at this time.</p>
                                        ) : (
                                            <div className="space-y-2">
                                            {reports.map(report => (
                                                <div key={report.id} onClick={() => handleSelectReport(report.id)} className={`p-3 cursor-pointer rounded-lg border-2 transition-all ${selectedReportId === report.id ? 'bg-blue-500/10 border-blue-500' : 'bg-gray-100/50 dark:bg-gray-800/50 border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`}>
                                                    <div className="flex justify-between items-start gap-2">
                                                        <h3 className="font-semibold text-md truncate">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                                                        <StatusBadge status={report.status} />
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                                                        {isVehicleReport(report) ? <CarIcon className="w-4 h-4 text-yellow-500" /> : <CrimeIcon className="w-4 h-4 text-red-500" />}
                                                        <span>{isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : report.crime_type}</span>
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
                                                </div>
                                            ))}
                                            </div>
                                        )}
                                    </div>
                                    <AnnouncementsPanel announcements={announcements} />
                                </>
                            ) : (
                                <LegacyObLog onRowClick={handleLegacyRowClick} />
                            )}
                        </div>
                    </div>
                </main>
            </div>
            <PublicReportDetailModal isOpen={!!detailReport} onClose={() => setDetailReport(null)} report={detailReport} />
            <LegacyObDetailModal isOpen={!!selectedLegacyEntry} onClose={() => setSelectedLegacyEntry(null)} entry={selectedLegacyEntry} />
        </>
    );
};

export default PublicDashboardPage;
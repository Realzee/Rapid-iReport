import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../utils/supabase';
import { Report, VehicleReport, Announcement } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { rapid911LogoUrl } from '../assets/rapid911logo';
import ThemeToggle from '../components/ThemeToggle';
import { CarIcon, CrimeIcon, XIcon, MenuIcon } from '../components/icons';
import { formatDistanceToNow } from 'date-fns';
import StatusBadge from '../components/StatusBadge';
import AnnouncementsPanel from '../components/AnnouncementsPanel';

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
    const [isSidePanelOpen, setSidePanelOpen] = useState(true);
    const { theme } = useTheme();

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

    const selectedReport = useMemo(() => reports.find(r => r.id === selectedReportId), [reports, selectedReportId]);
    
    const lightMapUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const darkMapUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const tileUrl = theme === 'dark' ? darkMapUrl : lightMapUrl;

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <header className="flex-shrink-0 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700/50 z-20">
                <div className="px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                         <button onClick={() => setSidePanelOpen(!isSidePanelOpen)} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors md:hidden">
                            {isSidePanelOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                        </button>
                        <img src={rapid911LogoUrl} alt="Logo" className="w-auto h-14 object-contain" />
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
            <main className="flex-grow flex relative overflow-hidden">
                <aside className={`absolute md:relative top-0 bottom-0 left-0 z-10 w-full max-w-sm md:w-96 flex-shrink-0 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-r border-gray-200 dark:border-gray-700/50 flex flex-col transition-transform duration-300 ease-in-out ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                    <div className="flex-grow overflow-y-auto">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700/50">
                            <h2 className="font-bold text-lg">Live Incidents ({reports.length})</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Showing reports from the last 72 hours.</p>
                        </div>
                        <div className="p-2">
                            {loading ? (
                                <div className="flex justify-center items-center h-full"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                            ) : reports.length === 0 ? (
                                <p className="text-center p-8 text-gray-500 dark:text-gray-400">No active public incidents at this time.</p>
                            ) : (
                                <div className="space-y-2">
                                {reports.map(report => (
                                    <div key={report.id} onClick={() => { setSelectedReportId(report.id); if (window.innerWidth < 768) setSidePanelOpen(false); }} className={`p-3 cursor-pointer rounded-lg border-2 transition-all ${selectedReportId === report.id ? 'bg-blue-500/10 border-blue-500' : 'bg-gray-100/50 dark:bg-gray-800/50 border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`}>
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
                    </div>
                </aside>
                <div className="flex-grow h-full">
                     <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}>
                        <TileLayer key={theme} url={tileUrl} attribution='&copy; CARTO' />
                        <MapFocusController selectedReport={selectedReport} />
                        {reports.map(report => report.location_coords && (
                            <Marker key={report.id} position={[report.location_coords.lat, report.location_coords.lng]} icon={isVehicleReport(report) ? createVehicleIcon() : createCrimeIcon()}>
                                <Popup>
                                    <div className="w-56">
                                        <h4 className="font-bold mb-1">{isVehicleReport(report) ? report.license_plate : report.title}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                                        <StatusBadge status={report.status} />
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                     </MapContainer>
                </div>
            </main>
        </div>
    );
};

export default PublicDashboardPage;
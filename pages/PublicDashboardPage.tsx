import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Severity, ReportStatus } from '../types';
import { logoUrl } from '../assets/logo';
import ThemeToggle from '../components/ThemeToggle';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../contexts/ThemeContext';
import { formatDistanceToNow } from 'date-fns';
import { ZapIcon, CarIcon, CrimeIcon, AlertTriangleIcon } from '../components/icons';

type PublicReport = Pick<Report, 'id' | 'severity' | 'status' | 'reported_at' | 'location_coords'> & { type: 'vehicle' | 'crime' };

const isVehicleReport = (report: PublicReport): boolean => report.type === 'vehicle';

const PublicStatCard: React.FC<{ title: string; value: string; icon: React.ReactElement }> = ({ title, value, icon }) => (
    <div className="bg-white/50 dark:bg-gray-900/40 backdrop-blur-md p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center space-x-4 shadow-sm">
        {/* FIX: Cast the icon to allow passing the className prop, similar to the StatCard component. */}
        <div className="p-3 rounded-lg bg-blue-500/10">{React.cloneElement(icon as React.ReactElement<{ className: string }>, { className: 'w-6 h-6 text-blue-500 dark:text-blue-400' })}</div>
        <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    </div>
);

const PublicFeedItem: React.FC<{ report: PublicReport }> = ({ report }) => (
    <div className="flex items-center gap-4 py-3 border-b border-gray-200 dark:border-gray-700/50 last:border-b-0">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isVehicleReport(report) ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
            {isVehicleReport(report) ? <CarIcon className="w-6 h-6 text-yellow-500" /> : <CrimeIcon className="w-6 h-6 text-red-500" />}
        </div>
        <div>
            <p className="font-semibold text-gray-800 dark:text-gray-100">{isVehicleReport(report) ? 'Vehicle Incident' : 'Crime Incident'} Reported</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
        </div>
    </div>
);

const createPublicIcon = (report: PublicReport) => {
    const isVehicle = isVehicleReport(report);
    const color = (report.severity === Severity.CRITICAL || report.severity === Severity.HIGH) ? '#EF4444' : (isVehicle ? '#EAB308' : '#3B82F6');
    const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 28px; height: 28px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">
        <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
        <circle cx="12" cy="9.5" r="2.5" fill="#ffffff"></circle>
    </svg>`;
    return new L.DivIcon({ html: iconHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 28] });
};

const PublicMapView: React.FC<{ reports: PublicReport[] }> = ({ reports }) => {
    const { theme } = useTheme();
    const lightMapUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const darkMapUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const tileUrl = theme === 'dark' ? darkMapUrl : lightMapUrl;

    const jitteredReports = useMemo(() => reports.map(r => {
        if (!r.location_coords) return null;
        return {
            ...r,
            location_coords: {
                lat: r.location_coords.lat + (Math.random() - 0.5) * 0.005,
                lng: r.location_coords.lng + (Math.random() - 0.5) * 0.005,
            }
        }
    }).filter(Boolean) as (PublicReport & { location_coords: { lat: number, lng: number }})[], [reports]);

    return (
        <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}>
            <TileLayer key={theme} url={tileUrl} attribution='&copy; CARTO' />
            {jitteredReports.map(report => (
                <Marker key={report.id} position={[report.location_coords.lat, report.location_coords.lng]} icon={createPublicIcon(report)}>
                    <Tooltip direction="top">
                        <div className="font-bold">{isVehicleReport(report) ? 'Vehicle Incident' : 'Crime Incident'}</div>
                        <div>Severity: <span className="capitalize font-semibold">{report.severity}</span></div>
                    </Tooltip>
                </Marker>
            ))}
        </MapContainer>
    );
};

const PublicHeader: React.FC<{ onShowAuth: () => void }> = ({ onShowAuth }) => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
            <img src={logoUrl} alt="Company Logo" className="w-auto h-10 object-contain" />
            <div className="flex items-center gap-4">
                <ThemeToggle />
                <button onClick={onShowAuth} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300">
                    Login / Register
                </button>
            </div>
        </div>
    </header>
);

interface PublicDashboardPageProps {
  onShowAuth: () => void;
}

const PublicDashboardPage: React.FC<PublicDashboardPageProps> = ({ onShowAuth }) => {
    const [reports, setReports] = useState<PublicReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPublicData = async () => {
            setLoading(true);
            const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

            const [ { data: vData, error: vError }, { data: cData, error: cError } ] = await Promise.all([
                supabase.from('vehicle_reports').select('id, severity, status, reported_at, location_coords').gt('reported_at', seventyTwoHoursAgo),
                supabase.from('crime_reports').select('id, severity, status, reported_at, location_coords').gt('reported_at', seventyTwoHoursAgo)
            ]);

            if (vError) console.error("Public vehicle data error:", vError.message);
            if (cError) console.error("Public crime data error:", cError.message);

            const combined = [
                ...((vData as any[]) || []).map(r => ({ ...r, type: 'vehicle' })),
                ...((cData as any[]) || []).map(r => ({ ...r, type: 'crime' })),
            ].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
            
            setReports(combined);
            setLoading(false);
        };
        fetchPublicData();
    }, []);

    const activeAlerts = useMemo(() => reports.filter(r => r.status === ReportStatus.ACTIVE || r.status === ReportStatus.ON_SCENE).length, [reports]);

    return (
        <div className="min-h-screen relative overflow-x-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white via-gray-50 to-white dark:from-black dark:via-indigo-900/60 dark:to-black z-0"></div>
            <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-400/30 dark:bg-blue-400/60 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
            <div className="absolute bottom-[5%] right-[5%] w-96 h-96 bg-red-400/30 dark:bg-indigo-600/60 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
            
            <PublicHeader onShowAuth={onShowAuth} />
            
            <main className="relative z-10 container mx-auto pt-28 px-4 sm:px-6 lg:px-8 pb-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white">Community Safety Dashboard</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500 dark:text-gray-400">A live, anonymized overview of community-reported incidents.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <PublicStatCard title="Incidents (Last 72h)" value={reports.length.toString()} icon={<ZapIcon />} />
                    <PublicStatCard title="Active Alerts" value={activeAlerts.toString()} icon={<AlertTriangleIcon />} />
                    <PublicStatCard title="Community Reports" value={reports.length.toString()} icon={<ZapIcon />} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 h-[60vh] rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700/50 shadow-lg">
                        <PublicMapView reports={reports} />
                    </div>
                    <div className="h-[60vh] bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex flex-col">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex-shrink-0">Recent Activity Feed</h3>
                        {loading ? <div className="flex-grow flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                        : <div className="overflow-y-auto flex-grow">{reports.slice(0, 10).map(r => <PublicFeedItem key={r.id} report={r} />)}</div>}
                    </div>
                </div>
            </main>
             <footer className="relative z-10 text-center py-4 text-xs text-gray-500 dark:text-gray-400">
                Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)
            </footer>
        </div>
    );
};

export default PublicDashboardPage;
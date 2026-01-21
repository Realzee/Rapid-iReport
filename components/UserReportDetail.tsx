import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Profile, VehicleReport, ReportUpdate, ReportStatus } from '../types';
import StatusBadge from './StatusBadge';
import { MapPinIcon, EditIcon } from './icons';
import { format, formatDistanceToNow } from 'date-fns';
import IncidentChat from './IncidentChat';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../contexts/ThemeContext';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const UserReportDetail: React.FC<{ report: Report, profile: Profile, onEdit: (report: Report) => void }> = ({ report, profile, onEdit }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const { theme } = useTheme();

    const lightMapUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const darkMapUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const tileUrl = theme === 'dark' ? darkMapUrl : lightMapUrl;

    useEffect(() => {
        const fetchUpdates = async () => { 
            const { data, error } = await supabase
                .from('report_updates')
                .select('*, profile:profiles(full_name)')
                .eq('report_id', report.id)
                .order('created_at', { ascending: true });
                
            if (error) console.error("Error fetching updates:", error);
            else setUpdates(data?.map(u => ({...u, user_full_name: (u.profile as any)?.full_name || 'System'})) || []);
        };
        fetchUpdates();

        const channel = supabase.channel(`user-updates-${report.id}`)
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, 
            async (payload) => {
                const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', payload.new.user_id).single();
                const newUpdateWithUser = { ...payload.new, user_full_name: profileData?.full_name || 'System' };
                setUpdates(prev => [...prev, newUpdateWithUser as ReportUpdate]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [report.id]);

    const canEdit = report.status === ReportStatus.PENDING;

    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none transition-colors duration-300 flex flex-col h-full max-h-[calc(100vh-12rem)]">
            <div className="flex justify-between items-start mb-4 flex-shrink-0 gap-4">
                <div className="flex-grow">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-2">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{report.ob_number}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                    {canEdit && (
                        <button 
                            onClick={() => onEdit(report)}
                            className="p-2 bg-gray-100 dark:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Edit this report"
                        >
                            <EditIcon className="w-4 h-4" />
                        </button>
                    )}
                    <StatusBadge status={report.status} />
                </div>
            </div>
            
            <div className="space-y-4 overflow-y-auto flex-grow pr-2 -mr-2">
                {report.evidence_images && report.evidence_images.length > 0 && (
                     <div className="grid grid-cols-2 gap-2">
                        {report.evidence_images.map((img, index) => (
                             <img key={index} src={img} alt={`Evidence ${index+1}`} className="w-full h-24 object-cover rounded-md border border-gray-200 dark:border-gray-700" />
                        ))}
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Severity</p>
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{report.severity}</p>
                    </div>
                     <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reported</p>
                        <p className="text-gray-900 dark:text-white">{format(new Date(report.reported_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                </div>

                <div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{isVehicleReport(report) ? 'Last Seen Location' : 'Location'}</p>
                     <p className="text-gray-900 dark:text-white flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400 dark:text-gray-500"/> {isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                </div>
                
                {report.location_coords ? (
                    <div className="h-40 w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 mt-2">
                        <MapContainer 
                            center={[report.location_coords.lat, report.location_coords.lng]} 
                            zoom={15} 
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            scrollWheelZoom={false}
                            dragging={false}
                            touchZoom={false}
                            doubleClickZoom={false}
                        >
                            <TileLayer key={theme} url={tileUrl} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
                            <Marker position={[report.location_coords.lat, report.location_coords.lng]} icon={markerIcon} />
                        </MapContainer>
                    </div>
                ) : (
                    <div className="h-40 w-full rounded-lg border border-dashed border-gray-300 dark:border-gray-700 mt-2 flex items-center justify-center bg-gray-50 dark:bg-gray-800/30">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Map preview not available.</p>
                    </div>
                )}


                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Description</p>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.description}</p>
                </div>
                
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Official Updates</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-100 dark:bg-gray-800/50 p-2 rounded-md">
                        {updates.length > 0 ? updates.map(u => (
                            <div key={u.id} className="text-sm border-b border-gray-200 dark:border-gray-700/50 pb-1 last:border-b-0">
                                <p className="text-gray-800 dark:text-gray-200">{u.content}</p>
                                <p className="text-xs text-gray-500 text-right">- {u.user_full_name} ({formatDistanceToNow(new Date(u.created_at), {addSuffix: true})})</p>
                            </div>
                        )) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No official updates posted yet.</p>
                        )}
                    </div>
                </div>
                 
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
                    <IncidentChat reportId={report.id} currentUserProfile={profile} />
                </div>
            </div>
        </div>
    );
};

export default UserReportDetail;

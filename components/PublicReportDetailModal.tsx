import React, { useState } from 'react';
import { Report, VehicleReport, EmergencyReport } from '../types';
import { XIcon, MapPinIcon } from './icons';
import StatusBadge from './StatusBadge';
import { safeFormat } from '../utils/dateUtils';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../contexts/ThemeContext';
import ImagePreviewModal from './ImagePreviewModal';

const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

interface PublicReportDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report | null;
}

const DetailItem: React.FC<{ label: string; value?: string | React.ReactNode }> = ({ label, value }) => (
    <div>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="text-gray-800 dark:text-gray-200">{value || 'N/A'}</div>
    </div>
);

const PublicReportDetailModal: React.FC<PublicReportDetailModalProps> = ({ isOpen, onClose, report }) => {
    const { theme } = useTheme();
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    if (!isOpen || !report) return null;

    const lightMapUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const darkMapUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const tileUrl = theme === 'dark' ? darkMapUrl : lightMapUrl;
    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    return (
        <>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors z-10">
                        <XIcon className="w-6 h-6" />
                    </button>
                    
                    <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-grow">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{report.type === 'vehicle' ? (report as any).license_plate : report.title}</h3>
                                <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{report.ob_number}</p>
                            </div>
                            <div className="flex-shrink-0">
                                <StatusBadge status={report.status} />
                            </div>
                        </div>
                        
                        {report.evidence_images && report.evidence_images.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Evidence</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {report.evidence_images.map((img, index) => (
                                        <button key={index} onClick={() => setPreviewImageUrl(img)} className="block relative h-24 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group">
                                            <img src={img} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V8m0 0h-4m4 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" /></svg>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <DetailItem label="Severity" value={<span className="font-bold uppercase">{report.severity.toUpperCase()}</span>} />
                            <DetailItem label="Reported At" value={safeFormat(report.reported_at, 'MMM d, yyyy HH:mm')} />
                            {report.type === 'vehicle' ? (
                                <DetailItem label="Vehicle" value={`${(report as any).vehicle_color} ${(report as any).vehicle_make} ${(report as any).vehicle_model}`} />
                            ) : report.type === 'emergency' ? (
                                <DetailItem label="Emergency Type" value={(report as any).emergency_type} />
                            ) : (
                                <DetailItem label="Crime Type" value={(report as any).crime_type} />
                            )}
                        </div>

                        <div>
                            <DetailItem label={report.type === 'vehicle' ? 'Last Seen Location' : 'Location'} value={
                                <div className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/20 p-2 rounded-lg border border-gray-100 dark:border-gray-850">
                                    <div className="flex items-start gap-2">
                                        <MapPinIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <span>{report.type === 'vehicle' ? (report as any).last_seen_location : (report as any).location}</span>
                                    </div>
                                    {(report.location_coords || report.map_link) && (
                                        <button 
                                            onClick={() => {
                                                if (report.map_link && (report.map_link.startsWith('http://') || report.map_link.startsWith('https://'))) {
                                                    window.open(report.map_link, '_blank');
                                                } else if (report.location_coords) {
                                                    const url = `https://www.google.com/maps/search/?api=1&query=${report.location_coords.lat},${report.location_coords.lng}`;
                                                    window.open(url, '_blank');
                                                }
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-[10px] flex items-center gap-0.5 transition shadow-sm whitespace-nowrap"
                                        >
                                            <span>Maps ↗</span>
                                        </button>
                                    )}
                                </div>
                            } />
                        </div>

                        {report.location_coords && typeof report.location_coords.lat === 'number' && !isNaN(report.location_coords.lat) && typeof report.location_coords.lng === 'number' && !isNaN(report.location_coords.lng) ? (
                            <div className="h-48 w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
                                <MapContainer 
                                    center={[report.location_coords.lat, report.location_coords.lng]} 
                                    zoom={15} 
                                    style={{ height: '100%', width: '100%' }}
                                    zoomControl={false} scrollWheelZoom={false} dragging={false} touchZoom={false} doubleClickZoom={false}
                                >
                                    <TileLayer key={theme} url={tileUrl} attribution={attribution} />
                                    <Marker position={[report.location_coords.lat, report.location_coords.lng]} icon={markerIcon} />
                                </MapContainer>
                            </div>
                        ) : null}

                        <div>
                            <DetailItem label="Description" value={<p className="whitespace-pre-wrap text-sm">{report.description}</p>} />
                        </div>
                    </div>
                </div>
            </div>
            <ImagePreviewModal isOpen={!!previewImageUrl} onClose={() => setPreviewImageUrl(null)} imageUrl={previewImageUrl} />
        </>
    );
};
export default PublicReportDetailModal;

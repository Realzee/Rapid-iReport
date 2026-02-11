import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L, { LatLngBoundsExpression } from 'leaflet';
import { Report, VehicleReport, Severity, ReportStatus } from '../types';
import { XIcon } from './icons';
import StatusBadge from './StatusBadge';
import MapStyleToggle, { MapStyle } from './MapStyleToggle';

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report | null;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const createVehicleIcon = (severity: Severity, status: ReportStatus) => {
    let bgColorClass = 'bg-blue-600';
    if (status === ReportStatus.RECOVERED || status === ReportStatus.RESOLVED) bgColorClass = 'bg-green-600';
    else if (status === ReportStatus.REJECTED) bgColorClass = 'bg-red-600';
    else if (severity === Severity.CRITICAL || severity === Severity.HIGH) bgColorClass = 'bg-red-600';

    const iconHtml = `<div class="relative w-8 h-8 ${bgColorClass} border-2 border-white/80 rounded-full shadow-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M14 16.5V14a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.5"/><path d="M20 10h-2.5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2H4"/><path d="M19 17h.01"/><path d="M5 17h.01"/><path d="M2 10l3.5-3.5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.5.5L22 10"/></svg>
    </div>`;
    return new L.DivIcon({ html: iconHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
};

const createCrimeIcon = (status: ReportStatus) => {
    let bgColorClass = 'bg-red-600';
    if (status === ReportStatus.RESOLVED) {
        bgColorClass = 'bg-green-600';
    }
    
    const iconHtml = `<div class="relative w-8 h-8 ${bgColorClass} border-2 border-white/80 rounded-full shadow-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9.5 14.5 5-5"/><path d="m9.5 9.5 5 5"/></svg>
    </div>`;
    return new L.DivIcon({ html: iconHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
};

const MapFocusController: React.FC<{ report: Report }> = ({ report }) => {
    const map = useMap();
    useEffect(() => {
        // This effect runs once when the map is ready
        if (report.location_boundingbox) {
             const bounds: LatLngBoundsExpression = [
                [report.location_boundingbox[0], report.location_boundingbox[2]],
                [report.location_boundingbox[1], report.location_boundingbox[3]]
            ];
            map.fitBounds(bounds, { padding: [20, 20] });
        } else if (report.location_coords) {
            map.setView([report.location_coords.lat, report.location_coords.lng], 16);
        }
    }, [map, report]); // Depend on map and report to re-run if they change
    return null;
}

const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, report }) => {
    const [mapStyle, setMapStyle] = useState<MapStyle>('street');

    if (!isOpen || !report || (!report.location_coords && !report.location_boundary)) {
        return null;
    }

    const streetTile = {
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    };
    const satelliteTile = {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    };
    const currentTile = mapStyle === 'street' ? streetTile : satelliteTile;
    
    const areaStyle = {
        fillColor: '#60A5FA',
        fillOpacity: 0.2,
        color: '#3B82F6',
        weight: 2,
    };

    const reportIcon = isVehicleReport(report)
        ? createVehicleIcon(report.severity, report.status)
        : createCrimeIcon(report.status);

    const position: [number, number] | undefined = report.location_coords ? [report.location_coords.lat, report.location_coords.lng] : undefined;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" aria-labelledby="map-modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl w-full h-full sm:rounded-2xl sm:w-11/12 sm:max-w-4xl sm:h-auto sm:max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                    <h3 id="map-modal-title" className="text-lg font-bold text-gray-900 dark:text-white truncate">
                        Map Location for: {isVehicleReport(report) ? report.license_plate : report.title}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="flex-grow h-full w-full relative">
                    {/* @ts-ignore */}
                    <MapContainer center={position || [0,0]} zoom={position ? 16 : 10} scrollWheelZoom={true} style={{ height: '100%', width: '100%', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
                         {/* @ts-ignore */}
                         <TileLayer 
                            key={mapStyle}
                            attribution={currentTile.attribution} 
                            url={currentTile.url} />
                        
                        <MapFocusController report={report} />
                        
                        {report.location_boundary && (
                            // @ts-ignore
                            <GeoJSON data={report.location_boundary} style={areaStyle} />
                        )}

                        {position && (
                            // @ts-ignore
                            <Marker position={position} icon={reportIcon}>
                                <Popup>
                                    <div className="w-56">
                                        <h4 className="font-bold mb-1">{isVehicleReport(report) ? report.license_plate : report.title}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                                        <StatusBadge status={report.status} />
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                    </MapContainer>
                    <MapStyleToggle currentStyle={mapStyle} onStyleChange={setMapStyle} />
                </div>
            </div>
        </div>
    );
};

export default MapModal;
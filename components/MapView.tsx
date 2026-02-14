import React, { useState, useEffect, useRef, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, GeoJSON } from 'react-leaflet';
import L, { LatLngBoundsExpression } from 'leaflet';
import { Report, Responder, VehicleReport, ReportStatus, Severity, ResponderStatus, Profile } from '../types';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon, ShareIcon } from './icons';
import MapStyleToggle, { MapStyle } from './MapStyleToggle';

interface MapViewProps {
  reports: Report[];
  responders: Responder[];
  selectedReportId: string | null;
  profile?: Profile;
  onReportSelect?: (reportId: string) => void;
  allUsers: Profile[];
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const createIncidentIcon = (report: Report, isSelected: boolean) => {
    const severityColors: Record<Severity, string> = {
        [Severity.CRITICAL]: '#ef4444', // red-500
        [Severity.HIGH]: '#f97316',      // orange-500
        [Severity.MEDIUM]: '#eab308',   // yellow-500
        [Severity.LOW]: '#3b82f6',      // blue-500
    };

    const color = severityColors[report.severity] || '#6b7280'; // gray-500 fallback

    const carSvgPath = `
        <path d="M14 16.5V14a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.5"></path>
        <path d="M20 10h-2.5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2H4"></path>
        <path d="M19 17h.01"></path>
        <path d="M5 17h.01"></path>
        <path d="M2 10l3.5-3.5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.5.5L22 10"></path>`;
    const crimeSvgPath = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`;
    
    const iconSvgPath = isVehicleReport(report) ? carSvgPath : crimeSvgPath;

    const size = isSelected ? 48 : 36;
    const scale = isSelected ? 1.1 : 1;
    const shadowFilter = `drop-shadow(0 4px 6px rgba(0,0,0,0.4))`;
    const glowFilter = isSelected ? `drop-shadow(0 0 8px ${color})` : '';
    
    const iconHtml = `
        <div style="width: ${size}px; height: ${size}px; display: flex; justify-content: center; align-items: center; transform: scale(${scale}); transition: transform 0.2s ease-out;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 100%; height: 100%; filter: ${shadowFilter} ${glowFilter}; transition: filter 0.2s ease-out;">
                <path fill="${color}" stroke="#ffffff" stroke-width="1" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                <g transform="translate(4, 3) scale(0.7)" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    ${iconSvgPath}
                </g>
            </svg>
        </div>
    `;

    return new L.DivIcon({
        html: iconHtml,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
    });
};


const createResponderIcon = (status: ResponderStatus) => {
    let colorClass = 'text-gray-500'; // Off-duty (fallback)
    let pulseColorClass = '';

    switch (status) {
        case ResponderStatus.AVAILABLE: colorClass = 'text-green-500'; break;
        case ResponderStatus.EN_ROUTE: colorClass = 'text-blue-500'; pulseColorClass = 'bg-blue-400'; break;
        case ResponderStatus.ON_SCENE: colorClass = 'text-yellow-500'; break;
    }

    const pulseHtml = pulseColorClass ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColorClass} opacity-75"></span>` : '';

    const iconHtml = `
        <div class="relative flex items-center justify-center w-8 h-8">
            ${pulseHtml}
            <svg class="relative w-8 h-8 ${colorClass}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <svg class="absolute w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        </div>
    `;

    return new L.DivIcon({
        html: iconHtml,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });
};


const MapFocusController: React.FC<{ selectedReport: Report | undefined, responders: Responder[] }> = ({ selectedReport, responders }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedReport?.location_coords) {
            const reportLocation: L.LatLngExpression = [selectedReport.location_coords.lat, selectedReport.location_coords.lng];

            const availableResponders = responders.filter(
                r => r.status === ResponderStatus.AVAILABLE && r.location_coords
            );

            if (availableResponders.length > 0) {
                const responderLocations: L.LatLngExpression[] = availableResponders.map(
                    r => [r.location_coords!.lat, r.location_coords!.lng]
                );
                
                const bounds = L.latLngBounds([reportLocation, ...responderLocations]);
                map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });

            } else if (selectedReport.location_boundingbox) {
                const bounds: LatLngBoundsExpression = [
                    [selectedReport.location_boundingbox[0], selectedReport.location_boundingbox[2]],
                    [selectedReport.location_boundingbox[1], selectedReport.location_boundingbox[3]]
                ];
                map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
            } else {
                map.flyTo(reportLocation, 15, { animate: true, duration: 1.0 });
            }
        }
    }, [selectedReport, responders, map]);
    return null;
};

const MapView: React.FC<MapViewProps> = ({ reports, responders, selectedReportId, profile, onReportSelect, allUsers }) => {
    const [copiedReportId, setCopiedReportId] = useState<string | null>(null);
    const [mapStyle, setMapStyle] = useState<MapStyle>('street');

    const handleShareReport = (reportId: string) => {
        navigator.clipboard.writeText(`https://rapid-ireport.app/report/${reportId}`).then(() => {
            setCopiedReportId(reportId);
            setTimeout(() => setCopiedReportId(null), 2000);
        });
    };

    const selectedReport = reports.find(r => r.id === selectedReportId);

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

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700/50 shadow-lg dark:shadow-none relative">
            <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}>
                <TileLayer 
                    attribution={currentTile.attribution} 
                    url={currentTile.url} />
                <MapFocusController selectedReport={selectedReport} responders={responders} />

                {responders.map(responder => (
                    responder.location_coords && (
                        <Marker
                            key={`responder-${responder.id}`}
                            position={[responder.location_coords.lat, responder.location_coords.lng]}
                            icon={createResponderIcon(responder.status)}
                            zIndexOffset={100}
                        >
                            <Tooltip direction="top" offset={[0, -32]}>
                                <div className="font-bold">{`${responder.first_name} ${responder.surname}`}</div>
                                <div className="capitalize">{responder.status.replace('_', ' ')}</div>
                            </Tooltip>
                        </Marker>
                    )
                ))}

                {reports.map(report => {
                    if (!report.location_coords) return null;
                    const isSelected = report.id === selectedReportId;
                    return (
                         <Marker
                            key={report.id}
                            position={[report.location_coords.lat, report.location_coords.lng]}
                            icon={createIncidentIcon(report, isSelected)}
                            zIndexOffset={isSelected ? 1000 : 0}
                            // FIX: The 'onClick' prop is not available on Marker. Use 'eventHandlers' instead.
                            eventHandlers={{
                                click: () => {
                                    if (onReportSelect) {
                                        onReportSelect(report.id);
                                    }
                                },
                            }}
                        >
                            <Popup>
                                <div className="w-72">
                                    <h3 className="font-bold text-lg mb-1">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mb-2">{report.ob_number}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{report.description}</p>
                                    <hr className="border-gray-200 dark:border-gray-600 my-2" />
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Status</span><StatusBadge status={report.status} /></div>
                                        <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Severity</span><span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${report.severity === 'critical' ? 'bg-red-500/20 text-red-400' : report.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : report.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{report.severity}</span></div>
                                    </div>
                                    
                                    <hr className="border-gray-200 dark:border-gray-600 my-2" />
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
                                        <button onClick={() => handleShareReport(report.id)} className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50" disabled={copiedReportId === report.id}>
                                            {copiedReportId === report.id ? <><CheckCircleIcon className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></> : <><ShareIcon className="w-4 h-4" /><span>Share</span></>}
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}

                {selectedReport && selectedReport.location_boundary && (
                    <GeoJSON data={selectedReport.location_boundary} style={areaStyle} />
                )}
            </MapContainer>
            <MapStyleToggle currentStyle={mapStyle} onStyleChange={setMapStyle} />
        </div>
    );
};

export default memo(MapView);

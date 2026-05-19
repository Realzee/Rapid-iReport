import React, { useState, useEffect, useRef, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, GeoJSON, Circle, Polyline } from 'react-leaflet';
import L, { LatLngBoundsExpression } from 'leaflet';
import { Report, Responder, VehicleReport, ReportStatus, Severity, ResponderStatus, Profile } from '../types';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon, ShareIcon, GlobeIcon, UsersIcon } from './icons';
import MapStyleToggle, { MapStyle } from './MapStyleToggle';
import { useTheme } from '../contexts/ThemeContext';
import { booleanPointInPolygon, point } from '@turf/turf';

interface MapViewProps {
  reports: Report[];
  responders: Responder[];
  selectedReportId: string | null;
  selectedResponderId?: string | null;
  profile?: Profile;
  onReportSelect?: (reportId: string) => void;
  onResponderSelect?: (responderId: string) => void;
  onAssignResponder?: (responderId: string) => void;
  allUsers: Profile[];
  activeTab?: 'events' | 'responders';
  showHighRiskAreas?: boolean;
}

const HIGH_RISK_POLYGONS = {
    type: "FeatureCollection",
    features: [
        // VERY HIGH
        { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-26.195, 28.035], [-26.195, 28.055], [-26.215, 28.055], [-26.215, 28.035], [-26.195, 28.035]]] }, properties: { name: "JHB Central / Hillbrow", intensity: "very-high" } },
        { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-26.10, 28.08], [-26.10, 28.12], [-26.13, 28.12], [-26.13, 28.08], [-26.10, 28.08]]] }, properties: { name: "Alexandra", intensity: "very-high" } },
        { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-26.25, 27.85], [-26.25, 27.90], [-26.30, 27.90], [-26.30, 27.85], [-26.25, 27.85]]] }, properties: { name: "Soweto Cluster", intensity: "very-high" } },
        // HIGH
        { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-26.16, 27.85], [-26.16, 27.90], [-26.20, 27.90], [-26.20, 27.85], [-26.16, 27.85]]] }, properties: { name: "Roodepoort", intensity: "high" } },
        { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-26.30, 27.95], [-26.30, 28.00], [-26.35, 28.00], [-26.35, 27.95], [-26.30, 27.95]]] }, properties: { name: "Lenasia/Eldorado", intensity: "high" } }
    ]
};

const isInsideHighRisk = (coords: { lat: number; lng: number }): boolean => {
    const pt = point([coords.lng, coords.lat]);
    return HIGH_RISK_POLYGONS.features.some(feature => booleanPointInPolygon(pt, feature as any));
};

const createIncidentIcon = (report: Report, isSelected: boolean, isInHighRisk: boolean) => {
    const typeColors: Record<string, string> = {
        'vehicle': '#3b82f6', // blue-500
        'crime': '#eab308',   // yellow-500
        'emergency': '#ef4444', // red-500
    };

    const color = isInHighRisk ? '#DC2626' : (typeColors[report.type || 'crime'] || '#6b7280'); // gray-500 fallback

    const carSvgPath = `
        <path d="M14 16.5V14a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.5"></path>
        <path d="M20 10h-2.5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2H4"></path>
        <path d="M19 17h.01"></path>
        <path d="M5 17h.01"></path>
        <path d="M2 10l3.5-3.5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.5.5L22 10"></path>`;
    const crimeSvgPath = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`;
    const emergencySvgPath = `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>`;
    
    const iconSvgPath = report.type === 'vehicle' ? carSvgPath : (report.type === 'emergency' ? emergencySvgPath : crimeSvgPath);

    const size = isSelected ? 52 : (isInHighRisk ? 48 : 40);
    const scale = isSelected ? 1.15 : (isInHighRisk ? 1.1 : 1);
    const shadowFilter = `drop-shadow(0 0 3px rgba(255,255,255,1)) drop-shadow(0 4px 6px rgba(0,0,0,0.5))`;
    const glowFilter = isSelected ? `drop-shadow(0 0 12px ${color})` : (isInHighRisk ? `drop-shadow(0 0 8px #EF4444)` : '');
    
    const iconHtml = `
        <div style="width: ${size}px; height: ${size}px; display: flex; justify-content: center; align-items: center; transform: scale(${scale}); transition: transform 0.2s ease-out;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 100%; height: 100%; filter: ${shadowFilter} ${glowFilter}; transition: filter 0.2s ease-out;">
                <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                <g transform="translate(4, 3) scale(0.7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

const createRecoveryIcon = (isSelected: boolean) => {
    const color = '#10B981'; // emerald-500
    const size = isSelected ? 48 : 40;
    
    const iconHtml = `
        <div style="width: ${size}px; height: ${size}px; display: flex; justify-content: center; align-items: center;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 100%; height: 100%; filter: drop-shadow(0 0 4px rgba(255,255,255,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                <circle cx="12" cy="9" r="3" fill="white" />
                <path d="M9 9l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(0, 1) scale(0.8)"/>
            </svg>
        </div>
    `;

    return new L.DivIcon({
        html: iconHtml,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
    });
};


const createResponderIcon = (status: ResponderStatus, isInHighRisk: boolean) => {
    let colorClass = 'text-gray-500'; // Off-duty (fallback)
    let pulseColorClass = '';

    switch (status) {
        case ResponderStatus.AVAILABLE: colorClass = isInHighRisk ? 'text-red-500' : 'text-emerald-500'; break;
        case ResponderStatus.EN_ROUTE: colorClass = 'text-indigo-500'; pulseColorClass = 'bg-indigo-400'; break;
        case ResponderStatus.ON_SCENE: colorClass = 'text-amber-500'; break;
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


const MapFocusController: React.FC<{ reports: Report[], selectedReport: Report | undefined, responders: Responder[], selectedResponder: Responder | undefined, selectedResponderId: string | null, activeTab?: 'events' | 'responders' }> = ({ reports, selectedReport, responders, selectedResponder, selectedResponderId, activeTab }) => {
    const map = useMap();
    useEffect(() => {
        // Use a timeout to allow CSS transitions on the container to finish before recalculating map size and position
        const timer = setTimeout(() => {
            map.invalidateSize();

            if (selectedResponder?.location_coords) {
                const { lat, lng } = selectedResponder.location_coords;
                if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
                    map.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });
                }
            } else if (activeTab === 'responders' && selectedResponderId) {
                // If we are in responders tab and have a selected responder but no coords, 
                // maybe we should do something?
            } else if (activeTab === 'responders') {
                const respondersWithCoords = responders.filter(r => 
                    r.location_coords && 
                    typeof r.location_coords.lat === 'number' && !isNaN(r.location_coords.lat) &&
                    typeof r.location_coords.lng === 'number' && !isNaN(r.location_coords.lng)
                );
                
                if (respondersWithCoords.length > 0) {
                    try {
                        const bounds = L.latLngBounds(respondersWithCoords.map(r => [r.location_coords!.lat, r.location_coords!.lng]));
                        if (bounds.isValid()) {
                            map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0, maxZoom: 14 });
                        }
                    } catch (e) {
                        console.error("Error calculating responder bounds:", e);
                    }
                } else {
                    // Default view if no responders have coordinates.
                    map.flyTo([-26.2041, 28.0473], 11, { animate: true, duration: 1.0 });
                }
            } else if (selectedReport?.location_coords) {
                const { lat, lng } = selectedReport.location_coords;
                if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
                    const reportLocation: L.LatLngExpression = [lat, lng];

                    // If the report has a defined bounding box (e.g., a neighborhood), fit to that.
                    if (selectedReport.location_boundingbox && selectedReport.location_boundingbox.length === 4) {
                        const [s, n, w, e] = selectedReport.location_boundingbox;
                        if (typeof s === 'number' && !isNaN(s) && typeof n === 'number' && !isNaN(n) && 
                            typeof w === 'number' && !isNaN(w) && typeof e === 'number' && !isNaN(e)) {
                            try {
                                const bounds: LatLngBoundsExpression = [
                                    [s, w],
                                    [n, e]
                                ];
                                map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
                            } catch (e) {
                                map.flyTo(reportLocation, 15, { animate: true, duration: 1.0 });
                            }
                        } else {
                             map.flyTo(reportLocation, 15, { animate: true, duration: 1.0 });
                        }
                    } else {
                        // Otherwise, just fly to the specific point.
                        map.flyTo(reportLocation, 15, { animate: true, duration: 1.0 });
                    }
                }
            } else {
                // "Show All" logic: No report is selected, so fit all reports on the map.
                const reportsWithCoords = reports.filter(r => 
                    r.location_coords && 
                    typeof r.location_coords.lat === 'number' && !isNaN(r.location_coords.lat) &&
                    typeof r.location_coords.lng === 'number' && !isNaN(r.location_coords.lng)
                );
                
                if (reportsWithCoords.length > 0) {
                    try {
                        const bounds = L.latLngBounds(reportsWithCoords.map(r => [r.location_coords!.lat, r.location_coords!.lng]));
                        if (bounds.isValid()) {
                            map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0, maxZoom: 14 });
                        }
                    } catch (e) {
                        console.error("Error calculating report bounds:", e);
                    }
                } else {
                    // Default view if no reports have coordinates.
                    map.flyTo([-26.2041, 28.0473], 11, { animate: true, duration: 1.0 });
                }
            }
        }, 310); // A little longer than the 300ms transition of the side panel.

        return () => clearTimeout(timer);
    }, [selectedReport, selectedResponder, selectedResponderId, reports, responders, activeTab, map]);
    return null;
};

const MapView: React.FC<MapViewProps> = ({ reports, responders, selectedReportId, selectedResponderId, profile, onReportSelect, onResponderSelect, onAssignResponder, allUsers, activeTab, showHighRiskAreas }) => {
    const [copiedReportId, setCopiedReportId] = useState<string | null>(null);
    const [mapStyle, setMapStyle] = useState<MapStyle>('street');
    const { theme } = useTheme();

    const handleShareReport = (reportId: string) => {
        const shareUrl = `${window.location.origin}/report/${reportId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopiedReportId(reportId);
            setTimeout(() => setCopiedReportId(null), 2000);
        });
    };

    const selectedReport = reports.find(r => r.id === selectedReportId);
    const selectedResponder = responders.find(r => r.id === selectedResponderId);

    const streetTile = {
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    };
    const satelliteTile = {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri'
    };
    const satelliteLabelsTile = {
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        attribution: ''
    };


    const areaStyle = {
        fillColor: '#60A5FA',
        fillOpacity: 0.2,
        color: '#3B82F6',
        weight: 2,
    };

    const approximateLocationStyle = {
        fillColor: '#F87171', // Red-400
        fillOpacity: 0.15,
        color: '#EF4444', // Red-500
        weight: 1,
        dashArray: '5, 5'
    };

    const getHighRiskStyle = (feature: any) => {
        const intensity = feature.properties.intensity;
        switch (intensity) {
            case 'very-high':
                return { fillColor: '#B91C1C', fillOpacity: 0.6, color: '#991B1B', weight: 1 };
            case 'high':
                return { fillColor: '#F97316', fillOpacity: 0.6, color: '#C2410C', weight: 1 };
            default:
                return { fillColor: '#EF4444', fillOpacity: 0.4, color: '#B91C1C', weight: 2 };
        }
    };

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700/50 shadow-lg dark:shadow-none relative">
            <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}>
                {mapStyle === 'street' ? (
                    <TileLayer
                        attribution={streetTile.attribution} 
                        url={streetTile.url}
                    />
                ) : (
                    <>
                        <TileLayer
                            attribution={satelliteTile.attribution} 
                            url={satelliteTile.url}
                        />
                        <TileLayer
                            url={satelliteLabelsTile.url}
                            pane="overlayPane"
                        />
                    </>
                )}
                <MapFocusController reports={reports} selectedReport={selectedReport} responders={responders} selectedResponder={selectedResponder} selectedResponderId={selectedResponderId} activeTab={activeTab} />
                
                {showHighRiskAreas && (
                    <GeoJSON data={HIGH_RISK_POLYGONS as any} style={getHighRiskStyle as any} />
                )}

                {responders.map(responder => (
                    responder.location_coords && 
                    typeof responder.location_coords.lat === 'number' && !isNaN(responder.location_coords.lat) &&
                    typeof responder.location_coords.lng === 'number' && !isNaN(responder.location_coords.lng) && (
                            <Marker
                                key={`responder-${responder.id}`}
                                position={[responder.location_coords.lat, responder.location_coords.lng]}
                                icon={createResponderIcon(responder.status, isInsideHighRisk(responder.location_coords))}
                                zIndexOffset={100}
                            eventHandlers={{
                                click: () => onResponderSelect?.(responder.id)
                            }}
                        >
                            <Tooltip direction="top" offset={[0, -32]}>
                                <div className="font-bold">{`${responder.first_name} ${responder.surname}`}</div>
                                <div className="capitalize">{responder.status.replace('_', ' ')}</div>
                            </Tooltip>
                            <Popup>
                                <div className="p-2 min-w-[200px]">
                                    <div className="flex items-center gap-3 mb-3">
                                        <img src={`https://i.pravatar.cc/40?u=${responder.id}`} alt="avatar" className="w-10 h-10 rounded-full" />
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white leading-tight">{responder.first_name} {responder.surname}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{responder.status.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                    
                                    {selectedReportId && responder.status === ResponderStatus.AVAILABLE && (
                                        <button 
                                            onClick={() => {
                                                onAssignResponder?.(responder.id);
                                            }}
                                            className="w-full py-2 px-3 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 transition shadow-sm"
                                        >
                                            Assign to Incident {selectedReport?.ob_number}
                                        </button>
                                    )}
                                    
                                    {!selectedReportId && (
                                        <p className="text-xs text-gray-500 italic">Select an incident to assign this responder.</p>
                                    )}
                                    
                                    {responder.status !== ResponderStatus.AVAILABLE && (
                                        <p className="text-xs text-yellow-600 dark:text-yellow-400 italic">Responder is currently {responder.status.replace('_', ' ')}.</p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}

                {reports.map(report => {
                    if (!report.location_coords || typeof report.location_coords.lat !== 'number' || typeof report.location_coords.lng !== 'number' || isNaN(report.location_coords.lat) || isNaN(report.location_coords.lng)) return null;
                    const isSelected = report.id === selectedReportId;
                    return (
                        <React.Fragment key={report.id}>
                            {!report.location_boundary && (
                                <Circle 
                                    center={[report.location_coords.lat, report.location_coords.lng]}
                                    radius={500} // 500 meters radius for approximate location
                                    pathOptions={approximateLocationStyle}
                                />
                            )}
                            <Marker
                                position={[report.location_coords.lat, report.location_coords.lng]}
                                icon={createIncidentIcon(report, isSelected, isInsideHighRisk(report.location_coords))}
                                zIndexOffset={isSelected ? 1000 : 0}
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
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-lg">{report.type === 'vehicle' ? (report as any).license_plate : report.title}</h3>
                                            {report.is_global && (
                                                <GlobeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" title="Global Report" />
                                            )}
                                            {!report.is_global && report.shared_with_company_ids && report.shared_with_company_ids.length > 0 && (
                                                <UsersIcon className="w-4 h-4 text-blue-500 flex-shrink-0" title="Shared with specific companies" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mb-2">{report.ob_number}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{report.description}</p>
                                        <hr className="border-gray-200 dark:border-gray-600 my-2" />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase shrink-0 mr-2">
                                                    {report.type === 'vehicle' ? 'Last Known Loc' : 'Location'}
                                                </span>
                                                <span className="text-sm text-right text-gray-700 dark:text-gray-300">
                                                    {report.type === 'vehicle' ? (report as any).last_seen_location : (report as any).location}
                                                </span>
                                            </div>
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

                            {(report as any).recovered_location_coords && 
                                typeof (report as any).recovered_location_coords.lat === 'number' && !isNaN((report as any).recovered_location_coords.lat) && 
                                typeof (report as any).recovered_location_coords.lng === 'number' && !isNaN((report as any).recovered_location_coords.lng) && (
                                <>
                                    <Polyline 
                                        positions={[
                                            [report.location_coords.lat, report.location_coords.lng],
                                            [(report as any).recovered_location_coords.lat, (report as any).recovered_location_coords.lng]
                                        ]} 
                                        pathOptions={{ color: '#10B981', weight: 3, dashArray: '10, 10', opacity: 0.6 }} 
                                    />
                                    <Marker
                                        position={[(report as any).recovered_location_coords.lat, (report as any).recovered_location_coords.lng]}
                                        icon={createRecoveryIcon(isSelected)}
                                        zIndexOffset={isSelected ? 1100 : 100}
                                    >
                                        <Popup>
                                            <div className="p-2">
                                                <p className="font-bold text-green-600 mb-1 flex items-center gap-1">
                                                    <CheckCircleIcon className="w-4 h-4" /> RECOVERED LOCATION
                                                </p>
                                                <p className="text-sm">Recovered at: {formatDistanceToNow(new Date((report as any).recovered_at || report.updated_at), { addSuffix: true })}</p>
                                                <p className="text-xs text-gray-500 mt-2">Vehicle/Subject from OB: {report.ob_number}</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                </>
                            )}
                        </React.Fragment>
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
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Report, Profile, ResponderStatus, LocationCoords } from '../types';
import MapStyleToggle, { MapStyle } from './MapStyleToggle';
import { getCartoTileUrl, CARTO_ATTRIBUTION, ESRI_SATELLITE_TILE, ESRI_LABELS_TILE } from '../utils/mapTileUtils';
import { Navigation, Compass, Phone, MessageSquare, MapPin, Wrench, Shield, CheckCircle, Car, ArrowUpRight } from 'lucide-react';

interface RoadsideDriverMapViewProps {
    report: Report | null;
    driverProfile: Profile;
    nearbyReports?: Report[];
    onSelectReport?: (report: Report) => void;
}

// Custom DivIcons
const createDriverTruckIcon = (status?: ResponderStatus | string) => {
    let color = '#10b981'; // green for available
    if (status === ResponderStatus.EN_ROUTE || status === 'en_route') color = '#3b82f6'; // blue
    if (status === ResponderStatus.ON_SCENE || status === 'on_scene') color = '#f59e0b'; // amber
    if (status === 'towing' || status === 'in_progress') color = '#8b5cf6'; // purple

    const iconHtml = `
        <div class="relative flex items-center justify-center w-11 h-11">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background-color: ${color};"></span>
            <div class="relative flex items-center justify-center w-10 h-10 rounded-full shadow-2xl border-2 border-white dark:border-gray-900" style="background-color: ${color};">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14 16.5V14a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.5M20 10h-2.5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2H4M19 17h.01M5 17h.01M2 10l3.5-3.5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.5.5L22 10" />
                </svg>
            </div>
            <div class="absolute -bottom-1 bg-gray-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                DRIVER
            </div>
        </div>
    `;

    return new L.DivIcon({
        html: iconHtml,
        className: 'driver-truck-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });
};

const createBreakdownSceneIcon = (severity?: string) => {
    const isCritical = severity === 'critical';
    const bgClass = isCritical ? 'bg-red-600' : 'bg-teal-600';
    const pingClass = isCritical ? 'bg-red-500' : 'bg-teal-500';

    const iconHtml = `
        <div class="relative flex items-center justify-center w-12 h-12">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${pingClass} opacity-80"></span>
            <div class="relative flex items-center justify-center w-10 h-10 rounded-full ${bgClass} shadow-2xl border-2 border-white dark:border-gray-900 text-white">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
            </div>
            <div class="absolute -top-2 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow uppercase tracking-wider">
                BREAKDOWN
            </div>
        </div>
    `;

    return new L.DivIcon({
        html: iconHtml,
        className: 'breakdown-scene-marker',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
    });
};

const createDropOffDestinationIcon = () => {
    const iconHtml = `
        <div class="relative flex items-center justify-center w-11 h-11">
            <div class="relative flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600 shadow-2xl border-2 border-white dark:border-gray-900 text-white">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
                </svg>
            </div>
            <div class="absolute -bottom-1 bg-indigo-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                DROP-OFF
            </div>
        </div>
    `;

    return new L.DivIcon({
        html: iconHtml,
        className: 'dropoff-dest-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });
};

const MapRecenterController: React.FC<{
    driverCoords?: LocationCoords;
    breakdownCoords?: LocationCoords;
    dropOffCoords?: LocationCoords;
    triggerRecenterKey: number;
}> = ({ driverCoords, breakdownCoords, dropOffCoords, triggerRecenterKey }) => {
    const map = useMap();

    useEffect(() => {
        const points: [number, number][] = [];

        if (driverCoords && typeof driverCoords.lat === 'number' && !isNaN(driverCoords.lat) && typeof driverCoords.lng === 'number' && !isNaN(driverCoords.lng)) {
            points.push([driverCoords.lat, driverCoords.lng]);
        }
        if (breakdownCoords && typeof breakdownCoords.lat === 'number' && !isNaN(breakdownCoords.lat) && typeof breakdownCoords.lng === 'number' && !isNaN(breakdownCoords.lng)) {
            points.push([breakdownCoords.lat, breakdownCoords.lng]);
        }
        if (dropOffCoords && typeof dropOffCoords.lat === 'number' && !isNaN(dropOffCoords.lat) && typeof dropOffCoords.lng === 'number' && !isNaN(dropOffCoords.lng)) {
            points.push([dropOffCoords.lat, dropOffCoords.lng]);
        }

        if (points.length === 1) {
            map.setView(points[0], 15, { animate: true });
        } else if (points.length > 1) {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
        }
    }, [map, driverCoords?.lat, driverCoords?.lng, breakdownCoords?.lat, breakdownCoords?.lng, dropOffCoords?.lat, dropOffCoords?.lng, triggerRecenterKey]);

    return null;
};

export const RoadsideDriverMapView: React.FC<RoadsideDriverMapViewProps> = ({
    report,
    driverProfile,
    nearbyReports = [],
    onSelectReport,
}) => {
    const [mapStyle, setMapStyle] = useState<MapStyle>('standard');
    const [recenterKey, setRecenterKey] = useState(0);

    const driverCoords = driverProfile?.location_coords;
    const breakdownCoords = report?.location_coords;
    const dropOffCoords = (report as any)?.drop_off_location_coords;

    // Fallback default center (Johannesburg / South Africa default coords or driver coords)
    const initialCenter: [number, number] = useMemo(() => {
        if (driverCoords && typeof driverCoords.lat === 'number' && !isNaN(driverCoords.lat)) {
            return [driverCoords.lat, driverCoords.lng];
        }
        if (breakdownCoords && typeof breakdownCoords.lat === 'number' && !isNaN(breakdownCoords.lat)) {
            return [breakdownCoords.lat, breakdownCoords.lng];
        }
        return [-26.2041, 28.0473]; // Johannesburg
    }, [driverCoords, breakdownCoords]);

    // Construct route polyline
    const routePolyline = useMemo(() => {
        const line: [number, number][] = [];
        if (driverCoords?.lat && driverCoords?.lng) {
            line.push([driverCoords.lat, driverCoords.lng]);
        }
        if (breakdownCoords?.lat && breakdownCoords?.lng) {
            line.push([breakdownCoords.lat, breakdownCoords.lng]);
        }
        if (dropOffCoords?.lat && dropOffCoords?.lng) {
            line.push([dropOffCoords.lat, dropOffCoords.lng]);
        }
        return line;
    }, [driverCoords, breakdownCoords, dropOffCoords]);

    const openGoogleMaps = (coords?: LocationCoords, label?: string) => {
        if (!coords?.lat || !coords?.lng) return;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
        window.open(url, '_blank');
    };

    const openWaze = (coords?: LocationCoords) => {
        if (!coords?.lat || !coords?.lng) return;
        const url = `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
        window.open(url, '_blank');
    };

    return (
        <div className="relative w-full h-full min-h-[380px] sm:min-h-[500px] rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 flex flex-col">
            {/* Map Action Quick Bar */}
            <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none gap-2">
                <div className="flex items-center gap-2 pointer-events-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <MapStyleToggle currentStyle={mapStyle} onStyleChange={setMapStyle} />
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                        onClick={() => setRecenterKey(prev => prev + 1)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg font-semibold text-xs transition active:scale-95"
                        title="Fit all markers in view"
                    >
                        <Compass className="w-4 h-4" />
                        <span className="hidden sm:inline">Fit Route</span>
                    </button>
                </div>
            </div>

            {/* Turn-by-Turn GPS Navigation Overlay Bar (if report has location) */}
            {breakdownCoords && (
                <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-teal-500/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex-shrink-0">
                            <Navigation className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                                {report?.title || 'Roadside Callout Destination'}
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-200 font-medium truncate">
                                {report?.location || 'Breakdown Scene'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => openGoogleMaps(breakdownCoords)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95"
                        >
                            <Navigation className="w-3.5 h-3.5" />
                            Google Maps
                        </button>
                        <button
                            onClick={() => openWaze(breakdownCoords)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95"
                        >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            Waze
                        </button>
                        {dropOffCoords && (
                            <button
                                onClick={() => openGoogleMaps(dropOffCoords)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95"
                                title="Navigate directly to Drop-off Location"
                            >
                                Drop-off
                            </button>
                        )}
                    </div>
                </div>
            )}

            <MapContainer
                center={initialCenter}
                zoom={14}
                className="w-full h-full flex-grow z-0"
                zoomControl={false}
            >
                {/* Tile Layers based on selected style */}
                {mapStyle === 'standard' && (
                    <TileLayer url={getCartoTileUrl('voyager')} attribution={CARTO_ATTRIBUTION} maxZoom={20} />
                )}
                {mapStyle === 'dark' && (
                    <TileLayer url={getCartoTileUrl('dark')} attribution={CARTO_ATTRIBUTION} maxZoom={20} />
                )}
                {mapStyle === 'satellite' && (
                    <>
                        <TileLayer url={ESRI_SATELLITE_TILE} attribution="Esri World Imagery" maxZoom={19} />
                        <TileLayer url={ESRI_LABELS_TILE} attribution="Esri Labels" maxZoom={19} />
                    </>
                )}

                <MapRecenterController
                    driverCoords={driverCoords}
                    breakdownCoords={breakdownCoords}
                    dropOffCoords={dropOffCoords}
                    triggerRecenterKey={recenterKey}
                />

                {/* Route Connecting Driver -> Breakdown Scene -> Drop-off */}
                {routePolyline.length > 1 && (
                    <Polyline
                        positions={routePolyline}
                        pathOptions={{
                            color: '#0d9488',
                            weight: 4,
                            opacity: 0.8,
                            dashArray: '8, 8',
                        }}
                    />
                )}

                {/* Driver Truck Marker */}
                {driverCoords?.lat && driverCoords?.lng && (
                    <>
                        <Circle
                            center={[driverCoords.lat, driverCoords.lng]}
                            radius={80}
                            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 1 }}
                        />
                        <Marker
                            position={[driverCoords.lat, driverCoords.lng]}
                            icon={createDriverTruckIcon(driverProfile.responder_status)}
                        >
                            <Popup>
                                <div className="p-1 text-xs">
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {driverProfile.first_name} {driverProfile.surname} (You)
                                    </p>
                                    <p className="text-gray-500">Status: {driverProfile.responder_status || 'On Duty'}</p>
                                    {driverProfile.vehicle_reg && (
                                        <p className="text-gray-500">Truck: {driverProfile.vehicle_reg}</p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    </>
                )}

                {/* Active Breakdown Report Marker */}
                {breakdownCoords?.lat && breakdownCoords?.lng && (
                    <Marker
                        position={[breakdownCoords.lat, breakdownCoords.lng]}
                        icon={createBreakdownSceneIcon(report?.severity)}
                    >
                        <Popup>
                            <div className="p-2 min-w-[200px] text-xs">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-black text-teal-700 dark:text-teal-400">
                                        CAR #{(report as any)?.car_number || (report as any)?.card_number || report?.ob_number}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold">
                                        {(report as any)?.assistance_type || 'Roadside'}
                                    </span>
                                </div>
                                <p className="font-semibold text-gray-900 dark:text-white">{report?.title}</p>
                                <p className="text-gray-600 dark:text-gray-300 mt-1">{report?.location}</p>
                                {(report as any)?.driver_name && (
                                    <p className="text-gray-500 mt-1">Driver: {(report as any).driver_name}</p>
                                )}
                                <div className="mt-2 flex gap-1">
                                    <button
                                        onClick={() => openGoogleMaps(breakdownCoords)}
                                        className="w-full py-1 bg-teal-600 text-white rounded text-[10px] font-bold"
                                    >
                                        Navigate to Scene
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Drop-Off Destination Marker */}
                {dropOffCoords?.lat && dropOffCoords?.lng && (
                    <Marker
                        position={[dropOffCoords.lat, dropOffCoords.lng]}
                        icon={createDropOffDestinationIcon()}
                    >
                        <Popup>
                            <div className="p-2 min-w-[190px] text-xs">
                                <span className="font-bold text-indigo-700 dark:text-indigo-400 uppercase text-[10px] tracking-wider">
                                    Drop-off Destination
                                </span>
                                <p className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                                    {(report as any)?.drop_off_location || 'Designated Destination'}
                                </p>
                                <div className="mt-2">
                                    <button
                                        onClick={() => openGoogleMaps(dropOffCoords)}
                                        className="w-full py-1 bg-indigo-600 text-white rounded text-[10px] font-bold"
                                    >
                                        Navigate to Drop-off
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Other Nearby Roadside Reports */}
                {nearbyReports.map((otherReport) => {
                    if (otherReport.id === report?.id || !otherReport.location_coords?.lat || !otherReport.location_coords?.lng) return null;
                    return (
                        <Marker
                            key={otherReport.id}
                            position={[otherReport.location_coords.lat, otherReport.location_coords.lng]}
                            icon={createBreakdownSceneIcon(otherReport.severity)}
                            eventHandlers={{
                                click: () => onSelectReport && onSelectReport(otherReport),
                            }}
                        >
                            <Popup>
                                <div className="p-1 text-xs">
                                    <p className="font-bold text-teal-600">
                                        CAR #{(otherReport as any).car_number || otherReport.ob_number}
                                    </p>
                                    <p className="text-gray-700">{otherReport.location}</p>
                                    <p className="text-gray-500 text-[10px]">{(otherReport as any).assistance_type || 'Roadside Callout'}</p>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default RoadsideDriverMapView;

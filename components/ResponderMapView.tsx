import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Report, Profile, ResponderStatus } from '../types';
import MapStyleToggle, { MapStyle } from './MapStyleToggle';

interface ResponderMapViewProps {
    report: Report | null;
    responderProfile: Profile;
}

const createIncidentIcon = () => {
    const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 40px; height: 40px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">
        <path fill="#dc2626" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
        <circle cx="12" cy="9.5" r="2.5" fill="#ffffff"></circle>
    </svg>`;
    return new L.DivIcon({
        html: iconHtml,
        className: 'pulse-ring-animation',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
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
    });
};

const MapFocusController: React.FC<{ report: Report | null, responderProfile: Profile }> = ({ report, responderProfile }) => {
    const map = useMap();
    useEffect(() => {
        const responderCoords = responderProfile.location_coords;
        const reportCoords = report?.location_coords;

        if (reportCoords && responderCoords) {
            map.flyToBounds([
                [responderCoords.lat, responderCoords.lng],
                [reportCoords.lat, reportCoords.lng]
            ], { padding: [50, 50], maxZoom: 14 });
        } else if (reportCoords) {
            map.flyTo([reportCoords.lat, reportCoords.lng], 14);
        } else if (responderCoords) {
            map.flyTo([responderCoords.lat, responderCoords.lng], 14);
        }

    }, [report, responderProfile, map]);
    return null;
};


const ResponderMapView: React.FC<ResponderMapViewProps> = ({ report, responderProfile }) => {
    const [mapStyle, setMapStyle] = useState<MapStyle>('street');

    const streetTile = {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    };
    const satelliteTile = {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    };
    const currentTile = mapStyle === 'street' ? streetTile : satelliteTile;

    const responderIcon = createResponderIcon(responderProfile.responder_status || ResponderStatus.OFF_DUTY);
    const incidentIcon = createIncidentIcon();
    
    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700/50 shadow-lg dark:shadow-none relative">
            <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}>
                <TileLayer key={mapStyle} url={currentTile.url} attribution={currentTile.attribution} />
                <MapFocusController report={report} responderProfile={responderProfile} />
                
                {responderProfile.location_coords && (
                    <Marker position={[responderProfile.location_coords.lat, responderProfile.location_coords.lng]} icon={responderIcon}>
                        <Tooltip direction="top">Your Location</Tooltip>
                    </Marker>
                )}

                {report?.location_coords && (
                    <Marker position={[report.location_coords.lat, report.location_coords.lng]} icon={incidentIcon}>
                        <Tooltip direction="top">Incident Location</Tooltip>
                    </Marker>
                )}
            </MapContainer>
            <MapStyleToggle currentStyle={mapStyle} onStyleChange={setMapStyle} />
        </div>
    );
};

export default ResponderMapView;
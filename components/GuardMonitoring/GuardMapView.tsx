import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Responder, ResponderStatus } from '../../types';
import { getCartoTileUrl, CARTO_ATTRIBUTION } from '../../utils/mapTileUtils';

interface GuardMapViewProps {
    guards: any[];
    sites?: any[];
}

const createResponderIcon = (status: ResponderStatus) => {
    let colorClass = 'text-gray-500';
    switch (status) {
        case ResponderStatus.AVAILABLE: colorClass = 'text-emerald-500'; break;
        case ResponderStatus.EN_ROUTE: colorClass = 'text-indigo-500'; break;
        case ResponderStatus.ON_SCENE: colorClass = 'text-amber-500'; break;
    }

    const iconHtml = `
        <div class="relative flex items-center justify-center w-8 h-8">
            <svg class="w-8 h-8 ${colorClass}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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

const createSiteIcon = () => {
    const iconHtml = `
        <div class="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-lg text-white">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        </div>
    `;
    return new L.DivIcon({
        html: iconHtml,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

const GuardMapView: React.FC<GuardMapViewProps> = ({ guards, sites = [] }) => {
    return (
        <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow">
            <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url={getCartoTileUrl('voyager')}
                    attribution={CARTO_ATTRIBUTION}
                />
                
                {/* Sites and Geofences */}
                {sites.map(site => (
                    <React.Fragment key={site.id}>
                        {site.location && (
                            <Marker
                                position={[site.location.lat, site.location.lng]}
                                icon={createSiteIcon()}
                            >
                                <Popup>
                                    <div className="p-1">
                                        <h4 className="font-bold">{site.name}</h4>
                                        <p className="text-xs text-gray-600">{site.address}</p>
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                        {/* If site has a boundary (GeoJSON), we could render it here with <GeoJSON data={site.boundary} /> */}
                    </React.Fragment>
                ))}

                {/* Guards */}
                {guards.map(guard => (
                    guard.location_coords && (
                        <Marker
                            key={guard.id}
                            position={[guard.location_coords.lat, guard.location_coords.lng]}
                            icon={createResponderIcon(guard.status || ResponderStatus.AVAILABLE)}
                        >
                            <Tooltip>{guard.name || guard.first_name || 'Unknown Guard'}</Tooltip>
                            <Popup>
                                <div>
                                    <p className="font-bold">{guard.name || guard.first_name || 'Unknown Guard'}</p>
                                    <p className="capitalize">{(guard.status || 'available').replace('_', ' ')}</p>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}
            </MapContainer>
        </div>
    );
};

export default GuardMapView;

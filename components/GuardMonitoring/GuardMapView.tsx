import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Responder, ResponderStatus } from '../../types';

interface GuardMapViewProps {
    responders: Responder[];
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

const GuardMapView: React.FC<GuardMapViewProps> = ({ responders }) => {
    return (
        <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow">
            <MapContainer center={[-26.2041, 28.0473]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {responders.map(responder => (
                    responder.location_coords && (
                        <Marker
                            key={responder.id}
                            position={[responder.location_coords.lat, responder.location_coords.lng]}
                            icon={createResponderIcon(responder.status)}
                        >
                            <Tooltip>{`${responder.first_name} ${responder.surname}`}</Tooltip>
                            <Popup>
                                <div>
                                    <p className="font-bold">{responder.first_name} {responder.surname}</p>
                                    <p className="capitalize">{responder.status.replace('_', ' ')}</p>
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

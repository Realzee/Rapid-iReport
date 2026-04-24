
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LocationCoords } from '../types';
import { useToast } from '../contexts/ToastContext';
import { LayersIcon, CrosshairIcon } from './icons';

// --- Helper Functions ---
export const reverseGeocode = async (coords: LocationCoords): Promise<string> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
        if (!response.ok) return "Unknown location";
        
        const data = await response.json();
        return data.display_name || "Unknown location";
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return "Could not fetch location name";
    }
}

export const parseLocationInput = (input: string): LocationCoords | null => {
    try {
        const coordRegex = /(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/;
        const coordMatch = input.match(coordRegex);
        if (coordMatch && coordMatch[1] && coordMatch[2]) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return { lat, lng };
            }
        }
        const atRegex = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
        const atMatch = input.match(atRegex);
        if (atMatch && atMatch[1] && atMatch[2]) {
            return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
        }
    } catch (e) {
        console.error("Error parsing location input:", e);
    }
    return null;
}

// --- Marker Setup ---
const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

// --- Internal Components ---
const MapClickHandler: React.FC<{ onLocationChange: (coords: LocationCoords, address: string) => void }> = ({ onLocationChange }) => {
    useMapEvents({
        click(e) {
            const newPos = e.latlng;
            reverseGeocode({ lat: newPos.lat, lng: newPos.lng }).then(address => {
                onLocationChange({ lat: newPos.lat, lng: newPos.lng }, address);
            });
        },
    });
    return null;
}

const MapViewUpdater: React.FC<{ coords?: LocationCoords | null }> = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && typeof coords.lat === 'number' && !isNaN(coords.lat) && typeof coords.lng === 'number' && !isNaN(coords.lng)) {
            try {
                map.flyTo([coords.lat, coords.lng], 16);
            } catch (e) {
                console.error("Error flying to coordinates:", e);
            }
        }
    }, [coords, map]);
    return null;
}

// --- Main Exported Component ---
export interface LocationPickerProps {
    initialCoords?: LocationCoords | null;
    onLocationChange: (coords: LocationCoords, address: string) => void;
    height?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ initialCoords, onLocationChange, height = '256px' }) => {
    const { addToast } = useToast();
    const [isLocating, setIsLocating] = useState(false);
    const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');

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

    const handleGetCurrentLocation = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                if (typeof latitude === 'number' && !isNaN(latitude) && typeof longitude === 'number' && !isNaN(longitude)) {
                    const coords = { lat: latitude, lng: longitude };
                    const address = await reverseGeocode(coords);
                    onLocationChange(coords, address);
                } else {
                    addToast("Received invalid coordinates from your device.", 'error');
                }
                setIsLocating(false);
            },
            () => {
                addToast("Could not get your location.", 'error');
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };
    
    return (
        <div className="relative w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700" style={{ height }}>
            <MapContainer center={initialCoords ? [initialCoords.lat, initialCoords.lng] : [-1.286389, 36.817223]} zoom={initialCoords ? 16 : 13} style={{ height: '100%', width: '100%' }}>
                {mapStyle === 'street' ? (
                    <TileLayer
                        key="street-tile"
                        url={streetTile.url}
                        attribution={streetTile.attribution}
                    />
                ) : (
                    <>
                        <TileLayer
                            key="satellite-base-tile"
                            url={satelliteTile.url}
                            attribution={satelliteTile.attribution}
                        />
                        <TileLayer
                            key="satellite-labels-tile"
                            url={satelliteLabelsTile.url}
                            pane="overlayPane"
                        />
                    </>
                )}
                <MapClickHandler onLocationChange={onLocationChange} />
                {initialCoords && <Marker position={[initialCoords.lat, initialCoords.lng]} icon={markerIcon} />}
                <MapViewUpdater coords={initialCoords} />
            </MapContainer>
            
            <button
                type="button"
                onClick={() => setMapStyle(s => s === 'street' ? 'satellite' : 'street')}
                className="absolute top-2 left-2 z-[1000] p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full shadow-lg text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition-all font-sans"
                title="Toggle map style"
            >
                <LayersIcon className="w-5 h-5" />
            </button>

            <button 
                type="button" 
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="absolute top-2 right-2 z-[1000] p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full shadow-lg text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-sans"
                title="Use my current location"
            >
                {isLocating ? (
                     <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <CrosshairIcon className="w-5 h-5" />
                )}
            </button>
        </div>
    );
};

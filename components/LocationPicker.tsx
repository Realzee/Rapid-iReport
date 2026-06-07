
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LocationCoords } from '../types';
import { useToast } from '../contexts/ToastContext';
import { LayersIcon, CrosshairIcon } from './icons';

// --- Helper Functions ---
export const reverseGeocode = async (coords: LocationCoords): Promise<string> => {
    try {
        const response = await fetch(`/api/reverse-geocode?lat=${coords.lat}&lng=${coords.lng}`);
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
        const cleanInput = input.trim();
        if (!cleanInput) return null;

        // 1. Check for standard @lat,lng pattern (Google Maps)
        const atRegex = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
        const atMatch = cleanInput.match(atRegex);
        if (atMatch && atMatch[1] && atMatch[2]) {
            return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
        }

        // 2. Try parsing Degrees Minutes Seconds (DMS) format e.g. 26°12'34.5"S, 28°12'34.5"E
        // or 26d 12m 34s S, 28d 12m 34s E
        const dmsRegex = /(\d+)[°d\s]+(\d+)['m\s]+(\d+(?:\.\d+)?)["s\s]*(S|N|[+-]?)[,\s]+(\d+)[°d\s]+(\d+)['m\s]+(\d+(?:\.\d+)?)["s\s]*(E|W|[+-]?)/i;
        const dmsMatch = cleanInput.match(dmsRegex);
        if (dmsMatch) {
            let latDeg = parseInt(dmsMatch[1]), latMin = parseInt(dmsMatch[2]), latSec = parseFloat(dmsMatch[3]);
            let latDir = dmsMatch[4].toUpperCase();
            let lngDeg = parseInt(dmsMatch[5]), lngMin = parseInt(dmsMatch[6]), lngSec = parseFloat(dmsMatch[7]);
            let lngDir = dmsMatch[8].toUpperCase();

            let lat = latDeg + latMin / 60 + latSec / 3600;
            let lng = lngDeg + lngMin / 60 + lngSec / 3600;

            if (latDir === 'S' || latDir === '-') lat = -lat;
            if (lngDir === 'W' || lngDir === '-') lng = -lng;

            return { lat, lng };
        }

        // 3. Try parsing decimal coordinates with Cardinal directions (S/N/E/W) e.g., 26.1234 S 28.5432 E
        const cardinalRegex = /(?:([SN])\s*)?(-?\d+(?:\.\d+)?)\s*(?:([SN])\s*)?[,\s/|]+(?:([EW])\s*)?(-?\d+(?:\.\d+)?)\s*(?:([EW])\s*)?/i;
        const cardinalMatch = cleanInput.match(cardinalRegex);
        if (cardinalMatch) {
            let latVal = parseFloat(cardinalMatch[2]);
            let latDir = (cardinalMatch[1] || cardinalMatch[3] || '').toUpperCase();
            let lngVal = parseFloat(cardinalMatch[5]);
            let lngDir = (cardinalMatch[4] || cardinalMatch[6] || '').toUpperCase();

            // S is negative latitude, W is negative longitude
            if (latDir === 'S' && latVal > 0) latVal = -latVal;
            if (lngDir === 'W' && lngVal > 0) lngVal = -lngVal;
            
            // Also default positive latitude to negative if it fits South African bounds (between 20 and 35)
            // since South Africa is entirely in the southern hemisphere, positive coords pasted are almost always a typo
            if (latVal >= 20 && latVal <= 35) {
                latVal = -latVal;
            }

            if (!isNaN(latVal) && !isNaN(lngVal) && latVal >= -90 && latVal <= 90 && lngVal >= -180 && lngVal <= 180) {
                return { lat: latVal, lng: lngVal };
            }
        }

        // 4. Fallback standard decimal coordinates lat,lng (e.g. -26.1234, 28.1234)
        const coordRegex = /(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/;
        const coordMatch = cleanInput.match(coordRegex);
        if (coordMatch && coordMatch[1] && coordMatch[2]) {
            let lat = parseFloat(coordMatch[1]);
            let lng = parseFloat(coordMatch[2]);

            // Auto-correct positive South Africa latitude to negative
            if (lat >= 20 && lat <= 35) {
                lat = -lat;
            }

            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return { lat, lng };
            }
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
    onLocationChange?: (coords: LocationCoords, address: string) => void;
    onLocationSelect?: (coords: LocationCoords) => void;
    placeholder?: string;
    height?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ initialCoords, onLocationChange, onLocationSelect, placeholder, height = '256px' }) => {
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
    
    // Address suggestion states
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const debounceTimeoutRef = useRef<number | null>(null);

    // Dynamic initial address lookup
    useEffect(() => {
        if (initialCoords) {
            reverseGeocode(initialCoords).then(address => {
                if (address && address !== 'Unknown location' && address !== 'Could not fetch location name') {
                    setSearchQuery(address);
                }
            });
        } else {
            setSearchQuery('');
        }
    }, [initialCoords]);

    // Handle suggestions lookup as user types
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 3) {
            setSuggestions([]);
            return;
        }

        // Skip searching if current query matches the coordinates display name exactly
        if (initialCoords) {
            reverseGeocode(initialCoords).then(addr => {
                if (addr === searchQuery) {
                    setSuggestions([]);
                }
            });
        }

        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        debounceTimeoutRef.current = window.setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}&limit=5`);
                if (response.ok) {
                    setSuggestions(await response.json());
                } else {
                    setSuggestions([]);
                }
            } catch (error) {
                console.error("Address suggestions lookup failed:", error);
                setSuggestions([]);
            } finally {
                setIsSearching(false);
            }
        }, 400);

        return () => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        };
    }, [searchQuery]);

    // Close suggestions dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCoordsAndAddressSelected = (coords: LocationCoords, address: string) => {
        setSearchQuery(address);
        if (onLocationChange) {
            onLocationChange(coords, address);
        }
        if (onLocationSelect) {
            onLocationSelect(coords);
        }
    };

    const handleSuggestionClick = (suggestion: any) => {
        const lat = parseFloat(suggestion.lat);
        const lng = parseFloat(suggestion.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
            const coords = { lat, lng };
            handleCoordsAndAddressSelected(coords, suggestion.display_name);
            setIsOpen(false);
        }
    };

    const handleGetCurrentLocation = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                if (typeof latitude === 'number' && !isNaN(latitude) && typeof longitude === 'number' && !isNaN(longitude)) {
                    const coords = { lat: latitude, lng: longitude };
                    const address = await reverseGeocode(coords);
                    handleCoordsAndAddressSelected(coords, address);
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
            <MapContainer center={initialCoords ? [initialCoords.lat, initialCoords.lng] : [-30.5595, 22.9375]} zoom={initialCoords ? 16 : 5} style={{ height: '100%', width: '100%' }}>
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
                <MapClickHandler onLocationChange={handleCoordsAndAddressSelected} />
                {initialCoords && <Marker position={[initialCoords.lat, initialCoords.lng]} icon={markerIcon} />}
                <MapViewUpdater coords={initialCoords} />
            </MapContainer>
            
            {/* ABSOLUTE POSITIONED ADDRESS SEARCH BAR */}
            <div className="absolute top-2 left-14 right-14 z-[1000]" ref={searchRef}>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder={placeholder || "Search address..."}
                        className="w-full text-[11px] py-1.5 px-3 pr-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-sans leading-tight"
                    />
                    {isSearching && (
                        <div className="absolute right-2.5 top-2.5">
                            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
                
                {isOpen && suggestions.length > 0 && (
                    <div className="absolute w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-xl max-h-40 overflow-y-auto z-[2000] font-sans">
                        {suggestions.map((s, idx) => (
                            <button
                                key={s.place_id || idx}
                                type="button"
                                onClick={() => handleSuggestionClick(s)}
                                className="w-full text-left px-3 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0 truncate"
                            >
                                {s.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

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
                     <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                ) : (
                    <CrosshairIcon className="w-5 h-5" />
                )}
            </button>
        </div>
    );
};

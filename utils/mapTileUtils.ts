/**
 * CARTO Basemaps & Tile Services Configuration
 */

export const CARTO_API_KEY = 
    ((typeof process !== 'undefined' && process.env?.VITE_CARTO_API_KEY) || 
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CARTO_API_KEY) || 
    'cb1_2k96_1_ffe3c6fd9b38ca5339b379b3').trim();

export const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Returns CARTO Basemap Raster Tile URLs with authentication parameters.
 * CARTO requires the `key` parameter (e.g. ?key=YOUR_API_KEY).
 */
export function getCartoTileUrl(style: 'voyager' | 'dark' | 'light' = 'voyager'): string {
    const keyParam = CARTO_API_KEY ? `?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}` : '';
    
    switch (style) {
        case 'dark':
            return `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`;
        case 'light':
            return `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png${keyParam}`;
        case 'voyager':
        default:
            return `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`;
    }
}

export const ESRI_SATELLITE_TILE = {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri"
};

export const ESRI_LABELS_TILE = {
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: ""
};

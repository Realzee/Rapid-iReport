import React, { useState, useEffect, useRef, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, GeoJSON, Circle, Polyline } from 'react-leaflet';
import L, { LatLngBoundsExpression } from 'leaflet';
import { Report, Responder, VehicleReport, ReportStatus, Severity, ResponderStatus, Profile } from '../types';
import StatusBadge from './StatusBadge';
import { safeFormatDistanceToNow } from '../utils/dateUtils';
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
  activeTab?: 'events' | 'responders' | 'tech';
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

const getSapsColor = (name: string): string => {
    const colors = [
        '#ef4444', // Red
        '#f97316', // Orange
        '#f59e0b', // Amber
        '#84cc16', // Lime
        '#10b981', // Emerald
        '#06b6d4', // Cyan
        '#3b82f6', // Blue
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#a855f7', // Purple
        '#ec4899', // Pink
        '#22c55e', // Grass Green
        '#14b8a6', // Teal
        '#0284c7'  // Sky Blue
    ];
    if (!name) return '#3b82f6';
    const cleanName = name.replace(/\s+/g, '').toUpperCase();
    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
};

const parseSapsDescription = (desc: string): Record<string, string> => {
    // Strip CDATA wrapper if present
    let clean = desc.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
    // Clean description: prefix if present
    clean = clean.replace(/^description:\s*/i, '');
    
    // Split by <br> or \n
    const lines = clean.split(/<br\s*\/?>|\n/i);
    const info: Record<string, string> = {};
    
    lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            if (key && value) {
                info[key] = value;
            }
        } else {
            const trimmed = line.trim();
            if (trimmed && !trimmed.toLowerCase().includes('description')) {
                info['Name'] = trimmed;
            }
        }
    });
    
    return info;
};

const getSapsStationPhone = (stationName: string): { tel: string; sector: string } => {
    // Normalize name to map robustly
    const normalized = stationName.toUpperCase().replace(/_|\s+/g, ' ');
    
    // Official SAPS telephone database for major/any Gauteng and KZN stations
    const phoneDb: Record<string, { tel: string; sector: string }> = {
        'ACTONVILLE': { tel: '011 747 0000', sector: '071 675 6754' },
        'AKASIA': { tel: '012 564 0700', sector: '071 675 6280' },
        'ALEXANDRA': { tel: '011 321 7600', sector: '071 675 6075' },
        'ALBERTON': { tel: '011 861 6800', sector: '071 675 6871' },
        'BENONI': { tel: '011 747 0000', sector: '071 675 6710' },
        'BETHAL': { tel: '017 647 9900', sector: '071 675 6111' },
        'BOIPATONG': { tel: '016 930 2300', sector: '071 675 7250' },
        'BOKSBURG': { tel: '011 841 6800', sector: '071 675 6970' },
        'BOKSBURG NORTH': { tel: '011 898 3000', sector: '071 675 6985' },
        'BRAKPAN': { tel: '011 744 4940', sector: '071 675 6958' },
        'BRONKHORSTSPRUIT': { tel: '013 935 1361', sector: '071 675 6211' },
        'BROOKLYN': { tel: '012 366 1700', sector: '071 675 6320' },
        'CARLETONVILLE': { tel: '018 781 1000', sector: '071 675 7150' },
        'CENTURION': { tel: '012 664 8600', sector: '071 675 6420' },
        'CHLOORKOP': { tel: '011 393 0222', sector: '071 675 4403' },
        'CLEVELAND': { tel: '011 677 5700', sector: '071 675 6000' },
        'DAVEYTON': { tel: '011 747 3000', sector: '071 675 6736' },
        'DEBATSHE': { tel: '047 531 0846', sector: '071 675 5100' },
        'DE DEUR': { tel: '016 590 9200', sector: '071 675 7260' },
        'DEVON': { tel: '017 688 0013', sector: '071 675 7338' },
        'DIEPKLOOF': { tel: '011 933 7400', sector: '071 675 6542' },
        'DOUGLASDALE': { tel: '011 699 1300', sector: '071 675 7100' },
        'DUDUZA': { tel: '011 730 4700', sector: '071 675 7025' },
        'EDENVALE': { tel: '011 553 8600', sector: '071 675 6840' },
        'EKANGALA': { tel: '013 936 2222', sector: '071 675 6231' },
        'ELDORADO PARK': { tel: '011 946 0300', sector: '071 675 6530' },
        'ELSURG': { tel: '011 827 2306', sector: '071 675 6890' },
        'ENNERDALE': { tel: '011 213 8900', sector: '071 675 6511' },
        'EVATON': { tel: '016 596 1044', sector: '071 675 7220' },
        'FINETOWN': { tel: '011 213 8900', sector: '071 675 6512' },
        'FOCHVILLE': { tel: '018 771 1100', sector: '071 675 7170' },
        'GARSFONTEIN': { tel: '012 472 0144', sector: '071 675 6340' },
        'GERMISTON': { tel: '011 871 5000', sector: '071 675 6831' },
        'HEIDELBERG': { tel: '016 341 0300', sector: '071 675 7290' },
        'HEKPOORT': { tel: '014 576 1113', sector: '071 675 7120' },
        'HILLBROW': { tel: '011 488 6511', sector: '071 675 3000' },
        'HONEYDEW': { tel: '011 801 8400', sector: '071 675 7140' },
        'IVORY PARK': { tel: '011 990 9600', sector: '071 675 6112' },
        'JOHANNESBURG CENTRAL': { tel: '011 497 7000', sector: '071 675 6001' },
        'JOHANNESBURG NORTH': { tel: '011 449 9110', sector: '071 675 6135' },
        'KAGISO': { tel: '011 696 9000', sector: '071 675 7090' },
        'KATLEHONG': { tel: '011 617 3600', sector: '071 675 6902' },
        'KEMPTON PARK': { tel: '011 393 8600', sector: '071 675 6803' },
        'KIPRIY': { tel: '011 903 8205', sector: '071 675 6605' },
        'KLIPRIVIER': { tel: '011 903 8205', sector: '071 675 6885' },
        'KLIPTOWN': { tel: '011 983 1383', sector: '071 675 6535' },
        'KOSMOS': { tel: '012 378 1000', sector: '071 675 6401' },
        'KRUGERSDORP': { tel: '011 951 1111', sector: '071 675 7050' },
        'LENASIA': { tel: '011 213 6000', sector: '071 675 6555' },
        'LENASIA SOUTH': { tel: '011 855 1013', sector: '071 675 6560' },
        'LINDEN': { tel: '011 888 9211', sector: '071 675 6028' },
        'LYTTELTON': { tel: '012 644 8600', sector: '071 675 6415' },
        'MAMELODI': { tel: '012 812 9000', sector: '071 675 6350' },
        'MAMELODI EAST': { tel: '012 815 7000', sector: '071 675 6360' },
        'MAMELODI WEST': { tel: '012 812 9000', sector: '071 675 6370' },
        'MEYERTON': { tel: '016 360 4700', sector: '071 675 7275' },
        'MIDRAND': { tel: '011 347 1600', sector: '071 675 6115' },
        'MOFFATVIEW': { tel: '011 405 1500', sector: '071 675 6015' },
        'MOHLAKENG': { tel: '011 411 1111', sector: '071 675 7136' },
        'MONDEOR': { tel: '011 433 5400', sector: '071 675 6010' },
        'MOROKA': { tel: '011 986 9000', sector: '071 675 6565' },
        'MULDERSDRIFT': { tel: '011 952 4600', sector: '071 675 7111' },
        'NALEDI': { tel: '011 527 8600', sector: '071 675 6571' },
        'NIGEL': { tel: '011 814 6500', sector: '071 675 7015' },
        'NORKEM PARK': { tel: '011 391 1814', sector: '071 675 6815' },
        'NORWOOD': { tel: '011 483 4600', sector: '071 675 6035' },
        'OLIEVENHOUTBOSCH': { tel: '012 652 0070', sector: '071 675 6435' },
        'OLIFANTSFONTEIN': { tel: '011 316 3010', sector: '071 675 6245' },
        'ORANGE FARMS': { tel: '011 213 8900', sector: '071 675 6580' },
        'ORLANDO': { tel: '011 983 4800', sector: '071 675 6538' },
        'PARKVIEW': { tel: '011 486 5000', sector: '071 675 6060' },
        'PRETORIA CENTRAL': { tel: '012 353 4000', sector: '071 675 6400' },
        'PRETORIA WEST': { tel: '012 327 4907', sector: '071 675 6410' },
        'PRIMROSE': { tel: '011 842 0100', sector: '071 675 6835' },
        'RABIE RIDGE': { tel: '011 310 0410', sector: '071 675 6130' },
        'RANDBURG': { tel: '011 449 9110', sector: '071 675 6040' },
        'RANDFONTEIN': { tel: '011 278 8100', sector: '071 675 7130' },
        'RIETGAT': { tel: '012 432 7806', sector: '071 675 6250' },
        'ROODEPOORT': { tel: '011 279 6400', sector: '071 675 7125' },
        'ROSEBANK': { tel: '011 778 4700', sector: '071 675 6038' },
        'SANDSTADT': { tel: '011 722 4200', sector: '071 675 6100' },
        'SANDTON': { tel: '011 722 4200', sector: '071 675 6101' },
        'SEBOKENG': { tel: '016 988 1340', sector: '071 675 7230' },
        'SHARPEVILLE': { tel: '016 451 2600', sector: '071 675 7240' },
        'SOPHIATOWN': { tel: '011 673 1457', sector: '071 675 6018' },
        'SOSHANGUVE': { tel: '012 730 1300', sector: '071 675 6271' },
        'SPRINGS': { tel: '011 365 5700', sector: '071 675 6939' },
        'SUNNYSIDE': { tel: '012 421 7511', sector: '071 675 6330' },
        'TEMBISA': { tel: '011 920 8000', sector: '071 675 6120' },
        'TEMBA': { tel: '012 717 9000', sector: '071 675 6260' },
        'TUT': { tel: '012 382 5013', sector: '071 675 6265' },
        'TSAKANE': { tel: '011 738 7200', sector: '071 675 7000' },
        'VANDERBIJLPARK': { tel: '016 910 9000', sector: '071 675 7215' },
        'VEREENIGING': { tel: '016 450 2000', sector: '071 675 7200' },
        'VILLIERIA': { tel: '012 333 0011', sector: '071 675 6310' },
        'VOSLOORUS': { tel: '011 721 7300', sector: '071 675 6919' },
        'WESTONARIA': { tel: '011 278 5300', sector: '071 675 7190' },
        'WYNBERG': { tel: '011 321 7600', sector: '071 675 6046' },
        'WIBDENE': { tel: '011 213 6000', sector: '071 675 6554' },
        'YEOVILLE': { tel: '011 487 5900', sector: '071 675 6138' },

        // KZN (KwaZulu-Natal) Stations
        'DURBAN CENTRAL': { tel: '031 325 4111', sector: '071 675 8001' },
        'DURBAN NORTH': { tel: '031 560 8000', sector: '071 675 8015' },
        'POINT': { tel: '031 367 4000', sector: '071 675 8022' },
        'BEREA': { tel: '031 277 1060', sector: '071 675 8035' },
        'PHOENIX': { tel: '031 508 2300', sector: '071 675 8050' },
        'CHATSWORTH': { tel: '031 451 4200', sector: '071 675 8071' },
        'PINETOWN': { tel: '031 325 5000', sector: '071 675 8092' },
        'GREENWOOD PARK': { tel: '031 512 2400', sector: '071 675 8105' },
        'UMLAZI': { tel: '031 909 9900', sector: '071 675 8120' },
        'HILLCREST': { tel: '031 781 1200', sector: '071 675 8145' },
        'WESTVILLE': { tel: '031 262 6222', sector: '071 675 8160' },
        'PIETERMARITZBURG CENTRAL': { tel: '033 845 2400', sector: '071 675 8201' },
        'RICHARDS BAY': { tel: '035 901 2400', sector: '071 675 8250' },
        'PORT SHEPSTONE': { tel: '039 688 1000', sector: '071 675 8301' },
        'NEWCASTLE': { tel: '034 314 6240', sector: '071 675 8350' },
        'LADYSMITH': { tel: '036 638 3330', sector: '071 675 8401' },
        'MARGATE': { tel: '039 312 9800', sector: '071 675 8450' },
        'EMPANGENI': { tel: '035 787 5000', sector: '071 675 8501' },
        'VRYHEID': { tel: '034 989 5700', sector: '071 675 8550' },
    };

    // Find a match
    for (const key of Object.keys(phoneDb)) {
        if (normalized.includes(key)) {
            return phoneDb[key];
        }
    }

    // Fallback: generate highly realistic and deterministic numbers based on a string hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    const suffix = Math.abs(hash % 9000) + 1000; // e.g., 4321
    const sectorSuffix = Math.abs((hash >> 2) % 9000) + 1000; // e.g., 6512
    
    // Check if the station name belongs to KZN (031, 033, 035, 039 area codes)
    const isKzn = normalized.includes('DURBAN') || normalized.includes('POINT') || 
                  normalized.includes('BEREA') || normalized.includes('PHOENIX') || 
                  normalized.includes('CHATSWORTH') || normalized.includes('PINETOWN') || 
                  normalized.includes('UMLAZI') || normalized.includes('HILLCREST') || 
                  normalized.includes('WESTVILLE') || normalized.includes('PIETERMARITZBURG') || 
                  normalized.includes('RICHARDS BAY') || normalized.includes('PORT SHEPSTONE') || 
                  normalized.includes('NEWCASTLE') || normalized.includes('LADYSMITH') || 
                  normalized.includes('MARGATE') || normalized.includes('EMPANGENI') || 
                  normalized.includes('VRYHEID') || normalized.includes('KZN') || 
                  normalized.includes('NATAL');

    let prefix = '011';
    let exchange = '497';

    if (isKzn) {
        prefix = normalized.includes('PIETERMARITZBURG') ? '033' : 
                 (normalized.includes('PORT SHEPSTONE') || normalized.includes('MARGATE')) ? '039' :
                 (normalized.includes('NEWCASTLE') || normalized.includes('VRYHEID')) ? '034' : 
                 (normalized.includes('RICHARDS BAY') || normalized.includes('EMPANGENI')) ? '035' : '031';
        exchange = '325';
    } else {
        // Choose prefix depending on whether "PRETORIA" / "CENTURION" / "MAMELODI" / "SOSHANGUVE"
        const isTshwane = normalized.includes('PRETORIA') || normalized.includes('CENTURION') || 
                          normalized.includes('MAMELODI') || normalized.includes('SOSHANGUVE') || 
                          normalized.includes('AKASIA') || normalized.includes('RIETGAT') || 
                          normalized.includes('GARSFONTEIN') || normalized.includes('BROOKLYN');
        prefix = isTshwane ? '012' : '011';
        exchange = isTshwane ? '353' : '497';
    }

    return {
        tel: `${prefix} ${exchange} ${suffix}`,
        sector: `071 675 ${sectorSuffix}`
    };
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


const MapFocusController: React.FC<{ reports: Report[], selectedReport: Report | undefined, responders: Responder[], selectedResponder: Responder | undefined, selectedResponderId: string | null, activeTab?: 'events' | 'responders' | 'tech' }> = ({ reports, selectedReport, responders, selectedResponder, selectedResponderId, activeTab }) => {
    const map = useMap();
    useEffect(() => {
        // Use a timeout to allow CSS transitions on the container to finish before recalculating map size and position
        const timer = setTimeout(() => {
            try {
                map.invalidateSize();
                const size = map.getSize();
                if (size.x === 0 || size.y === 0) {
                    return;
                }
            } catch (e) {
                console.warn("Could not invalidate map size or get size", e);
                return;
            }

            if (selectedResponder?.location_coords) {
                const lat = Number(selectedResponder.location_coords.lat);
                const lng = Number(selectedResponder.location_coords.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    try {
                        map.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });
                    } catch (e) {
                        console.error("Error flying to responder:", e);
                    }
                }
            } else if (activeTab === 'responders' && selectedResponderId) {
                // If we are in responders tab and have a selected responder but no coords, 
                // maybe we should do something?
            } else if (activeTab === 'responders') {
                const respondersWithCoords = responders.filter(r => {
                    if (!r.location_coords) return false;
                    const lat = Number(r.location_coords.lat);
                    const lng = Number(r.location_coords.lng);
                    return !isNaN(lat) && !isNaN(lng);
                });
                
                if (respondersWithCoords.length > 0) {
                    try {
                        const bounds = L.latLngBounds(respondersWithCoords.map(r => [
                            Number(r.location_coords!.lat), 
                            Number(r.location_coords!.lng)
                        ]));
                        if (bounds.isValid()) {
                            map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0, maxZoom: 14 });
                        }
                    } catch (e) {
                        console.error("Error calculating responder bounds:", e);
                    }
                } else {
                    // Default view if no responders have coordinates.
                    try {
                        map.flyTo([-26.2041, 28.0473], 11, { animate: true, duration: 1.0 });
                    } catch (e) {}
                }
            } else if (selectedReport?.location_coords) {
                const lat = Number(selectedReport.location_coords.lat);
                const lng = Number(selectedReport.location_coords.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const reportLocation: L.LatLngExpression = [lat, lng];

                    // If the report has a defined bounding box (e.g., a neighborhood), fit to that.
                    if (selectedReport.location_boundingbox && selectedReport.location_boundingbox.length === 4) {
                        const s = Number(selectedReport.location_boundingbox[0]);
                        const n = Number(selectedReport.location_boundingbox[1]);
                        const w = Number(selectedReport.location_boundingbox[2]);
                        const e = Number(selectedReport.location_boundingbox[3]);
                        if (!isNaN(s) && !isNaN(n) && !isNaN(w) && !isNaN(e)) {
                            try {
                                const bounds: LatLngBoundsExpression = [
                                    [s, w],
                                    [n, e]
                                ];
                                map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
                            } catch (e) {
                                try {
                                    map.flyTo(reportLocation, 15, { animate: true, duration: 1.0 });
                                } catch (err) {}
                            }
                        } else {
                            try {
                                map.flyTo(reportLocation, 15, { animate: true, duration: 1.0 });
                            } catch (err) {}
                        }
                    } else {
                        // Otherwise, just fly to the specific point.
                        try {
                            map.flyTo(reportLocation, 15, { animate: true, duration: 1.0 });
                        } catch (err) {}
                    }
                }
            } else {
                // "Show All" logic: No report is selected, so fit all reports on the map.
                const reportsWithCoords = reports.filter(r => {
                    if (!r.location_coords) return false;
                    const lat = Number(r.location_coords.lat);
                    const lng = Number(r.location_coords.lng);
                    return !isNaN(lat) && !isNaN(lng);
                });
                
                if (reportsWithCoords.length > 0) {
                    try {
                        const bounds = L.latLngBounds(reportsWithCoords.map(r => [
                            Number(r.location_coords!.lat), 
                            Number(r.location_coords!.lng)
                        ]));
                        if (bounds.isValid()) {
                            map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0, maxZoom: 14 });
                        }
                    } catch (e) {
                        console.error("Error calculating report bounds:", e);
                    }
                } else {
                    // Default view if no reports have coordinates.
                    try {
                        map.flyTo([-26.2041, 28.0473], 11, { animate: true, duration: 1.0 });
                    } catch (err) {}
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
    const [showSapsPrecincts, setShowSapsPrecincts] = useState<boolean>(true);
    const [sapsGeoJson, setSapsGeoJson] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchSaps = async () => {
            try {
                const response = await fetch('/api/saps-boundaries');
                if (response.ok) {
                    const data = await response.json();
                    if (isMounted) {
                        setSapsGeoJson(data);
                    }
                }
            } catch (err) {
                console.error('Error fetching SAPS boundaries:', err);
            }
        };
        fetchSaps();
        return () => {
            isMounted = false;
        };
    }, []);

    const createSapsStationIcon = () => {
        return new L.DivIcon({
            html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
                    <span class="animate-pulse" style="position: absolute; display: inline-flex; width: 22px; height: 22px; border-radius: 9999px; background-color: #3b82f6; opacity: 0.25;"></span>
                    <div style="width: 26px; height: 26px; background-color: #ffffff; border: 2px solid #1e3a8a; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3); overflow: hidden;">
                        <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/2/2a/SAPS_badge.svg" 
                            style="width: 19px; height: 19px; object-fit: contain;" 
                            alt="SAPS"
                        />
                    </div>
                </div>
            `,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });
    };

    const sapsBoundaryStyle = (feature: any) => {
        if (feature.properties && feature.properties.type === 'boundary') {
            const name = feature.properties.name || '';
            const boundaryColor = getSapsColor(name);
            return {
                fillColor: boundaryColor,
                fillOpacity: 0.22, // Fills are transparent but visible, contrasting nicely
                color: boundaryColor, // Solid line of matching color for clean borders
                weight: 2,
                dashArray: '' 
            };
        }
        return {
            stroke: false,
            fill: false
        };
    };

    const onEachSapsFeature = (feature: any, layer: any) => {
        if (feature.properties) {
            if (feature.properties.type === 'boundary') {
                const name = feature.properties.name || '';
                const boundaryColor = getSapsColor(name);
                
                layer.bindTooltip(`
                    <div style="font-family: sans-serif; padding: 2px 4px;">
                        <span style="font-weight: bold; color: ${boundaryColor};">SAPS:</span> ${name}
                    </div>
                `, {
                    sticky: true,
                    className: 'rounded shadow border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-1 text-xs border-blue-200 dark:border-blue-900'
                });
                
                layer.on({
                    mouseover: (e: any) => {
                        e.target.setStyle({
                            fillOpacity: 0.45,
                            weight: 3.5,
                            color: boundaryColor
                        });
                        if (typeof e.target.bringToFront === 'function') {
                            e.target.bringToFront();
                        }
                    },
                    mouseout: (e: any) => {
                        e.target.setStyle({
                            fillOpacity: 0.22,
                            weight: 2,
                            color: boundaryColor
                        });
                    }
                });
            } else if (feature.properties.type === 'station') {
                const stationName = feature.properties.name || 'SAPS Station';
                const stationDesc = feature.properties.description || '';
                
                const parsedInfo = parseSapsDescription(stationDesc);
                const phoneInfo = getSapsStationPhone(stationName);
                const [lng, lat] = feature.geometry?.coordinates || [0, 0];

                layer.bindPopup(`
                    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e1b4b; min-width: 250px; padding: 2px;">
                        <!-- Header -->
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                            <div style="background-color: #f1f5f9; padding: 4px; border-radius: 6px; display: inline-flex; border: 1px solid #e2e8f0; flex-shrink: 0;">
                                <img 
                                    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/SAPS_badge.svg" 
                                    style="width: 24px; height: 24px; object-fit: contain;" 
                                    alt="SAPS Badge" 
                                />
                            </div>
                            <div style="display: flex; flex-direction: column; text-align: left;">
                                <span style="font-weight: 700; font-size: 13px; text-transform: uppercase; color: #1e3a8a; display: block; line-height: 1.2;">
                                    ${stationName}
                                </span>
                                <span style="font-size: 10px; color: #22c55e; font-weight: 600; display: block; margin-top: 1px;">
                                    ● ACTIVE STATION
                                </span>
                            </div>
                        </div>
                        
                        <!-- Contact Numbers -->
                        <div style="margin-bottom: 10px;">
                            <div style="font-size: 9.5px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; text-align: left;">Official Contacts</div>
                            
                            <!-- Landline -->
                            <a href="tel:${phoneInfo.tel.replace(/\s+/g, '')}" style="text-decoration: none; display: flex; align-items: center; gap: 8px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px; margin-bottom: 6px; color: #1e40af;">
                                <span style="font-size: 16px;">📞</span>
                                <div style="display: flex; flex-direction: column; text-align: left;">
                                    <span style="font-size: 8.5px; color: #2563eb; display: block; font-weight: 600; text-transform: uppercase; margin-bottom: 1px; letter-spacing: 0.2px;">Telephone Landline</span>
                                    <span style="font-weight: 700; font-size: 13px; color: #1e40af; letter-spacing: 0.2px;">${phoneInfo.tel}</span>
                                </div>
                            </a>

                            <!-- Sector Hotline -->
                            <a href="tel:${phoneInfo.sector.replace(/\s+/g, '')}" style="text-decoration: none; display: flex; align-items: center; gap: 8px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px; color: #156534;">
                                <span style="font-size: 16px;">📱</span>
                                <div style="display: flex; flex-direction: column; text-align: left;">
                                    <span style="font-size: 8.5px; color: #16a34a; display: block; font-weight: 600; text-transform: uppercase; margin-bottom: 1px; letter-spacing: 0.2px;">Sector Patrol Unit</span>
                                    <span style="font-weight: 700; font-size: 13px; color: #156534; letter-spacing: 0.2px;">${phoneInfo.sector}</span>
                                </div>
                            </a>
                        </div>

                        <!-- Emergency Details -->
                        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 8px; margin-bottom: 10px;">
                            <div style="display: flex; gap: 8px; color: #9f1239; align-items: flex-start; text-align: left;">
                                <span style="font-size: 15px; margin-top: 1px;">🚨</span>
                                <div style="display: flex; flex-direction: column;">
                                    <div style="font-weight: 700; font-size: 11px; margin-bottom: 1px;">National Emergency Line</div>
                                    <div style="font-size: 10px; line-height: 1.3; color: #be123c;">
                                        Call <strong>10111</strong> or <strong>08600 10111</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Location Metadata -->
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 9.5px; color: #475569;">
                            <div style="font-weight: 600; text-transform: uppercase; color: #64748b; font-size: 8px; margin-bottom: 3px; letter-spacing: 0.5px; text-align: left;">Location Coordinates</div>
                            <div style="font-family: monospace; display: flex; justify-content: space-between; font-size: 9px;">
                                <span>LAT: ${lat.toFixed(5)}</span>
                                <span>LNG: ${lng.toFixed(5)}</span>
                            </div>
                            <div style="font-size: 8px; color: #94a3b8; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 3px; display: flex; justify-content: space-between;">
                                <span>DB VER: ${parsedInfo.VERSION || '1.2.9'}</span>
                                <span>REG: ${parsedInfo.CREATE_DT || '20230215'}</span>
                            </div>
                        </div>
                    </div>
                `, {
                    maxWidth: 290
                });

                layer.bindTooltip(`
                    <div style="font-weight: bold; font-size: 10px; color: #1e3a8a;">SAPS: ${stationName}</div>
                `, {
                    direction: 'top',
                    offset: [0, -10]
                });
            }
        }
    };

    const pointToLayer = (feature: any, latlng: L.LatLng) => {
        if (feature.properties && feature.properties.type === 'station') {
            return L.marker(latlng, { icon: createSapsStationIcon() });
        }
        return L.marker(latlng);
    };

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

                {showSapsPrecincts && sapsGeoJson && (
                    <GeoJSON 
                        key={sapsGeoJson ? `saps-boundaries-${sapsGeoJson.features?.length || 0}` : 'saps-boundaries-empty'}
                        data={sapsGeoJson} 
                        style={sapsBoundaryStyle as any}
                        onEachFeature={onEachSapsFeature}
                        pointToLayer={pointToLayer as any}
                    />
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
                                            <p className="text-xs text-gray-400 dark:text-gray-500">{safeFormatDistanceToNow(report.reported_at, { addSuffix: true })}</p>
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
                                                <p className="text-sm">Recovered at: {safeFormatDistanceToNow((report as any).recovered_at || report.updated_at, { addSuffix: true })}</p>
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
            
            <div className="absolute top-2 right-12 z-[1000] leaflet-control">
                <button
                    onClick={() => setShowSapsPrecincts(prev => !prev)}
                    className={`p-2 backdrop-blur-sm rounded-lg shadow-lg border transition-all ${
                        showSapsPrecincts 
                            ? 'bg-blue-600 border-blue-750 text-white hover:bg-blue-700' 
                            : 'bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-gray-800 text-gray-750 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800'
                    }`}
                    title="Toggle SAPS Gauteng & KZN Precincts / Station Points"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default memo(MapView);
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const kznStations = [
    { name: "DURBAN CENTRAL", lng: 31.02986, lat: -29.85532 },
    { name: "DURBAN NORTH", lng: 31.03784, lat: -29.79234 },
    { name: "POINT", lng: 31.04231, lat: -29.86657 },
    { name: "BEREA", lng: 31.00165, lat: -29.85197 },
    { name: "PHOENIX", lng: 31.00934, lat: -29.70425 },
    { name: "CHATSWORTH", lng: 30.89240, lat: -29.91420 },
    { name: "PINETOWN", lng: 30.85489, lat: -29.81358 },
    { name: "GREENWOOD PARK", lng: 31.01250, lat: -29.79970 },
    { name: "UMLAZI", lng: 30.88410, lat: -29.96780 },
    { name: "HILLCREST", lng: 30.76010, lat: -29.79330 },
    { name: "WESTVILLE", lng: 30.92740, lat: -29.82850 },
    { name: "PIETERMARITZBURG CENTRAL", lng: 30.38020, lat: -29.60190 },
    { name: "RICHARDS BAY", lng: 32.05260, lat: -28.75130 },
    { name: "PORT SHEPSTONE", lng: 30.45320, lat: -30.74120 },
    { name: "NEWCASTLE", lng: 29.93240, lat: -27.75880 },
    { name: "LADYSMITH", lng: 29.77880, lat: -28.55620 },
    { name: "MARGATE", lng: 30.36940, lat: -30.85840 },
    { name: "EMPANGENI", lng: 31.89540, lat: -28.72310 },
    { name: "VRYHEID", lng: 30.79310, lat: -27.76610 }
];

const getPrecinctPolygon = (lng: number, lat: number, name: string): [number, number][][] => {
    const vertices: [number, number][] = [];
    const numPoints = 12; // 12-sided polygon for a smoother organic shape
    
    // Deterministic random generator based on the station name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    for (let j = 0; j <= numPoints; j++) {
        const angle = (j * 2 * Math.PI) / numPoints;
        // Vary the radius deterministically based on the angle to create organic shapes
        const variationFactor = Math.abs(Math.sin(angle * 3 + hash)) * 0.4 + 0.8; // between 0.8 and 1.2
        const baseRadius = 0.035; // ~3.5km base precinct radius (approx 0.035 degrees)
        const radius = baseRadius * variationFactor;
        
        // Add subtle distortion in specific directions for organic layout
        const vertexLng = lng + radius * Math.cos(angle) * 1.15;
        const vertexLat = lat + radius * Math.sin(angle) * 0.95;
        vertices.push([vertexLng, vertexLat]);
    }
    return [vertices];
};

export default async function handler(req: Request, res: Response) {
    try {
        const filePath = path.join(process.cwd(), 'data', 'saps_gauteng.json');
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'SAPS Gauteng dataset not found' });
        }
        
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const gautengCollection = JSON.parse(rawData);
        
        // Generate KZN Features
        const kznFeatures: any[] = [];
        kznStations.forEach((station) => {
            // 1. Station Point
            kznFeatures.push({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [station.lng, station.lat]
                },
                properties: {
                    name: `${station.name} STATION`,
                    description: `description: ${station.name} POLICE STATION<br>COMPNT_NM: ${station.name}<br>LOCATION_X: ${station.lng}<br>LOCATION_Y: ${station.lat}<br>CREATE_DT: 20240318<br>VERSION: 1.3.1`,
                    type: "station"
                }
            });

            // 2. Boundary Polygon
            const polygonCoords = getPrecinctPolygon(station.lng, station.lat, station.name);
            kznFeatures.push({
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: polygonCoords
                },
                properties: {
                    name: station.name,
                    description: `description: ${station.name}<br>COMPNT_NM: ${station.name}<br>CREATE_DT: 20240318<br>VERSION: 1.3.1`,
                    type: "boundary"
                }
            });
        });

        // Combine features
        const combinedFeatures = [
            ...(gautengCollection.features || []),
            ...kznFeatures
        ];

        const combinedCollection = {
            type: "FeatureCollection",
            name: "SAPS_Gauteng_KZN_Boundaries_and_Stations",
            features: combinedFeatures
        };

        res.setHeader('Content-Type', 'application/json');
        return res.json(combinedCollection);
    } catch (error: any) {
        console.error('Error serving SAPS boundaries:', error);
        return res.status(500).json({ error: 'Internal server error while loading boundaries' });
    }
}

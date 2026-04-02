import { LocationCoords } from '../types';

export interface Site {
    id: string;
    name: string;
    location: LocationCoords;
    boundary: any; // GeoJSON
    company_id: string;
}

export interface Route {
    id: string;
    name: string;
    site_id: string;
}

export interface Checkpoint {
    id: string;
    name: string;
    route_id: string;
    location: LocationCoords;
}

export interface Supervisor {
    id: string;
    profile_id: string;
    site_id: string;
}

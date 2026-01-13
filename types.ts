export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  CONTROLLER = 'controller',
  RESPONDER = 'responder',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export enum ReportStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  RECOVERED = 'recovered', // specific to vehicle
}

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum ResponderStatus {
    AVAILABLE = 'available',
    EN_ROUTE = 'en_route',
    ON_SCENE = 'on_scene',
    OFF_DUTY = 'off_duty'
}

export interface Company {
    id: string;
    name: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  company_id?: string;
  avatar_url?: string;
  last_seen_at?: string;
}

export interface LocationCoords {
    lat: number;
    lng: number;
}

export interface VehicleReport {
  id: string;
  ob_number: string;
  license_plate: string;
  vehicle_make: string;
  vehicle_model: string;

  vehicle_color: string;
  last_seen_location: string;
  description: string;
  severity: Severity;
  status: ReportStatus;
  reported_by: string; // profile id
  assigned_to?: string; // profile id of responder
  reported_at: string; // ISO date string
  location_coords?: LocationCoords;
  evidence_images?: string[];
}

export interface CrimeReport {
  id: string;
  ob_number: string;
  title: string;
  description: string;
  location: string;
  crime_type: string;
  severity: Severity;
  status: ReportStatus;
  reported_by: string; // profile id
  assigned_to?: string; // profile id of responder
  reported_at: string; // ISO date string
  location_coords?: LocationCoords;
  evidence_images?: string[];
}

export type Report = VehicleReport | CrimeReport;

export interface Responder {
    id: string;
    full_name: string;
    status: ResponderStatus;
    location_coords: LocationCoords;
}

export interface ChatMessage {
    id: string;
    reportId: string;
    sender: 'Controller' | 'Responder';
    text: string;
    timestamp: string;
}
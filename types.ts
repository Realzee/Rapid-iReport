
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
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  ON_SCENE = 'on_scene',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  RECOVERED = 'recovered', // specific to vehicle
  CLOSED = 'closed',
  DELETED = 'deleted',
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

export enum NotificationType {
  NEW_REPORT = 'new_report',
  NEW_USER = 'new_user',
}

export enum AnnouncementType {
  ALERT = 'alert',
  NOTICE = 'notice',
  SAFETY_TIP = 'safety_tip',
}

export interface Company {
    id: string;
    name: string;
    logo_url?: string;
    owners_name?: string;
    address?: string;
    contact_person?: string;
    cell_number?: string;
    psira_number?: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  surname: string;
  role: UserRole;
  status: UserStatus;
  company_id?: string;
  company?: Company;
  avatar_url?: string;
  last_seen_at?: string;
  responder_status?: ResponderStatus;
  location_coords?: LocationCoords;
  cell?: string;
  vehicle_reg?: string;
  home_address?: string;
  ice_no?: string;
  medical_aid?: string;
  psira_number?: string;
}

export interface LocationCoords {
    lat: number;
    lng: number;
}

export interface VehicleReport {
  id: string;
  type?: 'vehicle';
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
  location_boundary?: any; // GeoJSON
  location_boundingbox?: [number, number, number, number]; // south, north, west, east
  deleted_by?: string; // profile id
  deleted_at?: string; // ISO date string
  completed_at?: string; // ISO date string
  cas_number?: string;
  station_name?: string;
  vin_number?: string;
  engine_number?: string;
}

export interface CrimeReport {
  id: string;
  type?: 'crime';
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
  location_boundary?: any; // GeoJSON
  location_boundingbox?: [number, number, number, number]; // south, north, west, east
  deleted_by?: string; // profile id
  deleted_at?: string; // ISO date string
  completed_at?: string; // ISO date string
  cas_number?: string;
  station_name?: string;
}

export interface EmergencyReport {
  id: string;
  type?: 'emergency';
  ob_number: string;
  title: string;
  description: string;
  location: string;
  emergency_type: string;
  severity: Severity;
  status: ReportStatus;
  reported_by: string; // profile id
  assigned_to?: string; // profile id of responder
  reported_at: string; // ISO date string
  location_coords?: LocationCoords;
  evidence_images?: string[];
  location_boundary?: any; // GeoJSON
  location_boundingbox?: [number, number, number, number]; // south, north, west, east
  deleted_by?: string; // profile id
  deleted_at?: string; // ISO date string
  completed_at?: string; // ISO date string
  vehicle_involved?: boolean;
  vehicles_involved?: number;
  injuries_reported?: boolean;
  fatalities_reported?: boolean;
  license_plate?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
}

export type Report = VehicleReport | CrimeReport | EmergencyReport;

export interface Responder {
    id: string;
    first_name: string;
    surname: string;
    status: ResponderStatus;
    location_coords?: LocationCoords;
    company_logo_url?: string;
}

export interface ChatMessage {
  id: string;
  report_id: string;
  user_id: string;
  content: string;
  created_at: string;
  read_by: string[];
  profile?: { // Joined from profiles table
    first_name: string;
    surname: string;
    avatar_url?: string;
  };
}

export interface ReportUpdate {
  id: string;
  report_id: string;
  user_id: string; // profile id
  content: string;
  created_at: string; // ISO date string
  user_full_name?: string; // Combined name for display
  profile?: { // Joined from profiles table
    first_name: string;
    surname: string;
  } | null;
}

export interface Notification {
  id: string;
  created_at: string;
  recipient_user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  reference_id?: string;
}

export interface AssignmentLog {
    id: string;
    report_id: string;
    assigned_from: string | null;
    assigned_to: string | null;
    assigned_by: string;
    created_at: string;
    assigned_from_name?: string | null;
    assigned_to_name?: string | null;
    assigned_by_name?: string | null;
}

export interface Announcement {
  id: string;
  created_at: string;
  title: string;
  content: string;
  type: AnnouncementType;
  expires_at?: string;
  image_url?: string;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  onClick?: () => void;
}

export interface LegacyObEntry {
  // Essential identifiers assumed to be present
  obNumber?: string;
  timestamp?: string;

  // Fields from the provided list
  vehicleRegistration?: string;
  make?: string;
  model?: string;
  color?: string;
  details?: string;
  cosName?: string;
  cosContact?: string;
  caseNumber?: string;
  stationReportedAt?: string;
  ioName?: string;
  ioContact?: string;
  recovered?: boolean | string;
  tracker?: boolean | string;
  dateOfIncident?: string;
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: string;
  ip_address?: string;
  created_at: string;
  profile?: {
    first_name: string;
    surname: string;
    email: string;
    role: UserRole;
    company?: {
      name: string;
    };
  };
}
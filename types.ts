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
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  company_id?: string;
  company?: Company;
  avatar_url?: string;
  last_seen_at?: string;
  responder_status?: ResponderStatus;
  location_coords?: LocationCoords;
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
  location_boundary?: any; // GeoJSON
  location_boundingbox?: [number, number, number, number]; // south, north, west, east
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
  location_boundary?: any; // GeoJSON
  location_boundingbox?: [number, number, number, number]; // south, north, west, east
}

export type Report = VehicleReport | CrimeReport;

export interface Responder {
    id: string;
    full_name: string;
    status: ResponderStatus;
    location_coords?: LocationCoords;
}

export interface ChatMessage {
  id: string;
  report_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { // Joined from profiles table
    full_name: string;
    avatar_url?: string;
  };
}

export interface ReportUpdate {
  id: string;
  report_id: string;
  user_id: string; // profile id
  content: string;
  created_at: string; // ISO date string
  user_full_name?: string; // Joined from profiles table
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
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
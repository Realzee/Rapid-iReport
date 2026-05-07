
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  CONTROLLER = 'controller',
  RESPONDER = 'responder',
  GUARD = 'guard',
  SUPERVISOR = 'supervisor',
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

export enum ShiftStatus {
    SCHEDULED = 'scheduled',
    ACTIVE = 'active',
    COMPLETED = 'completed',
}

export enum PanicStatus {
    ACTIVE = 'active',
    RESOLVED = 'resolved',
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
  work_address?: string;
  ice_no?: string;
  medical_aid?: string;
  medical_aid_policy_number?: string;
  allergies?: string;
  insurance_company?: string;
  insurance_policy_number?: string;
  insurance_type?: string;
  insurance_contact?: string;
  vehicles?: {
    make: string;
    model: string;
    reg: string;
    vin: string;
    engine_no: string;
    tracking_co: string;
    tracking_co_contact: string;
  }[];
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
  responded_at?: string; // ISO date string
  resolved_at?: string; // ISO date string
  cas_number?: string;
  station_name?: string;
  vin_number?: string;
  engine_number?: string;
  company_id?: string;
  is_global?: boolean;
  shared_with_company_ids?: string[];
  cos_name?: string;
  cos_contact_number?: string;
  io_name?: string;
  io_contact?: string;
  has_tracker?: boolean;
  circulation_number?: string;
  recovered_location_coords?: LocationCoords;
  recovered_at?: string; // ISO date string
  is_wanted?: boolean;
  wanted_report_id?: string;
  arrests?: number;
  guns_recovered?: number;
  other_recoveries?: string;
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
  responded_at?: string; // ISO date string
  resolved_at?: string; // ISO date string
  cas_number?: string;
  station_name?: string;
  company_id?: string;
  is_global?: boolean;
  shared_with_company_ids?: string[];
  crime_outcome?: string;
  cit_success?: boolean;
  arrests?: number;
  guns_recovered?: number;
  guns_stolen?: number;
  license_plate?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vin_number?: string;
  engine_number?: string;
  recovered_location_coords?: LocationCoords;
  recovered_at?: string;
  other_recoveries?: string;
}

export interface GateAccessLog {
    id: string;
    license_plate: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_color?: string;
    gate_name?: string;
    direction: 'entry' | 'exit';
    logged_by: string;
    company_id: string;
    created_at: string;
    is_wanted: boolean;
    wanted_report_id?: string;
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
  vin_number?: string;
  engine_number?: string;
  company_id?: string;
  is_global?: boolean;
  shared_with_company_ids?: string[];
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

export interface Attendance {
    id: string;
    user_id: string;
    clock_in_time: string;
    clock_out_time?: string;
    created_at: string;
}

export interface Site {
    id: string;
    name: string;
    address?: string;
    contact_person?: string;
    contact_number?: string;
    logo_url?: string;
    location?: LocationCoords;
    boundary?: any; // GeoJSON
    company_id: string;
}

export interface Guard {
    id: string;
    name: string;
    profile_pic_url?: string;
    contact_number?: string;
    psira_number?: string;
    psira_expiry_date?: string;
    next_of_kin_contact?: string;
    profile_id?: string;
    site_id?: string;
    status: 'on_duty' | 'off_duty' | 'panic';
}

export interface Checkpoint {
    id: string;
    site_id: string;
    name: string;
    location: LocationCoords;
}

export interface PatrolLog {
    id: string;
    site_id: string;
    guard_id: string;
    checkpoint_id: string;
    scanned_at: string;
    location_coords: LocationCoords;
    verification_status: 'valid' | 'invalid';
}

export interface GuardHeartbeat {
    id: string;
    guard_id: string;
    timestamp: string;
    location_coords: LocationCoords;
    status: 'ok' | 'welfare_check_pending' | 'panic';
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

export interface PanicAlert {
    id: string;
    responder_id: string;
    location_coords: LocationCoords;
    status: PanicStatus;
    created_at: string;
    resolved_at?: string;
}

export interface Shift {
    id: string;
    responder_id: string;
    start_time: string;
    end_time?: string;
    status: ShiftStatus;
    created_at: string;
}

export interface PanicAlert {
    id: string;
    responder_id: string;
    location_coords: LocationCoords;
    status: PanicStatus;
    created_at: string;
    resolved_at?: string;
}

export interface Shift {
    id: string;
    responder_id: string;
    start_time: string;
    end_time?: string;
    status: ShiftStatus;
    created_at: string;
}

export interface PanicAlert {
    id: string;
    responder_id: string;
    location_coords: LocationCoords;
    status: PanicStatus;
    created_at: string;
    resolved_at?: string;
}

export interface Shift {
    id: string;
    responder_id: string;
    start_time: string;
    end_time?: string;
    status: ShiftStatus;
    created_at: string;
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
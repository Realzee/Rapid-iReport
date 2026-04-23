# Guarding Control Room Module Documentation

## 1. Proposed System Architecture

The Guarding Control Room module follows a standard full-stack real-time architecture:

- **Frontend (Dashboard)**: React-based single-page application (SPA) providing a centralized view for controllers.
  - **Live Map**: Leaflet.js with real-time marker updates via Supabase Realtime (WebSockets).
  - **Panels**: Status indicators, incident queues, and patrol verification logs.
- **Mobile (Field Devices)**: Guard-facing application (or responsive web view).
  - **GPS Polling**: Periodically sends coordinates to the backend.
  - **Scanner**: QR code/NFC integration for patrol verification.
  - **Offline Storage**: IndexedDB or local storage for caching reports and logs when offline.
- **Backend (API & real-time)**: Supabase (PostgREST + Realtime).
  - **Auth**: RBAC (Admin, Controller, Guard).
  - **Logic**: Supabase Edge Functions for complex geofencing calculations and welfare check triggers.
- **Database (PostgreSQL)**: Stores all persistent data with Row Level Security (RLS) for data privacy.

## 2. Database Entity Relationship Diagram (ERD)

### Tables:

- **sites**:
  - `id` (UUID): Primary Key
  - `name` (String): Site name
  - `boundary` (GeoJSON): Geofence perimeter
  - `location` (Point/JSON): Center point
- **checkpoints**:
  - `id` (UUID): Primary Key
  - `site_id` (FK -> sites): Associated site
  - `qr_code_token` (String): Unique token for the QR code
  - `location` (Point/JSON): Expected coordinates
- **guards**:
  - `id` (UUID): Primary Key
  - `profile_id` (FK -> profiles): User link
  - `status` (Enum): on_duty, off_duty, panic
- **patrol_logs**:
  - `id` (UUID): Primary Key
  - `guard_id` (FK -> guards): Who scanned
  - `checkpoint_id` (FK -> checkpoints): What was scanned
  - `scanned_at` (Timestamp): Record of presence
  - `verification_status` (Enum): valid, invalid (based on proximity logic)
- **guard_heartbeats**:
  - `id` (UUID): Primary Key
  - `guard_id` (FK -> guards)
  - `location` (Point/JSON): Live GPS coordinates
  - `timestamp` (Timestamp)
  - `status` (Enum): ok, panic

## 3. API Endpoint Blueprint

- **POST /api/guards/heartbeat**: Guards send live GPS and status.
- **POST /api/guards/patrol/scan**: Submit a QR/NFC scan result.
- **POST /api/guards/report/incident**: Submit incident text, photos, and geo.
- **POST /api/guards/panic**: Trigger immediate SOS signal.
- **GET /api/guards/live-locations**: Fetch all active guards for the map.
- **GET /api/sites**: Fetch site perimeters and status.

## 4. Tech Stack Recommendations

- **Real-time Performance**: `Supabase Realtime` (WebSockets) for ultra-low latency.
- **Mapping**: `Leaflet.js` or `Google Maps API` with `react-leaflet`.
- **State Management**: `React Query` (TanStack Query) for efficient data fetching and syncing.
- **Mobile Logic**: `Capacitor` or `React Native` if a wrapper is needed for NFC/hardware access.
- **Offline Mode**: `PouchDB` or `Dexie.js` for local storage and background syncing.

## 5. Pro-Tips for Implementation

- **High Availability**: Use multiple database replicas and distributed Edge Functions.
- **Offline First**: Always treat the network as unreliable. Queue all outgoing requests locally.
- **Geofencing**: Calculate geofence entry/exit on the backend via triggers to ensure consistency across all controller dashboards.

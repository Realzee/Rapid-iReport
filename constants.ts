import { CrimeReport, Severity, ReportStatus } from './types';

export const CONTROLLER_CHANNEL_ID = '00000000-0000-0000-0000-000000000001';

// This is a pseudo-report object for the global staff chat channel.
// It doesn't exist in the DB tables but has the shape of a Report to work with the chat system.
export const CONTROLLER_CHANNEL_REPORT: CrimeReport = {
    id: CONTROLLER_CHANNEL_ID,
    ob_number: 'STAFF-COMMS',
    title: 'Staff Channel',
    description: 'General communication channel for controllers, responders, moderators, and admins.',
    crime_type: 'INTERNAL_COMMUNICATION',
    location: 'System-wide',
    severity: Severity.LOW,
    status: ReportStatus.ACTIVE,
    reported_by: '00000000-0000-0000-0000-000000000000', // A system UUID
    reported_at: new Date(0).toISOString(),
};

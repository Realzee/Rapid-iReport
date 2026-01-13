import React, { useState, useMemo } from 'react';
import { Report, ReportStatus, Severity, VehicleReport, CrimeReport, Responder, ResponderStatus } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon, CarIcon, CrimeIcon, MapPinIcon } from './icons';

const mockVehicleReports: VehicleReport[] = [
    { id: 'v1', ob_number: 'OBV20240729001', license_plate: 'KDA 123X', vehicle_make: 'Toyota', vehicle_model: 'Prado', vehicle_color: 'Black', last_seen_location: 'CBD, Nairobi', description: 'Stolen from parking lot.', severity: Severity.CRITICAL, status: ReportStatus.ACTIVE, reported_by: 'u1', reported_at: new Date(Date.now() - 3600000).toISOString(), location_coords: { lat: -1.283, lng: 36.818 } },
    { id: 'v2', ob_number: 'OBV20240729002', license_plate: 'KDB 456Y', vehicle_make: 'Subaru', vehicle_model: 'Forester', vehicle_color: 'Blue', last_seen_location: 'Westlands', description: 'Carjacked at gunpoint.', severity: Severity.HIGH, status: ReportStatus.IN_PROGRESS, reported_by: 'u2', reported_at: new Date(Date.now() - 7200000).toISOString(), location_coords: { lat: -1.267, lng: 36.807 } },
    { id: 'v3', ob_number: 'OBV20240728005', license_plate: 'KDC 789Z', vehicle_make: 'Nissan', vehicle_model: 'Note', vehicle_color: 'White', last_seen_location: 'Thika Road', description: 'Recovered by police.', severity: Severity.MEDIUM, status: ReportStatus.RECOVERED, reported_by: 'u3', reported_at: new Date(Date.now() - 86400000).toISOString(), location_coords: { lat: -1.218, lng: 36.889 } },
];

const mockCrimeReports: CrimeReport[] = [
    { id: 'c1', ob_number: 'OBC20240729003', title: 'Mugging Incident', crime_type: 'Robbery', location: 'Moi Avenue', description: 'Phone and wallet stolen.', severity: Severity.HIGH, status: ReportStatus.ACTIVE, reported_by: 'u4', reported_at: new Date(Date.now() - 5400000).toISOString(), location_coords: { lat: -1.286, lng: 36.822 } },
    { id: 'c2', ob_number: 'OBC20240729004', title: 'Break-in', crime_type: 'Burglary', location: 'Lavington', description: 'House broken into, electronics stolen.', severity: Severity.MEDIUM, status: ReportStatus.PENDING, reported_by: 'u5', reported_at: new Date().toISOString(), location_coords: { lat: -1.283, lng: 36.782 } },
    { id: 'c3', ob_number: 'OBC20240728001', title: 'Public Disturbance', crime_type: 'Vandalism', location: 'Uhuru Park', description: 'Group of youths causing trouble.', severity: Severity.LOW, status: ReportStatus.RESOLVED, reported_by: 'u6', reported_at: new Date(Date.now() - 90000000).toISOString(), location_coords: { lat: -1.291, lng: 36.819 } },
];

const mockResponders: Responder[] = [
    { id: 'r1', full_name: 'John K.', status: ResponderStatus.AVAILABLE, location_coords: { lat: -1.275, lng: 36.825 } },
    { id: 'r2', full_name: 'Maria O.', status: ResponderStatus.EN_ROUTE, location_coords: { lat: -1.290, lng: 36.800 } },
    { id: 'r3', full_name: 'David M.', status: ResponderStatus.ON_SCENE, location_coords: { lat: -1.268, lng: 36.808 } },
    { id: 'r4', full_name: 'Peter W.', status: ResponderStatus.OFF_DUTY, location_coords: { lat: -1.300, lng: 36.850 } },
];

const allReports = [...mockVehicleReports, ...mockCrimeReports];

const Dashboard: React.FC = () => {
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    const sortedReports = useMemo(() => {
        return allReports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [allReports]);

    const handleReportSelect = (reportId: string) => {
        setSelectedReportId(prevId => prevId === reportId ? null : reportId);
    };

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white">Control Center</h2>
                    <p className="text-gray-400 mt-1">Live operational overview of community safety.</p>
                </div>
                <div className="flex items-center space-x-4 mt-4 md:mt-0">
                     <button className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2">
                        <PlusIcon className="w-5 h-5" />
                        <span>New Report</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard title="Total Reports" value={allReports.length.toString()} icon={<ZapIcon />} color="blue" />
                <StatCard title="Active Incidents" value={allReports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon />} color="red" />
                <StatCard title="Resolved Today" value={allReports.filter(r => r.status === 'resolved' || r.status === 'recovered').length.toString()} icon={<CheckCircleIcon />} color="green" />
                <StatCard title="Available Responders" value={mockResponders.filter(r => r.status === 'available').length.toString()} icon={<ZapIcon />} color="yellow" />
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-[400px] lg:h-[70vh] flex flex-col">
                    <ReportList 
                        reports={sortedReports}
                        onReportSelect={handleReportSelect}
                        selectedReportId={selectedReportId}
                    />
                </div>
                <div className="flex-1 lg:h-[70vh]">
                    <MapView 
                        reports={allReports} 
                        responders={mockResponders}
                        selectedReportId={selectedReportId}
                    />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

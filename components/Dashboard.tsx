import React, { useState, useMemo, useEffect } from 'react';
import { Report, ReportStatus, Severity, VehicleReport, CrimeReport, Responder, ResponderStatus } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon, CarIcon, CrimeIcon, MapPinIcon } from './icons';
import { supabase } from '../utils/supabase';

const Dashboard: React.FC = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: vehicleData, error: vError } = await supabase.from('vehicle_reports').select('*');
            const { data: crimeData, error: cError } = await supabase.from('crime_reports').select('*');
            const { data: respondersData, error: rError } = await supabase.from('responders').select('*'); // Assuming a responders table

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (rError) console.error('Error fetching responders:', rError);

            const combinedReports = [
                ...(vehicleData || []),
                ...(crimeData || []),
            ];

            setReports(combinedReports);
            setResponders(respondersData || []); // Mock responders if table doesn't exist
            setLoading(false);
        };
        fetchData();
    }, []);

    const sortedReports = useMemo(() => {
        return reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [reports]);

    const handleReportSelect = (reportId: string) => {
        setSelectedReportId(prevId => prevId === reportId ? null : reportId);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

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
                <StatCard title="Total Reports" value={reports.length.toString()} icon={<ZapIcon />} color="blue" />
                <StatCard title="Active Incidents" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon />} color="red" />
                <StatCard title="Resolved Today" value={reports.filter(r => r.status === 'resolved' || r.status === 'recovered').length.toString()} icon={<CheckCircleIcon />} color="green" />
                <StatCard title="Available Responders" value={responders.filter(r => r.status === 'available').length.toString()} icon={<ZapIcon />} color="yellow" />
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
                        reports={reports} 
                        responders={responders}
                        selectedReportId={selectedReportId}
                    />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Profile, Severity, ReportStatus, VehicleReport } from '../types';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { useTheme } from '../contexts/ThemeContext';
// FIX: `subDays` is a named export from `date-fns` in v2+, not a default export from a subpath.
import { format, subDays } from 'date-fns';
import { BuildingIcon, ChartBarIcon, ChartPieIcon, MapIcon, ZapIcon, CheckCircleIcon, AlertTriangleIcon } from '../components/icons';
import StatCard from '../components/StatCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

type ReportType = 'summary' | 'trends' | 'severity' | 'hotspots';
const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ReportsPage: React.FC = () => {
    const [allReports, setAllReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<ReportType>('summary');
    const { theme } = useTheme();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*'),
                supabase.from('crime_reports').select('*'),
            ]);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            
            const combined = [
                ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' })),
                ...(crimeData || []).map(r => ({ ...r, type: 'crime' })),
            ];

            setAllReports(combined);
            setLoading(false);
        };
        fetchData();
    }, []);

    const chartOptions = useMemo(() => {
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = theme === 'dark' ? '#E5E7EB' : '#374151';
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: textColor } } },
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { ticks: { color: textColor }, grid: { color: gridColor } },
            },
        };
    }, [theme]);

    const renderReportContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center h-full"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
        }

        switch (selectedReport) {
            case 'summary': return <SummaryReport reports={allReports} />;
            case 'trends': return <TrendsReport reports={allReports} options={chartOptions} />;
            case 'severity': return <SeverityReport reports={allReports} options={chartOptions} />;
            case 'hotspots': return <HotspotsReport reports={allReports} />;
            default: return null;
        }
    };

    const navItems = [
        { id: 'summary', name: 'Summary', icon: ZapIcon },
        { id: 'trends', name: 'Incident Trends', icon: ChartBarIcon },
        { id: 'severity', name: 'Severity Distribution', icon: ChartPieIcon },
        { id: 'hotspots', name: 'Top Hotspots', icon: MapIcon },
    ];

    return (
        <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">System Analytics & Reports</h2>
            <div className="flex flex-col md:flex-row gap-8">
                <aside className="md:w-64 flex-shrink-0">
                    <nav className="space-y-2">
                        {navItems.map(item => (
                             <button 
                                key={item.id}
                                onClick={() => setSelectedReport(item.id as ReportType)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-semibold transition-colors duration-200 ${
                                    selectedReport === item.id 
                                    ? 'bg-blue-600 text-white' 
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="flex-1 bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 backdrop-blur-lg shadow-lg min-h-[60vh]">
                    {renderReportContent()}
                </main>
            </div>
        </div>
    );
};

const SummaryReport: React.FC<{ reports: Report[] }> = ({ reports }) => {
    const totalReports = reports.length;
    const vehicleReports = reports.filter(r => isVehicleReport(r)).length;
    const crimeReports = totalReports - vehicleReports;
    const resolved = reports.filter(r => r.status === ReportStatus.RESOLVED || r.status === ReportStatus.RECOVERED).length;
    const pending = reports.filter(r => r.status === ReportStatus.PENDING).length;

    return (
        <div>
            <h3 className="text-2xl font-bold mb-6">At a Glance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Total Reports" value={totalReports.toString()} icon={<ZapIcon />} color="blue" />
                <StatCard title="Vehicle Incidents" value={vehicleReports.toString()} icon={<BuildingIcon />} color="yellow" />
                <StatCard title="Crime Incidents" value={crimeReports.toString()} icon={<BuildingIcon />} color="red" />
                <StatCard title="Resolved Cases" value={resolved.toString()} icon={<CheckCircleIcon />} color="green" />
                <StatCard title="Pending Review" value={pending.toString()} icon={<AlertTriangleIcon />} color="yellow" />
            </div>
        </div>
    );
};

const TrendsReport: React.FC<{ reports: Report[], options: any }> = ({ reports, options }) => {
    const data = useMemo(() => {
        const labels = Array.from({ length: 30 }).map((_, i) => format(subDays(new Date(), 29 - i), 'MMM d'));
        const vehicleData = new Array(30).fill(0);
        const crimeData = new Array(30).fill(0);
        const thirtyDaysAgo = subDays(new Date(), 29);

        reports.forEach(report => {
            const reportDate = new Date(report.reported_at);
            if (reportDate.getTime() >= thirtyDaysAgo.getTime()) {
                const dayIndex = 29 - Math.floor((new Date().getTime() - reportDate.getTime()) / (1000 * 3600 * 24));
                if (dayIndex >= 0 && dayIndex < 30) {
                    if (isVehicleReport(report)) vehicleData[dayIndex]++;
                    else crimeData[dayIndex]++;
                }
            }
        });
        return {
            labels,
            datasets: [
                { label: 'Vehicle Reports', data: vehicleData, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.5)', tension: 0.3 },
                { label: 'Crime Reports', data: crimeData, borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.5)', tension: 0.3 },
            ]
        };
    }, [reports]);

    return <div className="h-[50vh]"><h3 className="text-2xl font-bold mb-4">Incidents Over Last 30 Days</h3><Line options={options} data={data} /></div>;
};

const SeverityReport: React.FC<{ reports: Report[], options: any }> = ({ reports, options }) => {
    const data = useMemo(() => {
        const severityCounts = reports.reduce((acc, report) => {
            acc[report.severity] = (acc[report.severity] || 0) + 1;
            return acc;
        }, {} as Record<Severity, number>);

        const labels = Object.keys(severityCounts) as Severity[];
        const counts = Object.values(severityCounts);

        return {
            labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
            datasets: [{
                data: counts,
                backgroundColor: ['#EF4444', '#F97316', '#EAB308', '#22C55E'],
                borderColor: '#111827', // dark:bg-gray-900
                borderWidth: 2,
            }]
        };
    }, [reports]);

    return <div className="h-[50vh] w-full flex flex-col items-center"><h3 className="text-2xl font-bold mb-4">Severity Distribution</h3><div className="w-full max-w-sm"><Doughnut data={data} options={{...options, scales: {}}} /></div></div>;
};

const HotspotsReport: React.FC<{ reports: Report[] }> = ({ reports }) => {
    const topLocations = useMemo(() => {
        const locationCounts = reports.reduce((acc, report) => {
            const location = isVehicleReport(report) ? report.last_seen_location : report.location;
            if (location) {
                acc[location] = (acc[location] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(locationCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }, [reports]);

    return (
        <div>
            <h3 className="text-2xl font-bold mb-4">Top 10 Incident Hotspots</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Report Count</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {topLocations.map(([location, count], index) => (
                            <tr key={location} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{index + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{location}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">{count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ReportsPage;

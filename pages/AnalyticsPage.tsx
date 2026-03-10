import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, ReportStatus, Severity, VehicleReport, EmergencyReport } from '../types';
import { 
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    AreaChart, Area
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO, getHours, differenceInHours, differenceInMinutes } from 'date-fns';
import { 
    CarIcon, CrimeIcon, ChartBarIcon, ChartPieIcon, MapIcon, ZapIcon, 
    CheckCircleIcon, AlertTriangleIcon, DownloadIcon, ClockIcon, ClipboardCheckIcon
} from '../components/icons';
import { Calendar, Filter } from 'lucide-react';
import StatCard from '../components/StatCard';

// Type Guard
const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;
const isEmergencyReport = (report: Report): report is EmergencyReport => 'emergency_type' in report;

type ReportType = 'summary' | 'trends' | 'severity' | 'status' | 'time' | 'hotspots';
type DateRange = '7days' | '30days' | '90days' | 'all';

const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];
const SEVERITY_COLORS = {
    critical: '#EF4444',
    high: '#F97316',
    medium: '#EAB308',
    low: '#22C55E'
};

const AnalyticsPage: React.FC = () => {
    const [allReports, setAllReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<ReportType>('summary');
    const [dateRange, setDateRange] = useState<DateRange>('30days');
    const { theme } = useTheme();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: emergencyData, error: aError },
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*'),
                supabase.from('crime_reports').select('*'),
                supabase.from('emergency_reports').select('*'),
            ]);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (aError) console.error('Error fetching emergency reports:', aError);
            
            const combined = [
                ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' })),
                ...(crimeData || []).map(r => ({ ...r, type: 'crime' })),
                ...(emergencyData || []).map(r => ({ ...r, type: 'emergency' })),
            ];

            // Sort by date descending
            combined.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());

            setAllReports(combined);
            setLoading(false);
        };
        fetchData();
    }, []);

    const filteredReports = useMemo(() => {
        if (dateRange === 'all') return allReports;

        const now = new Date();
        let daysToSubtract = 30;
        if (dateRange === '7days') daysToSubtract = 7;
        if (dateRange === '90days') daysToSubtract = 90;

        const startDate = subDays(now, daysToSubtract);

        return allReports.filter(report => {
            const reportDate = new Date(report.reported_at);
            return reportDate >= startDate;
        });
    }, [allReports, dateRange]);

    const handleExport = () => {
        const headers = ['ID', 'Type', 'Status', 'Severity', 'Reported At', 'Location', 'Description'];
        const csvContent = [
            headers.join(','),
            ...filteredReports.map(r => [
                r.id,
                isVehicleReport(r) ? 'Vehicle' : (isEmergencyReport(r) ? 'Emergency' : 'Crime'),
                r.status,
                r.severity,
                `"${r.reported_at}"`,
                `"${isVehicleReport(r) ? r.last_seen_location : r.location}"`,
                `"${r.description?.replace(/"/g, '""') || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `analytics_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderReportContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center h-full"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
        }

        switch (selectedReport) {
            case 'summary': return <SummaryReport reports={filteredReports} />;
            case 'trends': return <TrendsReport reports={filteredReports} theme={theme} />;
            case 'severity': return <SeverityReport reports={filteredReports} theme={theme} />;
            case 'status': return <StatusReport reports={filteredReports} theme={theme} />;
            case 'time': return <TimeAnalysisReport reports={filteredReports} theme={theme} />;
            case 'hotspots': return <HotspotsReport reports={filteredReports} />;
            default: return null;
        }
    };

    const navItems = [
        { id: 'summary', name: 'Summary', icon: ZapIcon },
        { id: 'trends', name: 'Incident Trends', icon: ChartBarIcon },
        { id: 'severity', name: 'Severity Analysis', icon: ChartPieIcon },
        { id: 'status', name: 'Status Breakdown', icon: CheckCircleIcon },
        { id: 'time', name: 'Time Analysis', icon: Calendar },
        { id: 'hotspots', name: 'Top Hotspots', icon: MapIcon },
    ];

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">System Analytics</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Comprehensive insights and reporting</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar className="h-4 w-4 text-gray-400" />
                        </div>
                        <select 
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as DateRange)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white appearance-none cursor-pointer"
                        >
                            <option value="7days">Last 7 Days</option>
                            <option value="30days">Last 30 Days</option>
                            <option value="90days">Last 90 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>

                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                <aside className="lg:w-64 flex-shrink-0">
                    <nav className="space-y-2 sticky top-6">
                        {navItems.map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setSelectedReport(item.id as ReportType)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all duration-200 ${
                                    selectedReport === item.id 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                <main className="flex-1 min-w-0">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm min-h-[600px]">
                        {renderReportContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

const SummaryReport: React.FC<{ reports: Report[] }> = ({ reports }) => {
    const totalReports = reports.length;
    const vehicleReports = reports.filter(r => isVehicleReport(r)).length;
    const emergencyReports = reports.filter(r => isEmergencyReport(r)).length;
    const crimeReports = totalReports - vehicleReports - emergencyReports;
    const resolved = reports.filter(r => r.status === ReportStatus.RESOLVED || r.status === ReportStatus.RECOVERED).length;
    const pending = reports.filter(r => r.status === ReportStatus.PENDING).length;
    
    // Calculate resolution rate
    const resolutionRate = totalReports > 0 ? Math.round((resolved / totalReports) * 100) : 0;

    // Calculate Average Response Time (for resolved/recovered/closed reports)
    const avgResponseTime = useMemo(() => {
        const completedReports = reports.filter(r => 
            (r.status === ReportStatus.RESOLVED || r.status === ReportStatus.RECOVERED || r.status === ReportStatus.CLOSED) && 
            r.completed_at
        );
        
        if (completedReports.length === 0) return 'N/A';

        const totalMinutes = completedReports.reduce((acc, r) => {
            const start = new Date(r.reported_at);
            const end = new Date(r.completed_at!);
            return acc + differenceInMinutes(end, start);
        }, 0);

        const avgMinutes = totalMinutes / completedReports.length;
        
        if (avgMinutes < 60) return `${Math.round(avgMinutes)} mins`;
        return `${Math.round(avgMinutes / 60)} hours`;
    }, [reports]);

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Key Performance Indicators</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard title="Total Reports" value={totalReports.toString()} icon={<ZapIcon />} color="blue" />
                    <StatCard title="Vehicle Incidents" value={vehicleReports.toString()} icon={<CarIcon />} color="yellow" />
                    <StatCard title="Emergency Reports" value={emergencyReports.toString()} icon={<AlertTriangleIcon />} color="orange" />
                    <StatCard title="Crime Incidents" value={crimeReports.toString()} icon={<CrimeIcon />} color="red" />
                    <StatCard title="Resolved Cases" value={resolved.toString()} icon={<CheckCircleIcon />} color="green" />
                    <StatCard title="Pending Review" value={pending.toString()} icon={<ClipboardCheckIcon />} color="purple" />
                    <StatCard title="Resolution Rate" value={`${resolutionRate}%`} icon={<ChartBarIcon />} color="indigo" />
                    <StatCard title="Avg. Resolution Time" value={avgResponseTime} icon={<ClockIcon />} color="cyan" />
                </div>
            </div>
        </div>
    );
};

const TrendsReport: React.FC<{ reports: Report[], theme: string }> = ({ reports, theme }) => {
    const data = useMemo(() => {
        // Group by date
        const grouped = reports.reduce((acc, report) => {
            if (!report.reported_at) return acc;
            try {
                const date = format(new Date(report.reported_at), 'yyyy-MM-dd');
                if (!acc[date]) acc[date] = { date, vehicle: 0, crime: 0, emergency: 0, total: 0 };
                
                if (isVehicleReport(report)) acc[date].vehicle++;
                else if (isEmergencyReport(report)) acc[date].emergency++;
                else acc[date].crime++;
                acc[date].total++;
            } catch (e) {
                console.error("Invalid date in report:", report);
            }
            return acc;
        }, {} as Record<string, { date: string, vehicle: number, crime: number, emergency: number, total: number }>);

        // Fill in missing days if needed, or just sort
        return (Object.values(grouped) as any[]).sort((a, b) => a.date.localeCompare(b.date));
    }, [reports]);

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Incident Trends Over Time</h3>
            <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorVehicle" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCrime" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorEmergency" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                            tickFormatter={(str) => format(parseISO(str), 'MMM d')}
                        />
                        <YAxis stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
                            itemStyle={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
                            labelFormatter={(label) => format(parseISO(label as string), 'MMM d, yyyy')}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="vehicle" name="Vehicle Incidents" stroke="#EAB308" fillOpacity={1} fill="url(#colorVehicle)" />
                        <Area type="monotone" dataKey="emergency" name="Emergency Reports" stroke="#F97316" fillOpacity={1} fill="url(#colorEmergency)" />
                        <Area type="monotone" dataKey="crime" name="Crime Incidents" stroke="#EF4444" fillOpacity={1} fill="url(#colorCrime)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const SeverityReport: React.FC<{ reports: Report[], theme: string }> = ({ reports, theme }) => {
    const data = useMemo(() => {
        const counts = reports.reduce((acc, report) => {
            acc[report.severity] = (acc[report.severity] || 0) + 1;
            return acc;
        }, {} as Record<Severity, number>);

        return Object.entries(counts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: SEVERITY_COLORS[name as Severity] || '#9CA3AF'
        }));
    }, [reports]);

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Severity Distribution</h3>
            <div className="flex-1 min-h-[400px] flex flex-col md:flex-row items-center justify-center">
                <div className="w-full h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={120}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke={theme === 'dark' ? '#111827' : '#FFFFFF'} strokeWidth={2} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
                                itemStyle={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
                            />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-8 md:mt-0 md:ml-8 grid grid-cols-2 gap-4">
                    {data.map((item) => (
                        <div key={item.name} className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{item.name}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const StatusReport: React.FC<{ reports: Report[], theme: string }> = ({ reports, theme }) => {
    const data = useMemo(() => {
        const counts = reports.reduce((acc, report) => {
            const status = report.status.toUpperCase();
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a: any, b: any) => b.value - a.value);
    }, [reports]);

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Reports by Status</h3>
            <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                        <XAxis type="number" stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'} />
                        <YAxis dataKey="name" type="category" width={100} stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'} tick={{fontSize: 12}} />
                        <Tooltip 
                            cursor={{fill: theme === 'dark' ? '#374151' : '#F3F4F6'}}
                            contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
                            itemStyle={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
                        />
                        <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const TimeAnalysisReport: React.FC<{ reports: Report[], theme: string }> = ({ reports, theme }) => {
    const data = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
        
        reports.forEach(report => {
            if (!report.reported_at) return;
            try {
                const date = new Date(report.reported_at);
                const hour = getHours(date);
                if (!isNaN(hour)) {
                    hours[hour].count++;
                }
            } catch (e) {
                console.error("Invalid date in report:", report);
            }
        });

        return hours.map(h => ({
            name: `${h.hour.toString().padStart(2, '0')}:00`,
            value: h.count
        }));
    }, [reports]);

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Incidents by Time of Day</h3>
            <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                        <XAxis 
                            dataKey="name" 
                            stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                            tick={{fontSize: 12}}
                            interval={2}
                        />
                        <YAxis stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'} />
                        <Tooltip 
                            cursor={{fill: theme === 'dark' ? '#374151' : '#F3F4F6'}}
                            contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
                            itemStyle={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
                        />
                        <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Incidents" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const HotspotsReport: React.FC<{ reports: Report[] }> = ({ reports }) => {
    const hotspots = useMemo(() => {
        const stats = reports.reduce((acc, report) => {
            const location = (isVehicleReport(report) ? report.last_seen_location : report.location)?.trim();
            if (!location) return acc;

            if (!acc[location]) {
                acc[location] = {
                    location,
                    count: 0,
                    vehicle: 0,
                    crime: 0,
                    emergency: 0,
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                };
            }

            acc[location].count++;
            
            if (isVehicleReport(report)) acc[location].vehicle++;
            else if (isEmergencyReport(report)) acc[location].emergency++;
            else acc[location].crime++;

            if (report.severity === Severity.CRITICAL) acc[location].critical++;
            else if (report.severity === Severity.HIGH) acc[location].high++;
            else if (report.severity === Severity.MEDIUM) acc[location].medium++;
            else acc[location].low++;

            return acc;
        }, {} as Record<string, { 
            location: string; 
            count: number; 
            vehicle: number; 
            crime: number; 
            emergency: number; 
            critical: number; 
            high: number; 
            medium: number; 
            low: number; 
        }>);

        return (Object.values(stats) as any[])
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [reports]);

    const getRiskLevel = (item: typeof hotspots[0]) => {
        const score = (item.critical * 3) + (item.high * 2) + (item.medium * 1);
        const avg = score / item.count;
        if (avg > 2.5) return { label: 'Critical', color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' };
        if (avg > 1.5) return { label: 'High', color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30' };
        if (avg > 0.5) return { label: 'Medium', color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' };
        return { label: 'Low', color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' };
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Top 10 Incident Hotspots</h3>
            <div className="grid grid-cols-1 gap-4">
                {hotspots.map((spot, index) => {
                    const risk = getRiskLevel(spot);
                    const percentage = Math.round((spot.count / reports.length) * 100);
                    
                    return (
                        <div key={spot.location} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:shadow-md">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                index < 3 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                                {index + 1}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{spot.location}</h4>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${risk.color}`}>
                                        {risk.label} Risk
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span>{spot.count} Reports ({percentage}%)</span>
                                    <div className="flex items-center gap-3">
                                        {spot.vehicle > 0 && (
                                            <span className="flex items-center gap-1" title="Vehicle Incidents">
                                                <CarIcon className="w-3 h-3" /> {spot.vehicle}
                                            </span>
                                        )}
                                        {spot.crime > 0 && (
                                            <span className="flex items-center gap-1" title="Crime Incidents">
                                                <CrimeIcon className="w-3 h-3" /> {spot.crime}
                                            </span>
                                        )}
                                        {spot.emergency > 0 && (
                                            <span className="flex items-center gap-1" title="Emergency Reports">
                                                <AlertTriangleIcon className="w-3 h-3" /> {spot.emergency}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-shrink-0 w-full sm:w-32">
                                <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${(spot.vehicle / spot.count) * 100}%` }} className="h-full bg-yellow-500" />
                                    <div style={{ width: `${(spot.crime / spot.count) * 100}%` }} className="h-full bg-red-500" />
                                    <div style={{ width: `${(spot.emergency / spot.count) * 100}%` }} className="h-full bg-orange-500" />
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                                    <span>Type Dist.</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {hotspots.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No location data available for the selected period.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsPage;
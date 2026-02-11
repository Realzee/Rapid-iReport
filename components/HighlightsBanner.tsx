import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Severity, VehicleReport } from '../types';
import { CarIcon, CrimeIcon, AlertTriangleIcon } from './icons';
// FIX: The original code used `sub`, which is from a newer version of date-fns. Replaced with `subDays` to match the project's installed version.
import { formatDistanceToNow, subDays } from 'date-fns';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

interface HighlightsBannerProps {
    onSelectReport: (reportId: string) => void;
    topClass?: string;
}

const HighlightCard: React.FC<{ report: Report, onSelect: (id: string) => void }> = ({ report, onSelect }) => {
    const isVehicle = isVehicleReport(report);
    const title = isVehicle ? report.license_plate : report.title;
    
    return (
        <div 
            onClick={() => onSelect(report.id)}
            className="flex items-center gap-1.5 bg-white/10 dark:bg-black/20 hover:bg-white/20 dark:hover:bg-black/30 backdrop-blur-sm rounded-md px-2 py-1 cursor-pointer border border-white/10 dark:border-black/20 transition-colors duration-300 flex-shrink-0 w-64"
        >
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${report.severity === Severity.CRITICAL ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
                {isVehicle ? <CarIcon className="w-3.5 h-3.5 text-yellow-400" /> : <CrimeIcon className="w-3.5 h-3.5 text-red-400" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate">{title}</p>
                <div className="flex items-center gap-1.5 text-xs opacity-80">
                    <AlertTriangleIcon className={`w-3 h-3 ${report.severity === Severity.CRITICAL ? 'text-red-400' : 'text-orange-400'}`} />
                    <span className="capitalize">{report.severity}</span>
                    <span>&middot;</span>
                    <span className="whitespace-nowrap">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</span>
                </div>
            </div>
        </div>
    );
};

const HighlightsBanner: React.FC<HighlightsBannerProps> = ({ onSelectReport, topClass = 'top-20' }) => {
    const [reports, setReports] = useState<Report[]>([]);
    
    useEffect(() => {
        const fetchHighlights = async () => {
            // FIX: Replaced `sub` with `subDays` to support older date-fns versions.
            const sevenDaysAgo = subDays(new Date(), 7).toISOString();
            
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').in('severity', [Severity.CRITICAL, Severity.HIGH]).gte('reported_at', sevenDaysAgo),
                supabase.from('crime_reports').select('*').in('severity', [Severity.CRITICAL, Severity.HIGH]).gte('reported_at', sevenDaysAgo)
            ]);

            if (vError) console.error("Error fetching vehicle highlights:", vError);
            if (cError) console.error("Error fetching crime highlights:", cError);

            const combined = [...(vehicleData || []), ...(crimeData || [])]
                .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
            
            setReports(combined);
        };

        fetchHighlights();

        const channel = supabase.channel('highlights-banner')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_reports', filter: `severity=in.("${Severity.CRITICAL}","${Severity.HIGH}")` }, payload => {
                setReports(prev => [payload.new as Report, ...prev].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()));
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crime_reports', filter: `severity=in.("${Severity.CRITICAL}","${Severity.HIGH}")` }, payload => {
                setReports(prev => [payload.new as Report, ...prev].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, []);

    if (reports.length === 0) {
        return null;
    }

    // Always duplicate reports to ensure a seamless marquee effect.
    const duplicatedReports = [...reports, ...reports];
    // Adjust duration based on number of reports to keep scroll speed consistent
    const animationDuration = Math.max(20, reports.length * 10);
    const animationStyle = { animation: `marquee ${animationDuration}s linear infinite` };

    return (
        <div className={`fixed ${topClass} left-0 right-0 z-40 bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800/50 text-gray-800 dark:text-gray-200 overflow-hidden py-1 print:hidden`}>
            <div className={`flex w-max`} style={animationStyle}>
                {duplicatedReports.map((report, index) => (
                    <div key={`${report.id}-${index}`} className="mx-2">
                        <HighlightCard report={report} onSelect={onSelectReport} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HighlightsBanner;
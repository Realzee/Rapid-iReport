import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { Attendance, Profile } from '../types';
import { useToast } from '../contexts/ToastContext';

const AttendancePage: React.FC = () => {
    const [records, setRecords] = useState<(Attendance & { profile: Profile })[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchAttendance = async () => {
            const { data, error } = await supabase
                .from('attendance')
                .select('*, profile:user_id(*)')
                .order('clock_in_time', { ascending: false });
            
            if (error) {
                console.error('Error fetching attendance:', error);
                addToast('Error fetching attendance records', 'error');
            } else {
                setRecords(data as any);
            }
            setLoading(false);
        };
        fetchAttendance();
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Attendance Records</h1>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b dark:border-gray-700 uppercase text-xs text-gray-500">
                            <th className="p-4">Guard</th>
                            <th className="p-4">Clock In</th>
                            <th className="p-4">Clock Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(record => (
                            <tr key={record.id} className="border-b dark:border-gray-700">
                                <td className="p-4">{record.profile.first_name} {record.profile.surname}</td>
                                <td className="p-4">{new Date(record.clock_in_time).toLocaleString()}</td>
                                <td className="p-4">{record.clock_out_time ? new Date(record.clock_out_time).toLocaleString() : 'Active'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AttendancePage;

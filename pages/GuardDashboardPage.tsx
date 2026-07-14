import React, { useState, useEffect } from 'react';
import { Profile, Attendance } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import ClockInModal from '../components/ClockInModal';

interface GuardDashboardPageProps {
    profile: Profile;
}

const GuardDashboardPage: React.FC<GuardDashboardPageProps> = ({ profile }) => {
    const [attendance, setAttendance] = useState<Attendance | null>(null);
    const [loading, setLoading] = useState(false);
    const [siteUpdate, setSiteUpdate] = useState('');
    const [showClockModal, setShowClockModal] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchAttendance = async () => {
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', profile.id)
                .is('clock_out_time', null)
                .order('clock_in_time', { ascending: false });
            
            if (error) {
                console.error('Error fetching attendance:', error);
                return;
            }
            if (data && data.length > 0) {
                setAttendance(data[0]);
            }
        };
        fetchAttendance();
    }, [profile.id]);

    const performClock = async (currentLocation: string) => {
        setLoading(true);
        setShowClockModal(false);

        if (attendance) {
            // Clock out
            const { error } = await supabase
                .from('attendance')
                .update({ clock_out_time: new Date().toISOString(), clock_out_location: currentLocation })
                .eq('id', attendance.id);
            if (!error) {
                setAttendance(null);
                addToast('Clocked out successfully', 'success');
            } else {
                addToast('Error clocking out', 'error');
            }
        } else {
            // Clock in
            const { data, error } = await supabase
                .from('attendance')
                .insert({ user_id: profile.id, clock_in_time: new Date().toISOString(), clock_in_location: currentLocation })
                .select()
                .single();
            if (data) {
                setAttendance(data);
                addToast('Clocked in successfully', 'success');
            } else {
                addToast('Error clocking in', 'error');
            }
        }
        setLoading(false);
    };

    const handleSendUpdate = async () => {
        if (!siteUpdate.trim()) return;
        setLoading(true);
        const { error } = await supabase
            .from('report_updates')
            .insert({ report_id: 'SYSTEM_Update', user_id: profile.id, content: siteUpdate });
        if (!error) {
            addToast('Update sent to control', 'success');
            setSiteUpdate('');
        } else {
            addToast('Error sending update', 'error');
        }
        setLoading(false);
    };

    return (
        <div className="py-3 px-2 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Guard Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Welcome, {profile.first_name} {profile.surname}.</p>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h2 className="text-lg font-bold mb-4">Attendance</h2>
                    <button 
                        onClick={() => setShowClockModal(true)} 
                        disabled={loading}
                        className={`w-full py-2 px-4 rounded ${attendance ? 'bg-red-500' : 'bg-green-500'} text-white`}
                    >
                        {attendance ? 'Clock Out' : 'Clock In'}
                    </button>
                    <ClockInModal
                        isOpen={showClockModal}
                        onClose={() => setShowClockModal(false)}
                        onConfirm={performClock}
                        action={attendance ? 'clockOut' : 'clockIn'}
                    />
                </div>

                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h2 className="text-lg font-bold mb-4">Live Site Update</h2>
                    <textarea 
                        value={siteUpdate} 
                        onChange={(e) => setSiteUpdate(e.target.value)}
                        className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter site update..."
                    />
                    <button 
                        onClick={handleSendUpdate}
                        disabled={loading || !siteUpdate.trim()}
                        className="w-full py-2 px-4 rounded bg-blue-500 text-white"
                    >
                        Send to Control
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuardDashboardPage;

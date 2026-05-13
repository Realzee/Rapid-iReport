import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Profile, Checkpoint } from '../types';
import PatrolScanner from '../components/GuardMonitoring/PatrolScanner';

interface PatrolPageProps {
    profile: Profile;
}

const PatrolPage: React.FC<PatrolPageProps> = ({ profile }) => {
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [guardRecord, setGuardRecord] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
             // Fetch checkpoints
            const { data: cpData } = await supabase
                .from('checkpoints')
                .select('*');
            if (cpData) setCheckpoints(cpData);

            // Fetch actual guard record for this profile
            const { data: gData } = await supabase
                .from('guards')
                .select('*')
                .eq('profile_id', profile.id)
                .maybeSingle();
            
            if (gData) {
                setGuardRecord(gData);
            } else {
                // If no guard record found, fallback to constructing one from profile (for admins etc)
                setGuardRecord({ 
                    id: profile.id, 
                    name: `${profile.first_name || ''} ${profile.surname || ''}`.trim() || profile.email,
                    site_id: profile.company_id || null,
                    company_id: profile.company_id || null
                });
            }
        };
        fetchData();
    }, [profile.id]);

    const guards = guardRecord ? [guardRecord] : [];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Patrol</h1>
            {guards.length > 0 ? (
                <PatrolScanner guards={guards as any} checkpoints={checkpoints} onScanSuccess={() => {}} />
            ) : (
                <div className="p-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400">
                    Loading patrol scanner...
                </div>
            )}
        </div>
    );
};

export default PatrolPage;

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
                // Try to find if this user is a supervisor and get their first site
                const { data: supSites } = await supabase.from('supervisors').select('site_ids, site_id').eq('profile_id', profile.id).maybeSingle();
                const defaultSiteId = supSites?.site_id || (supSites?.site_ids && supSites.site_ids.length > 0 ? supSites.site_ids[0] : null);

                // If no guard record found, fallback to constructing one from profile (for admins etc)
                setGuardRecord({ 
                    id: profile.id, 
                    name: `${profile.first_name || ''} ${profile.surname || ''}`.trim() || profile.email,
                    site_id: defaultSiteId || profile.company_id || null,
                    company_id: profile.company_id || null
                });
            }

            // Proactive schema fix if columns are missing
            const checkSchema = async () => {
                const { error: schemaError } = await supabase.from('patrol_logs').select('location_coords').limit(1);
                if (schemaError && (schemaError.code === 'PGRST204' || schemaError.message.includes('column "location_coords" does not exist'))) {
                    console.log('Detected missing columns in patrol_logs, applying fix...');
                    await fetch('/api/guard-monitoring', {
                        method: 'POST',
                        body: JSON.stringify({ action: 'fix-schema' })
                    });
                    // Don't reload immediately to avoid loop, just log
                }
            };
            checkSchema();
        };
        fetchData();
    }, [profile.id, profile.company_id]);

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

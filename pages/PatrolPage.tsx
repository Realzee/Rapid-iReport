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
    const [patrolLogs, setPatrolLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const fetchPatrolLogs = async (guardId?: string) => {
        setLoadingLogs(true);
        try {
            let query = supabase
                .from('patrol_logs')
                .select(`
                    id,
                    scanned_at,
                    verification_status,
                    location_coords,
                    checkpoints ( id, name, location_description )
                `)
                .order('scanned_at', { ascending: false })
                .limit(20);

            if (guardId) {
                query = query.eq('guard_id', guardId);
            }

            const { data, error } = await query;
            if (!error && data) {
                setPatrolLogs(data);
            }
        } catch (e) {
            console.error('Error fetching logs', e);
        } finally {
            setLoadingLogs(false);
        }
    };

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
            
            let gId = profile.id;

            if (gData) {
                setGuardRecord(gData);
                gId = gData.id;
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

            fetchPatrolLogs(gId);
        };
        fetchData();
    }, [profile.id, profile.company_id]);

    const guards = guardRecord ? [guardRecord] : [];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Patrol</h1>
            {guards.length > 0 ? (
                <PatrolScanner guards={guards as any} checkpoints={checkpoints} onScanSuccess={() => {
                    if (guardRecord) {
                        fetchPatrolLogs(guardRecord.id || profile.id);
                    }
                }} />
            ) : (
                <div className="p-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400">
                    Loading patrol scanner...
                </div>
            )}
            
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Recent Patrol Logs</h2>
                {loadingLogs ? (
                    <div className="p-4 text-gray-500">Loading records...</div>
                ) : patrolLogs.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                            {patrolLogs.map((log) => (
                                <li key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {log.checkpoints ? log.checkpoints.name : 'Unknown Checkpoint'}
                                            </p>
                                            {log.checkpoints?.location_description && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                                    {log.checkpoints.location_description}
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                {new Date(log.scanned_at || new Date()).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                log.verification_status === 'valid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                log.verification_status === 'invalid_location' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                                {log.verification_status === 'valid' ? 'Verified' : 
                                                 log.verification_status === 'invalid_location' ? 'Location Mismatch' : 
                                                 (log.verification_status || 'Logged')}
                                            </span>
                                            {log.location_coords && (
                                                <span className="text-[10px] text-gray-400 mt-1">GPS Logged</span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 text-sm">
                        No recent patrol records found. Scans will appear here.
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatrolPage;

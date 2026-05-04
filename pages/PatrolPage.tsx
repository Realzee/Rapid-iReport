import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Profile, Checkpoint } from '../types';
import PatrolScanner from '../components/GuardMonitoring/PatrolScanner';

interface PatrolPageProps {
    profile: Profile;
}

const PatrolPage: React.FC<PatrolPageProps> = ({ profile }) => {
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

    useEffect(() => {
        const fetchCheckpoints = async () => {
             // Fetch checkpoints for the guard's site
             // Assuming guards belong to a site via company_id or some other link
             // For now, let's just fetch all or filter by something
            const { data, error } = await supabase
                .from('checkpoints')
                .select('*');
            if (data) setCheckpoints(data);
        };
        fetchCheckpoints();
    }, []);

    // Assuming guard profile acts as a guard
    const guards = [{ id: profile.id, name: `${profile.first_name} ${profile.surname}`, site_id: profile.company_id || '' }];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Patrol</h1>
            <PatrolScanner guards={guards as any} checkpoints={checkpoints} onScanSuccess={() => {}} />
        </div>
    );
};

export default PatrolPage;

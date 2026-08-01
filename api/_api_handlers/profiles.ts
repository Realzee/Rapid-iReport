import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const SERVICE_ROLE_KEY_VAL = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnN2dGxubWpqa29iZnljdWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODI3MTMsImV4cCI6MjEwMDk1ODcxM30.PLeuqc3AKOq5QEFC2nxXIQ3MEEns5hxx7IkBYtzx43s';
    const supabaseUrl = process.env.SUPABASE_URL || 'https://zbbsvtlnmjjkobfycudw.supabase.co';
    
    let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
        supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
    }

    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);

    

    if (req.method === 'GET') {
        try {
            // Safe column detection
            const { data: colCheck, error: colError } = await supabaseAdmin.from('profiles').select('*').limit(1);
            let columns = 'id, email, role, status';
            
            const existingCols = (!colError && colCheck && colCheck.length > 0) 
                ? Object.keys(colCheck[0]) 
                : [];

            // Name columns
            if (existingCols.includes('first_name')) columns += ', first_name';
            else if (existingCols.includes('name')) columns += ', name';

            if (existingCols.includes('surname')) columns += ', surname';
            else if (existingCols.includes('last_name')) columns += ', last_name';
            
            // Other columns
            if (existingCols.includes('cell')) columns += ', cell';
            if (existingCols.includes('last_seen_at')) columns += ', last_seen_at';
            if (existingCols.includes('company_id')) columns += ', company_id';
            if (existingCols.includes('avatar_url')) columns += ', avatar_url';

            if (existingCols.length === 0 && !colError) {
                // Table might be empty, try individual checks
                const { error: fErr } = await supabaseAdmin.from('profiles').select('first_name').limit(1);
                if (!fErr) columns += ', first_name';
                const { error: sErr } = await supabaseAdmin.from('profiles').select('surname').limit(1);
                if (!sErr) columns += ', surname';
                else {
                    const { error: lErr } = await supabaseAdmin.from('profiles').select('last_name').limit(1);
                    if (!lErr) columns += ', last_name';
                }
                const { error: cErr } = await supabaseAdmin.from('profiles').select('company_id').limit(1);
                if (!cErr) columns += ', company_id';
                const { error: cellErr } = await supabaseAdmin.from('profiles').select('cell').limit(1);
                if (!cellErr) columns += ', cell';
            }
            
            const { data, error } = await supabaseAdmin
                .from('profiles')
                .select(columns)
                .order('email');
                
            if (error) {
                console.error('Error fetching profiles:', error);
                return res.status(500).json({ error: error.message, code: error.code });
            }
            return res.status(200).json(data);
        } catch (e: any) {
            console.error('Profiles handler crash:', e);
            return res.status(500).json({ error: e.message || 'Unknown internal error' });
        }
    } else if (req.method === 'POST') {
        const body = req.body || {};
        const { userId, updates, ...rest } = body;
        
        // Flatten updates if provided, otherwise use rest of the body
        let dbPayload = updates ? { ...updates } : { ...rest };

        // If this was just a presence update from App.tsx, swallow the error so it doesn't spam the console
        if (dbPayload.last_seen_at && Object.keys(dbPayload).length === 1) {
            if (!supabaseServiceKey) {
                return res.status(200).json({ success: false, message: 'Presence update ignored because config is missing' });
            }
        }

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // List of fallback columns in case database query is not possible/empty
        let validColumns = [
            'id', 'email', 'first_name', 'surname', 'role', 'status', 'company_id', 
            'avatar_url', 'last_seen_at', 'responder_status', 'location_coords', 
            'cell', 'vehicle_reg', 'home_address', 'work_address', 'ice_no', 
            'medical_aid', 'medical_aid_policy_number', 'allergies', 
            'insurance_company', 'insurance_policy_number', 'insurance_type', 
            'insurance_contact', 'vehicles', 'psira_number'
        ];

        try {
            const { data: colsData } = await supabaseAdmin.from('profiles').select('*').limit(1);
            if (colsData && colsData.length > 0) {
                validColumns = Object.keys(colsData[0]);
            }
        } catch (e: any) {
            console.warn('Dynamic column detection failed, utilizing default columns list. Error:', e?.message || e);
        }

        // Filter dbPayload to include ONLY valid columns, discarding frontend state keys, objects, etc.
        const cleanedPayload: Record<string, any> = {};
        for (const key of Object.keys(dbPayload)) {
            if (validColumns.includes(key) && key !== 'id' && key !== 'userId' && key !== 'company') {
                cleanedPayload[key] = dbPayload[key];
            }
        }

        try {
            console.log(`Updating profile for ${userId} with filtered payload:`, cleanedPayload);
            
            // If there are no attributes to update, return 200 with current state
            if (Object.keys(cleanedPayload).length === 0) {
                const { data: currentProfile, error: getError } = await supabaseAdmin
                    .from('profiles')
                    .select('*, company:companies(*)')
                    .eq('id', userId)
                    .maybeSingle();
                if (getError) throw getError;
                if (!currentProfile) {
                    console.warn(`Profile not found for ${userId} during empty-update fetch.`);
                    return res.status(200).json({ message: 'Profile not found', id: userId });
                }
                return res.status(200).json(currentProfile);
            }

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update(cleanedPayload)
                .eq('id', userId);

            if (updateError) {
                console.error('Supabase update error:', updateError);
                throw updateError;
            }

            const { data, error } = await supabaseAdmin
                .from('profiles')
                .select('*, company:companies(*)')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('Supabase fetch after update error:', error);
                throw error;
            }

            if (!data) {
                console.warn(`Profile not found for ${userId} during update payload save.`);
                return res.status(200).json({ message: 'Profile not found to update', id: userId });
            }

            return res.status(200).json(data);
        } catch (error: any) {
            console.error('Caught error in update-profile:', error);
            
            // If this was just a presence update from App.tsx, swallow the error so it doesn't spam the console
            if (dbPayload.last_seen_at && Object.keys(dbPayload).length === 1) {
                return res.status(200).json({ success: false, message: 'Presence update failed, ignored to prevent spam' });
            }

            return res.status(400).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

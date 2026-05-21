import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, updates, ...rest } = req.body;
    
    // Flatten updates if provided, otherwise use rest of the body
    let dbPayload = updates ? { ...updates } : { ...rest };
    
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key_to_prevent_crash';

    if (!supabaseServiceKey) {
        return res.status(500).json({ 
            error: 'Configuration missing', 
            message: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' 
        });
    }

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);

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
                .select('*')
                .eq('id', userId)
                .single();
            if (getError) throw getError;
            return res.status(200).json(currentProfile);
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(cleanedPayload)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Supabase update error:', error);
            throw error;
        }
        return res.status(200).json(data);
    } catch (error: any) {
        console.error('Caught error in update-profile:', error);
        return res.status(400).json({ error: error.message });
    }
}

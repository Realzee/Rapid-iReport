import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

    if (req.method === 'GET') {
        const { table } = req.query;
        if (!['sites', 'guards', 'routes', 'supervisors', 'checkpoints', 'patrol_logs'].includes(table as string)) {
            return res.status(400).json({ error: 'Invalid table' });
        }
        const { data, error } = await supabaseAdmin.from(table as string).select('*');
        if (error) {
            console.error(`Error fetching table ${table}:`, error);
            if (error.code === '42P01') { // relation does not exist
                return res.status(200).json([]);
            }
            return res.status(500).json({ error: error.message });
        }
        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, table: targetTable, ...payload } = body;
        
        if (action === 'get-my-site') {
            const { profile_id } = payload;
            if (!profile_id) return res.status(400).json({ error: 'profile_id required' });

            // Diagnostic: Try to find any guard record to see what columns we have
            const { data: allGuards, error: guardsCheckError } = await supabaseAdmin.from('guards').select('*').limit(1);
            const guardCols = allGuards && allGuards.length > 0 ? Object.keys(allGuards[0]) : [];
            
            let guardData: any = null;
            if (!guardsCheckError) {
                if (guardCols.includes('profile_id')) {
                    const { data } = await supabaseAdmin
                        .from('guards')
                        .select('site_id, sites(name)')
                        .eq('profile_id', profile_id)
                        .maybeSingle();
                    guardData = data;
                } else if (guardCols.includes('id')) {
                     const { data } = await supabaseAdmin
                        .from('guards')
                        .select('site_id, sites(name)')
                        .eq('id', profile_id)
                        .maybeSingle();
                    guardData = data;
                }
            }
            
            if (guardData?.site_id) {
                return res.status(200).json({ 
                    site_id: guardData.site_id, 
                    site_name: (guardData as any).sites?.name || 'Assigned Site' 
                });
            }

            // Check supervisors
            const { data: allSups, error: supsCheckError } = await supabaseAdmin.from('supervisors').select('*').limit(1);
            const supCols = allSups && allSups.length > 0 ? Object.keys(allSups[0]) : [];

            let supData: any = null;
            if (!supsCheckError) {
                if (supCols.includes('profile_id')) {
                    const { data } = await supabaseAdmin
                        .from('supervisors')
                        .select('site_id, sites(name)')
                        .eq('profile_id', profile_id)
                        .maybeSingle();
                    supData = data;
                } else if (supCols.includes('id')) {
                    const { data } = await supabaseAdmin
                        .from('supervisors')
                        .select('site_id, sites(name)')
                        .eq('id', profile_id)
                        .maybeSingle();
                    supData = data;
                }
            }

            if (supData?.site_id) {
                return res.status(200).json({ 
                    site_id: supData.site_id, 
                    site_name: (supData as any).sites?.name || 'Assigned Site' 
                });
            }

            return res.status(200).json({ 
                site_id: null, 
                debug_cols: { guards: guardCols, sups: supCols },
                errors: { guards: guardsCheckError?.message, sups: supsCheckError?.message }
            });
        }
        
        let table = '';
        switch (action) {
            case 'add-site': table = 'sites'; break;
            case 'add-guard': table = 'guards'; break;
            case 'add-route': table = 'routes'; break;
            case 'add-supervisor': table = 'supervisors'; break;
            case 'add-checkpoint': table = 'checkpoints'; break;
            default: return res.status(400).json({ error: 'Invalid action' });
        }

        try {
            // Get columns for the target table to sanitize payload
            const { data: colsData, error: colsError } = await supabaseAdmin.from(table).select('*').limit(1);
            
            let sanitizedPayload: any = { ...payload };
            
            // Special handling for required but missing fields
            if (table === 'sites' && !sanitizedPayload.location) {
                sanitizedPayload.location = { lat: -26.2041, lng: 28.0473 }; // Default to Johannesburg coords
            }
            if (table === 'checkpoints' && !sanitizedPayload.location) {
                sanitizedPayload.location = { lat: -26.2041, lng: 28.0473 };
            }

            if (!colsError && colsData) {
                const validCols = colsData.length > 0 ? Object.keys(colsData[0]) : [];
                if (validCols.length > 0) {
                    const finalPayload: any = {};
                    Object.keys(sanitizedPayload).forEach(key => {
                        if (validCols.includes(key)) {
                            finalPayload[key] = sanitizedPayload[key];
                        }
                    });
                    const { data, error } = await supabaseAdmin.from(table).insert(finalPayload).select().single();
                    if (error) throw error;
                    return res.status(200).json(data);
                }
            }

            // Fallback to direct insert if column detection fails
            const { data, error } = await supabaseAdmin.from(table).insert(sanitizedPayload).select().single();
            if (error) throw error;
            return res.status(200).json(data);
        } catch (error: any) {
            console.error(`Error inserting into ${table}:`, error);
            return res.status(400).json({ error: error.message || 'Unknown error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

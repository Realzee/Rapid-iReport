import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

    if (req.method === 'GET') {
        const { table, company_id } = req.query;
        if (!['sites', 'guards', 'routes', 'supervisors', 'checkpoints', 'patrol_logs'].includes(table as string)) {
            return res.status(400).json({ error: 'Invalid table' });
        }
        let query = supabaseAdmin.from(table as string).select('*');
        if (company_id) {
            query = query.eq('company_id', company_id);
        }
        const { data, error } = await query;
        if (error) {
            console.error(`Error fetching table ${table}:`, error);
            if (error.code === '42P01') { // relation does not exist
                return res.status(200).json([]);
            }
            if (error.code === '42703' && company_id) { // column company_id does not exist
                // Fallback to query without filter if the column is missing (means schema repair needed)
                const { data: fallbackData, error: fallbackError } = await supabaseAdmin.from(table as string).select('*');
                if (!fallbackError) return res.status(200).json(fallbackData);
            }
            return res.status(500).json({ error: error.message });
        }
        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, table: targetTable, ...payload } = body;
        
        if (action === 'fix-schema') {
            const queries = [
                "ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS name text",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS contact_number text",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS profile_pic_url text",
                "ALTER TABLE public.supervisors ALTER COLUMN profile_id DROP NOT NULL",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS name text",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS contact_number text",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS psira_number text",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'off_duty'",
                "ALTER TABLE public.guards ALTER COLUMN profile_id DROP NOT NULL"
            ];
            const results = [];
            for (const q of queries) {
                const { error } = await supabaseAdmin.rpc('eval', { query: q });
                results.push({ query: q, success: !error, error: error?.message });
            }
            return res.status(200).json({ results });
        }

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
        
        if (action.startsWith('update-')) {
            let targetTbl = '';
            const entity = action.split('-')[1];
            if (entity === 'site') targetTbl = 'sites';
            else if (entity === 'guard') targetTbl = 'guards';
            else if (entity === 'route') targetTbl = 'routes';
            else if (entity === 'supervisor') targetTbl = 'supervisors';
            else if (entity === 'checkpoint') targetTbl = 'checkpoints';
            
            if (!targetTbl) return res.status(400).json({ error: `Invalid update action entity: ${entity}` });
            
            const { id, ...updateData } = payload;
            if (!id) return res.status(400).json({ error: 'ID is required for update' });

            const { data, error } = await supabaseAdmin.from(targetTbl).update(updateData).eq('id', id).select().single();
            if (error) return res.status(400).json({ error: error.message });
            return res.status(200).json(data);
        }

        if (action.startsWith('delete-')) {
            let targetTbl = '';
            const entity = action.split('-')[1];
            if (entity === 'site') targetTbl = 'sites';
            else if (entity === 'guard') targetTbl = 'guards';
            else if (entity === 'route') targetTbl = 'routes';
            else if (entity === 'supervisor') targetTbl = 'supervisors';
            else if (entity === 'checkpoint') targetTbl = 'checkpoints';
            
            if (!targetTbl) return res.status(400).json({ error: `Invalid delete action entity: ${entity}` });
            
            const { id } = payload;
            if (!id) return res.status(400).json({ error: 'ID is required for delete' });

            const { error } = await supabaseAdmin.from(targetTbl).delete().eq('id', id);
            if (error) return res.status(400).json({ error: error.message });
            return res.status(200).json({ success: true });
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
            // Check if we need to create a user account for guards/supervisors
            if ((action === 'add-guard' || action === 'add-supervisor') && payload.email && payload.password) {
                const { email, password, name, ...rest } = payload;
                
                // 1. Create Auth User
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true
                });

                if (authError) {
                    if (authError.message.includes('already registered')) {
                        // User exists, try to get their ID
                        const { data: userData } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
                        if (userData) {
                            payload.profile_id = userData.id;
                        }
                    } else {
                        throw authError;
                    }
                } else if (authData.user) {
                    // 2. Create Profile
                    const nameParts = name ? name.split(' ') : ['User'];
                    const firstName = nameParts[0];
                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                    
                    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
                        id: authData.user.id,
                        email,
                        first_name: firstName,
                        last_name: lastName,
                        role: action === 'add-guard' ? 'guard' : 'supervisor',
                        company_id: payload.company_id
                    });

                    if (profileError) {
                        console.error('Error creating profile:', profileError);
                        // We continue because the guard/supervisor record needs to be created, 
                        // even if the profile insertion fails (maybe it already exists)
                    }
                    
                    payload.profile_id = authData.user.id;
                }
                
                // Clean up payload so we don't try to insert email/password into guards/supervisors table
                delete payload.email;
                delete payload.password;
            }

            // Get columns for the target table to sanitize payload
            const { data: colsData, error: colsError } = await supabaseAdmin.from(table).select('*').limit(1);
            
            let sanitizedPayload: any = { ...payload };
            
            // Special handling for required but missing fields
            if (['sites', 'guards', 'supervisors', 'routes', 'checkpoints'].includes(table)) {
                if (table === 'sites' || table === 'checkpoints') {
                    if (!sanitizedPayload.location) {
                        sanitizedPayload.location = { lat: -26.2041, lng: 28.0473 }; // Default to Johannesburg coords
                    }
                }
                if (!sanitizedPayload.company_id) {
                    const { data: firstCompany } = await supabaseAdmin.from('companies').select('id').limit(1).single();
                    if (firstCompany) {
                        sanitizedPayload.company_id = firstCompany.id;
                    }
                }
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


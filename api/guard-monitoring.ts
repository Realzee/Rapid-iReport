import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = req.supabaseAdmin || createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key_to_prevent_crash'
    );


    if (req.method === 'GET') {
        const { table, company_id } = req.query;
        if (!['sites', 'guards', 'routes', 'supervisors', 'checkpoints', 'patrol_logs', 'gate_access_logs'].includes(table as string)) {
            return res.status(400).json({ error: 'Invalid table' });
        }
        let query = supabaseAdmin.from(table as string).select(table === 'gate_access_logs' ? '*, wanted_report:vehicle_reports(*)' : '*');
        if (company_id) {
            // Safe check for company_id column presence
            try {
                const { error: testError } = await supabaseAdmin.from(table as string).select('company_id').limit(1);
                if (!testError) {
                    query = query.eq('company_id', company_id);
                }
            } catch (e) {
                // Ignore errors during column check
            }
        }
        const { data, error } = await query;
        if (error) {
            console.error(`Error fetching table ${table}:`, error);
            // Fallback for schema cache issues: if explicitly filtering by company_id failed, try without it
            if (error.message.includes('schema cache') || error.code === '42703') {
                const { data: fallbackData, error: fallbackErr } = await supabaseAdmin.from(table as string).select('*');
                if (!fallbackErr) return res.status(200).json(fallbackData);
            }
            if (error.code === '42P01') { 
                return res.status(200).json([]);
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
                // 1. Ensure table exists with core columns at minimum
                "CREATE TABLE IF NOT EXISTS public.patrol_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now());",
                
                // 2. Ensure eval function exists - try to create it using DO block
                "DO $$ BEGIN EXECUTE 'CREATE OR REPLACE FUNCTION eval(query text) RETURNS void AS $func$ BEGIN EXECUTE query; END; $func$ LANGUAGE plpgsql SECURITY DEFINER;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;",
                
                // 3. Add columns one by one with IF NOT EXISTS logic
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS checkpoint_id uuid;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS guard_id uuid;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS site_id uuid;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS company_id uuid;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS location_coords jsonb;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS verification_status text;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS qr_code_scanned text;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS scanned_at timestamptz DEFAULT now();",

                // 3.5 Ensure report_updates exists and has correct foreign keys
                "CREATE TABLE IF NOT EXISTS public.report_updates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL, user_id uuid NOT NULL, content text NOT NULL, created_at timestamptz DEFAULT now());",
                "DO $$ BEGIN ALTER TABLE public.report_updates ADD CONSTRAINT report_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;",
                "ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;",
                "DROP POLICY IF EXISTS \"Enable all for authenticated on updates\" ON public.report_updates;",
                "CREATE POLICY \"Enable all for authenticated on updates\" ON public.report_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);",
                
                // 4. Reset nullability for safety
                "ALTER TABLE public.patrol_logs ALTER COLUMN checkpoint_id DROP NOT NULL;",
                "ALTER TABLE public.patrol_logs ALTER COLUMN guard_id DROP NOT NULL;",
                "ALTER TABLE public.patrol_logs ALTER COLUMN site_id DROP NOT NULL;",
                "ALTER TABLE public.patrol_logs ALTER COLUMN company_id DROP NOT NULL;",
                "ALTER TABLE public.patrol_logs ALTER COLUMN location_coords DROP NOT NULL;",
                
                // 5. Hard cast location_coords to jsonb if it was somehow text
                "DO $$ BEGIN ALTER TABLE public.patrol_logs ALTER COLUMN location_coords SET DATA TYPE jsonb USING location_coords::jsonb; EXCEPTION WHEN OTHERS THEN NULL; END $$;",
                
                // 6. Ensure RLS is enabled but permissive for now to debug
                "ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;",
                "DROP POLICY IF EXISTS \"Enable all for authenticated\" ON public.patrol_logs;",
                "CREATE POLICY \"Enable all for authenticated\" ON public.patrol_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);",
                
                // 7. Force PostgREST reload
                "NOTIFY pgrst, 'reload schema';",
                "SELECT pg_notify('pgrst', 'reload schema');"
            ];

            const results = [];
            for (const q of queries) {
                try {
                    // Try direct rpc if eval exists, or try to run as a DO block if it's a simple query
                    const { error } = await supabaseAdmin.rpc('eval', { query: q });
                    if (error) {
                        console.warn(`RPC eval failed for query: ${q}`, error);
                    }
                    results.push({ query: q, success: !error, error: error?.message });
                } catch (e: any) {
                    results.push({ query: q, success: false, error: e.message });
                }
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

            if (supData?.site_id || (supData?.site_ids && supData.site_ids.length > 0)) {
                const siteId = supData.site_id || supData.site_ids[0];
                return res.status(200).json({ 
                    site_id: siteId, 
                    site_name: (supData as any).sites?.name || 'Assigned Site',
                    site_ids: supData.site_ids || [supData.site_id]
                });
            }

            return res.status(200).json({ 
                site_id: null, 
                debug_cols: { guards: guardCols, sups: supCols },
                errors: { guards: guardsCheckError?.message, sups: supsCheckError?.message }
            });
        }
        
        if (action === 'debug-sites-table') {
            const { data, error } = await supabaseAdmin.from('sites').select('*').limit(1);
            return res.status(200).json({ cols: data && data.length > 0 ? Object.keys(data[0]) : [], error });
        }

        if (action === 'debug-report-updates') {
            const { data, error } = await supabaseAdmin.from('report_updates').select('*, profile:profiles(first_name, surname)').limit(1);
            return res.status(200).json({ data, error });
        }
        
        if (action === 'debug-patrol-logs-columns') {
            const { data, error } = await supabaseAdmin.rpc('eval', { 
                query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'patrol_logs';" 
            });
            return res.status(200).json({ info: data, error });
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
            
            if (targetTbl === 'supervisors') {
                if (!updateData.site_id && updateData.site_ids && updateData.site_ids.length > 0) {
                    updateData.site_id = updateData.site_ids[0];
                }
            }

                    // Profile Sync for Guards and Supervisors
                    if ((entity === 'guard' || entity === 'supervisor')) {
                        const { profile_id, name, contact_number, profile_pic_url, psira_number } = payload;
                        if (profile_id) {
                            const nameParts = name ? name.split(' ') : [];
                            const firstName = nameParts[0];
                            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                            
                            // Try to update with all possible columns, if it fails because of missing columns we catch it
                            try {
                                const profileUpdate: any = {
                                    cell: contact_number,
                                    avatar_url: profile_pic_url,
                                    psira_number: psira_number
                                };
                                if (firstName) profileUpdate.first_name = firstName;
                                if (lastName) profileUpdate.surname = lastName;
                                
                                const { error: updateErr } = await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', profile_id);
                                if (updateErr && updateErr.code === '42703') {
                                    // Fallback to simpler update if columns don't exist
                                    const fallbackUpdate: any = { name: name };
                                    await supabaseAdmin.from('profiles').update(fallbackUpdate).eq('id', profile_id);
                                }
                            } catch (e) {
                                console.error('Error updating profile during sync:', e);
                            }
                        }
                    }

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
            case 'add-patrol-log':
                try {
                    const { checkpoint_id, guard_id, site_id, company_id, location_coords, verification_status, qr_code_scanned } = payload;
                    let insertQuery = `INSERT INTO public.patrol_logs (`;
                    let valuesQuery = `VALUES (`;
                    const args: any[] = [];
                    let idx = 1;

                    // Building dynamic SQL query text to bypass PostgREST schema cache issues on newly created columns
                    const safeStr = (v: any) => v === null ? 'NULL' : typeof v === 'object' ? `'${JSON.stringify(v)}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;

                    const cols = [];
                    if (checkpoint_id !== undefined) cols.push(`checkpoint_id = ${safeStr(checkpoint_id)}`);
                    if (guard_id !== undefined) cols.push(`guard_id = ${safeStr(guard_id)}`);
                    if (site_id !== undefined) cols.push(`site_id = ${safeStr(site_id)}`);
                    if (company_id !== undefined) cols.push(`company_id = ${safeStr(company_id)}`);
                    if (location_coords !== undefined) cols.push(`location_coords = ${safeStr(location_coords)}`);
                    if (verification_status !== undefined) cols.push(`verification_status = ${safeStr(verification_status)}`);
                    if (qr_code_scanned !== undefined) cols.push(`qr_code_scanned = ${safeStr(qr_code_scanned)}`);

                    const queryCols = [];
                    const queryVals = [];
                    if (checkpoint_id !== undefined) { queryCols.push('checkpoint_id'); queryVals.push(safeStr(checkpoint_id)); }
                    if (guard_id !== undefined) { queryCols.push('guard_id'); queryVals.push(safeStr(guard_id)); }
                    if (site_id !== undefined) { queryCols.push('site_id'); queryVals.push(safeStr(site_id)); }
                    if (company_id !== undefined) { queryCols.push('company_id'); queryVals.push(safeStr(company_id)); }
                    if (location_coords !== undefined) { queryCols.push('location_coords'); queryVals.push(safeStr(location_coords)); }
                    if (verification_status !== undefined) { queryCols.push('verification_status'); queryVals.push(safeStr(verification_status)); }
                    if (qr_code_scanned !== undefined) { queryCols.push('qr_code_scanned'); queryVals.push(safeStr(qr_code_scanned)); }

                    if (queryCols.length === 0) {
                        return res.status(400).json({ error: 'No data to insert' });
                    }

                    const rawQuery = `INSERT INTO public.patrol_logs (${queryCols.join(', ')}) VALUES (${queryVals.join(', ')})`;
                    const { error: evalErr } = await supabaseAdmin.rpc('eval', { query: rawQuery });
                    if (evalErr) {
                         // fallback to typical insert if RPC fails
                         const { data, error } = await supabaseAdmin.from('patrol_logs').insert(payload).select().single();
                         if (error) throw error;
                         return res.status(200).json(data);
                    }
                    return res.status(200).json({ success: true, method: 'rpc' });
                } catch (err: any) {
                    return res.status(500).json({ error: err.message });
                }

            case 'add-site': table = 'sites'; break;
            case 'add-guard': table = 'guards'; break;
            case 'add-route': table = 'routes'; break;
            case 'add-supervisor': table = 'supervisors'; break;
            case 'add-checkpoint': table = 'checkpoints'; break;
            default: return res.status(400).json({ error: 'Invalid action' });
        }

        try {
            console.log(`Processing action: ${action}, table: ${table}`);
            
            // Check if we need to create a user account for guards/supervisors
            if ((action === 'add-guard' || action === 'add-supervisor') && payload.email && payload.password) {
                console.log('Creating auth user...');
                const { email, password, name, ...rest } = payload;
                
                // 1. Create Auth User
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true
                });

                if (authError) {
                    console.log('Auth user creation error:', authError);
                    if (authError.message.includes('already registered') || authError.status === 422) {
                        // User exists, try to get their ID
                        const { data: userData } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
                        if (userData) {
                            payload.profile_id = userData.id;
                            // Optionally update profile to match the required role and company
                            await supabaseAdmin.from('profiles').update({ 
                                role: action === 'add-guard' ? 'guard' : 'supervisor',
                                company_id: payload.company_id 
                            }).eq('id', userData.id);
                        } else {
                            // User exists in Auth but not in Profiles? This is rare but possible.
                            // We don't have the ID easily here without searching Auth which is restricted.
                            // Let's try to find them in Auth via listUsers if allowed, or just error.
                            return res.status(400).json({ error: 'User exists in authentication but has no profile record. Please link manually or check with admin.' });
                        }
                    } else {
                        throw authError;
                    }
                } else if (authData.user) {
                    console.log('Auth user created:', authData.user.id);
                    // 2. Create Profile
                    const nameParts = name ? name.split(' ') : ['User'];
                    const firstName = nameParts[0];
                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                    
                    const profileData: any = {
                        id: authData.user.id,
                        email,
                        role: action === 'add-guard' ? 'guard' : 'supervisor',
                        status: 'active',
                        avatar_url: payload.profile_pic_url,
                        cell: payload.contact_number,
                        company_id: payload.company_id,
                        psira_number: payload.psira_number
                    };

                    try {
                        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
                            ...profileData,
                            first_name: firstName,
                            surname: lastName
                        });

                        if (profileError && profileError.code === '42703') {
                            // Fallback if schema is old
                            await supabaseAdmin.from('profiles').upsert({
                                id: authData.user.id,
                                email,
                                name: name,
                                role: profileData.role,
                                status: 'active',
                                company_id: profileData.company_id
                            });
                        }
                    } catch (e) {
                         console.error('Exception creating profile:', e);
                    }
                    
                    payload.profile_id = authData.user.id;
                }
                
                // Clean up payload so we don't try to insert email/password into guards/supervisors table
                delete payload.email;
                delete payload.password;
            }

            let sanitizedPayload: any = { ...payload };
            
            // Special handling for required but missing fields
            if (['sites', 'guards', 'supervisors', 'routes', 'checkpoints'].includes(table || '')) {
                if (table === 'sites' || table === 'checkpoints') {
                    if (!sanitizedPayload.location) {
                        sanitizedPayload.location = { lat: -26.2041, lng: 28.0473 }; // Default to Johannesburg coords
                    }
                }
                if (table === 'supervisors') {
                    if (!sanitizedPayload.site_id && sanitizedPayload.site_ids && sanitizedPayload.site_ids.length > 0) {
                        sanitizedPayload.site_id = sanitizedPayload.site_ids[0];
                    }
                }
                if (!sanitizedPayload.company_id && (sanitizedPayload.company_id !== null || sanitizedPayload.company_id !== undefined)) {
                    const { data: firstCompany } = await supabaseAdmin.from('companies').select('id').limit(1).single();
                    if (firstCompany) {
                        sanitizedPayload.company_id = firstCompany.id;
                    }
                }
            }

            console.log('Inserting into table:', table, 'payload:', sanitizedPayload);
            // Direct insert is safer than trying to detect columns from potentially empty tables
            const { data, error } = await supabaseAdmin.from(table).insert(sanitizedPayload).select().single();
            
            if (error) {
                console.log('Insert error:', error);
                // If it fails because of extra columns, try to detect what's valid
                if (error.code === '42703') {
                    const { data: colsData } = await supabaseAdmin.from(table).select('*').limit(1);
                    if (colsData && colsData.length > 0) {
                        const validCols = Object.keys(colsData[0]);
                        const finalPayload: any = {};
                        Object.keys(sanitizedPayload).forEach(key => {
                            if (validCols.includes(key)) finalPayload[key] = sanitizedPayload[key];
                        });
                        const { data: retryData, error: retryError } = await supabaseAdmin.from(table).insert(finalPayload).select().single();
                        if (!retryError) return res.status(200).json(retryData);
                        throw retryError;
                    }
                }
                throw error;
            }
            
            console.log('Insert success:', data);
            return res.status(200).json(data);
        } catch (error: any) {
            console.error(`Error inserting into ${table}:`, error);
            return res.status(500).json({ 
                error: error.message || 'Unknown error',
                details: error.stack,
                table: table,
                payloadKeys: Object.keys(payload || {})
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}


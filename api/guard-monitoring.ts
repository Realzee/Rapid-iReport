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
                // Ensure eval function exists
                "CREATE OR REPLACE FUNCTION eval(query text) RETURNS void AS $$ BEGIN EXECUTE query; END; $$ LANGUAGE plpgsql SECURITY DEFINER;",
                "CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid) RETURNS text AS $body$ BEGIN RETURN (SELECT role FROM public.profiles WHERE id = p_user_id); END; $body$ LANGUAGE plpgsql SECURITY DEFINER;",
                "ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE",
                "ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS qr_code text",
                "ALTER TABLE public.checkpoints ALTER COLUMN route_id DROP NOT NULL",
                "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL",
                "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text",
                "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS surname text",
                "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cell text",
                "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text",
                "ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'guard'",
                "ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'supervisor'",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS site_ids uuid[]",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS name text",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS contact_number text",
                "ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS profile_pic_url text",
                "ALTER TABLE public.supervisors ALTER COLUMN profile_id DROP NOT NULL",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS name text",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS contact_number text",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS psira_number text",
                "ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'off_duty'",
                "ALTER TABLE public.guards ALTER COLUMN profile_id DROP NOT NULL",
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone.') THEN CREATE POLICY \"Public profiles are viewable by everyone.\" ON public.profiles FOR SELECT USING (true); END IF; END $$;",
                "ALTER TABLE public.guards ENABLE ROW LEVEL SECURITY",
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guards' AND policyname = 'Admins can do everything on guards') THEN CREATE POLICY \"Admins can do everything on guards\" ON public.guards FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')); END IF; END $$;",
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guards' AND policyname = 'Guards can update own status and contact') THEN CREATE POLICY \"Guards can update own status and contact\" ON public.guards FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid()); END IF; END $$;",
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guards' AND policyname = 'Guards can view own record') THEN CREATE POLICY \"Guards can view own record\" ON public.guards FOR SELECT TO authenticated USING (profile_id = auth.uid() OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin' OR role = 'moderator')); END IF; END $$;",
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sites' AND policyname = 'Guards can only see their assigned site') THEN CREATE POLICY \"Guards can only see their assigned site\" ON public.sites FOR SELECT TO authenticated USING (auth.uid() IN (SELECT profile_id FROM public.guards WHERE site_id = public.sites.id) OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'moderator', 'controller'))); END IF; END $$;",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS qr_code_scanned text",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS verification_status text",
                "ALTER TABLE public.patrol_logs ADD COLUMN IF NOT EXISTS location_coords jsonb",
                "ALTER TABLE public.patrol_logs ALTER COLUMN guard_id DROP NOT NULL",
                "ALTER TABLE public.patrol_logs ALTER COLUMN site_id DROP NOT NULL",
                "ALTER TABLE public.patrol_logs ALTER COLUMN checkpoint_id DROP NOT NULL",
                "ALTER TABLE public.patrol_logs ALTER COLUMN location_coords DROP NOT NULL",
                "DO $$ BEGIN ALTER TABLE public.patrol_logs DROP CONSTRAINT IF EXISTS patrol_logs_guard_id_fkey; END $$;",
                "DO $$ BEGIN ALTER TABLE public.patrol_logs DROP CONSTRAINT IF EXISTS patrol_logs_site_id_fkey; END $$;",
                "DO $$ BEGIN ALTER TABLE public.patrol_logs DROP CONSTRAINT IF EXISTS patrol_logs_checkpoint_id_fkey; END $$;",
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_logs' AND policyname = 'Enable read access for authenticated users') THEN CREATE POLICY \"Enable read access for authenticated users\" ON public.patrol_logs FOR SELECT TO authenticated USING (true); END IF; END $$;",
                "DROP POLICY IF EXISTS \"Enable insert access for authenticated users\" ON public.patrol_logs",
                "CREATE POLICY \"Enable insert access for authenticated users\" ON public.patrol_logs FOR INSERT TO authenticated WITH CHECK (true)",
                "DROP POLICY IF EXISTS \"Enable insert for authenticated\" ON public.patrol_logs",
                "CREATE POLICY \"Enable insert for authenticated\" ON public.patrol_logs FOR INSERT TO authenticated WITH CHECK (true)",
                "NOTIFY pgrst, 'reload schema';"
            ];

            const results = [];
            for (const q of queries) {
                try {
                    const { error } = await supabaseAdmin.rpc('eval', { query: q });
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
            if (['sites', 'guards', 'supervisors', 'routes', 'checkpoints'].includes(table)) {
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
                if (!sanitizedPayload.company_id && sanitizedPayload.company_id !== null) {
                    const { data: firstCompany } = await supabaseAdmin.from('companies').select('id').limit(1).single();
                    if (firstCompany) {
                        sanitizedPayload.company_id = firstCompany.id;
                    }
                }
            }

            // Direct insert is safer than trying to detect columns from potentially empty tables
            const { data, error } = await supabaseAdmin.from(table).insert(sanitizedPayload).select().single();
            
            if (error) {
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
            
            return res.status(200).json(data);
        } catch (error: any) {
            console.error(`Error inserting into ${table}:`, error);
            return res.status(400).json({ error: error.message || 'Unknown error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}


import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
    const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
    
    let supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseServiceKey || supabaseServiceKey.length < 50 || supabaseServiceKey.includes('dummy') || supabaseServiceKey === 'undefined' || supabaseServiceKey === 'null') {
        supabaseServiceKey = SERVICE_ROLE_KEY_VAL;
    }

    const supabaseAdmin = req.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);

    if (!supabaseAdmin) {
        return res.status(500).json({
            status: 'invalid',
            error: "Supabase client not initialized on the server."
        });
    }

    const isQuotaError = (err: any): boolean => {
        if (!err) return false;
        const msg = (typeof err === 'string' ? err : (err.message || '')).toLowerCase();
        return msg.includes('exceed_egress_quota') ||
               msg.includes('quota') ||
               msg.includes('restricted') ||
               msg.includes('spend caps') ||
               msg.includes('service for this project is restricted');
    };

    try {
        // Check 1: Basic table access (profiles)
        const { error: profileError } = await supabaseAdmin.from('profiles').select('id').limit(1);
        if (profileError) {
            if (isQuotaError(profileError)) {
                console.warn("Database check server handler detected quota restriction. Bypassing schema error screen.", profileError.message);
                return res.status(200).json({ status: 'valid', warning: 'Database quota limit encountered.' });
            }
            console.error("Database schema check failed on 'profiles' table on server:", profileError);
            return res.status(200).json({
                status: 'invalid',
                error: `The database check failed on server, indicating a missing table or incorrect Row Level Security (RLS) policies. Error: ${profileError.message}`
            });
        }

        // Check 2: Advanced Enum validation using RPC
        let { data: enumValues, error: rpcError } = await supabaseAdmin.rpc('get_enum_values', { enum_type_name: 'report_status' });
        let enumTypeName = 'report_status';

        // Try legacy enum name if modern doesn't exist
        if (!rpcError && (!enumValues || enumValues.length === 0)) {
            const { data: legacyEnumValues, error: legacyRpcError } = await supabaseAdmin.rpc('get_enum_values', { enum_type_name: 'report_status_enum' });
            if (!legacyRpcError && legacyEnumValues && legacyEnumValues.length > 0) {
                enumValues = legacyEnumValues;
                enumTypeName = 'report_status_enum';
            }
        }

        if (rpcError) {
            if (isQuotaError(rpcError)) {
                return res.status(200).json({ status: 'valid', warning: 'Database quota limit encountered.' });
            }
            if (rpcError.code === '42883') { // "function does not exist"
                 console.error("Database schema check failed: 'get_enum_values' function missing on server.", rpcError);
                 return res.status(200).json({
                    status: 'invalid',
                    error: "Database Schema Outdated: The helper function 'get_enum_values' is missing on server. This indicates an old database schema."
                 });
            }
            console.error("Database schema check failed on RPC 'get_enum_values' on server:", rpcError);
            return res.status(200).json({
                status: 'invalid',
                error: `An error occurred on server while checking enum types: ${rpcError.message}`
            });
        }

        if (!enumValues || !Array.isArray(enumValues) || enumValues.length === 0) {
            return res.status(200).json({
                status: 'invalid',
                error: "Database Schema Malformed: Could not find 'report_status' or 'report_status_enum' type on server."
            });
        }

        // Check if 'deleted' is in the list
        if (!enumValues.includes('deleted')) {
            return res.status(200).json({
                status: 'invalid',
                error: `Database Schema Mismatch: The application requires 'deleted' value in '${enumTypeName}' enum, but it is missing on server.`
            });
        }

        // Check 3: Verify critical functions exist using eval
        try {
            const { error: funcError } = await supabaseAdmin.rpc('eval', { 
                query: "DO $$ BEGIN PERFORM 'public.create_staff_notification(text, text, text, uuid, text[], uuid)'::regprocedure; END $$;" 
            });
            
            if (funcError) {
                console.warn("Schema check failed on server eval:", funcError);
                if (funcError.message.includes("does not exist") || funcError.code === '42883' || funcError.code === 'PGRST202' || funcError.message.includes("Could not find the function")) {
                     return res.status(200).json({
                        status: 'invalid',
                        error: "Database Schema Incomplete: The critical function 'create_staff_notification' (or the helper 'eval') is missing on server."
                    });
                }
                return res.status(200).json({
                    status: 'invalid',
                    error: `Database Schema Check Failed: The 'eval' function returned error on server (${funcError.message || funcError.code}).`
                });
            }
        } catch (e: any) {
            console.warn("Function verification failed with exception on server:", e);
            return res.status(200).json({
                status: 'invalid',
                error: `Database Schema Check Failed: Unexpected exception on server (${e.message}).`
            });
        }

        return res.status(200).json({ status: 'valid' });
    } catch (e: any) {
        console.error("Server-side DB check exception:", e);
        return res.status(500).json({
            status: 'invalid',
            error: `Server-side database check error: ${e.message}`
        });
    }
}

import { supabase } from './supabase';

interface SchemaCheckResult {
    status: 'valid' | 'invalid';
    error?: string;
}

export const checkDatabaseSchema = async (): Promise<SchemaCheckResult> => {
    if (typeof window !== 'undefined' && localStorage.getItem('rapid911_sandbox_mode') === 'true') {
        return { status: 'valid' };
    }

    const isNetworkOrQuotaError = (err: any): boolean => {
        if (!err) return false;
        const msg = (typeof err === 'string' ? err : (err.message || '')).toLowerCase();
        return msg.includes('failed to fetch') || 
               msg.includes('networkerror') || 
               msg.includes('cors') ||
               msg.includes('load failed') ||
               msg.includes('network connection') ||
               msg.includes('failed to connect') ||
               msg.includes('typeerror') ||
               msg.includes('exceed_egress_quota') ||
               msg.includes('quota') ||
               msg.includes('restricted') ||
               msg.includes('spend caps') ||
               msg.includes('service for this project is restricted');
    };

    // Try server-side schema check first to bypass client-side CORS or ad-blocker network issues
    try {
        const cached = localStorage.getItem('schema_check_valid');
        if (cached === 'true') {
            return { status: 'valid' };
        }
        const response = await fetch('/api/check-db');
        if (response.ok) {
            const serverResult = await response.json();
            if (serverResult && (serverResult.status === 'valid' || serverResult.status === 'invalid')) {
                console.log("Database schema check via server-side API:", serverResult);
                if (serverResult.status === 'valid') {
                    localStorage.setItem('schema_check_valid', 'true');
                }
                return serverResult;
            }
        }
    } catch (apiError) {
        console.warn("Server-side schema check API unreachable, falling back to client-side checks:", apiError);
    }

    if (!supabase) {
        return {
            status: 'invalid',
            error: "Supabase client not initialized. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables."
        };
    }
    try {
        // Check 1: Basic table access (catches RLS issues or missing tables)
        const { error: profileError } = await supabase.from('profiles').select('id').limit(1);
        if (profileError) {
            if (isNetworkOrQuotaError(profileError)) {
                console.warn("Database schema check encountered a network or quota issue. Skipping check.", profileError);
                return { status: 'valid' };
            }
            console.error("Database schema check failed on 'profiles' table:", profileError);
            return {
                status: 'invalid',
                error: `The database check failed, indicating a missing table or incorrect Row Level Security (RLS) policies. Please run the full setup script from DATABASE_SCHEMA.md. Error: ${profileError.message}`
            };
        }
        
        // Check 2: Advanced Enum validation using RPC.
        // This is more robust as it doesn't rely on table RLS policies.
        // It also checks for legacy enum names to provide a more accurate error.
        let { data: enumValues, error: rpcError } = await supabase.rpc('get_enum_values', { enum_type_name: 'report_status' });

        let enumTypeName = 'report_status';

        // If the modern enum name doesn't exist or is empty, try the legacy one.
        if (!rpcError && (!enumValues || enumValues.length === 0)) {
            const { data: legacyEnumValues, error: legacyRpcError } = await supabase.rpc('get_enum_values', { enum_type_name: 'report_status_enum' });
            if (!legacyRpcError && legacyEnumValues && legacyEnumValues.length > 0) {
                enumValues = legacyEnumValues;
                enumTypeName = 'report_status_enum';
            }
        }
        
        if (rpcError) {
            if (isNetworkOrQuotaError(rpcError)) {
                console.warn("Database schema check encountered a network or quota issue during RPC. Skipping check.", rpcError);
                return { status: 'valid' };
            }
            // If the function doesn't exist, it's a schema issue.
            if (rpcError.code === '42883') { // "function does not exist"
                 console.error("Database schema check failed: 'get_enum_values' function missing.", rpcError);
                 return {
                    status: 'invalid',
                    error: `Database Schema Outdated: The helper function 'get_enum_values' is missing. This indicates an old database schema. Please run the full setup script from DATABASE_SCHEMA.md.`
                 };
            }
            // For other errors, we can be strict.
            console.error("Database schema check failed on RPC 'get_enum_values':", rpcError);
             return {
                status: 'invalid',
                error: `An error occurred while checking enum types: ${rpcError.message}`
            };
        }

        if (!enumValues || !Array.isArray(enumValues) || enumValues.length === 0) {
            return {
                status: 'invalid',
                error: `Database Schema Malformed: Could not find the 'report_status' or 'report_status_enum' type. Please ensure your database is set up correctly.`
            };
        }

        // Now check if 'deleted' is in the list of values.
        if (!enumValues.includes('deleted')) {
            const errorMsg = `Database Schema Mismatch: The application requires the 'deleted' value in the '${enumTypeName}' enum, but it is missing. This usually means the database was set up with an older script. Administrators should use the "Attempt Automatic Fix" button or run the scripts in DATABASE_SCHEMA.md to resolve this.`;
            return {
                status: 'invalid',
                error: errorMsg,
            };
        }

        // Check 3: Verify critical functions exist using eval (if available)
        // We use regprocedure with specific arguments to avoid "more than one function named" errors if overloads exist.
        try {
            const { error: funcError } = await supabase.rpc('eval', { 
                query: "DO $$ BEGIN PERFORM 'public.create_staff_notification(text, text, text, uuid, text[], uuid)'::regprocedure; END $$;" 
            });
            
            if (funcError) {
                if (isNetworkOrQuotaError(funcError)) {
                    console.warn("Database schema check encountered a network or quota issue during eval. Skipping check.", funcError);
                    return { status: 'valid' };
                }
                console.warn("Schema check failed on eval:", funcError);
                // If the error is about the function not existing OR if eval itself is missing (404/400)
                if (funcError.message.includes("does not exist") || funcError.code === '42883' || funcError.code === 'PGRST202' || funcError.message.includes("Could not find the function")) {
                     return {
                        status: 'invalid',
                        error: `Database Schema Incomplete: The critical function 'create_staff_notification' (or the helper 'eval') is missing. Please run the full setup script from DATABASE_SCHEMA.md.`
                     };
                }
                // For other errors (like 400 Bad Request which might mean eval is missing or invalid), treat as schema issue
                return {
                    status: 'invalid',
                    error: `Database Schema Check Failed: The 'eval' function returned an error (${funcError.message || funcError.code}). This usually means the database schema is outdated. Please run the setup script.`
                };
            }
        } catch (e: any) {
            if (isNetworkOrQuotaError(e)) {
                console.warn("Database schema check encountered an exception during eval. Skipping check.", e);
                return { status: 'valid' };
            }
            console.warn("Function verification failed with exception:", e);
             return {
                status: 'invalid',
                error: `Database Schema Check Failed: An unexpected error occurred (${e.message}). Please ensure your database is set up correctly.`
            };
        }

        return { status: 'valid' };

    } catch (e: any) {
        if (isNetworkOrQuotaError(e)) {
            console.warn("A network or quota error occurred during the database check. Bypassing schema error screen.", e);
            return { status: 'valid' };
        }
        console.error("A JavaScript error occurred during the database check:", e);
        return {
            status: 'invalid',
            error: `An unexpected application error occurred while trying to verify the database schema: ${e.message}`
        };
    }
};

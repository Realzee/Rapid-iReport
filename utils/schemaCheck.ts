import { supabase } from './supabase';

interface SchemaCheckResult {
    status: 'valid' | 'invalid';
    error?: string;
}

export const checkDatabaseSchema = async (): Promise<SchemaCheckResult> => {
    try {
        // Check 1: Basic table access (catches RLS issues or missing tables)
        const { error: profileError } = await supabase.from('profiles').select('id').limit(1);
        if (profileError) {
            console.error("Database schema check failed on 'profiles' table:", profileError);
            return {
                status: 'invalid',
                error: `The database check failed, indicating a missing table or incorrect Row Level Security (RLS) policies. Please run the full setup script from DATABASE_SCHEMA.md. Error: ${profileError.message}`
            };
        }
        
        // Check 2: Advanced Enum validation using RPC.
        // This is more robust as it doesn't rely on table RLS policies.
        const { data: enumValues, error: rpcError } = await supabase.rpc('get_enum_values', { enum_type_name: 'report_status' });

        if (rpcError) {
            // If the function doesn't exist, it's a schema issue.
            if (rpcError.code === '42883') { // "function does not exist"
                 console.error("Database schema check failed: 'get_enum_values' function missing.", rpcError);
                 return {
                    status: 'invalid',
                    error: `Database Schema Outdated: The helper function 'get_enum_values' is missing. This indicates an old database schema. Please run the full setup script from DATABASE_SCHEMA.md.`
                 };
            }
            // For other errors, we can be lenient or log them. For now, we will be strict.
            console.error("Database schema check failed on RPC 'get_enum_values':", rpcError);
             return {
                status: 'invalid',
                error: `An error occurred while checking enum types: ${rpcError.message}`
            };
        }

        if (!enumValues || !Array.isArray(enumValues)) {
            return {
                status: 'invalid',
                error: `Database Schema Malformed: The function 'get_enum_values' returned an unexpected result.`
            };
        }

        // Now check if 'deleted' is in the list of values.
        if (!enumValues.includes('deleted')) {
            return {
                status: 'invalid',
                error: `Database Schema Mismatch: The application requires a database feature (enum value: 'deleted' for 'report_status') that is missing. This usually means the database was set up with an older script. Administrators can use the "Attempt Automatic Fix" button to resolve this.`
            };
        }

        return { status: 'valid' };

    } catch (e: any) {
        console.error("A JavaScript error occurred during the database check:", e);
        return {
            status: 'invalid',
            error: `An unexpected application error occurred while trying to verify the database schema: ${e.message}`
        };
    }
};

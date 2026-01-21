import { supabase } from './supabase';
import { ReportStatus } from '../types';

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
        
        // Check 2: Advanced Enum validation via canary query.
        // This is more reliable than RPC as it uses the same PostgREST layer as the main app,
        // catching issues like stale schema caches.
        const { error: canaryError } = await supabase
            .from('vehicle_reports')
            .select('id')
            .eq('status', ReportStatus.DELETED) // This filter forces PostgREST to validate the 'deleted' enum value.
            .limit(0); // We don't need any data, just the query validation.

        if (canaryError && canaryError.code === '22P02' && canaryError.message.includes('enum')) {
            console.error("Database schema check failed on canary query:", canaryError);
            return {
                status: 'invalid',
                error: `Your application is out of sync with the database API. This is a common issue caused by a stale API cache after a database update. The specific error is: "${canaryError.message}". Please use the "Attempt Automatic Fix" button on the error screen. This is the fastest way to resolve this.`
            };
        }
        // We deliberately ignore other errors (like RLS blocking access) because those aren't fatal schema validation failures.
        // The goal here is to specifically catch the '22P02' enum error that breaks the app's data fetching.

        return { status: 'valid' };

    } catch (e: any) {
        console.error("A JavaScript error occurred during the database check:", e);
        return {
            status: 'invalid',
            error: `An unexpected application error occurred while trying to verify the database schema: ${e.message}`
        };
    }
};
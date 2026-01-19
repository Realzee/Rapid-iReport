
import { supabase } from './supabase';
import { ReportStatus, UserRole, UserStatus, Severity, ResponderStatus, RequestStatus } from '../types';

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
                error: `The database check failed, indicating a missing table or incorrect Row Level Security (RLS) policies. Please run the full setup script. Error: ${profileError.message}`
            };
        }

        // Check 2: Advanced Enum validation (catches the specific "invalid input for enum" error)
        const enumsToValidate = [
            { name: 'report_status', frontend: Object.values(ReportStatus) },
            { name: 'user_role', frontend: Object.values(UserRole) },
            { name: 'user_status', frontend: Object.values(UserStatus) },
            { name: 'severity', frontend: Object.values(Severity) },
            { name: 'responder_status', frontend: Object.values(ResponderStatus) },
            { name: 'request_status', frontend: Object.values(RequestStatus) },
        ];

        for (const enumInfo of enumsToValidate) {
            const { data: dbValues, error: rpcError } = await supabase.rpc('get_enum_values', { enum_type_name: enumInfo.name });

            if (rpcError) {
                console.error(`Database schema check failed on 'get_enum_values' RPC for enum '${enumInfo.name}':`, rpcError);
                return {
                    status: 'invalid',
                    error: `The check for database type '${enumInfo.name}' failed. This usually means the 'get_enum_values' function is missing from your database. Please run the setup script from DATABASE_SETUP.md. Error: ${rpcError.message}`
                };
            }

            if (dbValues) {
                const missingValues = enumInfo.frontend.filter(feValue => !dbValues.includes(feValue));
                if (missingValues.length > 0) {
                    console.error(`Database enum mismatch for '${enumInfo.name}'. Missing values:`, missingValues);
                    return {
                        status: 'invalid',
                        error: `The database type '${enumInfo.name}' is out of sync with the application code. It's missing the value(s): [${missingValues.join(', ')}]. Please run the setup script to fix this.`
                    };
                }
            }
        }

        // If all checks pass
        return { status: 'valid' };

    } catch (e: any) {
        console.error("A JavaScript error occurred during the database check:", e);
        return {
            status: 'invalid',
            error: `An unexpected application error occurred while trying to verify the database schema: ${e.message}`
        };
    }
};

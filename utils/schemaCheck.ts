import { supabase } from './supabase';
import { ReportStatus, UserRole, UserStatus, Severity, ResponderStatus } from '../types';

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
        
        const { error: chatMessagesError } = await supabase.from('chat_messages').select('id').limit(1);
        if (chatMessagesError) {
            console.error("Database schema check failed on 'chat_messages' table:", chatMessagesError);
            return {
                status: 'invalid',
                error: `The database check failed on the 'chat_messages' table, indicating a missing table or incorrect Row Level Security (RLS) policies. Please run the full setup script. Error: ${chatMessagesError.message}`
            };
        }

        // Check 2: Advanced Enum validation
        const enumsToValidate = [
            { name: 'report_status', frontend: Object.values(ReportStatus) },
            { name: 'user_role', frontend: Object.values(UserRole) },
            { name: 'user_status', frontend: Object.values(UserStatus) },
            { name: 'severity', frontend: Object.values(Severity) },
            { name: 'responder_status', frontend: Object.values(ResponderStatus) },
        ];
        
        for (const enumInfo of enumsToValidate) {
            // Try the correct name first (e.g., 'report_status')
            let { data: dbValues, error: rpcError } = await supabase.rpc('get_enum_values', { enum_type_name: enumInfo.name });
            
            let checkedTypeName = enumInfo.name;

            // If not found, try the legacy name (e.g., 'report_status_enum')
            if (!dbValues || dbValues.length === 0) {
                const legacyName = `${enumInfo.name}_enum`;
                const { data: legacyDbValues } = await supabase.rpc('get_enum_values', { enum_type_name: legacyName });
                
                if (legacyDbValues && legacyDbValues.length > 0) {
                    dbValues = legacyDbValues;
                    checkedTypeName = legacyName;
                    console.warn(`Legacy enum type '${legacyName}' detected. The database schema should be updated.`);
                } else if (rpcError) {
                    // If the first attempt had a network/RPC error and the legacy check also failed, report the original error.
                    console.error(`Database schema check failed on 'get_enum_values' RPC for enum '${enumInfo.name}':`, rpcError);
                    return {
                        status: 'invalid',
                        error: `The check for database type '${enumInfo.name}' failed. This usually means the 'get_enum_values' function is missing from your database. Please run the setup script from DATABASE_SCHEMA.md. Error: ${rpcError.message}`
                    };
                }
            }

            // After trying both, if we still have no values, the enum type is missing.
            if (!dbValues || dbValues.length === 0) {
                 console.error(`Database enum '${enumInfo.name}' (or legacy '${enumInfo.name}_enum') not found or is empty.`);
                 return {
                    status: 'invalid',
                    error: `The database type (enum) '${enumInfo.name}' could not be found. This indicates an incomplete database schema. Please run the setup scripts from DATABASE_SCHEMA.md.`
                };
            }
            
            // Now validate the values of the found enum type.
            const missingValues = enumInfo.frontend.filter(feValue => !dbValues.includes(feValue));
            if (missingValues.length > 0) {
                console.error(`Database enum mismatch for '${checkedTypeName}'. Missing values:`, missingValues);
                const errorMessage = checkedTypeName.endsWith('_enum')
                    ? `Your database is using a legacy type name ('${checkedTypeName}') and is missing the value(s): [${missingValues.join(', ')}]. Please run the latest setup script from DATABASE_SCHEMA.md to migrate and fix this.`
                    : `The database type '${checkedTypeName}' is out of sync with the application code. It's missing the value(s): [${missingValues.join(', ')}]. Please run the setup script to fix this.`;
                
                return {
                    status: 'invalid',
                    error: errorMessage
                };
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
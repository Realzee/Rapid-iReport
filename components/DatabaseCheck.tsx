
import React, { useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { ReportStatus, UserRole, UserStatus, Severity, ResponderStatus, RequestStatus } from '../types';

interface DatabaseCheckProps {
    onCheckComplete: (status: 'valid' | 'invalid', error?: string) => void;
}

const DatabaseCheck: React.FC<DatabaseCheckProps> = ({ onCheckComplete }) => {
    useEffect(() => {
        const checkDatabaseSchema = async () => {
            try {
                // Check 1: Basic table access (catches RLS issues or missing tables)
                const { error: profileError } = await supabase.from('profiles').select('id').limit(1);
                if (profileError) {
                    console.error("Database schema check failed on 'profiles' table:", profileError);
                    onCheckComplete('invalid', `The database check failed, indicating a missing table or incorrect Row Level Security (RLS) policies. Please run the full setup script. Error: ${profileError.message}`);
                    return;
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
                        onCheckComplete('invalid', `The check for database type '${enumInfo.name}' failed. This usually means the 'get_enum_values' function is missing from your database. Please run the setup script from DATABASE_SETUP.md. Error: ${rpcError.message}`);
                        return; // Stop on first error
                    }

                    if (dbValues) {
                        const missingValues = enumInfo.frontend.filter(feValue => !dbValues.includes(feValue));
                        if (missingValues.length > 0) {
                            console.error(`Database enum mismatch for '${enumInfo.name}'. Missing values:`, missingValues);
                            onCheckComplete('invalid', `The database type '${enumInfo.name}' is out of sync with the application code. It's missing the value(s): [${missingValues.join(', ')}]. Please run the setup script to fix this.`);
                            return; // Stop on first mismatch
                        }
                    }
                }

                // If all checks pass
                onCheckComplete('valid');

            } catch (e: any) {
                console.error("A JavaScript error occurred during the database check:", e);
                onCheckComplete('invalid', `An unexpected application error occurred while trying to verify the database schema: ${e.message}`);
            }
        };

        checkDatabaseSchema();
    }, [onCheckComplete]);

    return null; // This component does not render anything itself
};

export default DatabaseCheck;

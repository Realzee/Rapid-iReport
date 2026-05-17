import { supabase } from './supabase';

/**
 * Logs a user action to the database.
 * 
 * Requires a 'user_activity_logs' table with the following schema:
 * - id: uuid (primary key)
 * - user_id: uuid (foreign key to profiles.id)
 * - action: text
 * - details: text
 * - ip_address: text (optional)
 * - created_at: timestamp with time zone (default now())
 */
export const logUserAction = async (
    userId: string,
    action: string,
    details: string
) => {
    try {
        if (!supabase) {
            console.warn('Logging skipped: Supabase not configured.');
            return;
        }
        const { error } = await supabase
            .from('user_activity_logs')
            .insert({
                user_id: userId,
                action,
                details,
            });

        if (error) {
            console.error('Failed to log user action:', error);
        }
    } catch (err) {
        console.error('Exception logging user action:', err);
    }
};

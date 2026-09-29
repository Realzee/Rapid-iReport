import { supabase } from './supabase';

/**
 * Logs a user action to the database.
 * 
 * Includes graceful dual-path fallback (Supabase direct insert + Server-side API fallback)
 * to prevent RLS policy errors (42501) and network fetch failures from breaking client operations.
 */
export const logUserAction = async (
    userId: string | null | undefined,
    action: string,
    details?: string
): Promise<void> => {
    if (!action) return;

    try {
        const isValidUuid = userId && typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

        const payload: {
            user_id?: string;
            action: string;
            details?: string;
        } = {
            action: action.substring(0, 100),
            details: details ? details.substring(0, 2000) : undefined,
        };

        if (isValidUuid) {
            payload.user_id = userId;
        }

        let loggedSuccessfully = false;

        // Path 1: Direct Supabase Client Insertion if available
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('user_activity_logs')
                    .insert(payload);

                if (!error) {
                    loggedSuccessfully = true;
                } else {
                    // If RLS 42501 or permission/schema error occurred, we will try the backend API route
                    console.debug('[User Logger] Direct insert note:', error.message || error.code);
                }
            } catch (supaErr: any) {
                // Catch fetch or network exceptions silently
                console.debug('[User Logger] Direct Supabase fetch note:', supaErr?.message || supaErr);
            }
        }

        // Path 2: If direct insert was blocked by RLS (42501) or network fetch failed, use backend API proxy
        if (!loggedSuccessfully && typeof window !== 'undefined' && typeof fetch === 'function') {
            try {
                const res = await fetch('/api/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: isValidUuid ? userId : undefined,
                        action,
                        details
                    })
                });
                if (res.ok) {
                    loggedSuccessfully = true;
                }
            } catch (fetchErr: any) {
                // Network unavailable or server route offline; fail silently without console error noise
                console.debug('[User Logger] API route fallback note:', fetchErr?.message || fetchErr);
            }
        }
    } catch (err: any) {
        // Safe catch to ensure telemetry never causes app disruption
        console.debug('[User Logger] Logging completed with notice:', err?.message || err);
    }
};

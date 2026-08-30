import { createClient } from '@supabase/supabase-js';

const getSafeUrl = () => {
  const envUrl = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL);
  const defaultUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
  if (!envUrl || envUrl === 'undefined' || envUrl.trim() === '') return defaultUrl;
  const trimmed = envUrl.trim();
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

export const supabaseUrl = getSafeUrl();
export const supabaseAnonKey = ((typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzU3ODksImV4cCI6MjA4Mzg1MTc4OX0.yj6Zdkqr_Wp6oVfg98Rok1ih5wxEvUGj6BwmM782xmU').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('undefined') || supabaseAnonKey === 'undefined') {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid. Database functionality will NOT work. Please check your environment variables.");
}

// Only initialize if we have a valid-looking url and key, otherwise export null
export const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('undefined') && supabaseAnonKey !== 'undefined' && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Utility to parse PostgREST or Postgres schema mismatch errors to detect missing columns.
 */
export function extractMissingColumn(errorMessage: string): string | null {
  if (!errorMessage || typeof errorMessage !== 'string') return null;
  
  // PostgREST: "Could not find the 'column_name' column of 'table_name' in the schema cache"
  const match1 = errorMessage.match(/Could not find the ['"]([^'"]+)['"] column/i);
  if (match1 && match1[1]) return match1[1];

  // Postgres: column "column_name" of relation "table_name" does not exist
  const match2 = errorMessage.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation/i);
  if (match2 && match2[1]) return match2[1];

  // column table.column does not exist or column "column" does not exist
  const match3 = errorMessage.match(/column ["']?([a-zA-Z0-9_.]+)["']? does not exist/i);
  if (match3 && match3[1]) {
      const parts = match3[1].split('.');
      return parts[parts.length - 1];
  }

  return null;
}

/**
 * Safely fetches the next OB sequence number.
 * Tries RPC first. If RPC fails (e.g. function overloading collision or missing function),
 * falls back to directly querying existing tables to calculate max sequence for the current month/year.
 */
export async function getSafeNextObSequence(companyId?: string | null, date: Date = new Date()): Promise<number> {
  if (!supabase) return 1;

  try {
    const { data: seq, error } = await supabase.rpc('get_next_ob_sequence', {
      p_company_id: companyId || null,
      p_report_date: date.toISOString()
    });

    if (!error && typeof seq === 'number' && seq > 0) {
      return seq;
    }
    if (error) {
      console.warn('[OB Sequence RPC Warning]', error.message, '- Using resilient fallback query.');
    }
  } catch (err) {
    console.warn('[OB Sequence RPC Exception]', err, '- Using resilient fallback query.');
  }

  // Fallback: Query tables directly to find max sequence for the month/year
  try {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const [vRes, cRes, eRes] = await Promise.all([
      supabase.from('vehicle_reports').select('ob_number').gte('reported_at', startOfMonth).lte('reported_at', endOfMonth).limit(500),
      supabase.from('crime_reports').select('ob_number').gte('reported_at', startOfMonth).lte('reported_at', endOfMonth).limit(500),
      supabase.from('emergency_reports').select('ob_number').gte('reported_at', startOfMonth).lte('reported_at', endOfMonth).limit(500).then(r => r, () => ({ data: [] }))
    ]);

    let maxSeq = 0;
    const allReports = [...(vRes?.data || []), ...(cRes?.data || []), ...(eRes?.data || [])];
    for (const rep of allReports) {
      if (rep && rep.ob_number && typeof rep.ob_number === 'string') {
        const match = rep.ob_number.match(/^[A-Z]?(\d{4})\//);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
    return maxSeq + 1;
  } catch (fallbackErr) {
    console.warn('[OB Sequence Fallback Error]', fallbackErr);
    return 1;
  }
}

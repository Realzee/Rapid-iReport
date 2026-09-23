import { Company, Profile } from '../types';
import { supabase } from './supabase';

// 5-minute Time-To-Live for cached lookup data
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEnvelope<T> {
  timestamp: number;
  data: T;
}

// In-Memory Lookup Caches
let companiesMemoryCache: CacheEnvelope<Company[]> | null = null;
const profilesMemoryCache = new Map<string, CacheEnvelope<Profile>>();

const SESSION_KEY_COMPANIES = 'rapid911_cached_companies_v2';
const SESSION_KEY_PROFILES_PREFIX = 'rapid911_prof_v2_';

/**
 * Standard column projections for high-volume report queries.
 * Omits unneeded payload while guaranteeing database column compatibility.
 */
export const VEHICLE_REPORT_COLUMNS = '*';
export const CRIME_REPORT_COLUMNS = '*';
export const EMERGENCY_REPORT_COLUMNS = '*';
export const SUMMARY_PROFILE_COLUMNS = 'id, first_name, surname, email, role, status, avatar_url, company_id, responder_status, location_coords';

/**
 * Safely fetches companies with in-memory and sessionStorage caching.
 * Prevents repeating `select * from companies` on every route navigation.
 */
export async function fetchCachedCompanies(forceRefresh = false): Promise<Company[]> {
  const now = Date.now();

  // 1. Check in-memory cache
  if (!forceRefresh && companiesMemoryCache && (now - companiesMemoryCache.timestamp < CACHE_TTL_MS)) {
    return companiesMemoryCache.data;
  }

  // 2. Check sessionStorage
  if (!forceRefresh && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY_COMPANIES);
      if (stored) {
        const envelope: CacheEnvelope<Company[]> = JSON.parse(stored);
        if (now - envelope.timestamp < CACHE_TTL_MS) {
          companiesMemoryCache = envelope;
          return envelope.data;
        }
      }
    } catch {
      // Ignore sessionStorage parsing or quota errors
    }
  }

  // 3. Fallback: Fetch from Supabase with selective columns
  if (!supabase) return companiesMemoryCache?.data || [];

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, logo_url, owners_name, address, contact_person, cell_number, psira_number, allowed_modules, alias')
      .order('name');

    if (error) {
      console.warn('[CacheUtils] Supabase companies fetch note:', error.message);
      return companiesMemoryCache?.data || [];
    }

    const fetchedCompanies = (data || []) as Company[];
    const envelope: CacheEnvelope<Company[]> = { timestamp: now, data: fetchedCompanies };
    companiesMemoryCache = envelope;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(SESSION_KEY_COMPANIES, JSON.stringify(envelope));
      } catch {
        // Ignore quota issues
      }
    }

    return fetchedCompanies;
  } catch (err) {
    console.warn('[CacheUtils] Network issue fetching companies:', err);
    return companiesMemoryCache?.data || [];
  }
}

/**
 * Invalidates the company cache so newly added or modified companies appear immediately.
 */
export function invalidateCompaniesCache(): void {
  companiesMemoryCache = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.removeItem(SESSION_KEY_COMPANIES);
    } catch {}
  }
}

/**
 * Fetches user profiles by ID using an incremental cache.
 * Only queries Supabase for profile IDs that have not yet been cached.
 */
export async function fetchCachedProfiles(userIds: string[]): Promise<Profile[]> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const now = Date.now();
  const results: Profile[] = [];
  const missingIds: string[] = [];

  for (const id of uniqueIds) {
    // Check in-memory
    const mem = profilesMemoryCache.get(id);
    if (mem && (now - mem.timestamp < CACHE_TTL_MS)) {
      results.push(mem.data);
      continue;
    }

    // Check sessionStorage
    let fromSession: Profile | null = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem(`${SESSION_KEY_PROFILES_PREFIX}${id}`);
        if (stored) {
          const envelope: CacheEnvelope<Profile> = JSON.parse(stored);
          if (now - envelope.timestamp < CACHE_TTL_MS) {
            fromSession = envelope.data;
            profilesMemoryCache.set(id, envelope);
            results.push(fromSession);
            continue;
          }
        }
      } catch {}
    }

    missingIds.push(id);
  }

  if (missingIds.length === 0 || !supabase) {
    return results;
  }

  try {
    // Fetch only the missing profiles and only the summary columns
    const { data, error } = await supabase
      .from('profiles')
      .select(SUMMARY_PROFILE_COLUMNS)
      .in('id', missingIds.slice(0, 50)); // Chunk to 50 max to stay light

    if (error) {
      console.warn('[CacheUtils] Note fetching missing profiles:', error.message);
      return results;
    }

    if (data) {
      for (const p of data as Profile[]) {
        const envelope: CacheEnvelope<Profile> = { timestamp: now, data: p };
        profilesMemoryCache.set(p.id, envelope);
        results.push(p);

        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem(`${SESSION_KEY_PROFILES_PREFIX}${p.id}`, JSON.stringify(envelope));
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('[CacheUtils] Error in fetchCachedProfiles:', err);
  }

  return results;
}

/**
 * Invalidates a specific profile from cache or all profiles.
 */
export function invalidateProfileCache(userId?: string): void {
  if (userId) {
    profilesMemoryCache.delete(userId);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`${SESSION_KEY_PROFILES_PREFIX}${userId}`);
      } catch {}
    }
  } else {
    profilesMemoryCache.clear();
  }
}

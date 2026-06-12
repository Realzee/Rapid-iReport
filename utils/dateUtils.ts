import { format as dfFormatter, formatDistanceToNow as dfDistanceFormatter, parseISO as dfParseISO } from 'date-fns';

/**
 * Safely parses a value into a valid Date object.
 * Returns null if the value is invalid or null/undefined.
 */
export function safeGetDate(dateVal: any): Date | null {
  if (dateVal === null || dateVal === undefined || dateVal === '') return null;
  try {
    // If it's already a Date object
    if (dateVal instanceof Date) {
      return isNaN(dateVal.getTime()) ? null : dateVal;
    }
    // If it's a number (timestamp)
    if (typeof dateVal === 'number') {
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? null : d;
    }
    // If it's a string, attempt parseISO first, then native Date fallback
    if (typeof dateVal === 'string') {
      const parsedISO = dfParseISO(dateVal);
      if (!isNaN(parsedISO.getTime())) {
        return parsedISO;
      }
      const parsedDate = new Date(dateVal);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
      // Check if it's a pure numeric string (timestamp)
      if (/^\d+$/.test(dateVal)) {
        const d = new Date(parseInt(dateVal, 10));
        return isNaN(d.getTime()) ? null : d;
      }
    }
    // Fallback general Date constructor
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Safely formats a date. Does not throw on invalid dates.
 */
export function safeFormat(dateVal: any, formatStr: string, fallback: string = 'N/A'): string {
  const d = safeGetDate(dateVal);
  if (!d) return fallback;
  try {
    return dfFormatter(d, formatStr);
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely gets relative time distance to now. Does not throw on invalid dates.
 */
export function safeFormatDistanceToNow(dateVal: any, options: any = { addSuffix: true }, fallback: string = 'N/A'): string {
  const d = safeGetDate(dateVal);
  if (!d) return fallback;
  try {
    return dfDistanceFormatter(d, options);
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely parses a date string, returning a valid Date object fallback or a specified fallback Date.
 */
export function safeParseISO(dateVal: any, fallbackDate: Date = new Date()): Date {
  const d = safeGetDate(dateVal);
  return d || fallbackDate;
}

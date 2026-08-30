/**
 * Calculates the ISO-8601 week number for a given date.
 */
export function getWeekNumber(date: Date = new Date()): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Calculates the week number for the current month (strictly between 1 and 4).
 * - Days 1 to 7   -> Week 1
 * - Days 8 to 14  -> Week 2
 * - Days 15 to 21 -> Week 3
 * - Days 22+      -> Week 4
 */
export function getWeekOfMonth(date: Date = new Date()): number {
    const day = date.getDate();
    return Math.min(4, Math.max(1, Math.ceil(day / 7)));
}

export const getWeekNumberForMonth = getWeekOfMonth;

/**
 * Generates a Roadside Car / Card Number in the required format:
 * 000(number)/00(week number for current month, 01-04)/00(month)/0000(year)
 * Example: 001/04/08/2026
 */
export function generateRoadsideCardNumber(sequence: number = 1, date: Date = new Date()): string {
    const seqStr = String(sequence).padStart(3, '0');
    const weekStr = String(getWeekOfMonth(date)).padStart(2, '0');
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const yearStr = String(date.getFullYear());
    return `${seqStr}/${weekStr}/${monthStr}/${yearStr}`;
}

export const generateRoadsideCarNumber = generateRoadsideCardNumber;



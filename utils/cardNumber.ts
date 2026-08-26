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
 * Generates a Roadside Card Number in the required format:
 * 000(number)/00(week number)/00(month)/0000(year)
 * Example: 001/35/08/2026
 */
export function generateRoadsideCardNumber(sequence: number = 1, date: Date = new Date()): string {
    const seqStr = String(sequence).padStart(3, '0');
    const weekStr = String(getWeekNumber(date)).padStart(2, '0');
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const yearStr = String(date.getFullYear());
    return `${seqStr}/${weekStr}/${monthStr}/${yearStr}`;
}

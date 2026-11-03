import { parseISO, differenceInCalendarDays } from 'date-fns';

/**
 * Robust calculator for days remaining until target exam date.
 * Handles ISO strings ('2026-09-12'), date objects, and timestamps.
 * Guarantees a safe integer (never NaN or negative).
 */
export function calculateDaysRemaining(targetDateInput?: string | number | null): number {
  if (!targetDateInput) return 120; // Default fallback for RBI Grade B 2026

  try {
    let target: Date;
    if (typeof targetDateInput === 'number') {
      target = new Date(targetDateInput);
    } else {
      const trimmed = String(targetDateInput).trim();
      target = new Date(trimmed);
      if (isNaN(target.getTime())) {
        target = parseISO(trimmed);
      }
    }

    if (isNaN(target.getTime())) {
      return 120;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diff = differenceInCalendarDays(target, today);
    return Math.max(0, isNaN(diff) ? 120 : diff);
  } catch {
    return 120;
  }
}

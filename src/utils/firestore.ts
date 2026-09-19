/**
 * Firestore Utilities
 * Deeply sanitizes objects to prevent unsupported field value: undefined errors,
 * cleans NaN/Infinity values, and guarantees safe serialization for Firestore writes.
 */

export function sanitizeForFirestore<T>(input: T): T {
  if (input === undefined) {
    return null as any;
  }
  if (input === null) {
    return null as any;
  }
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) {
      return 0 as any;
    }
    return input;
  }
  if (typeof input === 'string' || typeof input === 'boolean') {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined) as any;
  }
  if (typeof input === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return input;
}

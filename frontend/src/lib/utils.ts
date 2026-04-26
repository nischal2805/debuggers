/**
 * Normalize a percentage value to 0-100.
 * Handles cases where backend returns already-scaled values (e.g. 0-100)
 * but frontend accidentally multiplies again.
 *
 * Rule: if val > 100, shrink to valid range:
 *   3 digits (100-999) → val / 10
 *   4+ digits (1000+)  → val / 100
 */
export function normalizePct(val: number): number {
  if (val <= 100) return Math.min(100, Math.max(0, Math.round(val)))
  const digits = Math.abs(Math.round(val)).toString().length
  if (digits >= 4) return Math.min(100, Math.round(val / 100))
  return Math.min(100, Math.round(val / 10))
}

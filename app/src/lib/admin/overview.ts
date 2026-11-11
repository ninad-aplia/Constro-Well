// Presentation helpers for the admin overview dashboard.

/** Bar width/height as a percentage; 0 stays 0, non-zero gets at least 2%. */
export function barPercent(count: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(count) || count <= 0) return 0;
  return Math.max(2, Math.round((count / max) * 100));
}

export function maxCount(rows: Array<{ count: number }>): number {
  return rows.reduce((highest, row) => Math.max(highest, row.count), 0);
}

/** Short label for a YYYY-MM-DD day bucket. */
export function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return `${day}/${month}`;
}

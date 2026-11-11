// Admin actor drill-down links. Kept pure so the URL contract is unit-testable.

export function actorHref(id: string): string {
  return `/admin/actors/${encodeURIComponent(id)}`;
}

export function actorActivityHref(id: string): string {
  return `/admin/activity?actorId=${encodeURIComponent(id)}`;
}

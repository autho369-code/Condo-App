// Page-number paging for owner portal lists (same shape as the manager
// lists: ?page=N, Previous/Next links, a "x-y of n" line).

/** The requested page (1-based); anything invalid is page 1. */
export function parsePage(raw: string | string[] | null | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(String(value ?? '1'), 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/** Inclusive row range for `.range(from, to)`. */
export function pageRange(page: number, size: number): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * size;
  return { from, to: from + size - 1 };
}

/** Number of pages for `total` rows (at least 1). */
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** `path` with ?page=N (page 1 drops the parameter). */
export function pageHref(path: string, page: number): string {
  return page > 1 ? `${path}?page=${page}` : path;
}

/** Escape LIKE/ILIKE pattern characters so a value (e.g. an email) compares literally. */
export function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

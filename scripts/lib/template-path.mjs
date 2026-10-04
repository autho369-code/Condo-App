// Used by scripts/audit-local-links.mjs (npm run check:routes).

/**
 * Turn a template link into a checkable path: a `${…}` filling a whole path
 * segment becomes a dynamic segment; one glued to text ends the path there
 * (`/budget${qs}` checks `/budget`). `?` and `#` count as URL delimiters only
 * outside `${…}` (so `${a ?? b}` stays one segment). Returns null when it
 * can't be parsed.
 */
export function templatePath(raw) {
  const SUB = '\u0000';
  let path = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '$' && raw[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      for (; j < raw.length && depth > 0; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') depth--;
      }
      if (depth > 0) return null;
      path += SUB;
      i = j - 1;
      continue;
    }
    if (raw[i] === '?' || raw[i] === '#') break;
    path += raw[i];
  }
  path = path.replace(new RegExp(`/${SUB}(?=/|$)`, 'g'), '/__param__');
  const cut = path.indexOf(SUB);
  if (cut === 0) return null;
  if (cut > 0) path = path.slice(0, cut);
  if (/[`{}]/.test(path) || !path.startsWith('/')) return null;
  return path;
}

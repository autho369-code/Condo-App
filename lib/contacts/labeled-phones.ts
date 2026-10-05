import type { PhoneEntry } from '@/lib/sms/phone-entries';

// AppFolio (and similar) exports put every phone in one cell:
//   "Mobile: (773) 829-7314, Home: (773) 599-6882, Phone: (312) 576-0379"
// Split that into separate numbers with their labels. The primary number is
// the first mobile, otherwise the first number.

const SEGMENT = /^\s*(?:([A-Za-z][A-Za-z ]{0,20}?)\s*:\s*)?(.+?)\s*$/;

export function parseLabeledPhones(raw: string | null | undefined): { primary: string | null; entries: PhoneEntry[] } {
  const text = (raw ?? '').trim();
  if (!text) return { primary: null, entries: [] };
  const entries: PhoneEntry[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[,;\n]+/)) {
    const m = SEGMENT.exec(part);
    if (!m) continue;
    const number = m[2].trim();
    const digits = number.replace(/\D/g, '');
    if (digits.length < 7 || seen.has(digits)) continue;
    seen.add(digits);
    const label = m[1]?.trim().toLowerCase() || null;
    entries.push({ number, type: label });
  }
  const primary = (entries.find((e) => e.type === 'mobile' || e.type === 'cell') ?? entries[0])?.number ?? null;
  return { primary, entries };
}

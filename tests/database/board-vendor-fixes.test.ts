import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { firstVendorEmail, replaceFirstVendorEmail } from '@/lib/vendors/contact';
import { meetingTypeLabel, MEETING_TYPE_LABELS, splitBoardMeetings } from '@/lib/meetings/labels';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const migration = read('supabase/migrations/20261015100000_board_vendor_fixes.sql');

describe('20261015100000_board_vendor_fixes migration', () => {
  it('keeps vendor compliance dates as claims', () => {
    expect(migration).toContain('alter table public.vendor_compliance disable trigger trg_vendor_compliance_sync;');
    expect(migration).toContain('if public.is_self_service_caller() then return new; end if;');
  });

  it('no longer trusts trigger depth alone in the vendors guard', () => {
    expect(migration).toContain('if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;');
    expect(migration).toMatch(/if not public\.is_self_service_caller\(\) then return new; end if;\n  n := new;\n  new := old;\n  if pg_trigger_depth\(\) > 1 then/);
    // Expiration columns are never whitelisted for nested vendor writes.
    const nested = migration.slice(migration.indexOf('if pg_trigger_depth() > 1 then'), migration.indexOf('$new$);'));
    expect(nested).not.toMatch(/_expiration/);
  });

  it('removes the email-match board branch only when nothing relies on it', () => {
    expect(migration).toMatch(/if n > 0 then\s+raise notice/);
    expect(migration).toContain('linked login only, never by email match');
  });

  it('uses each association local date for receivables and the meeting snapshot', () => {
    expect(migration).toContain('public.association_local_date(a.id) AS local_today');
    expect(migration).not.toMatch(/CURRENT_DATE/);
    expect(migration).toContain('coalesce(p_as_of, public.association_local_date(ar.association_id))');
    expect(migration).toContain('count(distinct ar.unit_id) filter (where ar.due_date < ar.as_of)');
    expect(migration).toContain("date_trunc(''month'', public.association_local_date(p_association_id))");
    expect(migration).toContain('and c.due_date >= v_month_start');
  });

  it('closes vendor reads of labor costs without dropping the policy', () => {
    expect(migration).toContain('alter policy labor_entries_vendor_read on public.work_order_labor_entries using (false);');
  });

  it('is re-runnable and drops or deletes nothing', () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|column|view|function|policy)\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
    const patches = migration.match(/position\('board_vendor_fixes' in d\) > 0 then return/g) ?? [];
    expect(patches.length).toBe(4);
  });
});

describe('vendor profile email edits', () => {
  it('removes the first of two emails', () => {
    expect(replaceFirstVendorEmail(['a@x.com', 'b@x.com'], '')).toEqual(['b@x.com']);
  });

  it('refuses to remove the only email', () => {
    expect(replaceFirstVendorEmail(['a@x.com'], '')).toBeNull();
    expect(replaceFirstVendorEmail([], '  ')).toBeNull();
  });

  it('keeps the stored shape of the first entry', () => {
    expect(replaceFirstVendorEmail([{ email: 'a@x.com', type: 'work' }], 'c@x.com')).toEqual([{ email: 'c@x.com', type: 'work' }]);
    expect(replaceFirstVendorEmail(['a@x.com', 'b@x.com'], ' c@x.com ')).toEqual(['c@x.com', 'b@x.com']);
    expect(firstVendorEmail([{ email: ' a@x.com ' }])).toBe('a@x.com');
    expect(firstVendorEmail(null)).toBe('');
  });

  it('the profile page uses the helper', () => {
    const page = read('app/vendor/profile/page.tsx');
    expect(page).toContain('replaceFirstVendorEmail(current.emails, emailVal)');
    expect(page).not.toContain('emails.length <= 1');
  });
});

describe('board meetings', () => {
  it('labels the real meeting_type enum', () => {
    expect(Object.keys(MEETING_TYPE_LABELS).sort()).toEqual(
      ['annual_meeting', 'board_meeting', 'committee_meeting', 'executive_session', 'special_meeting'],
    );
    expect(meetingTypeLabel('executive_session')).toBe('Executive Session');
  });

  it('lists cancelled meetings, future ones included', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const rows = [
      { id: 'a', start_time: '2026-11-01T18:00:00Z', status: 'scheduled' },
      { id: 'b', start_time: '2026-11-02T18:00:00Z', status: 'cancelled' },
      { id: 'c', start_time: '2026-09-01T18:00:00Z', status: 'completed' },
      { id: 'd', start_time: '2026-09-02T18:00:00Z', status: 'cancelled' },
    ];
    const { upcoming, past, cancelled } = splitBoardMeetings(rows, now);
    expect(upcoming.map((m) => m.id)).toEqual(['a']);
    expect(past.map((m) => m.id)).toEqual(['c']);
    expect(cancelled.map((m) => m.id)).toEqual(['b', 'd']);
  });

  it('the detail page refuses archived meetings', () => {
    expect(read('app/board/meetings/[id]/page.tsx')).toContain(".is('archived_at', null)");
  });
});

describe('board budget and vendor dashboard', () => {
  it('budget uses the association local date', () => {
    const page = read('app/board/budget/page.tsx');
    expect(page).toContain('todayInZone(assoc?.timezone || DEFAULT_TIME_ZONE)');
    expect(page).toContain('fiscalMonthsElapsed(fy, assoc?.fiscal_year_start, localDate)');
    expect(page).not.toContain('fiscalYearFor(new Date()');
  });

  it('vendor dashboard counts come from head counts', () => {
    const page = read('app/vendor/page.tsx');
    expect(page).toContain("{ count: 'exact', head: true }");
    expect(page).not.toContain('.limit(100)');
    expect(page).not.toContain("'open'];");
  });
});

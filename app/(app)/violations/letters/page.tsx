import Link from 'next/link';
import { Mail } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { markViolationLetterMailed } from '@/lib/rpcs/violation-rules';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { signLetterLinks, type ViolationLetterRow } from '@/lib/violations/letter-links';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ViolationLettersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assoc?: string; q?: string; error?: string; saved?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const status = sp.status === 'mailed' || sp.status === 'all' ? sp.status : 'to_mail';
  const assoc = UUID.test(sp.assoc ?? '') ? sp.assoc! : '';
  const db = (await createClient()) as any;

  let query = db
    .from('violation_letters')
    .select('id, violation_id, step_name, subject, pdf_path, delivery_methods, emailed_to, email_status, mail_status, mailed_at, created_at, associations(name), owners(full_name), violations(title, units(unit_number))')
    .order('created_at', { ascending: status === 'to_mail' })
    .limit(500);
  query = status === 'all' ? query.neq('mail_status', 'not_requested') : query.eq('mail_status', status);
  if (assoc) query = query.eq('association_id', assoc);
  const [{ data, error }, { data: associations }] = await Promise.all([
    query,
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (error) throw new Error(`Could not load letters: ${error.message}`);
  const q = (sp.q ?? '').trim().toLowerCase();
  const all = (data ?? []) as Array<ViolationLetterRow & { associations?: any; owners?: any; violations?: any }>;
  const rows = q
    ? all.filter((l) => [l.owners?.full_name, l.associations?.name, l.violations?.title, l.violations?.units?.unit_number, l.step_name]
        .some((v) => String(v ?? '').toLowerCase().includes(q)))
    : all;
  const links = await signLetterLinks(rows);
  const back = `/violations/letters${status !== 'to_mail' || assoc ? `?status=${status}${assoc ? `&assoc=${assoc}` : ''}` : ''}`;

  return (
    <DataWorkspace
      title="Violation letters to mail"
      description="Step letters whose follow-up step includes mail. Print each one, post it, then mark it mailed — the date is kept as proof of notice."
      actions={<Link href="/violations"><Button variant="secondary">Back to violations</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not update letter">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}

        <FilterBar action="/violations/letters" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner, unit, association or violation">
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="to_mail">To mail</option>
            <option value="mailed">Mailed</option>
            <option value="all">All mailed letters</option>
          </FilterSelect>
          <FilterSelect label="Association" name="assoc" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        {rows.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Mail}
              title={status === 'to_mail' ? 'Nothing to mail' : 'No letters here'}
              description="Letters appear here when a violation reaches a follow-up step that is delivered by mail."
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Written</TH>
                <TH>Owner · unit</TH>
                <TH>Violation · step</TH>
                <TH>Status</TH>
                <TH><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((l) => {
                const href = links.get(l.pdf_path);
                return (
                  <TR key={l.id}>
                    <TD className="whitespace-nowrap">{date(l.created_at)}</TD>
                    <TD>
                      <div className="text-gray-950">{l.owners?.full_name ?? 'Owner not on file'}</div>
                      <div className="text-xs text-gray-500">
                        {l.associations?.name ?? '—'}{l.violations?.units?.unit_number ? ` · Unit ${l.violations.units.unit_number}` : ''}
                      </div>
                    </TD>
                    <TD>
                      <Link href={`/violations/${l.violation_id}`} className="text-gray-950 hover:underline">{l.violations?.title ?? 'Violation'}</Link>
                      <div className="text-xs text-gray-500">{l.step_name}</div>
                    </TD>
                    <TD>
                      {l.mail_status === 'to_mail'
                        ? <StatusChip tone="warning">{l.delivery_methods.includes('certified_mail') ? 'To mail — certified' : 'To mail'}</StatusChip>
                        : <StatusChip tone="success">Mailed {date(l.mailed_at)}</StatusChip>}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2">
                        {href && <a href={href} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm">Print PDF</Button></a>}
                        {l.mail_status === 'to_mail' && (
                          <form action={markViolationLetterMailed}>
                            <input type="hidden" name="letter_id" value={l.id} />
                            <input type="hidden" name="back" value={back} />
                            <Button type="submit" size="sm">Mark mailed</Button>
                          </form>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { hasPortfolioAdminAccess, requirePortfolioAdmin, requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState } from '@/components/ui/shell';
import { Input, Textarea } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function currency(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));
}

function back(key: 'error' | 'saved', message: string) {
  redirect(`/delinquencies?${key}=${encodeURIComponent(message)}`);
}

export default async function DelinquenciesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  async function syncCases() {
    'use server';
    const current = await requireStaff();
    const { error } = await (await createClient() as any).rpc('sync_owner_delinquency_cases', { p_portfolio_id: current.portfolio?.id });
    if (error) back('error', error.message);
    revalidatePath('/delinquencies');
    back('saved', 'Owner balances synchronized into durable collection cases.');
  }

  async function initializePolicy(formData: FormData) {
    'use server';
    await requirePortfolioAdmin();
    const associationId = String(formData.get('association_id') ?? '');
    const { error } = await (await createClient() as any).rpc('initialize_delinquency_policy', { p_association_id: associationId });
    if (error) back('error', error.message);
    revalidatePath('/delinquencies');
    back('saved', 'Four-step owner collection policy initialized.');
  }

  async function advanceCase(formData: FormData) {
    'use server';
    await requireStaff();
    const caseId = String(formData.get('case_id') ?? '');
    const note = String(formData.get('note') ?? '').trim() || null;
    const { error } = await (await createClient() as any).rpc('advance_delinquency_case', { p_case_id: caseId, p_note: note });
    if (error) back('error', error.message);
    revalidatePath('/delinquencies');
    back('saved', 'Case advanced to the next due policy step.');
  }

  async function setHold(formData: FormData) {
    'use server';
    await requireStaff();
    const caseId = String(formData.get('case_id') ?? '');
    const hold = formData.get('hold') === 'true';
    const note = String(formData.get('note') ?? '').trim();
    if (hold && note.length < 10) back('error', 'A hold reason of at least 10 characters is required.');
    const { error } = await (await createClient() as any).rpc('set_delinquency_case_hold', { p_case_id: caseId, p_hold: hold, p_note: note || null });
    if (error) back('error', error.message);
    revalidatePath('/delinquencies');
    back('saved', hold ? 'Collection hold placed.' : 'Collection hold released.');
  }

  async function reviewLegalGate(formData: FormData) {
    'use server';
    await requirePortfolioAdmin();
    const caseId = String(formData.get('case_id') ?? '');
    const note = String(formData.get('note') ?? '').trim();
    const approved = formData.get('approved') === 'true';
    const { error } = await (await createClient() as any).rpc('review_delinquency_legal_gate', { p_case_id: caseId, p_approved: approved, p_note: note });
    if (error) back('error', error.message);
    revalidatePath('/delinquencies');
    back('saved', approved ? 'Human counsel-referral approval recorded.' : 'Legal escalation rejected and case placed on hold.');
  }

  async function recordManualDelivery(formData: FormData) {
    'use server';
    await requirePortfolioAdmin();
    const mailId = String(formData.get('mail_id') ?? '');
    const trackingNumber = String(formData.get('tracking_number') ?? '').trim();
    const deliveredOn = String(formData.get('delivered_on') ?? '');
    const note = String(formData.get('note') ?? '').trim();
    if (!mailId || !trackingNumber || !deliveredOn || note.length < 20) {
      back('error', 'Tracking number, delivery date, and a 20-character evidence note are required.');
    }
    const { error } = await (await createClient() as any).rpc('record_manual_certified_mail_delivery', {
      p_id: mailId,
      p_tracking_number: trackingNumber,
      p_delivered_on: deliveredOn,
      p_note: note,
    });
    if (error) back('error', error.message);
    revalidatePath('/delinquencies');
    revalidatePath('/letters/mail');
    back('saved', 'Certified-mail delivery evidence recorded with an audit trail.');
  }

  const [{ data: cases }, { data: policies }, { data: steps }, { data: associations }, { data: mailDeliveries }] = await Promise.all([
    db.from('delinquency_cases').select('*, associations(name), units(unit_number), owners(full_name, email), delinquency_policies(name)').order('balance_snapshot', { ascending: false }),
    db.from('delinquency_policies').select('id, association_id, name, minimum_balance, active'),
    db.from('delinquency_steps').select('policy_id, step_number, name, days_past_due, action_type, requires_human_approval').order('step_number'),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('physical_mail_deliveries').select('id, delinquency_case_id, status, provider, provider_piece_id, expected_delivery_date, delivered_at, delivery_verified_at, updated_at').not('delinquency_case_id', 'is', null).order('created_at', { ascending: false }),
  ]);
  const policyAssociations = new Set((policies ?? []).map((policy: any) => policy.association_id));
  const stepsByPolicy = new Map<string, any[]>();
  for (const step of steps ?? []) { const list = stepsByPolicy.get(step.policy_id) ?? []; list.push(step); stepsByPolicy.set(step.policy_id, list); }
  const mailByCase = new Map<string, any>();
  for (const delivery of mailDeliveries ?? []) if (!mailByCase.has(delivery.delinquency_case_id)) mailByCase.set(delivery.delinquency_case_id, delivery);
  const openCases = (cases ?? []).filter((record: any) => !['resolved', 'closed'].includes(record.status));
  const overdueTotal = openCases.reduce((sum: number, record: any) => sum + Number(record.balance_snapshot ?? 0), 0);

  return <DataWorkspace title="Owner Delinquency Ladder" description="Stateful collection cases with policy deadlines, holds, evidence, and a mandatory human gate before counsel referral." actions={<form action={syncCases}><Button type="submit">Sync owner balances</Button></form>}>
    <div className="space-y-5">
      {sp.error && <Alert title="Collection workflow blocked">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
      <Alert tone="warning" title="No autonomous legal action.">Portier may identify a case as ready for review, but only a portfolio administrator can approve counsel referral with a written rationale. The software never files a lien, lawsuit, or collection action.</Alert>
      <MetricStrip metrics={[
        { label: 'Open cases', value: openCases.length, sublabel: 'Active owner accounts' },
        { label: 'Overdue balance', value: currency(overdueTotal), sublabel: 'Latest ledger snapshot' },
        { label: 'On hold', value: openCases.filter((record: any) => record.status === 'on_hold').length, sublabel: 'Dispute or payment plan' },
        { label: 'Legal review', value: openCases.filter((record: any) => record.status === 'legal_review').length, sublabel: 'Human decision required' },
      ]} />

      {hasPortfolioAdminAccess(me) && (associations ?? []).some((association: any) => !policyAssociations.has(association.id)) && <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><h2 className="font-semibold text-gray-950">Initialize association policies</h2><p className="mt-1 text-sm text-gray-500">The safe default is 10-day reminder, 30-day approved notice, 45-day tracked mail, and 60-day counsel review.</p><div className="mt-3 flex flex-wrap gap-2">{(associations ?? []).filter((association: any) => !policyAssociations.has(association.id)).map((association: any) => <form action={initializePolicy} key={association.id}><input type="hidden" name="association_id" value={association.id} /><Button type="submit" variant="secondary">Initialize {association.name}</Button></form>)}</div></div>}

      {openCases.length ? <div className="space-y-4">{openCases.map((record: any) => {
        const policySteps = stepsByPolicy.get(record.policy_id) ?? [];
        const current = policySteps.find((step) => step.step_number === record.current_step_number);
        const next = policySteps.find((step) => step.step_number > record.current_step_number);
        const mail = mailByCase.get(record.id);
        const days = record.oldest_due_date ? Math.max(0, Math.floor((Date.now() - new Date(record.oldest_due_date).getTime()) / 86400000)) : 0;
        return <div key={record.id} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold text-gray-950">{record.owners?.full_name ?? 'Unassigned owner'} · Unit {record.units?.unit_number ?? '—'}</h2><p className="mt-1 text-sm text-gray-500">{record.associations?.name} · oldest due {date(record.oldest_due_date)} · {days} days</p></div><div className="flex items-center gap-2"><span className="text-lg font-semibold tabular-nums">{currency(record.balance_snapshot)}</span><Badge status={record.status} /></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-gray-50 p-3"><div className="text-xs text-gray-500">Current step</div><div className="mt-1 text-sm font-medium">{current?.name ?? 'Case opened'}</div></div><div className="rounded-xl bg-gray-50 p-3"><div className="text-xs text-gray-500">Next step</div><div className="mt-1 text-sm font-medium">{next ? `${next.name} · day ${next.days_past_due}` : 'Policy complete'}</div></div><div className="rounded-xl bg-gray-50 p-3"><div className="text-xs text-gray-500">Policy</div><div className="mt-1 text-sm font-medium">{record.delinquency_policies?.name ?? 'Not configured'}</div></div><div className="rounded-xl bg-gray-50 p-3"><div className="text-xs text-gray-500">Tracked mail</div><div className="mt-1 text-sm font-medium">{mail ? mail.status.replaceAll('_', ' ') : 'Not queued'}</div>{mail?.delivered_at && <div className="mt-1 text-xs text-gray-500">Delivered {date(mail.delivered_at)}</div>}</div></div>
          {(current?.action_type === 'physical_mail' || next?.action_type === 'physical_mail' || next?.action_type === 'legal_review') && mail?.status !== 'delivered' && <div className="mt-3"><Link href={`/letters/mail/new?owner_id=${record.owner_id}&case_id=${record.id}`}><Button variant="secondary">{mail ? 'Queue replacement tracked mail' : 'Queue tracked mail'}</Button></Link></div>}
          {mail && mail.status !== 'delivered' && hasPortfolioAdminAccess(me) && <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-medium text-gray-900">Record manual certified-mail delivery</summary><p className="mt-2 text-xs text-gray-500">Use this only after independently confirming USPS delivery. Tracking, date, reviewer, and rationale are written to the audit trail.</p><form action={recordManualDelivery} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="mail_id" value={mail.id} /><Input name="tracking_number" required minLength={8} maxLength={40} placeholder="USPS certified-mail tracking" /><Input name="delivered_on" type="date" required max={new Date().toISOString().slice(0, 10)} /><div className="sm:col-span-2"><Textarea name="note" required minLength={20} maxLength={2000} placeholder="Describe how delivery was verified and where the supporting receipt is retained (20+ characters)." /></div><div className="sm:col-span-2"><Button type="submit" variant="secondary">Record audited delivery</Button></div></form></details>}
          {record.status === 'legal_review' ? hasPortfolioAdminAccess(me) ? <form action={reviewLegalGate} className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><Textarea name="note" required minLength={20} placeholder="Document ledger review, notices, board policy, disputes, and the reason for the decision (20+ characters)." /><input type="hidden" name="case_id" value={record.id} /><Button type="submit" name="approved" value="true">Approve counsel referral</Button><Button type="submit" name="approved" value="false" variant="danger">Reject and hold</Button></form> : <div className="mt-4 border-t border-gray-100 pt-4"><Alert title="Administrator review required">A portfolio administrator must inspect the delivered-mail evidence and record the legal decision.</Alert></div> : <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row"><form action={advanceCase} className="flex flex-1 gap-2"><input type="hidden" name="case_id" value={record.id} /><Input name="note" placeholder="Review note or evidence" /><Button type="submit" disabled={!next || record.status === 'on_hold' || days < Number(next?.days_past_due ?? Infinity) || (next?.action_type === 'legal_review' && mail?.status !== 'delivered')}>Advance</Button></form><form action={setHold} className="flex flex-1 gap-2"><input type="hidden" name="case_id" value={record.id} /><input type="hidden" name="hold" value={record.status === 'on_hold' ? 'false' : 'true'} /><Input name="note" placeholder={record.status === 'on_hold' ? 'Optional release note' : 'Required hold reason'} /><Button type="submit" variant="secondary">{record.status === 'on_hold' ? 'Release hold' : 'Place hold'}</Button></form></div>}
        </div>;
      })}</div> : <div className="rounded-2xl border border-gray-200/70 bg-white"><EmptyState icon={AlertTriangle} title="No open owner collection cases" description="Sync owner balances to create cases for qualifying overdue accounts." /></div>}
    </div>
  </DataWorkspace>;
}

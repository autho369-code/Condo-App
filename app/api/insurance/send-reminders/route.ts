/**
 * GET /api/insurance/send-reminders
 * Daily cron. Emails owners and their property managers when an HO6 policy is
 * 30 days / 15 days from expiration, honoring the per-policy remind_owner /
 * remind_manager preferences. Each window is sent once (reminder_*_sent_at).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { queueEmails, type QueuedEmail } from '@/lib/email/queue';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { companyUrl, type CompanyAddress } from '@/lib/tenant/host';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { selectInChunks } from '@/lib/supabase/select-in-chunks';
import { reminderWindow } from '@/lib/insurance/reminder-window';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const svc = createServiceClient() as any;

  try {
    // Refresh active/expiring_soon/expired statuses first
    await svc.rpc('check_insurance_expirations');

    // Policies within 30 days of expiry by each association's own calendar
    // day, skipping archived (renewed) policies and owners who no longer own
    // there (insurance_policies_due_for_reminder). Paged: no 1,000-row cap.
    const { rows: policies, error } = await fetchAllRows<any>(() => svc
      .rpc('insurance_policies_due_for_reminder', { p_within_days: 30 })
      .order('id'));
    if (error) throw new Error(error);

    const due = policies
      .map((p: any) => {
        const daysLeft = Number(p.days_left);
        const window = reminderWindow(daysLeft, p);
        return window ? { ...p, daysLeft, window } : null;
      })
      .filter(Boolean) as any[];

    if (due.length === 0) return NextResponse.json({ sent: 0, message: 'No reminders due today' });

    // Owners and associations of the due policies, a chunk of ids at a time.
    const [ownersRes, assocRes] = await Promise.all([
      selectInChunks<any>(due.map((p) => p.owner_id), (chunk) => svc
        .from('owners').select('id, full_name, email').in('id', chunk).order('id')),
      selectInChunks<any>(due.map((p) => p.association_id), (chunk) => svc
        .from('associations').select('id, name, portfolio_id').in('id', chunk).order('id')),
    ]);
    if (ownersRes.error) throw new Error(`owners lookup failed — ${ownersRes.error}`);
    if (assocRes.error) throw new Error(`associations lookup failed — ${assocRes.error}`);
    const ownerById = new Map<string, any>(ownersRes.rows.map((o: any) => [o.id, o]));
    const assocById = new Map<string, any>(assocRes.rows.map((a: any) => [a.id, a]));
    for (const p of due) {
      p.owners = ownerById.get(p.owner_id) ?? null;
      p.associations = p.association_id ? (assocById.get(p.association_id) ?? null) : null;
    }

    // Resolve assigned managers for the affected associations
    const assocIds = Array.from(new Set(due.map((p) => p.association_id).filter(Boolean))) as string[];
    const managersByAssoc = new Map<string, { email: string; name: string | null }[]>();
    // White-label branding: every email presents as the management company —
    // sender name, reply-to, and signature. Only the sending address stays on
    // the verified portier369.com domain (Resend requirement).
    const brandByPortfolio = new Map<string, { companyName: string | null; supportEmail: string | null; supportPhone: string | null; address: CompanyAddress }>();
    if (assocIds.length > 0) {
      const { rows: assignments, error: assignmentsError } = await selectInChunks<any>(assocIds, (chunk) => svc
        .from('association_managers')
        .select('id, association_id, user_id')
        .in('association_id', chunk)
        .is('ended_at', null)
        .order('id'));
      if (assignmentsError) throw new Error(`manager lookup failed — ${assignmentsError}`);
      const profileById = new Map<string, any>();
      const { rows: profiles, error: profilesError } = await selectInChunks<any>(assignments.map((a: any) => a.user_id), (chunk) => svc
        .from('profiles').select('id, email, full_name').in('id', chunk).order('id'));
      if (profilesError) throw new Error(`manager profile lookup failed — ${profilesError}`);
      for (const pr of profiles) profileById.set(pr.id, pr);
      for (const a of assignments) {
        const pr = profileById.get(a.user_id);
        if (!pr?.email) continue;
        const list = managersByAssoc.get(a.association_id) ?? [];
        list.push({ email: pr.email, name: pr.full_name ?? null });
        managersByAssoc.set(a.association_id, list);
      }
      const { rows: pfs, error: pfError } = await selectInChunks<any>(due.map((p) => p.associations?.portfolio_id), (chunk) => svc
        .from('portfolios').select('id, company_name, support_email, support_phone, slug, custom_domain, custom_domain_verified_at').in('id', chunk).order('id'));
      if (pfError) throw new Error(`company lookup failed — ${pfError}`);
      for (const pf of pfs) {
        brandByPortfolio.set(pf.id, {
          companyName: pf.company_name ?? null,
          supportEmail: pf.support_email ?? null,
          supportPhone: pf.support_phone ?? null,
          address: { slug: pf.slug, custom_domain: pf.custom_domain, custom_domain_verified_at: pf.custom_domain_verified_at },
        });
      }
    }

    const emails: QueuedEmail[] = [];
    const results: any[] = [];

    for (const p of due) {
      const ownerName = p.owners?.full_name ?? 'Owner';
      const assocName = p.associations?.name ?? 'your association';
      const brand = p.associations?.portfolio_id ? brandByPortfolio.get(p.associations.portfolio_id) : undefined;
      const companyName = brand?.companyName ?? assocName;
      const managers = p.association_id ? (managersByAssoc.get(p.association_id) ?? []) : [];
      // Replies from the owner go to their manager (or the company inbox) —
      // never to the platform.
      const replyTo = managers[0]?.email ?? brand?.supportEmail ?? null;
      const contactLine = [brand?.supportEmail, brand?.supportPhone].filter(Boolean).join(' · ');
      const signature = `— ${companyName}${contactLine ? `\n${contactLine}` : ''}`;
      const portalUrl = companyUrl(brand?.address, '/portal/insurance');
      const managerUrl = companyUrl(brand?.address, '/insurance');
      const details =
        `Carrier: ${p.insurance_company}\n` +
        `Policy #: ${p.policy_number}\n` +
        `Policy period: ${p.effective_date} to ${p.expiration_date}\n` +
        `Days remaining: ${p.daysLeft}`;

      if (p.remind_owner && p.owners?.email) {
        emails.push({
          to: p.owners.email,
          toName: ownerName,
          fromName: companyName,
          replyTo,
          subject: `Your insurance policy expires in ${p.daysLeft} days`,
          text:
            `Hi ${ownerName},\n\nThis is a reminder that your HO6 insurance policy on file with ${assocName} expires on ${p.expiration_date}.\n\n${details}\n\n` +
            `Please renew your policy and upload the new certificate in your owner portal:\n${portalUrl}\n\n${signature}`,
          associationId: p.association_id ?? null,
          portfolioId: p.associations?.portfolio_id ?? null,
          idempotencyKey: `insurance-reminder:${p.id}:${p.window}:owner:${String(p.owners.email).toLowerCase()}`,
        });
      }

      if (p.remind_manager) {
        let recipients = managers;
        if (recipients.length === 0 && brand?.supportEmail) {
          recipients = [{ email: brand.supportEmail, name: null }];
        }
        for (const r of recipients) {
          emails.push({
            to: r.email,
            toName: r.name,
            fromName: companyName,
            replyTo: p.owners?.email ?? null,
            subject: `Owner insurance expiring in ${p.daysLeft} days — ${ownerName} (${assocName})`,
            text:
              `The HO6 insurance policy for ${ownerName} at ${assocName} expires on ${p.expiration_date}.\n\n${details}\n\n` +
              `Review insurance tracking:\n${managerUrl}\n\n${signature}`,
            associationId: p.association_id ?? null,
            portfolioId: p.associations?.portfolio_id ?? null,
            idempotencyKey: `insurance-reminder:${p.id}:${p.window}:manager:${String(r.email).toLowerCase()}`,
          });
        }
      }
    }

    const { error: queueErr, count } = await queueEmails(svc, emails);
    if (queueErr) throw new Error(queueErr);

    // Only close a reminder window after its emails are durably present in the
    // queue. Idempotency keys make this safe if queueing succeeded but a stamp
    // or HTTP response failed and Vercel retries the cron.
    for (const p of due) {
      const stamp: Record<string, string> = { [`reminder_${p.window}_sent_at`]: new Date().toISOString() };
      if (p.window === 15 && !p.reminder_30_sent_at) stamp.reminder_30_sent_at = new Date().toISOString();
      const { error: stampErr } = await svc.from('insurance_policies').update(stamp).eq('id', p.id);
      results.push({ policy: p.policy_number, window: p.window, daysLeft: p.daysLeft, stamped: !stampErr });
    }

    return NextResponse.json({ sent: count, policies: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

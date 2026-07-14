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

export const dynamic = 'force-dynamic';

const PORTAL_URL = 'https://portier369.com/portal/insurance';
const MANAGER_URL = 'https://portier369.com/insurance';

function isoDaysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const svc = createServiceClient() as any;

  try {
    // Refresh active/expiring_soon/expired statuses first
    await svc.rpc('check_insurance_expirations');

    const today = isoDaysFromNow(0);
    const { data: policies, error } = await svc
      .from('insurance_policies')
      .select(
        'id, policy_number, insurance_company, effective_date, expiration_date, remind_owner, remind_manager, reminder_30_sent_at, reminder_15_sent_at, owner_id, association_id, owners(full_name, email), associations(name, portfolio_id)',
      )
      .is('archived_at', null)
      .in('status', ['active', 'expiring_soon'])
      .gte('expiration_date', today)
      .lte('expiration_date', isoDaysFromNow(30));
    if (error) throw new Error(error.message);

    const due = (policies ?? [])
      .map((p: any) => {
        const daysLeft = Math.round((new Date(p.expiration_date + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000);
        const window = daysLeft <= 15 && !p.reminder_15_sent_at ? 15 : daysLeft > 15 && !p.reminder_30_sent_at ? 30 : null;
        return window ? { ...p, daysLeft, window } : null;
      })
      .filter(Boolean) as any[];

    if (due.length === 0) return NextResponse.json({ sent: 0, message: 'No reminders due today' });

    // Resolve assigned managers for the affected associations
    const assocIds = Array.from(new Set(due.map((p) => p.association_id).filter(Boolean)));
    const managersByAssoc = new Map<string, { email: string; name: string | null }[]>();
    // White-label branding: every email presents as the management company —
    // sender name, reply-to, and signature. Only the sending address stays on
    // the verified portier369.com domain (Resend requirement).
    const brandByPortfolio = new Map<string, { companyName: string | null; supportEmail: string | null; supportPhone: string | null }>();
    if (assocIds.length > 0) {
      const { data: assignments } = await svc
        .from('association_managers')
        .select('association_id, user_id')
        .in('association_id', assocIds)
        .is('ended_at', null);
      const userIds = Array.from(new Set((assignments ?? []).map((a: any) => a.user_id).filter(Boolean)));
      const profileById = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await svc.from('profiles').select('id, email, full_name').in('id', userIds);
        for (const pr of profiles ?? []) profileById.set(pr.id, pr);
      }
      for (const a of assignments ?? []) {
        const pr = profileById.get(a.user_id);
        if (!pr?.email) continue;
        const list = managersByAssoc.get(a.association_id) ?? [];
        list.push({ email: pr.email, name: pr.full_name ?? null });
        managersByAssoc.set(a.association_id, list);
      }
      const portfolioIds = Array.from(new Set(due.map((p) => p.associations?.portfolio_id).filter(Boolean)));
      if (portfolioIds.length > 0) {
        const { data: pfs } = await svc.from('portfolios').select('id, company_name, support_email, support_phone').in('id', portfolioIds);
        for (const pf of pfs ?? []) {
          brandByPortfolio.set(pf.id, {
            companyName: pf.company_name ?? null,
            supportEmail: pf.support_email ?? null,
            supportPhone: pf.support_phone ?? null,
          });
        }
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
            `Please renew your policy and upload the new certificate in your owner portal:\n${PORTAL_URL}\n\n${signature}`,
          associationId: p.association_id ?? null,
          portfolioId: p.associations?.portfolio_id ?? null,
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
              `Review insurance tracking:\n${MANAGER_URL}\n\n${signature}`,
            associationId: p.association_id ?? null,
            portfolioId: p.associations?.portfolio_id ?? null,
          });
        }
      }

      // Stamp the window as sent even when both parties opted out, so a later
      // opt-in doesn't fire a stale notice. Sending the 15-day notice also
      // closes the 30-day window for policies added late.
      const stamp: Record<string, string> = { [`reminder_${p.window}_sent_at`]: new Date().toISOString() };
      if (p.window === 15 && !p.reminder_30_sent_at) stamp.reminder_30_sent_at = new Date().toISOString();
      const { error: stampErr } = await svc.from('insurance_policies').update(stamp).eq('id', p.id);
      results.push({ policy: p.policy_number, window: p.window, daysLeft: p.daysLeft, stamped: !stampErr });
    }

    const { error: queueErr, count } = await queueEmails(svc, emails);
    if (queueErr) throw new Error(queueErr);

    return NextResponse.json({ sent: count, policies: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

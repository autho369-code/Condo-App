import Link from 'next/link';
import { Suspense } from 'react';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { EMAIL_FROM } from '@/lib/email/queue';
import { brandedFromAddress, dnsRecords, type SenderDomainRow } from '@/lib/email/sender-domains';
import { recordTone, senderStatus } from '@/lib/email/sender-status';
import { isRootDomain } from '@/lib/tenant/custom-domain';
import { customDomainStatus, isConfirmedLive } from '@/lib/tenant/domain-status';
import { apexDomain, tenantWorkspaceUrl } from '@/lib/tenant/host';
import { date } from '@/lib/utils';

export type CompanySenderRow = Pick<SenderDomainRow, 'domain' | 'from_local_part' | 'status' | 'records' | 'enabled' | 'last_checked_at'>;

/**
 * Read-only view of the company's own addresses: its workspace address, its
 * custom domain and its email sender domain, with the DNS records still
 * needed. The platform sets these up; the company adds the DNS records.
 */
export function AddressesCard({
  slug,
  customDomain,
  sender,
  senderError,
}: {
  slug: string | null;
  customDomain: string | null;
  sender: CompanySenderRow | null;
  senderError: string | null;
}) {
  const sending = brandedFromAddress(sender);
  const status = sender ? senderStatus(sender.status) : null;
  const records = dnsRecords(sender?.records);

  return (
    <Card id="addresses">
      <CardHeader>
        <CardTitle>Web address &amp; email</CardTitle>
        <p className="text-xs text-gray-500">
          Where your owners, board members and vendors sign in, and the address your email comes from. To set up
          or change these, send a <Link href="/company-admin/platform-requests" className="font-medium text-gray-900 underline-offset-4 hover:underline">platform request</Link>.
        </p>
      </CardHeader>
      <CardBody className="space-y-6">
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-950">Workspace address</h3>
          {slug ? (
            <a href={tenantWorkspaceUrl(slug, '/login')} className="break-all text-sm text-blue-700 underline-offset-4 hover:underline">
              {slug}.{apexDomain()}
            </a>
          ) : (
            <p className="text-sm text-gray-500">Not set up yet.</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-950">Custom domain</h3>
          {customDomain ? (
            <Suspense fallback={<p className="text-xs text-gray-500">Checking {customDomain}…</p>}>
              <CustomDomainStatus domain={customDomain} />
            </Suspense>
          ) : (
            <p className="text-sm text-gray-500">None. Your workspace address is used.</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-950">Email sender</h3>
          {senderError && <Alert title="The email sender could not be loaded">{senderError}</Alert>}
          {sender ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {status && <StatusChip tone={status.tone}>{status.label}</StatusChip>}
                {!sender.enabled && <StatusChip tone="neutral">Switched off</StatusChip>}
                <span className="text-xs text-gray-500">
                  {sending
                    ? `Your email is sent from ${sending}.`
                    : !sender.enabled
                      ? `Your email is sent from ${EMAIL_FROM} while the sender is switched off.`
                      : `Your email is sent from ${EMAIL_FROM} until ${sender.domain} is verified.`}
                  {sender.last_checked_at ? ` Last checked ${date(sender.last_checked_at)}.` : ''}
                </span>
              </div>
              {sender.status !== 'verified' && records.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-gray-600">
                    Add these DNS records for {sender.domain} at your domain provider, then send a platform request so the records are checked. DNS changes can take a few hours.
                  </p>
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <TR><TH>Type</TH><TH>Name</TH><TH>Value</TH><TH>Priority</TH><TH>Status</TH></TR>
                      </THead>
                      <tbody>
                        {records.map((r) => (
                          <TR key={`${r.type}-${r.name}-${r.value}`}>
                            <TD>{r.type}</TD>
                            <TD className="font-mono text-xs">{r.name}</TD>
                            <TD className="font-mono text-xs break-all">{r.value}</TD>
                            <TD>{r.priority ?? '—'}</TD>
                            <TD><StatusChip tone={recordTone(r.status)}>{r.status.replace(/_/g, ' ') || 'pending'}</StatusChip></TD>
                          </TR>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          ) : !senderError ? (
            <p className="text-sm text-gray-500">Your email is sent from {EMAIL_FROM} under your company&rsquo;s name.</p>
          ) : null}
        </section>
      </CardBody>
    </Card>
  );
}

async function CustomDomainStatus({ domain }: { domain: string }) {
  const status = await customDomainStatus(domain);
  const { current, pendingRecords } = status;
  // Hosting details (Vercel) are the platform's to fix; the company sees
  // whether the domain is live and which DNS records it still has to add.
  const live = isConfirmedLive(status);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="break-all text-gray-950">{domain}</span>
        <StatusChip tone={live ? 'success' : 'warning'}>{live ? 'Live' : pendingRecords.length ? 'Waiting for DNS records' : 'Being set up'}</StatusChip>
      </div>
      {pendingRecords.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-gray-600">
            Add these DNS records at your domain provider. Public DNS now answers: {current.length ? current.join(', ') : 'nothing'}.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR><TH>Type</TH><TH>Name</TH><TH>Value</TH></TR>
              </THead>
              <tbody>
                {pendingRecords.map((r) => (
                  <TR key={`${r.type}-${r.name}-${r.value}`}>
                    <TD>{r.type}</TD>
                    <TD className="font-mono text-xs">{r.name}</TD>
                    <TD className="font-mono text-xs break-all">{r.value}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {isRootDomain(domain)
              ? 'A root domain needs an A record. A subdomain such as portal.yourcompany.com can use a CNAME instead.'
              : 'Some providers want only the part before your domain in Name (for example, portal).'}
            {' '}DNS changes can take up to a few hours; reload this page to check again.
          </p>
        </div>
      )}
    </div>
  );
}

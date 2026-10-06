import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { EMAIL_FROM } from '@/lib/email/queue';
import { DEFAULT_FROM_LOCAL_PART, brandedFromAddress, dnsRecords, type SenderDomainRow } from '@/lib/email/sender-domains';
import { date } from '@/lib/utils';
import { checkSenderDomain, setSenderDomainEnabled, setupSenderDomain } from '../actions';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  verified: { tone: 'success', label: 'Verified' },
  pending: { tone: 'warning', label: 'Checking DNS' },
  not_started: { tone: 'warning', label: 'Waiting for DNS records' },
  partially_verified: { tone: 'warning', label: 'Partly verified' },
  partially_failed: { tone: 'danger', label: 'Some records failed' },
  failed: { tone: 'danger', label: 'Verification failed' },
  temporary_failure: { tone: 'warning', label: 'Temporary failure' },
};

export function EmailDomainCard({
  portfolioId,
  row,
  loadError,
  returnTo,
}: {
  portfolioId: string;
  row: SenderDomainRow | null;
  loadError: string | null;
  returnTo: string;
}) {
  const sending = brandedFromAddress(row);
  const records = dnsRecords(row?.records);
  const status = row ? STATUS[row.status] ?? { tone: 'neutral' as Tone, label: row.status } : null;

  return (
    <Card id="email-domain">
      <CardHeader>
        <CardTitle>Email sender domain</CardTitle>
        <p className="text-xs text-gray-500">
          Send the company&rsquo;s email (notices, statements, invitations) from its own domain instead of {EMAIL_FROM}.
          Mail keeps going out from {EMAIL_FROM} until the domain is verified, and falls back to it if the domain stops verifying.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {loadError && <Alert title="The sender domain could not be loaded">{loadError}</Alert>}

        <form action={setupSenderDomain as any} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="portfolio_id" value={portfolioId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <div>
            <Label htmlFor="from_local_part">Address</Label>
            <div className="flex items-center gap-2">
              <Input
                id="from_local_part"
                name="from_local_part"
                defaultValue={row?.from_local_part ?? DEFAULT_FROM_LOCAL_PART}
                maxLength={64}
                autoCapitalize="none"
                spellCheck={false}
                className="w-36"
              />
              <span className="text-sm text-gray-500">@</span>
              <Input
                id="domain"
                name="domain"
                aria-label="Sending domain"
                required
                defaultValue={row?.domain ?? ''}
                placeholder="theircompany.com"
                maxLength={253}
                autoCapitalize="none"
                spellCheck={false}
                className="w-64"
              />
            </div>
          </div>
          <Button type="submit" variant="secondary">{row ? 'Save Sender' : 'Set Up Domain'}</Button>
        </form>

        {row && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {status && <StatusChip tone={status.tone}>{status.label}</StatusChip>}
              {!row.enabled && <StatusChip tone="neutral">Switched off</StatusChip>}
              <span className="text-xs text-gray-500">
                {sending ? `Company mail is sent from ${sending}.` : `Company mail is sent from ${EMAIL_FROM} for now.`}
                {row.last_checked_at ? ` Last checked ${date(row.last_checked_at)}.` : ''}
              </span>
            </div>
            {row.last_error && <Alert tone="warning" title="Last check">{row.last_error}</Alert>}

            <div className="flex flex-wrap gap-2">
              <form action={checkSenderDomain as any}>
                <input type="hidden" name="portfolio_id" value={portfolioId} />
                <input type="hidden" name="return_to" value={returnTo} />
                <Button type="submit" variant="secondary" size="sm">Check Now</Button>
              </form>
              <form action={setSenderDomainEnabled as any}>
                <input type="hidden" name="portfolio_id" value={portfolioId} />
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="enabled" value={row.enabled ? 'false' : 'true'} />
                <Button type="submit" variant="secondary" size="sm">
                  {row.enabled ? 'Switch Off (Use Platform Address)' : 'Switch On'}
                </Button>
              </form>
            </div>

            {row.status !== 'verified' && records.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-gray-600">
                  Send the company these DNS records for {row.domain}, then press Check Now. DNS changes can take a few hours.
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
                          <TD><StatusChip tone={r.status === 'verified' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>{r.status.replace(/_/g, ' ') || 'pending'}</StatusChip></TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

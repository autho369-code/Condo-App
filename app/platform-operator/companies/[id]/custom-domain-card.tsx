import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { apexDomain } from '@/lib/tenant/host';
import { isRootDomain } from '@/lib/tenant/custom-domain';
import { customDomainStatus } from '@/lib/tenant/domain-status';
import { updateCustomDomain } from '../actions';

export function CustomDomainCard({
  portfolioId,
  slug,
  customDomain,
  returnTo,
}: {
  portfolioId: string;
  slug: string | null;
  customDomain: string | null;
  returnTo: string;
}) {
  return (
    <Card id="custom-domain">
      <CardHeader>
        <CardTitle>Custom domain</CardTitle>
        <p className="text-[13px] text-gray-500">
          Serve the company from its own domain, such as portal.theircompany.com. Its workspace address
          {slug ? ` (${slug}.${apexDomain()})` : ''} keeps working alongside it. Leave the field empty and save to remove the domain.
        </p>
      </CardHeader>
      <CardBody>
        <form action={updateCustomDomain as any} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="portfolio_id" value={portfolioId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <div>
            <Label htmlFor="custom_domain">Domain</Label>
            <Input
              id="custom_domain"
              name="custom_domain"
              defaultValue={customDomain ?? ''}
              placeholder="portal.theircompany.com"
              maxLength={253}
              autoCapitalize="none"
              spellCheck={false}
              className="w-72"
            />
          </div>
          <Button type="submit" variant="secondary">Save Domain</Button>
        </form>
        {customDomain && (
          <Suspense fallback={<p className="mt-4 text-xs text-gray-500">Checking {customDomain}…</p>}>
            <DomainStatus domain={customDomain} />
          </Suspense>
        )}
      </CardBody>
    </Card>
  );
}

async function DomainStatus({ domain }: { domain: string }) {
  const { tone, label, current, pendingRecords: records, vercel, vercelConfigured } = await customDomainStatus(domain);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusChip tone={tone}>{label}</StatusChip>
        <span className="text-[13px] text-gray-500">
          Public DNS now answers: {current.length ? current.join(', ') : 'nothing'}
        </span>
      </div>

      {vercel?.state === 'error' && <Alert title="Vercel status could not be loaded">{vercel.error}</Alert>}
      {vercel?.state === 'not-attached' && (
        <Alert tone="warning" title="The domain is not on the Vercel project">
          Save the domain again to add it, or add {domain} under Vercel → Project → Domains.
        </Alert>
      )}
      {!vercelConfigured && (
        <p className="text-[13px] text-gray-500">
          Add {domain} under Vercel → Project → Domains (set VERCEL_API_TOKEN and VERCEL_PROJECT_ID to do this automatically on save).
        </p>
      )}

      {records.length > 0 ? (
        <div>
          <p className="mb-2 text-xs text-gray-600">Send the company these DNS records for their domain provider:</p>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR><TH>Type</TH><TH>Name</TH><TH>Value</TH></TR>
              </THead>
              <tbody>
                {records.map((r) => (
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
              ? 'A root domain needs an A record. A subdomain such as portal.theircompany.com can use a CNAME instead.'
              : 'Some providers want only the part before the company\u2019s domain in Name (for example, portal).'}
            {' '}DNS changes can take up to a few hours; reload this page to check again.
          </p>
        </div>
      ) : null}
    </div>
  );
}

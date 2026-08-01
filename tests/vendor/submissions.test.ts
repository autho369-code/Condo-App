import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const actions = readFileSync(resolve(root, 'lib/rpcs/vendor-submissions.ts'), 'utf8');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260801010000_vendor_invoice_submission.sql'), 'utf8');
const documentTypesMigration = readFileSync(resolve(root, 'supabase/migrations/20260801011000_vendor_document_types.sql'), 'utf8');
const payments = readFileSync(resolve(root, 'app/vendor/payments/page.tsx'), 'utf8');
const compliance = readFileSync(resolve(root, 'app/vendor/compliance/page.tsx'), 'utf8');

describe('vendor submissions', () => {
  it('keeps upload capabilities scoped to the authenticated vendor', () => {
    expect(actions).toContain('const me = await requireVendor()');
    expect(actions).toContain('`vendors/${me.vendor_id}/${category}/');
    expect(actions).toContain("isScopedStoragePath(input.path, 'vendors', me.vendor_id)");
    expect(actions).toContain("isScopedStoragePath(input.attachment.path, 'vendors', me.vendor_id)");
    expect(actions).toContain('.storage.from(BUCKET).info(');
  });

  it('creates vendor invoices atomically from assigned work-order scope', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('wo.vendor_id = v_vendor_id');
    expect(migration).toContain('wo.archived_at is null');
    expect(migration).toContain("'pending_approval', true, auth.uid()");
    expect(migration).toContain("'vendor', v_vendor_id, 'vendor_invoice'");
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('Invoice number already exists for this vendor');
    expect(migration).toContain('revoke all on function public.submit_vendor_invoice');
    expect(migration).toContain('grant execute on function public.submit_vendor_invoice');
    expect(documentTypesMigration).toContain("'vendor_invoice'::text");
    expect(documentTypesMigration).toContain("'workers_comp'::text");
    expect(documentTypesMigration).toContain("'w9'::text");
  });

  it('exposes real invoice and compliance upload forms in the vendor portal', () => {
    expect(payments).toContain('<InvoiceSubmissionForm workOrders={workOrders} />');
    expect(payments).toContain('Invoice submitted for management approval.');
    expect(compliance).toContain('<ComplianceDocumentForm');
    expect(compliance).toContain(".eq('entity_type', 'vendor').eq('entity_id', me.vendor_id)");
    expect(compliance).toContain('Requests from management');
  });
});

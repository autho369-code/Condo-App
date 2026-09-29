import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { requestVendorDocument } from '@/lib/rpcs/vendor-document-requests';
import { VENDOR_DOC_TYPES, firstVendorEmail, isVendorDocType } from '@/lib/vendors/document-requests';

export const dynamic = 'force-dynamic';

// Older links used template names; map them onto the document types.
const LEGACY: Record<string, string> = { w9_request: 'w9', document_request: 'general_liability' };

export default async function VendorFormsPage({ searchParams }: { searchParams: Promise<{ vendor?: string; template?: string; doc?: string; error?: string; saved?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: vendors } = await db.from('vendors').select('id, name, trade, emails').is('archived_at', null).order('name').limit(1000);
  const requested = sp.doc ?? LEGACY[sp.template ?? ''] ?? sp.template ?? 'w9';
  const docType = isVendorDocType(requested) ? requested : 'w9';
  const selected = (vendors ?? []).find((v: any) => v.id === sp.vendor);

  return (
    <DataWorkspace
      title="Request a vendor document"
      description="Email a vendor a secure upload link for their W-9, insurance certificate or license. No vendor login needed; you review what they send."
      actions={<Link href="/vendors/compliance"><Button variant="secondary">Vendor compliance</Button></Link>}
    >
      <div className="max-w-3xl space-y-4">
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved} <Link href="/vendors/compliance" className="font-semibold underline">Track it</Link></Alert>}
        <Surface>
          <form action={requestVendorDocument} className="space-y-5">
            <input type="hidden" name="back" value="forms" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor" htmlFor="vendor_id">
                <Select id="vendor_id" name="vendor_id" defaultValue={sp.vendor ?? ''} required>
                  <option value="">Select a vendor</option>
                  {(vendors ?? []).map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}{firstVendorEmail(v.emails) ? '' : ' (no email on file)'}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Document" htmlFor="doc_type">
                <Select id="doc_type" name="doc_type" defaultValue={docType}>
                  {VENDOR_DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </Select>
              </Field>
              <Field label="Send to" htmlFor="email" hint="Leave blank to use the vendor’s email on file.">
                <Input id="email" name="email" type="email" maxLength={320} placeholder={firstVendorEmail(selected?.emails) ?? 'vendor@example.com'} />
              </Field>
              <Field label="Due date (optional)" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </Field>
            </div>
            <Field label="Message (optional)" htmlFor="message">
              <Textarea id="message" name="message" rows={4} maxLength={2000} placeholder="e.g. Please list Granville Courts Condominium Association as additional insured." />
            </Field>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Link href="/vendors"><Button variant="secondary" type="button">Cancel</Button></Link>
              <Button type="submit">Email request</Button>
            </div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}

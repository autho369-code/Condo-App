'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import MergeFieldEditor, { MERGE_FIELDS } from '@/components/letters/merge-field-editor';

export default function PreviewLetterPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Entity selection
  const [entityType, setEntityType] = useState<'association' | 'owner' | 'vendor'>('owner');
  const [associations, setAssociations] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedAssocId, setSelectedAssocId] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // Email
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Load template
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (err) { setError('Template not found.'); setLoading(false); return; }
      setTemplate(data);

      // Load associations
      const { data: assocs } = await supabase.from('associations').select('id, name').order('name');
      setAssociations(assocs || []);

      // Load owners
      const { data: ownersData } = await supabase.from('owners').select('id, full_name, email, mailing_address, phone').order('full_name');
      setOwners(ownersData || []);

      // Load vendors
      const { data: vendorsData } = await supabase.from('vendors').select('id, company_name, contact_name, emails, phone_numbers, address').order('company_name');
      setVendors(vendorsData || []);

      setLoading(false);
    }
    load();
  }, [id]);

  // Merge values based on selection
  const getMergeValues = useCallback((): Record<string, string> => {
    const vals: Record<string, string> = {};
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 14);

    vals['current_date'] = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    vals['current_date_short'] = now.toLocaleDateString('en-US');
    vals['due_date'] = dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    vals['amount_due'] = '$350.00';
    vals['late_fee_amount'] = '$25.00';
    vals['payment_instructions'] = 'Pay online at portal.portier369.com or mail check to PO Box 1234, Springfield, IL 62701.';
    vals['violation_description'] = 'Unauthorized exterior modification — satellite dish on balcony';
    vals['violation_rule'] = 'CC&R Section 4.2 — Exterior Modifications';
    vals['hearing_date'] = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' at 6:30 PM';
    vals['manager_name'] = 'Sarah Williams, CAM';
    vals['board_president_name'] = 'Robert Johnson';

    // Association values
    const assoc = associations.find((a: any) => a.id === selectedAssocId);
    if (assoc) {
      vals['association_name'] = assoc.name || '';
      vals['association_address'] = assoc.address || '123 Community Way';
      vals['association_city'] = assoc.city || 'Springfield';
      vals['association_state'] = assoc.state || 'IL';
      vals['association_zip'] = assoc.zip || '62701';
      vals['association_phone'] = assoc.phone || '(555) 123-4567';
    }

    // Owner values
    const owner = owners.find((o: any) => o.id === selectedOwnerId);
    if (owner) {
      vals['owner_name'] = owner.full_name || '';
      vals['owner_address'] = owner.mailing_address || '456 Oak Lane, Springfield, IL 62702';
      vals['owner_email'] = owner.email || '';
      vals['owner_phone'] = owner.phone || '(555) 987-6543';
      vals['owner_unit'] = owner.unit_label || 'Unit 4B';
      vals['owner_account_number'] = owner.account_number || `OA-${String(owners.indexOf(owner) + 1).padStart(4, '0')}`;
      vals['owner_balance'] = '$1,250.00';
    }

    // Vendor values
    const vendor = vendors.find((v: any) => v.id === selectedVendorId);
    if (vendor) {
      vals['vendor_name'] = vendor.company_name || '';
      vals['vendor_address'] = vendor.address || '789 Commerce Dr, Springfield, IL 62703';
      vals['vendor_email'] = vendor.emails?.[0] || '';
      vals['vendor_phone'] = vendor.phone_numbers?.[0] || '(555) 456-7890';
    }

    return vals;
  }, [associations, owners, vendors, selectedAssocId, selectedOwnerId, selectedVendorId]);

  const mergeValues = getMergeValues();

  // Merge the body
  const mergedBody = (template?.body || '').replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
    return mergeValues[key] || `{{${key}}}`;
  });

  const mergedSubject = (template?.subject || '').replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
    return mergeValues[key] || `{{${key}}}`;
  });

  function handlePrint() {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${mergedSubject || 'Letter'}</title>
        <style>
          body { font-family: Georgia, serif; font-size: 13pt; line-height: 1.7; color: #1a1a1a; max-width: 650px; margin: 2rem auto; padding: 0 2rem; }
          h2 { font-size: 1.1rem; margin-top: 1.5rem; }
          h3 { font-size: 1rem; margin-top: 1rem; }
          @media print { body { margin: 1rem; } }
        </style>
      </head>
      <body>
        <p style="font-size: 10pt; color: #888; margin-bottom: 2rem;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${mergedBody}
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  }

  async function handleSendEmail() {
    if (!emailTo.trim()) return;
    setSending(true);
    const res = await fetch('/api/letters/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: id,
        to: emailTo.trim(),
        subject: mergedSubject,
        body: mergedBody,
      }),
    });
    if (!res.ok) {
      const errData = await res.json();
      setError(errData.error || 'Failed to send email.');
    } else {
      setSent(true);
      setShowEmail(false);
    }
    setSending(false);
  }

  // Auto-set email when entity is selected
  useEffect(() => {
    if (entityType === 'owner' && selectedOwnerId) {
      const owner = owners.find((o: any) => o.id === selectedOwnerId);
      if (owner?.email) setEmailTo(owner.email);
    }
    if (entityType === 'vendor' && selectedVendorId) {
      const vendor = vendors.find((v: any) => v.id === selectedVendorId);
      if (vendor?.emails?.[0]) setEmailTo(vendor.emails[0]);
    }
    setSent(false);
  }, [entityType, selectedOwnerId, selectedVendorId, owners, vendors]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-gray-200" />
          <div className="h-10 w-64 rounded bg-gray-200" />
          <div className="h-[400px] rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-6">
        <p className="text-red-600">{error || 'Template not found'}</p>
        <Link href="/letters" className="mt-4 inline-block text-sm text-emerald-600 hover:underline">Back to letters</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-6xl overflow-y-auto px-8 py-6">
      <nav className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/letters" className="hover:text-emerald-600">Letters</Link>
        <span className="mx-1">/</span>
        <Link href={`/letters/${id}/edit`} className="hover:text-emerald-600">{template.name}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">Preview &amp; send</span>
      </nav>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {sent && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Letter sent successfully to {emailTo}.
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Controls */}
        <div className="w-80 flex-shrink-0 space-y-4">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Preview data</h2>
            <p className="mb-3 text-xs text-gray-500">Select an entity to preview the merged letter.</p>

            {/* Entity type tabs */}
            <div className="mb-3 flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {(['association', 'owner', 'vendor'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setEntityType(type); setSelectedAssocId(''); setSelectedOwnerId(''); setSelectedVendorId(''); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${entityType === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Association selector */}
            {entityType === 'association' && (
              <select
                value={selectedAssocId}
                onChange={(e) => setSelectedAssocId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select association...</option>
                {associations.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}

            {/* Owner selector */}
            {entityType === 'owner' && (
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select owner...</option>
                {owners.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </select>
            )}

            {/* Vendor selector */}
            {entityType === 'vendor' && (
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select vendor...</option>
                {vendors.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.company_name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Merge values preview */}
          <details className="rounded-lg border border-gray-200">
            <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Merge values
            </summary>
            <div className="border-t border-gray-200 px-4 py-3 max-h-64 overflow-y-auto">
              {Object.entries(mergeValues).map(([key, val]) => (
                <div key={key} className="flex justify-between py-0.5 text-xs">
                  <code className="text-emerald-700">{key}</code>
                  <span className="text-gray-500 truncate ml-2 max-w-[140px]">{val || '(empty)'}</span>
                </div>
              ))}
            </div>
          </details>

          {/* Actions */}
          <div className="space-y-2 border-t border-gray-200 pt-4">
            <Button onClick={handlePrint} className="w-full">
              🖨 Print letter
            </Button>
            <Button variant="secondary" onClick={() => setShowEmail(!showEmail)} className="w-full">
              ✉ {showEmail ? 'Cancel email' : 'Send via email'}
            </Button>

            {showEmail && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <label className="text-xs font-medium text-gray-600">Recipient email</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="owner@example.com"
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <Button onClick={handleSendEmail} disabled={sending || !emailTo.trim()} className="w-full" size="sm">
                  {sending ? 'Sending...' : 'Send now'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Letter preview</h2>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            {/* Letter content */}
            <div className="px-8 py-10">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: mergedBody }}
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '13pt',
                  lineHeight: '1.7',
                  color: '#1a1a1a',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

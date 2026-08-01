'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { escapeHtmlText, sanitizeRichTextHtml } from '@/lib/security/rich-text';

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
  const [boardMembers, setBoardMembers] = useState<any[]>([]);
  const [selectedAssocId, setSelectedAssocId] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // Email
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailRequestKey, setEmailRequestKey] = useState('');

  useEffect(() => {
    setEmailRequestKey(crypto.randomUUID());
  }, []);

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

      const [
        { data: assocs },
        { data: ownersData },
        { data: vendorsData },
        { data: boardData },
      ] = await Promise.all([
        supabase
          .from('associations')
          .select('id, name, address, address_line_2, city, state, zip, maintenance_phone, payment_instructions, late_fee_amount_override, site_manager')
          .order('name'),
        supabase
          .from('owners')
          .select('id, full_name, email, mailing_address, address_street, address_city, address_state, address_zip, phone, unit_owners(is_primary, end_date, units(unit_number, association_id))')
          .order('full_name'),
        supabase
          .from('vendors')
          .select('id, name, emails, phone_numbers, address_street, address_city, address_state, address_zip')
          .order('name'),
        supabase
          .from('board_members')
          .select('association_id, full_name, role, active')
          .eq('active', true),
      ]);

      setAssociations(assocs || []);
      setOwners(ownersData || []);
      setVendors(vendorsData || []);
      setBoardMembers(boardData || []);

      setLoading(false);
    }
    load();
  }, [id]);

  // Merge values based on selection
  const mergeValues = useMemo((): Record<string, string> => {
    const vals: Record<string, string> = {};
    const now = new Date();

    vals['current_date'] = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    vals['current_date_short'] = now.toLocaleDateString('en-US');

    const owner = owners.find((o: any) => o.id === selectedOwnerId);
    const activeOwnerships = owner?.unit_owners?.filter((row: any) => !row.end_date) ?? [];
    const primaryOwnership = activeOwnerships.find((row: any) => row.is_primary) ?? activeOwnerships[0];
    const effectiveAssocId = selectedAssocId || primaryOwnership?.units?.association_id || '';

    // Association values
    const assoc = associations.find((a: any) => a.id === effectiveAssocId);
    if (assoc) {
      vals['association_name'] = assoc.name || '';
      vals['association_address'] = [assoc.address, assoc.address_line_2, assoc.city, assoc.state, assoc.zip].filter(Boolean).join(', ');
      vals['association_city'] = assoc.city || '';
      vals['association_state'] = assoc.state || '';
      vals['association_zip'] = assoc.zip || '';
      vals['association_phone'] = assoc.maintenance_phone || '';
      vals['payment_instructions'] = assoc.payment_instructions || '';
      vals['manager_name'] = assoc.site_manager || '';
      if (assoc.late_fee_amount_override != null) {
        vals['late_fee_amount'] = Number(assoc.late_fee_amount_override).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      }
      vals['board_president_name'] = boardMembers.find(
        (member: any) => member.association_id === effectiveAssocId && member.role === 'president',
      )?.full_name || '';
    }

    // Owner values
    if (owner) {
      vals['owner_name'] = owner.full_name || '';
      vals['owner_address'] = owner.mailing_address || [owner.address_street, owner.address_city, owner.address_state, owner.address_zip].filter(Boolean).join(', ');
      vals['owner_email'] = owner.email || '';
      vals['owner_phone'] = owner.phone || '';
      vals['owner_unit'] = primaryOwnership?.units?.unit_number || '';
    }

    // Vendor values
    const vendor = vendors.find((v: any) => v.id === selectedVendorId);
    if (vendor) {
      vals['vendor_name'] = vendor.name || '';
      vals['vendor_address'] = [vendor.address_street, vendor.address_city, vendor.address_state, vendor.address_zip].filter(Boolean).join(', ');
      vals['vendor_email'] = vendor.emails?.[0] || '';
      vals['vendor_phone'] = vendor.phone_numbers?.[0] || '';
    }

    return vals;
  }, [associations, boardMembers, owners, vendors, selectedAssocId, selectedOwnerId, selectedVendorId]);

  // Merge the body
  const mergedBodyUnsafe = (template?.body || '').replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
    return mergeValues[key] || `{{${key}}}`;
  });

  const mergedSubject = (template?.subject || '').replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
    return mergeValues[key] || `{{${key}}}`;
  }).replace(/[\r\n]+/g, ' ').trim();

  // DOMPurify is intentionally browser-only. Start empty for SSR/hydration,
  // then populate the allowlisted HTML before preview, print, or email use.
  const [mergedBody, setMergedBody] = useState('');
  useEffect(() => {
    setMergedBody(sanitizeRichTextHtml(mergedBodyUnsafe));
  }, [mergedBodyUnsafe]);

  function handlePrint() {
    const safeBody = sanitizeRichTextHtml(mergedBodyUnsafe);
    const safeTitle = escapeHtmlText(mergedSubject || 'Letter');
    const printDocument = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="referrer" content="no-referrer">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
        <title>${safeTitle}</title>
        <style>
          body { font-family: Georgia, serif; font-size: 13pt; line-height: 1.7; color: #1a1a1a; max-width: 650px; margin: 2rem auto; padding: 0 2rem; }
          h2 { font-size: 1.1rem; margin-top: 1.5rem; }
          h3 { font-size: 1rem; margin-top: 1rem; }
          @media print { body { margin: 1rem; } }
        </style>
      </head>
      <body>
        <p style="font-size: 10pt; color: #888; margin-bottom: 2rem;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${safeBody}
        <script>window.addEventListener('load', function () { window.print(); });<\/script>
      </body>
      </html>
    `;

    // A Blob document plus noopener/noreferrer avoids document.write() into a
    // same-origin popup. Only our fixed print script remains; all stored and
    // merged content has already passed the explicit DOMPurify allowlist.
    const printUrl = URL.createObjectURL(new Blob([printDocument], { type: 'text/html' }));
    window.open(printUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);
  }

  async function handleSendEmail() {
    if (!emailTo.trim() || !emailRequestKey) return;
    setSending(true);
    const res = await fetch('/api/letters/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: id,
        associationId: selectedAssocId || null,
        requestKey: emailRequestKey,
        to: emailTo.trim(),
        subject: mergedSubject,
        // Re-sanitize at the moment of use so a same-tick click cannot race
        // the effect that updates the preview after merge values change.
        body: sanitizeRichTextHtml(mergedBodyUnsafe),
      }),
    });
    if (!res.ok) {
      const errData = await res.json();
      setError(errData.error || 'Failed to send email.');
    } else {
      setSent(true);
      setShowEmail(false);
      setEmailRequestKey(crypto.randomUUID());
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
        <Link href={`/letters/${id}/edit`} className="transition-colors hover:text-gray-700">{template.name}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">Preview &amp; send</span>
      </nav>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
      )}
      {sent && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
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
                  <option key={v.id} value={v.id}>{v.name}</option>
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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

'use client';

import { useState, useMemo } from 'react';
import { sendBulkComms } from '@/lib/rpcs/maintenance-comms';
import { Button } from '@/components/ui/button';

const PRIORITY_TONES: Record<string, string> = {
  emergency: 'text-red-600',
  high: 'text-amber-600',
  normal: 'text-blue-600',
  low: 'text-gray-500',
};

function extractEmail(entity: any): string {
  if (!entity?.emails) return '';
  if (Array.isArray(entity.emails)) {
    const work = entity.emails.find((e: any) => e?.type === 'work' || e?.label === 'work');
    if (work?.email) return work.email;
    const first = entity.emails.find((e: any) => e?.email);
    if (first?.email) return first.email;
  }
  return '';
}

function extractPhone(entity: any): string {
  if (entity?.phone && typeof entity.phone === 'string' && entity.phone.trim()) return entity.phone.trim();
  if (entity?.phone_numbers && Array.isArray(entity.phone_numbers)) {
    const mobile = entity.phone_numbers.find((p: any) => p?.type === 'mobile' || p?.label === 'mobile');
    if (mobile?.number) return mobile.number;
    const first = entity.phone_numbers.find((p: any) => p?.number);
    if (first?.number) return first.number;
  }
  return '';
}

function parseVendorEmails(vendor: any): string[] {
  if (!vendor?.emails || !Array.isArray(vendor.emails)) return [];
  return vendor.emails
    .filter((e: any) => e?.email && typeof e.email === 'string')
    .map((e: any) => e.email.trim())
    .filter(Boolean);
}

function parseVendorPhones(vendor: any): string[] {
  if (!vendor?.phone_numbers || !Array.isArray(vendor.phone_numbers)) return [];
  return vendor.phone_numbers
    .filter((p: any) => p?.number && typeof p.number === 'string')
    .map((p: any) => p.number.trim())
    .filter(Boolean);
}

interface Recipient {
  vendorId: string;
  vendorName: string;
  email: string;
  phone: string;
  source: 'work_order' | 'maintenance_task' | 'manual' | 'all';
  sourceRef: string;
}

export function BulkCommsForm({
  workOrders,
  vendors,
  templates,
  maintenanceTasks,
  preSelectedWoId,
}: {
  workOrders: any[];
  vendors: any[];
  templates: any[];
  maintenanceTasks: any[];
  preSelectedWoId: string;
}) {
  const [channel, setChannel] = useState<string>('email');
  const [commType, setCommType] = useState<string>('custom');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [selectedWoIds, setSelectedWoIds] = useState<Set<string>>(new Set(preSelectedWoId ? [preSelectedWoId] : []));
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<any>(null);

  // ── Toggle work order selection ──
  function toggleWo(id: string) {
    setSelectedWoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllWos() {
    const all = new Set(workOrders.map((wo: any) => wo.id));
    setSelectedWoIds(all);
  }

  function clearAllWos() {
    setSelectedWoIds(new Set());
  }

  // ── Toggle vendor selection ──
  function toggleVendor(id: string) {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVendors() {
    const all = new Set(vendors.map((v: any) => v.id));
    setSelectedVendorIds(all);
  }

  // ── Toggle maintenance task selection ──
  function toggleTask(id: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Template handling ──
  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    const tpl = templates.find((t: any) => t.id === templateId);
    if (tpl) {
      if (tpl.subject) setSubject(tpl.subject);
      if (tpl.body) setBody(tpl.body);
      if (tpl.channel === 'email' || tpl.channel === 'sms') setChannel(tpl.channel);
    }
  }

  function handleCommTypeChange(type: string) {
    setCommType(type);
    if (type === 'status_update' && body === '') {
      setSubject('Work Order Status Update');
      setBody('Please be advised of the following work order status updates:\n\n');
    } else if (type === 'reminder' && body === '') {
      setSubject('Maintenance Reminder');
      setBody('This is a reminder regarding upcoming scheduled maintenance:\n\n');
    }
  }

  // ── Resolve recipients ──
  const recipients = useMemo<Recipient[]>(() => {
    const map = new Map<string, Recipient>();

    // From selected work orders
    for (const wo of workOrders) {
      if (!selectedWoIds.has(wo.id)) continue;
      const vendor = wo.vendors;
      if (!vendor) continue;
      const email = extractEmail(vendor);
      const phone = extractPhone(vendor);
      if (!email && !phone) continue;
      const key = vendor.name || wo.vendor_id;
      if (!map.has(key)) {
        map.set(key, {
          vendorId: wo.vendor_id,
          vendorName: vendor.name ?? 'Unknown Vendor',
          email,
          phone,
          source: 'work_order' as const,
          sourceRef: `WO #${wo.number ?? wo.id}`,
        });
      }
    }

    // From selected maintenance tasks
    for (const task of maintenanceTasks) {
      if (!selectedTaskIds.has(task.id)) continue;
      const vendor = task.vendors;
      if (!vendor) continue;
      const email = extractEmail(vendor);
      const phone = extractPhone(vendor);
      if (!email && !phone) continue;
      const key = vendor.name || task.vendor_id;
      if (!map.has(key)) {
        map.set(key, {
          vendorId: task.vendor_id,
          vendorName: vendor.name ?? 'Unknown Vendor',
          email,
          phone,
          source: 'maintenance_task' as const,
          sourceRef: task.task_name || 'Maintenance Task',
        });
      }
    }

    // From manually selected vendors
    for (const v of vendors) {
      if (!selectedVendorIds.has(v.id)) continue;
      const email = extractEmail(v);
      const phone = extractPhone(v);
      if (!email && !phone) continue;
      if (!map.has(v.name)) {
        map.set(v.name, {
          vendorId: v.id,
          vendorName: v.name,
          email,
          phone,
          source: 'manual' as const,
          sourceRef: v.trade ?? 'Vendor',
        });
      }
    }

    return Array.from(map.values());
  }, [selectedWoIds, selectedTaskIds, selectedVendorIds, workOrders, maintenanceTasks, vendors]);

  // ── Send ──
  async function handleSend(formData: FormData) {
    if (recipients.length === 0) {
      setError('No recipients selected. Choose work orders, maintenance tasks, or vendors.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await sendBulkComms(formData);
      if (result.success) {
        setSent(true);
        setSendResults(result);
      } else {
        setError(result.error || 'Failed to send');
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    }
    setSending(false);
  }

  // ── If sent, show confirmation ──
  if (sent) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-4xl mb-3">&#10003;</div>
        <h3 className="text-lg font-semibold text-emerald-800">Messages Queued</h3>
        <p className="mt-1 text-sm text-emerald-700">
          {sendResults?.queued ?? recipients.length} message{recipients.length !== 1 ? 's' : ''} queued for delivery
          to {recipients.length} vendor{recipients.length !== 1 ? 's' : ''}.
        </p>
        {sendResults?.channel && (
          <p className="mt-1 text-xs text-emerald-600">Channel: {sendResults.channel}</p>
        )}
        <button
          onClick={() => {
            setSent(false);
            setSendResults(null);
            setSubject('');
            setBody('');
          }}
          className="mt-4 inline-block rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
        >
          Send Another
        </button>
      </div>
    );
  }

  const hasWorkOrders = workOrders.length > 0;
  const hasMaintenanceTasks = maintenanceTasks.length > 0;

  return (
    <form action={handleSend} className="space-y-6">
      {/* Hidden fields */}
      {Array.from(selectedWoIds).map((id) => (
        <input key={`wo-${id}`} type="hidden" name="work_order_ids" value={id} />
      ))}
      {Array.from(selectedTaskIds).map((id) => (
        <input key={`task-${id}`} type="hidden" name="maintenance_task_ids" value={id} />
      ))}
      {Array.from(selectedVendorIds).map((id) => (
        <input key={`vendor-${id}`} type="hidden" name="vendor_ids" value={id} />
      ))}

      {/* Communication type */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Communication type</label>
        <div className="flex gap-3">
          {([
            { value: 'status_update', label: 'Status Update' },
            { value: 'reminder', label: 'Reminder' },
            { value: 'custom', label: 'Custom Message' },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm hover:border-emerald-500 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 ${
                commType === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="comm_type"
                value={opt.value}
                checked={commType === opt.value}
                onChange={() => handleCommTypeChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Channel */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Channel</label>
        <div className="flex gap-3">
          {([
            { value: 'email', label: 'Email' },
            { value: 'sms', label: 'SMS' },
            { value: 'both', label: 'Email + SMS' },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm hover:border-emerald-500 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 ${
                channel === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="channel"
                value={opt.value}
                checked={channel === opt.value}
                onChange={() => setChannel(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Template selector */}
      {templates.length > 0 && (
        <div>
          <label htmlFor="template_selector" className="mb-1 block text-sm font-medium text-gray-700">
            Load template
          </label>
          <select
            id="template_selector"
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="h-10 w-full max-w-md rounded border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="">Choose a template...</option>
            {templates.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.channel})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Work Order Selection */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Select by work order</label>
          {hasWorkOrders && (
            <div className="flex gap-2">
              <button type="button" onClick={selectAllWos} className="text-xs text-emerald-600 hover:underline">
                Select all
              </button>
              <button type="button" onClick={clearAllWos} className="text-xs text-gray-400 hover:underline">
                Clear
              </button>
            </div>
          )}
        </div>
        {hasWorkOrders ? (
          <div className="max-h-48 overflow-y-auto rounded border border-gray-200 bg-white">
            {workOrders.map((wo: any) => {
              const vendor = wo.vendors;
              const hasContact = vendor && (extractEmail(vendor) || extractPhone(vendor));
              return (
                <label
                  key={wo.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 ${
                    selectedWoIds.has(wo.id) ? 'bg-emerald-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedWoIds.has(wo.id)}
                    onChange={() => toggleWo(wo.id)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                  />
                  <span className={`font-mono text-xs ${PRIORITY_TONES[wo.priority] || 'text-gray-500'}`}>
                    {wo.priority?.toUpperCase() ?? ''}
                  </span>
                  <span className="font-medium text-gray-900">
                    #{wo.number ?? wo.id} {wo.title}
                  </span>
                  <span className="text-gray-500">{wo.associations?.name}</span>
                  <span className="text-gray-400">
                    — {vendor?.name ?? 'No vendor'}
                    {!hasContact && ' (no contact)'}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No active work orders with assigned vendors.</p>
        )}
      </div>

      {/* Maintenance Task Selection */}
      {hasMaintenanceTasks && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Select by maintenance task</label>
          <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-white">
            {maintenanceTasks.map((task: any) => {
              const vendor = task.vendors;
              const hasContact = vendor && (extractEmail(vendor) || extractPhone(vendor));
              return (
                <label
                  key={task.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 ${
                    selectedTaskIds.has(task.id) ? 'bg-emerald-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.has(task.id)}
                    onChange={() => toggleTask(task.id)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                  />
                  <span className="font-medium text-gray-900">{task.task_name}</span>
                  <span className="text-gray-500">{task.category}</span>
                  <span className="text-gray-400">
                    — {vendor?.name ?? 'No vendor'}
                    {task.next_due_date && ` (due ${task.next_due_date})`}
                    {!hasContact && ' (no contact)'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Vendor Selection */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Or select vendors directly</label>
          {vendors.length > 0 && (
            <button type="button" onClick={selectAllVendors} className="text-xs text-emerald-600 hover:underline">
              Select all
            </button>
          )}
        </div>
        {vendors.length > 0 ? (
          <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-white">
            {vendors.map((v: any) => {
              const hasContact = extractEmail(v) || extractPhone(v);
              return (
                <label
                  key={v.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 ${
                    selectedVendorIds.has(v.id) ? 'bg-emerald-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedVendorIds.has(v.id)}
                    onChange={() => toggleVendor(v.id)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                  />
                  <span className="font-medium text-gray-900">{v.name}</span>
                  <span className="text-gray-400">
                    {v.trade ?? 'Vendor'}
                    {!hasContact && ' (no contact)'}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No vendors found in your portfolio.</p>
        )}
      </div>

      {/* Recipient summary */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-blue-800">
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} resolved
            </span>
            {recipients.length > 0 && (
              <span className="ml-2 text-xs text-blue-600">
                ({recipients.filter((r: any) => r.email).length} email, {recipients.filter((r: any) => r.phone).length} phone)
              </span>
            )}
          </div>
        </div>
        {recipients.length > 0 && (
          <div className="mt-2 max-h-32 overflow-y-auto text-xs text-blue-700">
            {recipients.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="font-medium">{r.vendorName}</span>
                <span className="text-blue-400">
                  ({r.email || 'no email'}{r.phone ? ` / ${r.phone}` : ''})
                </span>
                <span className="text-blue-300">via {r.sourceRef}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          id="subject"
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g., Work Order Status Update — 123 Main Street"
          className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
        />
      </div>

      {/* Body */}
      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="body"
          name="body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={5000}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          placeholder="Compose your message to vendors..."
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>Use {'{vendor_name}'}, {'{wo_title}'}, {'{wo_status}'}, {'{association_name}'} as merge fields</span>
          <span>{body.length}/5000</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={sending || recipients.length === 0}>
          {sending ? 'Sending...' : `Send to ${recipients.length} Vendor${recipients.length !== 1 ? 's' : ''}`}
        </Button>
        <span className="text-xs text-gray-400">
          Messages will be queued and logged in the Communication Center.
        </span>
      </div>
    </form>
  );
}

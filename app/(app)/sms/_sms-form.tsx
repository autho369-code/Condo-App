'use client';

import { useState } from 'react';
import { sendSms } from '@/lib/rpcs/sms';
import { Button } from '@/components/ui/button';

function extractPhone(entity: any, type: string): string {
  if (entity.phone && typeof entity.phone === 'string' && entity.phone.trim()) return entity.phone.trim();
  if (entity.phone_numbers && Array.isArray(entity.phone_numbers)) {
    const mobile = entity.phone_numbers.find((p: any) => p.type === 'mobile' || p.label === 'mobile');
    if (mobile?.number) return mobile.number;
    const first = entity.phone_numbers.find((p: any) => p.number);
    if (first?.number) return first.number;
  }
  return '';
}

export function SmsForm({
  owners,
  vendors,
  templates,
}: {
  owners: any[];
  vendors: any[];
  templates: any[];
}) {
  const [recipientType, setRecipientType] = useState<string>('owner');
  const [selectedId, setSelectedId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const entities = recipientType === 'owner' ? owners : vendors;

  function handleEntityChange(id: string) {
    setSelectedId(id);
    const entity = entities.find((e: any) => e.id === id);
    if (entity) {
      const phone = extractPhone(entity, recipientType);
      setPhoneNumber(phone);
    }
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    const tpl = templates.find((t: any) => t.id === templateId);
    if (tpl) setMessage(tpl.body);
  }

  const entityLabel = recipientType === 'owner' ? 'Owner' : 'Vendor';

  return (
    <form action={sendSms as any} className="space-y-4">
      {/* Recipient type */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Recipient type</label>
        <div className="flex gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="recipient_type" value="owner" checked={recipientType === 'owner'} onChange={() => { setRecipientType('owner'); setSelectedId(''); setPhoneNumber(''); }} />
            Owner
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="recipient_type" value="vendor" checked={recipientType === 'vendor'} onChange={() => { setRecipientType('vendor'); setSelectedId(''); setPhoneNumber(''); }} />
            Vendor
          </label>
        </div>
      </div>

      {/* Recipient selector */}
      <div>
        <label htmlFor="recipient_id" className="mb-1 block text-sm font-medium text-gray-700">
          {entityLabel} <span className="text-red-500">*</span>
        </label>
        <select
          id="recipient_id"
          name="recipient_id"
          required
          value={selectedId}
          onChange={(e) => handleEntityChange(e.target.value)}
          className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="">Select {entityLabel.toLowerCase()}...</option>
          {entities.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.full_name || e.name} {extractPhone(e, recipientType) ? `(${extractPhone(e, recipientType)})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Phone number */}
      <div>
        <label htmlFor="phone_number" className="mb-1 block text-sm font-medium text-gray-700">
          Phone number <span className="text-red-500">*</span>
        </label>
        <input
          id="phone_number"
          name="phone_number"
          required
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1 555 123 4567"
          className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
        />
      </div>

      {/* Template selector */}
      {templates.length > 0 && (
        <div>
          <label htmlFor="template_selector" className="mb-1 block text-sm font-medium text-gray-700">Load template</label>
          <select
            id="template_selector"
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="">Choose a template...</option>
            {templates.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Message */}
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-700">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={1600}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          placeholder="Type your SMS message here..."
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>SMS messages are limited to 1600 characters</span>
          <span>{message.length}/1600</span>
        </div>
      </div>

      {/* From number (optional) */}
      <div>
        <label htmlFor="from_number" className="mb-1 block text-sm font-medium text-gray-700">
          From number
        </label>
        <input
          id="from_number"
          name="from_number"
          type="tel"
          placeholder="Company phone number"
          className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Leave blank to use company default</p>
      </div>

      <div className="flex gap-3">
        <Button type="submit">Send SMS</Button>
      </div>
    </form>
  );
}

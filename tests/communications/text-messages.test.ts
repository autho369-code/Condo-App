import { describe, expect, it } from 'vitest';

import {
  buildTextMessageRows,
  normalizeTextMessageForm,
  normalizeTextPhone,
  uniqueTextRecipients,
} from '@/lib/communications/text-messages';

describe('text message helpers', () => {
  it('normalizes US phone numbers for SMS storage', () => {
    expect(normalizeTextPhone('(312) 555-0100')).toBe('+13125550100');
    expect(normalizeTextPhone('1-312-555-0100')).toBe('+13125550100');
    expect(normalizeTextPhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizeTextPhone('')).toBeNull();
  });

  it('normalizes the website text form', () => {
    const formData = new FormData();
    formData.set('recipient_group', 'both');
    formData.set('message', '  Please call the office.  ');
    formData.set('custom_phone', '3125550100');

    expect(normalizeTextMessageForm(formData)).toEqual({
      recipientGroup: 'both',
      body: 'Please call the office.',
      customPhone: '+13125550100',
      returnTo: null,
    });
  });

  it('requires a message body', () => {
    const formData = new FormData();
    formData.set('recipient_group', 'owners');
    formData.set('message', ' ');

    expect(() => normalizeTextMessageForm(formData)).toThrow('Text message is required.');
  });

  it('deduplicates recipients by normalized phone', () => {
    expect(uniqueTextRecipients([
      { name: 'Ada', phone: '(312) 555-0100', group: 'owner', entityType: 'owner', entityId: 'owner-1' },
      { name: 'Ada Backup', phone: '+1 312 555 0100', group: 'owner', entityType: 'owner', entityId: 'owner-1' },
      { name: 'Grace', phone: '7735550101', group: 'renter', entityType: 'renter', entityId: 'tenancy-1' },
    ])).toEqual([
      { name: 'Ada', phone: '+13125550100', group: 'owner', entityType: 'owner', entityId: 'owner-1' },
      { name: 'Grace', phone: '+17735550101', group: 'renter', entityType: 'renter', entityId: 'tenancy-1' },
    ]);
  });

  it('builds communication rows for queued outbound texts', () => {
    const rows = buildTextMessageRows({
      associationId: 'assoc-1',
      body: 'Gate code changed.',
      createdBy: 'staff-1',
      portfolioId: 'portfolio-1',
      recipients: [{ name: 'Ada', phone: '+13125550100', group: 'owner', entityType: 'owner', entityId: 'owner-1' }],
    });

    expect(rows).toEqual([{
      association_id: 'assoc-1',
      body: 'Gate code changed.',
      channel: 'sms',
      created_by: 'staff-1',
      portfolio_id: 'portfolio-1',
      queued_at: expect.any(String),
      recipient_group: 'owner',
      recipient_name: 'Ada',
      recipient_phone: '+13125550100',
      status: 'draft',
      subject: 'Text message',
    }]);
  });
});

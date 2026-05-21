import { describe, expect, it } from 'vitest';

import { requiresConfirmation } from '@/lib/people/owner-workflows';
import { requiresVendorConfirmation } from '@/lib/vendors/workflows';

describe('safe workflow rules', () => {
  it('requires confirmation for owner outbound and payment actions', () => {
    expect(requiresConfirmation('send_portal_activation')).toBe(true);
    expect(requiresConfirmation('preview_owner_packet')).toBe(false);
  });

  it('requires confirmation for vendor outbound and bank actions', () => {
    expect(requiresVendorConfirmation('send_w9_request')).toBe(true);
    expect(requiresVendorConfirmation('preview_vendor_form')).toBe(false);
  });
});

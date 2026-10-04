import { describe, expect, it } from 'vitest';
import { buildMergeValues, mergeTemplate, ownerAddress, unfilledFields } from '@/lib/letters/merge';

const association = { name: 'Granville Courts', address: '1 Main St', city: 'Baltimore', state: 'MD', zip: '21201', late_fee_amount_override: 25 };
const owner = { full_name: 'Olivia <b>Smith</b>', email: 'o@example.com', address_street: '1 Main St #101', address_city: 'Baltimore', address_state: 'MD', address_zip: '21201' };

describe('letter merge', () => {
  it('fills association, owner and unit fields', () => {
    const v = buildMergeValues({ association, owner, unitNumbers: ['101', '102'], boardPresidentName: 'Liam', now: new Date('2026-10-04T12:00:00Z'), timeZone: 'America/New_York' });
    expect(v.association_name).toBe('Granville Courts');
    expect(v.association_address).toBe('1 Main St, Baltimore, MD, 21201');
    expect(v.owner_unit).toBe('101, 102');
    expect(v.late_fee_amount).toBe('$25.00');
    expect(v.board_president_name).toBe('Liam');
    expect(v.current_date).toBe('October 4, 2026');
  });

  it('escapes values placed into HTML but not into plain text', () => {
    const v = buildMergeValues({ owner });
    expect(mergeTemplate('<p>Dear {{owner_name}}</p>', v, { html: true })).toBe('<p>Dear Olivia &lt;b&gt;Smith&lt;/b&gt;</p>');
    expect(mergeTemplate('Dear {{owner_name}}', v, { html: false })).toBe('Dear Olivia <b>Smith</b>');
  });

  it('leaves unknown or empty fields visible and reports them', () => {
    const v = buildMergeValues({ owner: { full_name: 'A' } });
    expect(mergeTemplate('{{owner_name}} {{owner_phone}} {{nope}}', v, { html: true })).toBe('A {{owner_phone}} {{nope}}');
    expect(unfilledFields('{{owner_name}} {{owner_phone}} {{nope}} {{nope}}', v)).toEqual(['owner_phone', 'nope']);
  });

  it('prefers the free-text mailing address', () => {
    expect(ownerAddress({ mailing_address: 'PO Box 9', address_street: 'x' })).toBe('PO Box 9');
    expect(ownerAddress(owner)).toBe('1 Main St #101, Baltimore, MD, 21201');
  });
});

// Letter merge fields ({{field}}) for homeowner letters. Values are escaped
// before they are placed into template HTML, so an owner name or address can
// never inject markup; the merged HTML is still sanitized before display.

export type MergeAssociation = {
  name?: string | null;
  address?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  maintenance_phone?: string | null;
  payment_instructions?: string | null;
  late_fee_amount_override?: number | string | null;
  site_manager?: string | null;
};

export type MergeOwner = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mailing_address?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
};

const join = (parts: Array<string | null | undefined>) => parts.filter((p) => p && String(p).trim()).join(', ');

export function ownerAddress(owner: MergeOwner): string {
  return owner.mailing_address?.trim()
    || join([owner.address_street, owner.address_city, owner.address_state, owner.address_zip]);
}

export function buildMergeValues(input: {
  association?: MergeAssociation | null;
  boardPresidentName?: string | null;
  owner?: MergeOwner | null;
  unitNumbers?: string[];
  now?: Date;
  timeZone?: string;
}): Record<string, string> {
  const now = input.now ?? new Date();
  const tz = input.timeZone;
  const vals: Record<string, string> = {
    current_date: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: tz }),
    current_date_short: now.toLocaleDateString('en-US', { timeZone: tz }),
  };
  const a = input.association;
  if (a) {
    vals.association_name = a.name ?? '';
    vals.association_address = join([a.address, a.address_line_2, a.city, a.state, a.zip]);
    vals.association_city = a.city ?? '';
    vals.association_state = a.state ?? '';
    vals.association_zip = a.zip ?? '';
    vals.association_phone = a.maintenance_phone ?? '';
    vals.payment_instructions = a.payment_instructions ?? '';
    vals.manager_name = a.site_manager ?? '';
    if (a.late_fee_amount_override != null && a.late_fee_amount_override !== '') {
      vals.late_fee_amount = Number(a.late_fee_amount_override).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }
    vals.board_president_name = input.boardPresidentName ?? '';
  }
  const o = input.owner;
  if (o) {
    vals.owner_name = o.full_name ?? '';
    vals.owner_address = ownerAddress(o);
    vals.owner_email = o.email ?? '';
    vals.owner_phone = o.phone ?? '';
    vals.owner_unit = (input.unitNumbers ?? []).join(', ');
  }
  return vals;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Replace {{field}} with its value. Unknown or empty fields stay visible as {{field}}. */
export function mergeTemplate(text: string, values: Record<string, string>, { html }: { html: boolean }): string {
  return (text ?? '').replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const v = values[key];
    if (!v) return match;
    return html ? escapeHtml(v) : v;
  });
}

/** Fields in a template that the merge could not fill. */
export function unfilledFields(text: string, values: Record<string, string>): string[] {
  const missing = new Set<string>();
  for (const m of (text ?? '').matchAll(/\{\{(\w+)\}\}/g)) if (!values[m[1]]) missing.add(m[1]);
  return [...missing];
}

import type { ScheduleStep } from '@/components/violations/schedule-editor';

export const VIOLATION_TYPES = [
  'noise', 'parking', 'pets', 'exterior_modification', 'trash_debris', 'landscaping',
  'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other',
] as const;

export const humanize = (s: string | null | undefined) =>
  (s ?? '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Associations the signed-in staff member can see, plus the selected one. */
export async function loadAssociationScope(db: any, requested?: string) {
  const { data } = await db.from('associations').select('id, name, portfolio_id').is('archived_at', null).order('name');
  const associations = (data ?? []) as { id: string; name: string; portfolio_id: string }[];
  const selected = associations.find((a) => a.id === requested) ?? associations[0] ?? null;
  return { associations, selected };
}

export function toScheduleSteps(rows: any[] | null | undefined): ScheduleStep[] {
  return (rows ?? []).map((s) => ({
    follow_up_name: s.follow_up_name ?? '',
    days_after_previous: Number(s.days_after_previous ?? 0),
    fee: Number(s.fee ?? 0),
    offers_hearing: Boolean(s.offers_hearing),
    delivery_methods: (s.delivery_methods ?? []) as string[],
    letter_template_id: s.letter_template_id ?? null,
    gl_account_id: s.gl_account_id ?? null,
  }));
}

/** Letter templates and GL accounts offered in the schedule editor. */
export async function loadScheduleOptions(db: any, portfolioId: string | undefined, associationId: string) {
  const [{ data: templates }, { data: gl }] = await Promise.all([
    db.from('document_templates').select('id, name').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, number, name, association_id').eq('portfolio_id', portfolioId).eq('active', true).order('number'),
  ]);
  return {
    templates: (templates ?? []) as { id: string; name: string }[],
    glAccounts: ((gl ?? []) as any[]).filter((g) => !g.association_id || g.association_id === associationId),
  };
}

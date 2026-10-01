'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEMPLATES = '/inspections/templates';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}
function uuid(formData: FormData, key: string) {
  const v = text(formData, key);
  return UUID.test(v) ? v : null;
}

/** One checklist item per line; "Area: item" puts it under an area. */
/** Templates belong to a management company; operator-only accounts have none. */
async function requireCompanyStaff(back: string) {
  const me = await requireStaff();
  if (!me.is_staff) redirect(`${back}?error=${encodeURIComponent('Open inspection templates from a management company account.')}`);
  return me;
}

function parseItems(raw: string) {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const i = line.indexOf(':');
    return i > 0 ? { area: line.slice(0, i).trim(), item: line.slice(i + 1).trim() } : { area: null, item: line };
  });
}

export async function saveInspectionTemplate(formData: FormData) {
  await requireCompanyStaff(TEMPLATES);
  const id = uuid(formData, 'id');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_inspection_template', {
    p_id: id,
    p_name: text(formData, 'name'),
    p_inspection_type: text(formData, 'inspection_type') || null,
    p_items: parseItems(text(formData, 'items')),
  });
  if (error) redirect(`${TEMPLATES}?error=${encodeURIComponent(error.message)}${id ? `&edit=${id}` : ''}`);
  revalidatePath(TEMPLATES);
  redirect(`${TEMPLATES}?saved=1`);
}

export async function archiveInspectionTemplate(formData: FormData) {
  await requireCompanyStaff(TEMPLATES);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('archive_inspection_template', { p_id: uuid(formData, 'id') });
  if (error) redirect(`${TEMPLATES}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(TEMPLATES);
  redirect(TEMPLATES);
}

/** Schedule a property-wide inspection or one per unit from a template. */
export async function scheduleInspectionsFromTemplate(formData: FormData) {
  await requireCompanyStaff('/inspections/bulk');
  const back = '/inspections/bulk';
  const scheduled = text(formData, 'scheduled_date');
  const scope = text(formData, 'scope');
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('create_inspections_from_template', {
    p_template_id: uuid(formData, 'template_id'),
    p_association_id: uuid(formData, 'association_id'),
    p_unit_ids: null,
    p_all_units: scope === 'units',
    p_scheduled_date: DATE.test(scheduled) ? scheduled : null,
    p_inspection_type: text(formData, 'inspection_type') || null,
    p_notes: text(formData, 'notes') || null,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/inspections');
  redirect(`/inspections?scheduled=${Number(data) || 0}`);
}

/** Save the condition and note of every checklist row on an inspection. */
export async function saveInspectionChecklist(formData: FormData) {
  await requireStaff();
  const inspectionId = uuid(formData, 'inspection_id');
  const back = `/inspections/${inspectionId ?? ''}`;
  const rows = formData.getAll('row_id').map((v) => String(v)).filter((v) => UUID.test(v)).map((id) => ({
    id,
    condition: text(formData, `condition_${id}`) || null,
    note: text(formData, `note_${id}`) || null,
  }));
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_inspection_checklist', { p_inspection_id: inspectionId, p_rows: rows });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  redirect(`${back}?saved=${encodeURIComponent('Checklist saved.')}`);
}

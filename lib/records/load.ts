import type { RecordMeta, RecordType } from './types';

/** Tags, notes and @mentionable colleagues for one record (RLS-scoped client). */
export async function loadRecordMeta(db: any, type: RecordType, id: string): Promise<RecordMeta> {
  const [assigned, allTags, notes, staff] = await Promise.all([
    db.from('tag_assignments').select('tags(id, name)').eq('entity_type', type).eq('entity_id', id),
    db.from('tags').select('id, name').order('name').limit(500),
    db.from('record_notes')
      .select('id, body, pinned, mentioned_user_ids, created_by, created_by_name, created_at')
      .eq('entity_type', type)
      .eq('entity_id', id)
      .is('archived_at', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    db.rpc('mentionable_staff'),
  ]);
  const tags = ((assigned.data ?? []) as any[])
    .map((r) => r.tags)
    .filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
  return {
    tags,
    allTags: allTags.data ?? [],
    notes: notes.data ?? [],
    staff: staff.data ?? [],
  };
}

/** Record ids of a type carrying a tag, for list-page filtering. */
export async function recordIdsWithTag(db: any, type: RecordType, tagId: string): Promise<string[]> {
  const { data } = await db.from('tag_assignments').select('entity_id').eq('entity_type', type).eq('tag_id', tagId);
  return ((data ?? []) as any[]).map((r) => r.entity_id);
}

/** Tags that are attached to at least one record of this type (for list filters). */
export async function tagsInUse(db: any, type: RecordType): Promise<{ id: string; name: string }[]> {
  const { data } = await db
    .from('tags')
    .select('id, name, tag_assignments!inner(entity_type)')
    .eq('tag_assignments.entity_type', type)
    .order('name');
  const seen = new Set<string>();
  return ((data ?? []) as any[])
    .filter((t) => !seen.has(t.id) && seen.add(t.id))
    .map((t) => ({ id: t.id, name: t.name }));
}

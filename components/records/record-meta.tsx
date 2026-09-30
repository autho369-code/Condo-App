import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Surface, SectionTitle } from '@/components/ui/shell';
import { addRecordNote, setRecordTags, updateRecordNote } from '@/lib/rpcs/record-meta';
import type { RecordMeta, RecordType } from '@/lib/records/types';
import { NoteComposer } from './note-composer';

function dateTime(v: string) {
  return new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Hidden({ type, id }: { type: RecordType; id: string }) {
  return (
    <>
      <input type="hidden" name="entity_type" value={type} />
      <input type="hidden" name="entity_id" value={id} />
    </>
  );
}

/** Tag chips for a record header; `href` builds the filtered list link for a tag. */
export function RecordTagChips({ tags, href }: { tags: RecordMeta['tags']; href?: (tagId: string) => string }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) =>
        href ? (
          <a key={t.id} href={href(t.id)} className="inline-flex h-6 items-center rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-500/15 hover:bg-gray-200">
            {t.name}
          </a>
        ) : (
          <span key={t.id} className="inline-flex h-6 items-center rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-500/15">
            {t.name}
          </span>
        ),
      )}
    </div>
  );
}

/** Tags editor + staff notes thread with @mentions, for any supported record. */
export function RecordMetaPanels({
  type,
  id,
  meta,
  currentUserId,
  tagHref,
  showNotes = true,
}: {
  type: RecordType;
  id: string;
  meta: RecordMeta;
  currentUserId?: string | null;
  tagHref?: (tagId: string) => string;
  /** Associations keep their existing standard-notes list, so they show tags only. */
  showNotes?: boolean;
}) {
  const listId = `tags-${type}-${id}`;
  return (
    <div className={showNotes ? 'grid grid-cols-1 gap-4 lg:grid-cols-3' : ''}>
      <Surface className={showNotes ? 'lg:col-span-1' : undefined}>
        <div id="tags" className="scroll-mt-24" />
        <SectionTitle title="Tags" description="Group and filter records your own way." />
        {meta.tags.length ? (
          <RecordTagChips tags={meta.tags} href={tagHref} />
        ) : (
          <p className="text-sm text-gray-500">No tags yet.</p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-medium text-gray-600 hover:text-gray-900">Edit tags</summary>
          <form action={setRecordTags} className="mt-2 space-y-2">
            <Hidden type={type} id={id} />
            <Input
              name="tags"
              list={listId}
              defaultValue={meta.tags.map((t) => t.name).join(', ')}
              placeholder="e.g. Pool view, Leak history"
              aria-label="Tags, separated by commas"
            />
            <datalist id={listId}>
              {meta.allTags.map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
            <p className="text-xs text-gray-500">Separate tags with commas. Up to 20, each up to 40 characters.</p>
            <Button type="submit" variant="secondary" size="sm">Save tags</Button>
          </form>
        </details>
      </Surface>

      {showNotes && <Surface className="lg:col-span-2">
        <div id="notes" className="scroll-mt-24" />
        <SectionTitle title="Notes" description="Internal notes. Mention a colleague with @ to email them a link." />
        <form action={addRecordNote}>
          <Hidden type={type} id={id} />
          <NoteComposer staff={meta.staff} currentUserId={currentUserId} />
        </form>
        {meta.notes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No notes yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {meta.notes.map((n) => {
              const names = n.mentioned_user_ids
                .map((uid) => meta.staff.find((p) => p.id === uid)?.name)
                .filter(Boolean);
              return (
                <li key={n.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{n.created_by_name ?? 'Staff'}</span> · {dateTime(n.created_at)}
                        {n.pinned && <span className="ml-2 font-medium text-amber-700">Pinned</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{n.body}</p>
                      {names.length > 0 && <p className="mt-1 text-xs text-gray-500">Notified {names.join(', ')}</p>}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <form action={updateRecordNote}>
                        <Hidden type={type} id={id} />
                        <input type="hidden" name="note_id" value={n.id} />
                        <input type="hidden" name="op" value={n.pinned ? 'unpin' : 'pin'} />
                        <Button type="submit" variant="ghost" size="sm">{n.pinned ? 'Unpin' : 'Pin'}</Button>
                      </form>
                      {(n.created_by === currentUserId) && (
                        <form action={updateRecordNote}>
                          <Hidden type={type} id={id} />
                          <input type="hidden" name="note_id" value={n.id} />
                          <input type="hidden" name="op" value="remove" />
                          <Button type="submit" variant="ghost" size="sm">Remove</Button>
                        </form>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>}
    </div>
  );
}

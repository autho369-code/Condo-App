import { Button } from '@/components/ui/button';

export type ArcMessage = {
  id: string;
  author_name: string | null;
  author_role: string;
  body: string;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Homeowner',
  staff: 'Management',
  board: 'Board',
  vendor: 'Vendor',
};

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  staff: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  board: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  vendor: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

/**
 * In-app discussion thread. Generic: nothing here is ARC-specific — work-order
 * pages reuse it too. `postAction` is a server action already bound to the
 * parent entity id, so this stays a server component with no client JS.
 */
export function ArcMessageThread({
  messages,
  postAction,
  canPost = true,
  placeholder = 'Write a message…',
}: {
  messages: ArcMessage[];
  postAction: (formData: FormData) => void | Promise<void>;
  canPost?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="text-sm text-gray-500">No messages yet. Start the conversation below.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-gray-200/70 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{m.author_name ?? ROLE_LABEL[m.author_role] ?? 'User'}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${ROLE_BADGE[m.author_role] ?? ROLE_BADGE.staff}`}>
                  {ROLE_LABEL[m.author_role] ?? m.author_role}
                </span>
                <span className="ml-auto text-xs text-gray-400">{fmt(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{m.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <form action={postAction} className="space-y-2 border-t border-gray-100 pt-4">
          <textarea
            name="body"
            required
            rows={3}
            placeholder={placeholder}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm">Send message</Button>
          </div>
        </form>
      )}
    </div>
  );
}

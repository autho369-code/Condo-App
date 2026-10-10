'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PendingSubmit } from '@/components/ui/pending-submit';

type Signer = { key: number; name: string; email: string; role_label: string };
type BoardMember = { association_id: string; full_name: string; email: string | null; role: string | null };

const SUBJECT_LABELS: Record<string, string> = {
  document: 'General document',
  board_resolution: 'Board resolution',
  architectural_request: 'Architectural review decision',
  vendor_agreement: 'Vendor agreement',
  management_agreement: 'Management agreement',
  year_end_package: 'Year-end package acceptance',
};

export function NewSignatureRequestForm({
  action,
  associations,
  boardMembers,
  initial,
  submissionToken,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** One-time token (lib/forms/submission) so a double submit sends once. */
  submissionToken: string;
  associations: { id: string; name: string }[];
  boardMembers: BoardMember[];
  initial: { association_id?: string; subject_type?: string; subject_id?: string; title?: string; body_text?: string };
}) {
  const nextKey = React.useRef(1);
  const blank = (): Signer => ({ key: nextKey.current++, name: '', email: '', role_label: '' });
  const [associationId, setAssociationId] = React.useState(initial.association_id ?? '');
  const [kind, setKind] = React.useState<'text' | 'pdf'>(initial.body_text ? 'text' : 'pdf');
  const [signers, setSigners] = React.useState<Signer[]>([blank()]);
  const board = boardMembers.filter((m) => m.association_id === associationId && m.email);

  const update = (key: number, patch: Partial<Signer>) => setSigners((prev) => prev.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const addBoard = () =>
    setSigners((prev) => {
      const existing = new Set(prev.map((x) => x.email.toLowerCase()));
      const kept = prev.filter((x) => x.name || x.email);
      const added = board
        .filter((m) => !existing.has(String(m.email).toLowerCase()))
        .map((m) => ({ key: nextKey.current++, name: m.full_name, email: String(m.email), role_label: (m.role ?? '').replace(/_/g, ' ') }));
      return [...kept, ...added].slice(0, 20);
    });

  return (
    <form action={action}  className="space-y-5">
      {initial.subject_type && <input type="hidden" name="subject_type" value={initial.subject_type} />}
      {initial.subject_id && <input type="hidden" name="subject_id" value={initial.subject_id} />}
      <input type="hidden" name="submission_token" value={submissionToken} />
      <input type="hidden" name="document_kind" value={kind} />
      <input type="hidden" name="signers" value={JSON.stringify(signers.map(({ key: _k, ...x }) => x))} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="title" required className="sm:col-span-2">
          <Input id="title" name="title" required minLength={2} maxLength={200} defaultValue={initial.title ?? ''} placeholder="e.g. Resolution 2026-07: reserve transfer" />
        </Field>
        <Field label="Association" htmlFor="association_id">
          <Select id="association_id" name="association_id" value={associationId} onChange={(e) => setAssociationId(e.target.value)}>
            <option value="">Company-level</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Type">
          {initial.subject_type ? (
            <div className="flex h-10 items-center text-sm text-gray-700">{SUBJECT_LABELS[initial.subject_type] ?? 'Document'}</div>
          ) : (
            <Select name="subject_type" defaultValue="document">
              {['document', 'board_resolution', 'vendor_agreement'].map((t) => <option key={t} value={t}>{SUBJECT_LABELS[t]}</option>)}
            </Select>
          )}
        </Field>
      </div>

      <div>
        <div className="mb-2 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm sm:w-fit" role="tablist">
          {(['pdf', 'text'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
              className={`h-9 rounded-md px-3 font-medium ${kind === k ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {k === 'pdf' ? 'Upload PDF' : 'Write text'}
            </button>
          ))}
        </div>
        {kind === 'pdf' ? (
          <Field hint="Up to 10 MB. The exact file is fingerprinted; signing is blocked if it ever changes.">
            <input type="file" name="document" accept="application/pdf" required className="block w-full text-sm text-gray-700 file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:text-sm file:font-medium file:text-gray-900 hover:file:bg-gray-200" />
          </Field>
        ) : (
          <Textarea name="body_text" required minLength={20} maxLength={50000} rows={10} defaultValue={initial.body_text ?? ''} placeholder="RESOLVED, that the Board of Directors…" />
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Signers</h2>
          {board.length > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={addBoard}><Users className="h-4 w-4" /> Add board ({board.length})</Button>
          )}
        </div>
        <div className="space-y-2">
          {signers.map((x, i) => (
            <div key={x.key} className="grid grid-cols-1 gap-2 rounded-xl border border-line p-3 sm:grid-cols-[28px_1fr_1fr_160px_40px] sm:items-center">
              <span className="hidden text-center text-[12px] tabular-nums text-gray-400 sm:block">{i + 1}</span>
              <Input aria-label="Signer name" value={x.name} onChange={(e) => update(x.key, { name: e.target.value })} placeholder="Full name" maxLength={120} />
              <Input aria-label="Signer email" type="email" value={x.email} onChange={(e) => update(x.key, { email: e.target.value })} placeholder="email@example.com" maxLength={254} />
              <Input aria-label="Signer role" value={x.role_label} onChange={(e) => update(x.key, { role_label: e.target.value })} placeholder="Role (optional)" maxLength={80} />
              <button type="button" aria-label="Remove signer" disabled={signers.length === 1}
                onClick={() => setSigners((prev) => prev.filter((y) => y.key !== x.key))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="secondary" size="sm" disabled={signers.length >= 20} onClick={() => setSigners((prev) => [...prev, blank()])}><Plus className="h-4 w-4" /> Add signer</Button>
          <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="sequential" className="h-4 w-4 rounded border-gray-300" />Sign in this order</label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="Message to signers" htmlFor="message"><Textarea id="message" name="message" rows={2} maxLength={2000} /></Field>
        <Field label="Link expires in (days)" htmlFor="expires_days"><Input id="expires_days" name="expires_days" type="number" min="1" max="90" defaultValue={30} /></Field>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/signatures" className="text-center text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
        <PendingSubmit pendingLabel="Sending…">Send for signature</PendingSubmit>
      </div>
    </form>
  );
}

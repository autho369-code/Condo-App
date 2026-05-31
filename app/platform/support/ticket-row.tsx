'use client';

import * as React from 'react';
import { TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { date } from '@/lib/utils';
import {
  MessageSquare,
  ChevronRight,
  Send,
  User,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Priority & Status Badges                                                  */
/* -------------------------------------------------------------------------- */

const PRIORITY_STYLES: Record<string, string> = {
  Critical: 'bg-red-400/15 text-red-400 ring-red-400/40',
  High: 'bg-amber-400/15 text-amber-400 ring-amber-400/40',
  Medium: 'bg-blue-400/15 text-blue-400 ring-blue-400/40',
  Low: 'bg-slate-400/15 text-slate-400 ring-slate-400/40',
};

function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES['Low'];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {priority}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-blue-400/15 text-blue-400 ring-blue-400/40',
  'In Progress': 'bg-amber-400/15 text-amber-400 ring-amber-400/40',
  Resolved: 'bg-emerald-400/15 text-emerald-400 ring-emerald-400/40',
  Closed: 'bg-slate-400/15 text-slate-400 ring-slate-400/40',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES['Open'];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data Types                                                                */
/* -------------------------------------------------------------------------- */

interface TicketRow {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CommentRow {
  id: number;
  ticket_id: number;
  body: string;
  author_id: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Expandable Ticket Row                                                     */
/* -------------------------------------------------------------------------- */

export function TicketRowClient({
  ticket,
  companyName,
  assignedToName,
  comments,
  addInternalNote,
  markTicketResolved,
}: {
  ticket: TicketRow;
  companyName: string;
  assignedToName: string | null;
  comments: CommentRow[];
  addInternalNote: (formData: FormData) => Promise<void>;
  markTicketResolved: (formData: FormData) => Promise<void>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleNoteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!noteBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('ticket_id', String(ticket.id));
      fd.set('body', noteBody.trim());
      await addInternalNote(fd);
      setNoteBody('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    const fd = new FormData();
    fd.set('ticket_id', String(ticket.id));
    await markTicketResolved(fd);
  };

  return (
    <>
      {/* Main row */}
      <tr
        className="group border-gray-800 transition cursor-pointer hover:bg-white/[0.03]"
        onClick={() => setExpanded(!expanded)}
      >
        <TD>
          <div className="flex items-center gap-2">
            <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </span>
            <span className="font-mono text-xs text-slate-400">#{ticket.id}</span>
          </div>
        </TD>
        <TD>
          <span className="font-medium text-slate-200 line-clamp-1">{ticket.title}</span>
        </TD>
        <TD>
          <span className="text-sm text-slate-400">{companyName}</span>
        </TD>
        <TD>
          <span className="text-sm capitalize text-slate-400">{ticket.category ?? '—'}</span>
        </TD>
        <TD>
          <PriorityBadge priority={ticket.priority} />
        </TD>
        <TD>
          <StatusBadge status={ticket.status} />
        </TD>
        <TD>
          <span className="text-sm text-slate-400">{assignedToName ?? 'Unassigned'}</span>
        </TD>
        <TD className="text-sm tabular-nums text-slate-400">
          {ticket.dueDate ? date(ticket.dueDate) : '—'}
        </TD>
        <TD className="text-sm tabular-nums text-slate-500">{date(ticket.updatedAt)}</TD>
        <TD className="text-sm tabular-nums text-slate-500">{date(ticket.createdAt)}</TD>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-gray-800 bg-white/[0.02]">
          <TD colSpan={10} className="p-0">
            <div className="px-8 py-6 space-y-6" onClick={(e) => e.stopPropagation()}>
              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {ticket.description || 'No description provided.'}
                </p>
              </div>

              {/* Ticket metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Category</p>
                  <p className="text-sm capitalize text-slate-300">{ticket.category ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Priority</p>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Status</p>
                  <StatusBadge status={ticket.status} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Due Date</p>
                  <p className="text-sm text-slate-300">
                    {ticket.dueDate ? date(ticket.dueDate, 'long') : '—'}
                  </p>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comments ({comments.length})
                </h4>
                {comments.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No comments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700">
                            <User className="h-3 w-3 text-slate-400" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            {c.author_id ?? 'Internal Note'}
                          </span>
                          <span className="text-xs text-slate-600">·</span>
                          <span className="text-xs text-slate-500">{date(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                          {c.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                {/* Add internal note */}
                <form onSubmit={handleNoteSubmit} className="flex-1 flex gap-2">
                  <Input
                    name="body"
                    placeholder="Add an internal note..."
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    className="border-gray-700 bg-gray-900 text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 flex-1"
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={!noteBody.trim() || submitting}
                    className="border border-gray-700 text-slate-300 hover:bg-gray-800"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>

                {/* Mark resolved */}
                {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                  <Button
                    onClick={handleResolve}
                    variant="ghost"
                    size="sm"
                    className="border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Mark Resolved
                  </Button>
                )}
              </div>
            </div>
          </TD>
        </tr>
      )}
    </>
  );
}

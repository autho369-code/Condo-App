import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';
import type { ViolationLetterRow } from '@/lib/violations/letter-links';

type Props = {
  letters: ViolationLetterRow[];
  links: Map<string, string>;
  /** Staff view: delivery details + "Mark mailed". Owner view: just the letters. */
  markMailed?: (formData: FormData) => Promise<void>;
  back?: string;
};

function emailLabel(l: ViolationLetterRow) {
  if (l.email_status === 'queued') return `Emailed to ${l.emailed_to}`;
  if (l.email_status === 'no_email_on_file') return 'Not emailed — no email on file';
  return null;
}

export function ViolationLettersList({ letters, links, markMailed, back }: Props) {
  if (letters.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-gray-500">
        {markMailed ? 'No letters yet. A letter is written and sent each time the violation moves to its next step.' : 'No letters yet.'}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {letters.map((l) => {
        const href = links.get(l.pdf_path);
        const email = markMailed ? emailLabel(l) : null;
        return (
          <li key={l.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-950">{l.step_name}</div>
              <div className="mt-0.5 truncate text-xs text-gray-500">{l.subject}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{date(l.created_at)}</span>
                {email && <span>· {email}</span>}
                {markMailed && l.delivery_methods.includes('portal') && <span>· On owner portal</span>}
                {markMailed && l.mail_status === 'to_mail' && <StatusChip tone="warning">To mail</StatusChip>}
                {markMailed && l.mail_status === 'mailed' && <StatusChip tone="success">Mailed {date(l.mailed_at)}</StatusChip>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">Open PDF</Button>
                </a>
              )}
              {markMailed && l.mail_status === 'to_mail' && (
                <form action={markMailed}>
                  <input type="hidden" name="letter_id" value={l.id} />
                  {back && <input type="hidden" name="back" value={back} />}
                  <Button type="submit" size="sm">Mark mailed</Button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

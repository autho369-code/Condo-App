import Link from 'next/link';

/**
 * Picks one of a login's records (one per association) on a page that works
 * on a single record at a time. Shown only when the login has more than one.
 */
export function RecordSwitcher({
  records,
  currentId,
  basePath,
  caption,
}: {
  records: { id: string; label: string }[];
  currentId: string | null;
  basePath: string;
  caption: string;
}) {
  if (records.length < 2) return null;
  return (
    <nav aria-label={caption}>
      <p className="mb-2 text-[13px] text-gray-500">{caption}</p>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {records.map((record) => (
          <Link
            key={record.id}
            href={`${basePath}?record=${encodeURIComponent(record.id)}`}
            aria-current={record.id === currentId ? 'page' : undefined}
            className={
              'flex min-h-10 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-colors ' +
              (record.id === currentId ? 'bg-gray-950 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')
            }
          >
            {record.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

import { SegmentedLinks } from '@/components/ui/segmented';

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
    <div>
      <p className="mb-2 text-[13px] text-gray-500">{caption}</p>
      <SegmentedLinks label={caption} current={currentId}
        items={records.map((record) => ({ id: record.id, label: record.label, href: `${basePath}?record=${encodeURIComponent(record.id)}` }))} />
    </div>
  );
}

export const RECORD_TYPES = ['association', 'unit', 'owner', 'vendor'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type RecordTag = { id: string; name: string };
export type RecordNote = {
  id: string;
  body: string;
  pinned: boolean;
  mentioned_user_ids: string[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};
export type MentionableStaff = { id: string; name: string; email: string };

export type RecordMeta = {
  tags: RecordTag[];
  allTags: RecordTag[];
  notes: RecordNote[];
  staff: MentionableStaff[];
};

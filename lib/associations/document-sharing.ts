// Who can see an association document, and the default folder structure.

export const SHARE_SCOPES = ['staff', 'board', 'owners'] as const;
export type ShareScope = (typeof SHARE_SCOPES)[number];

export const SHARE_LABEL: Record<ShareScope, string> = {
  staff: 'Management only',
  board: 'Board',
  owners: 'Board and owners',
};

export const SHARE_TONE: Record<ShareScope, 'inactive' | 'progress' | 'complete'> = {
  staff: 'inactive',
  board: 'progress',
  owners: 'complete',
};

export const DEFAULT_FOLDERS = [
  'Governing documents',
  'Financial',
  'Insurance',
  'Meetings',
  'Contracts',
  'Legal',
  'Correspondence',
  'Newsletters',
  'Photos',
] as const;

const FOLDER_BY_TYPE: Record<string, string> = {
  declaration_ccrs: 'Governing documents',
  bylaws: 'Governing documents',
  articles_of_incorporation: 'Governing documents',
  rules_regulations: 'Governing documents',
  operating_budget: 'Financial',
  master_insurance_policy: 'Insurance',
  minutes: 'Meetings',
};

export function folderForDocType(docType: string | null | undefined) {
  return docType ? FOLDER_BY_TYPE[docType] ?? null : null;
}

/** Folder names in display order: defaults first, then any custom ones alphabetically. */
export function orderedFolders(used: (string | null | undefined)[]) {
  const set = new Set(used.filter((f): f is string => !!f));
  const defaults = DEFAULT_FOLDERS.filter((f) => set.has(f));
  const custom = [...set].filter((f) => !(DEFAULT_FOLDERS as readonly string[]).includes(f)).sort((a, b) => a.localeCompare(b));
  return [...defaults, ...custom];
}

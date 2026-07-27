type PortalRecord = {
  portal_activated?: unknown;
  archived_at?: unknown;
};

/** Fail closed unless a tenant-local portal record is explicitly active. */
export function isActivePortalRecord(record: PortalRecord | null | undefined): boolean {
  return record?.portal_activated === true && (record.archived_at === null || record.archived_at === undefined);
}

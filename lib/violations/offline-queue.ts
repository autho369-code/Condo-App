'use client';
// Device queue for violation field captures. Every capture is written here
// first (photos included, as Blobs — too big for localStorage), then synced:
// create the violation (idempotent by clientMutationId), upload each photo to
// a keyed path (idempotent by photo key), and only then drop it from the
// device. An interrupted sync resumes where it stopped.
import { createClient } from '@/lib/supabase/client';
import {
  createFieldViolation,
  createViolationAttachmentUpload,
  recordViolationAttachment,
} from '@/lib/rpcs/violations';

const DB_NAME = 'portier369-field';
const STORE = 'violation-captures';
const BUCKET = 'association-documents';

export type QueuedPhoto = { key: string; name: string; type: string; size: number; blob: Blob; done: boolean };

export type QueuedCapture = {
  id: string; // client mutation id
  userId: string; // captures belong to the staff member who made them
  associationId: string;
  associationName: string;
  unitId: string | null;
  unitLabel: string | null;
  violationType: string;
  title: string;
  description: string;
  gps: { lat: number; lng: number; accuracy: number } | null;
  capturedAt: string;
  observedOn: string; // device-local date of the capture
  photos: QueuedPhoto[];
  violationId: string | null;
  state: 'pending' | 'syncing' | 'failed';
  error: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser cannot store captures on the device')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open device storage'));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error ?? new Error('Device storage failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Device storage was full or unavailable'));
    });
  } finally {
    db.close();
  }
}

export async function listCaptures(userId: string): Promise<QueuedCapture[]> {
  const all = await run<QueuedCapture[]>('readonly', (store) => store.getAll() as IDBRequest<QueuedCapture[]>);
  return all.filter((c) => c.userId === userId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function saveCapture(capture: QueuedCapture) {
  await run('readwrite', (store) => store.put(capture));
}

export async function removeCapture(id: string) {
  await run('readwrite', (store) => store.delete(id));
}

/** Device-local calendar date (the day the manager actually saw it). */
export function localDate(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Sync one capture. Returns the violation id once everything (the case and
 * every photo) is on the server; otherwise throws with a readable message and
 * leaves the capture — with its progress saved — on the device.
 */
export async function syncCapture(capture: QueuedCapture): Promise<string> {
  let current = { ...capture, photos: capture.photos.map((p) => ({ ...p })) };
  if (!current.violationId) {
    const created = await createFieldViolation({
      association_id: current.associationId,
      unit_id: current.unitId,
      violation_type: current.violationType,
      title: current.title,
      description: current.description,
      location_lat: current.gps?.lat ?? null,
      location_lng: current.gps?.lng ?? null,
      location_accuracy_m: current.gps?.accuracy ?? null,
      client_mutation_id: current.id,
      observed_on: current.observedOn,
    });
    if (created.error || !created.id) throw new Error(created.error ?? 'Portier did not create the violation');
    current = { ...current, violationId: created.id };
    await saveCapture(current);
  }
  const violationId = current.violationId!;

  const supabase = createClient();
  const failed: string[] = [];
  for (const photo of current.photos) {
    if (photo.done) continue;
    try {
      const signed = await createViolationAttachmentUpload(violationId, photo.name, photo.size, photo.key);
      if (signed.error || !signed.path) throw new Error(signed.error ?? 'Upload not authorized');
      if (!signed.recorded) {
        if (!signed.token) throw new Error('Upload not authorized');
        const { error: upErr } = await supabase.storage.from(BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, photo.blob, { contentType: photo.type || undefined });
        if (upErr) throw new Error(upErr.message);
        const rec = await recordViolationAttachment(violationId, { path: signed.path, name: photo.name, size: photo.size });
        if (rec.error) throw new Error(rec.error);
      }
      photo.done = true;
      await saveCapture(current);
    } catch (error: any) {
      failed.push(`${photo.name}: ${error?.message ?? 'upload failed'}`);
    }
  }
  if (failed.length) {
    throw new Error(`The case was filed, but ${failed.length} photo${failed.length === 1 ? '' : 's'} still need to upload (${failed.join('; ')})`);
  }
  await removeCapture(current.id);
  return violationId;
}

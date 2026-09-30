'use client';

// Phone-first field capture form: a manager walking the property files a
// violation in under 30 seconds — snap photos, auto-GPS, pick unit, done.
// Works without a connection: every capture is saved to the device first
// (lib/violations/offline-queue.ts, photos included) and synced right away
// when online, or automatically once the connection returns.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CloudOff, Crosshair, LoaderCircle, MapPin, RefreshCw } from 'lucide-react';
import {
  getCapture,
  listCaptures,
  localDate,
  removeCapture,
  saveCapture,
  syncCapture,
  type QueuedCapture,
} from '@/lib/violations/offline-queue';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Badge } from '@/components/ui/shell';

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
// Failed syncs retry on their own (the browser may never report going offline
// and back): 30 s, doubling, capped at 5 minutes.
const RETRY_START_MS = 30_000;
const RETRY_MAX_MS = 5 * 60_000;

const TYPE_OPTIONS = [
  'noise', 'parking', 'pets', 'exterior_modification', 'trash_debris',
  'landscaping', 'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other',
] as const;

type AssociationOption = { id: string; name: string };
type UnitOption = { id: string; unit_number: string; association_id: string };

type GpsState =
  | { state: 'capturing' }
  | { state: 'captured'; lat: number; lng: number; accuracy: number }
  | { state: 'unavailable'; message: string };

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const secondaryButton =
  'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50';
const card = 'rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]';

export function FieldCaptureForm({
  userId,
  associations,
  units,
}: {
  userId: string;
  associations: AssociationOption[];
  units: UnitOption[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [associationId, setAssociationId] = useState(associations.length === 1 ? associations[0].id : '');
  const [unitId, setUnitId] = useState('');
  const [unitQuery, setUnitQuery] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [gps, setGps] = useState<GpsState>({ state: 'capturing' });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [online, setOnline] = useState(true);
  const syncing = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(RETRY_START_MS);

  // ── Device queue ──
  const reloadQueue = useCallback(async () => {
    try { setQueue(await listCaptures(userId)); } catch { /* no device storage — online filing still works */ }
  }, [userId]);

  const markFailed = useCallback(async (id: string, message: string) => {
    const latest = await getCapture(id, userId).catch(() => null);
    if (latest) await saveCapture({ ...latest, state: 'failed', error: message }).catch(() => {});
    return latest ?? null;
  }, [userId]);

  // Sync everything still on the device, oldest first; one pass at a time.
  const syncQueue = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    syncing.current = true;
    let remaining = 0;
    try {
      const pending = await listCaptures(userId);
      for (const { id } of pending) {
        // Re-read each capture right before syncing it: the manager may have
        // discarded it (or its progress changed) while earlier ones uploaded.
        const capture = await getCapture(id, userId);
        if (!capture) continue;
        setQueue((q) => q.map((c) => (c.id === capture.id ? { ...c, state: 'syncing', error: null } : c)));
        try {
          await syncCapture(capture);
        } catch (err: any) {
          await markFailed(capture.id, err?.message ?? 'Sync failed');
          if (!navigator.onLine) break;
        }
      }
      remaining = (await listCaptures(userId)).length;
    } catch { /* no device storage */ }
    finally {
      syncing.current = false;
      await reloadQueue();
    }
    if (remaining > 0) scheduleRetry();
    else retryDelay.current = RETRY_START_MS;
  }, [userId, markFailed, reloadQueue]); // eslint-disable-line react-hooks/exhaustive-deps
  // Arm (or re-arm) the next automatic retry with backoff.
  function scheduleRetry() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => { retryTimer.current = null; void syncQueueRef.current(); }, retryDelay.current);
    retryDelay.current = Math.min(retryDelay.current * 2, RETRY_MAX_MS);
  }
  const syncQueueRef = useRef(syncQueue);
  useEffect(() => { syncQueueRef.current = syncQueue; }, [syncQueue]);
  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current); }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    void reloadQueue().then(() => { if (navigator.onLine) void syncQueue(); });
    const up = () => { setOnline(true); retryDelay.current = RETRY_START_MS; void syncQueue(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [reloadQueue, syncQueue]);

  async function discard(capture: QueuedCapture) {
    const message = capture.violationId
      ? 'The case is already filed. Discard the photos that have not uploaded yet?'
      : 'Discard this capture? It has not been filed and will be lost.';
    if (!window.confirm(message)) return;
    await removeCapture(capture.id).catch(() => {});
    await reloadQueue();
  }

  // ── GPS: capture automatically on mount, allow retry, degrade gracefully ──
  function captureGps() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps({ state: 'unavailable', message: 'Location is not available on this device' });
      return;
    }
    setGps({ state: 'capturing' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({
        state: 'captured',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => setGps({
        state: 'unavailable',
        message: err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — the violation will be filed without GPS'
          : 'Could not get a GPS fix — you can retry or file without it',
      }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }
  useEffect(() => { captureGps(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unit quick-pick: filtered by association + search, big touch targets ──
  const associationUnits = useMemo(
    () => units.filter((u) => u.association_id === associationId),
    [units, associationId],
  );
  const visibleUnits = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    const matches = q
      ? associationUnits.filter((u) => u.unit_number.toLowerCase().includes(q))
      : associationUnits;
    return matches.slice(0, 24);
  }, [associationUnits, unitQuery]);
  const selectedUnit = units.find((u) => u.id === unitId) ?? null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get('title') ?? '').trim();
    if (!associationId) { setError('Select an association first.'); return; }
    if (!title) { setError('Give the violation a short title.'); return; }
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length > MAX_PHOTOS) { setError(`Up to ${MAX_PHOTOS} photos per violation.`); return; }
    if (files.some((f) => f.size > MAX_PHOTO_BYTES)) { setError('Each photo must be 25 MB or smaller.'); return; }

    setBusy(true);
    setProgress('Saving…');
    const capture: QueuedCapture = {
      id: crypto.randomUUID(),
      userId,
      associationId,
      associationName: associations.find((a) => a.id === associationId)?.name ?? 'Association',
      unitId: unitId || null,
      unitLabel: selectedUnit ? `Unit ${selectedUnit.unit_number}` : null,
      violationType: String(fd.get('violation_type') ?? 'other'),
      title,
      description: String(fd.get('description') ?? '').trim(),
      gps: gps.state === 'captured' ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy } : null,
      capturedAt: new Date().toISOString(),
      observedOn: localDate(),
      photos: files.map((f) => ({ key: crypto.randomUUID(), name: f.name, type: f.type, size: f.size, blob: f, done: false })),
      violationId: null,
      state: 'pending',
      error: null,
    };

    const resetForm = () => {
      form.reset();
      if (fileRef.current) fileRef.current.value = '';
      setPhotoCount(0);
      setUnitId('');
      setUnitQuery('');
      setBusy(false);
      setProgress(null);
    };

    let stored = true;
    try {
      await saveCapture(capture);
    } catch (err: any) {
      stored = false;
      if (!navigator.onLine) {
        setError(`${err?.message ?? 'This device cannot store captures'} — and there is no connection, so nothing was saved.`);
        setBusy(false);
        setProgress(null);
        return;
      }
    }

    if (!navigator.onLine) {
      resetForm();
      setNotice('Saved on this device. It will be filed automatically when you are back online.');
      await reloadQueue();
      return;
    }

    setProgress(files.length ? 'Filing and uploading photos…' : 'Filing…');
    syncing.current = true;
    try {
      const violationId = await syncCapture(capture, { persist: stored });
      setProgress('Done — opening case…');
      router.push(`/violations/${violationId}`);
    } catch (err: any) {
      const message = err?.message ?? 'Sync failed';
      const latest = stored ? await markFailed(capture.id, message) : null;
      if (!latest && message.startsWith('The case was filed')) {
        // Not stored on the device, so no automatic retry — don't invite a duplicate resubmission.
        resetForm();
        setError(`${message}. Add the missing photos from the case page.`);
      } else if (!latest) {
        setError(`${message} — the violation may not have been saved.`);
        setBusy(false);
        setProgress(null);
      } else {
        resetForm();
        setNotice(latest.violationId
          ? `The case was filed, but some photos are still on this device and will keep retrying. ${message}`
          : `Saved on this device — Portier could not be reached (${message}). It will retry automatically.`);
        scheduleRetry();
      }
      await reloadQueue();
    } finally {
      syncing.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4">
      {error && <Alert tone="danger" title="Could not file the violation">{error}</Alert>}
      {notice && <Alert tone="info" title="Capture saved">{notice}</Alert>}
      {!online && (
        <Alert tone="info" title="You are offline.">
          Keep capturing — violations and photos are saved on this device and filed when the connection returns.
        </Alert>
      )}

      {/* ── Captures waiting on this device ── */}
      {queue.length > 0 && (
        <section className={`space-y-2 ${card}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-900">
              <CloudOff className="h-4 w-4 shrink-0 text-gray-400" />
              {queue.length} capture{queue.length === 1 ? '' : 's'} waiting on this device
            </div>
            <button type="button" onClick={() => void syncQueue()} disabled={!online || busy} className={secondaryButton}>
              <RefreshCw className="h-4 w-4 text-gray-400" /> Sync now
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {queue.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{c.title}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {c.associationName}{c.unitLabel ? ` · ${c.unitLabel}` : ''} · {c.photos.length} photo{c.photos.length === 1 ? '' : 's'}
                    {c.violationId ? ' · case filed, photos pending' : ''}
                  </div>
                  {c.error && <div className="mt-1 text-xs text-red-700">{c.error}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge status={c.state}>{c.state}</Badge>
                  <button
                    type="button"
                    onClick={() => void discard(c)}
                    disabled={c.state === 'syncing' || busy}
                    className="inline-flex h-10 items-center rounded-lg px-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                  >
                    Discard
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── GPS status ── */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            {gps.state === 'capturing' && (
              <>
                <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
                <span className="text-gray-500">Getting your location…</span>
              </>
            )}
            {gps.state === 'captured' && (
              <>
                <MapPin className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="min-w-0 truncate text-gray-700">
                  <span className="font-medium tabular-nums">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
                  <span className="ml-1.5 text-gray-400">±{Math.round(gps.accuracy)} m</span>
                </span>
              </>
            )}
            {gps.state === 'unavailable' && (
              <>
                <Crosshair className="h-5 w-5 shrink-0 text-gray-400" />
                <span className="text-gray-500">{gps.message}</span>
              </>
            )}
          </div>
          {gps.state !== 'capturing' && (
            <button type="button" onClick={captureGps} disabled={busy} className={secondaryButton}>
              <RefreshCw className="h-4 w-4 text-gray-400" /> Retry
            </button>
          )}
        </div>
      </section>

      {/* ── Where ── */}
      <section className={`space-y-4 ${card}`}>
        <Field label="Association" htmlFor="fc-association" required>
          <Select
            id="fc-association"
            className="h-12"
            value={associationId}
            disabled={busy}
            onChange={(e) => { setAssociationId(e.target.value); setUnitId(''); setUnitQuery(''); }}
          >
            <option value="">Select association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>

        <Field
          label="Unit"
          htmlFor="fc-unit-search"
          hint={!associationId ? 'Pick an association to see its units.' : selectedUnit ? undefined : 'Optional — leave empty for common-area violations.'}
        >
          <Input
            id="fc-unit-search"
            className="h-12"
            type="search"
            inputMode="search"
            placeholder="Search unit number…"
            value={unitQuery}
            disabled={busy || !associationId}
            onChange={(e) => setUnitQuery(e.target.value)}
          />
          {associationId && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedUnit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUnitId('')}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  Unit {selectedUnit.unit_number} · tap to clear
                </button>
              )}
              {visibleUnits.filter((u) => u.id !== unitId).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setUnitId(u.id)}
                  className="inline-flex h-11 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {u.unit_number}
                </button>
              ))}
              {visibleUnits.length === 0 && !selectedUnit && (
                <p className="text-sm text-gray-400">No units match &ldquo;{unitQuery}&rdquo;.</p>
              )}
              {associationUnits.length > visibleUnits.length && (
                <p className="w-full text-xs text-gray-400">Showing first {visibleUnits.length} — keep typing to narrow down.</p>
              )}
            </div>
          )}
        </Field>
      </section>

      {/* ── What ── */}
      <section className={`space-y-4 ${card}`}>
        <Field label="Type" htmlFor="fc-type" required>
          <Select id="fc-type" name="violation_type" className="h-12" defaultValue="other" disabled={busy}>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </Select>
        </Field>
        <Field label="Title" htmlFor="fc-title" required>
          <Input id="fc-title" name="title" className="h-12" placeholder="Trash cans left out, unapproved fence…" disabled={busy} />
        </Field>
        <Field label="Description" htmlFor="fc-description" hint="A sentence is enough — you can expand the case later at your desk.">
          <Textarea id="fc-description" name="description" rows={3} placeholder="What you observed" disabled={busy} />
        </Field>
      </section>

      {/* ── Photos ── */}
      <section className={card}>
        <label
          htmlFor="fc-photos"
          className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          <Camera className="h-5 w-5 text-gray-400" />
          {photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'} attached — tap to change` : 'Take photos'}
        </label>
        <input
          id="fc-photos"
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
        />
        <p className="mt-2 text-xs text-gray-400">Up to {MAX_PHOTOS} photos, 25 MB each. They upload after the case is filed — offline, they wait on this device.</p>
      </section>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 text-base font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {progress ?? 'Saving…'}</> : online ? 'File violation' : 'Save to device'}
      </button>
    </form>
  );
}

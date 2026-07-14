'use client';

// Phone-first field capture form: a manager walking the property files a
// violation in under 30 seconds — snap photos, auto-GPS, pick unit, done.
// Photos upload browser→Supabase Storage via signed URLs (same pattern as
// components/architectural/attachments-uploader.tsx) AFTER the violation row
// exists: createFieldViolation returns { id }, photos go to violations/{id}/,
// then recordViolationAttachment appends them to violations.attachments.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Crosshair, LoaderCircle, MapPin, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  createFieldViolation,
  createViolationAttachmentUpload,
  recordViolationAttachment,
} from '@/lib/rpcs/violations';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';

const BUCKET = 'association-documents';
const MAX_PHOTOS = 10;

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

export function FieldCaptureForm({
  associations,
  units,
}: {
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

    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get('title') ?? '').trim();
    if (!associationId) { setError('Select an association first.'); return; }
    if (!title) { setError('Give the violation a short title.'); return; }
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length > MAX_PHOTOS) { setError(`Up to ${MAX_PHOTOS} photos per violation.`); return; }

    setBusy(true);
    setProgress('Creating violation…');
    try {
      const created = await createFieldViolation({
        association_id: associationId,
        unit_id: unitId || null,
        violation_type: String(fd.get('violation_type') ?? 'other'),
        title,
        description: String(fd.get('description') ?? ''),
        location_lat: gps.state === 'captured' ? gps.lat : null,
        location_lng: gps.state === 'captured' ? gps.lng : null,
        location_accuracy_m: gps.state === 'captured' ? gps.accuracy : null,
      });
      if (created.error || !created.id) {
        setError(created.error ?? 'Failed to create the violation');
        setBusy(false);
        setProgress(null);
        return;
      }

      // Upload photos one at a time (browser→storage via signed URL), then
      // record each into violations.attachments. A failed photo doesn't lose
      // the violation — we surface it and continue.
      const supabase = createClient();
      const failed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
        try {
          const signed = await createViolationAttachmentUpload(created.id, file.name, file.size);
          if (signed.error || !signed.path || !signed.token) { failed.push(file.name); continue; }
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
          if (upErr) { failed.push(file.name); continue; }
          const rec = await recordViolationAttachment(created.id, { path: signed.path, name: file.name, size: file.size });
          if (rec.error) { failed.push(file.name); continue; }
        } catch {
          failed.push(file.name);
        }
      }

      const suffix = failed.length > 0 ? `?error=${encodeURIComponent(`Violation saved, but ${failed.length} photo${failed.length === 1 ? '' : 's'} failed to upload: ${failed.join(', ')}`)}` : '';
      setProgress('Done — opening case…');
      router.push(`/violations/${created.id}${suffix}`);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong — the violation may not have been saved.');
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4">
      {error && <Alert tone="danger" title="Could not file the violation">{error}</Alert>}

      {/* ── GPS status ── */}
      <section className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
            <button
              type="button"
              onClick={captureGps}
              disabled={busy}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 text-gray-400" /> Retry
            </button>
          )}
        </div>
      </section>

      {/* ── Where ── */}
      <section className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
      <section className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
      <section className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
        <p className="mt-2 text-xs text-gray-400">Up to {MAX_PHOTOS} photos, 25 MB each. They upload one at a time after the case is created.</p>
      </section>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 text-base font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {progress ?? 'Saving…'}</> : 'File violation'}
      </button>
    </form>
  );
}

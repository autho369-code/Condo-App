'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Alert, Badge } from '@/components/ui/shell';

type QueuedFinding = {
  clientMutationId: string;
  area: string;
  issue: string;
  severity: string;
  capturedAt: string;
  state: 'pending' | 'syncing' | 'failed';
  error?: string;
};

export function OfflineInspectionCapture({ inspectionId, compact = false }: { inspectionId: string; compact?: boolean }) {
  const key = useMemo(() => `portier369:inspection:${inspectionId}:pending-findings:v1`, [inspectionId]);
  const [queue, setQueue] = useState<QueuedFinding[]>([]);
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (Array.isArray(saved)) setQueue(saved.map((item) => ({ ...item, state: item.state === 'syncing' ? 'pending' : item.state })));
    } catch {
      localStorage.removeItem(key);
    }
    setReady(true);
    const becameOnline = () => setOnline(true);
    const becameOffline = () => setOnline(false);
    window.addEventListener('online', becameOnline);
    window.addEventListener('offline', becameOffline);
    return () => { window.removeEventListener('online', becameOnline); window.removeEventListener('offline', becameOffline); };
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(key, JSON.stringify(queue));
  }, [key, queue, ready]);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = queue.filter((item) => item.state !== 'syncing');
    if (!pending.length) return;
    setQueue((current) => current.map((item) => pending.some((candidate) => candidate.clientMutationId === item.clientMutationId) ? { ...item, state: 'syncing', error: undefined } : item));
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ findings: pending }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Sync failed');
      const accepted = new Set<string>(result.accepted ?? []);
      setQueue((current) => current
        .filter((item) => !accepted.has(item.clientMutationId))
        .map((item) => item.state === 'syncing' ? { ...item, state: 'failed', error: 'Portier did not acknowledge this finding.' } : item));
    } catch (error: any) {
      setQueue((current) => current.map((item) => item.state === 'syncing' ? { ...item, state: 'failed', error: error?.message ?? 'Sync failed' } : item));
    }
  }, [inspectionId, queue]);

  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; }, [sync]);

  useEffect(() => {
    if (ready && online) void syncRef.current();
  }, [online, ready]); // retry after hydration and whenever connectivity returns

  function capture(formData: FormData) {
    const issue = String(formData.get('issue') ?? '').trim();
    if (!issue) return;
    const item: QueuedFinding = {
      clientMutationId: crypto.randomUUID(),
      area: String(formData.get('area') ?? '').trim(),
      issue,
      severity: String(formData.get('severity') ?? 'minor'),
      capturedAt: new Date().toISOString(),
      state: 'pending',
    };
    setQueue((current) => [...current, item]);
    const form = document.getElementById(`offline-capture-${inspectionId}`) as HTMLFormElement | null;
    form?.reset();
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge status={online ? 'online' : 'on_hold'}>{online ? 'Online' : 'Offline'}</Badge><span className="text-sm text-gray-500">{queue.length} finding{queue.length === 1 ? '' : 's'} on device</span></div><Button type="button" variant="secondary" onClick={() => void sync()} disabled={!online || !queue.length}>Sync now</Button></div>
    {!online && <Alert tone="info" title="Disconnected mode active.">Capture continues locally. Keep this browser profile secure; queued findings sync when connectivity returns.</Alert>}
    <form id={`offline-capture-${inspectionId}`} action={capture} className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      <div><Label htmlFor={`offline-area-${inspectionId}`}>Area</Label><Input id={`offline-area-${inspectionId}`} name="area" placeholder="Roof, pool deck, mechanical room" /></div>
      <div><Label htmlFor={`offline-severity-${inspectionId}`}>Severity</Label><Select id={`offline-severity-${inspectionId}`} name="severity" defaultValue="minor"><option value="info">Information</option><option value="minor">Minor</option><option value="moderate">Moderate</option><option value="major">Major</option><option value="critical">Critical</option></Select></div>
      <div className={compact ? '' : 'sm:col-span-2'}><Label htmlFor={`offline-issue-${inspectionId}`}>Finding</Label><Textarea id={`offline-issue-${inspectionId}`} name="issue" required /></div>
      <Button type="submit" className="w-fit">Save to device</Button>
    </form>
    {queue.length > 0 && <div className="space-y-2 border-t border-gray-100 pt-4">{queue.map((item) => <div key={item.clientMutationId} className="rounded-xl border border-gray-200 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium text-gray-900">{item.issue}</div><div className="mt-1 text-xs text-gray-500">{item.area || 'Area not specified'} · {item.severity}</div>{item.error && <div className="mt-1 text-xs text-red-700">{item.error}</div>}</div><Badge status={item.state}>{item.state}</Badge></div></div>)}</div>}
  </div>;
}

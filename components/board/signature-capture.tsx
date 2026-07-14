'use client';

// Board-member signature capture: draw on a canvas (pointer events, touch OK)
// or type a name rendered in a cursive font. On save the canvas exports a PNG
// that uploads browser→storage via a signed URL, then the path is recorded on
// the caller's board seats.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, Eraser, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { createSignatureUpload, saveSignature } from '@/lib/rpcs/signatures';

const BUCKET = 'association-documents';
const CANVAS_W = 600;
const CANVAS_H = 200;
const INK = '#111827';
const CURSIVE = '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive';

type Mode = 'draw' | 'type';

export function SignatureCapture({ currentSignatureUrl }: { currentSignatureUrl: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!currentSignatureUrl);
  const [mode, setMode] = useState<Mode>('draw');
  const [typedName, setTypedName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  function ctx(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext('2d') ?? null;
  }

  function clearCanvas() {
    const c = ctx();
    if (!c || !canvasRef.current) return;
    c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setDirty(false);
  }

  // Configure the pen whenever the pad becomes visible.
  useEffect(() => {
    if (!editing) return;
    const c = ctx();
    if (!c) return;
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = INK;
  }, [editing]);

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw' || busy) return;
    const c = ctx();
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = canvasPoint(e);
    c.beginPath();
    c.moveTo(x, y);
    // A dot for taps, so a single press leaves ink.
    c.lineTo(x + 0.1, y + 0.1);
    c.stroke();
    setDirty(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || mode !== 'draw') return;
    const c = ctx();
    if (!c) return;
    const { x, y } = canvasPoint(e);
    c.lineTo(x, y);
    c.stroke();
  }

  function onPointerUp() {
    drawingRef.current = false;
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setTypedName('');
    clearCanvas();
  }

  function renderTypedName(name: string) {
    const c = ctx();
    if (!c || !canvasRef.current) return;
    c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    const trimmed = name.trim();
    if (!trimmed) {
      setDirty(false);
      return;
    }
    // Shrink long names to fit the pad.
    let size = 56;
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    do {
      c.font = `${size}px ${CURSIVE}`;
      if (c.measureText(trimmed).width <= CANVAS_W - 48) break;
      size -= 4;
    } while (size > 20);
    c.fillText(trimmed, CANVAS_W / 2, CANVAS_H / 2);
    setDirty(true);
  }

  async function onSave() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not read the signature image.');

      const signed = await createSignatureUpload(blob.size);
      if (signed.error || !signed.path || !signed.token) {
        throw new Error(signed.error ?? 'Could not authorize the upload');
      }

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, blob, { contentType: 'image/png' });
      if (upErr) throw new Error(upErr.message);

      const res = await saveSignature(signed.path);
      if (res.error) throw new Error(res.error);

      setEditing(false);
      setTypedName('');
      clearCanvas();
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save your signature');
    } finally {
      setBusy(false);
    }
  }

  if (!editing && currentSignatureUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" /> Signature on file
        </div>
        <div className="inline-block rounded-xl border border-gray-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentSignatureUrl} alt="Your signature" className="h-16 w-auto max-w-full object-contain" />
        </div>
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <PenLine className="h-3.5 w-3.5" /> Replace signature
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        {(
          [
            { value: 'draw', label: 'Draw' },
            { value: 'type', label: 'Type your name' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => switchMode(opt.value)}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-[13px] font-medium transition-colors ${
              mode === opt.value
                ? 'border-gray-950 bg-gray-950 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'type' && (
        <input
          type="text"
          value={typedName}
          onChange={(e) => {
            setTypedName(e.target.value);
            renderTypedName(e.target.value);
          }}
          placeholder="e.g. Jane Doe"
          disabled={busy}
          className="h-10 w-full max-w-sm rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        />
      )}

      <div>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`w-full max-w-xl touch-none rounded-xl border border-dashed border-gray-300 bg-white ${
            mode === 'draw' ? 'cursor-crosshair' : 'pointer-events-none'
          }`}
          aria-label="Signature pad"
        />
        <p className="mt-1 text-xs text-gray-400">
          {mode === 'draw'
            ? 'Sign above with your finger, stylus, or mouse.'
            : 'Your typed name is rendered as a signature above.'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={onSave} disabled={!dirty || busy}>
          <PenLine className="h-4 w-4" /> {busy ? 'Saving…' : 'Save signature'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setTypedName('');
            clearCanvas();
          }}
        >
          <Eraser className="h-4 w-4" /> Clear
        </Button>
        {currentSignatureUrl && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

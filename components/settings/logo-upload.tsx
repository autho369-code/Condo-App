'use client';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Variant = 'logo' | 'favicon';

const VARIANT_CONFIG: Record<Variant, {
  folder: string;
  maxBytes: number;
  accept: string;
  helper: string;
  preview: { width: number; height: number; tone: 'cream' | 'ink' };
  emptyLabel: string;
}> = {
  logo: {
    folder: '',                       // root of {portfolio_id}/
    maxBytes: 2 * 1024 * 1024,
    accept: 'image/png,image/jpeg,image/svg+xml,image/webp',
    helper:
      'PNG, JPG, SVG, or WebP. Up to 2 MB. A transparent PNG works best for the dark concierge panels — it sits cleanly on any background.',
    preview: { width: 160, height: 96, tone: 'cream' },
    emptyLabel: 'No logo set',
  },
  favicon: {
    folder: 'favicons/',
    maxBytes: 256 * 1024,
    accept: 'image/png,image/x-icon,image/svg+xml,image/webp',
    helper:
      'PNG, ICO, SVG, or WebP. Up to 256 KB. Square, ideally 256×256 or larger — browsers will scale it down for the browser tab.',
    preview: { width: 64, height: 64, tone: 'cream' },
    emptyLabel: 'No favicon',
  },
};

type Props = {
  portfolioId: string;
  initialUrl: string | null;
  variant?: Variant;
  /** Hidden field name we write the resulting public URL into for form submit. */
  fieldName?: string;
  /** Hidden field name for the explicit "remove" flag. */
  clearFieldName?: string;
};

export function LogoUpload({
  portfolioId,
  initialUrl,
  variant = 'logo',
  fieldName,
  clearFieldName,
}: Props) {
  const cfg = VARIANT_CONFIG[variant];
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingClear, setPendingClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hiddenName  = fieldName      ?? (variant === 'favicon' ? 'favicon_url' : 'logo_url');
  const clearName   = clearFieldName ?? (variant === 'favicon' ? 'clear_favicon' : 'clear_logo');

  async function handleFile(file: File) {
    setError(null);
    setPendingClear(false);
    if (file.size > cfg.maxBytes) {
      const limitKB = (cfg.maxBytes / 1024).toFixed(0);
      const sizeKB  = (file.size / 1024).toFixed(0);
      setError(`File is ${sizeKB} KB. Maximum is ${limitKB} KB.`);
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${portfolioId}/${cfg.folder}${variant}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('tenant-logos')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('tenant-logos').getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (e: any) {
      setError(e.message ?? 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  function pickFile() { inputRef.current?.click(); }
  function clearAsset() { setUrl(null); setPendingClear(true); }

  return (
    <div>
      <input type="hidden" name={hiddenName} value={url ?? ''} />
      <input type="hidden" name={clearName}  value={pendingClear ? '1' : ''} />

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-ink-200 bg-cream-50 p-3"
          style={{ width: cfg.preview.width, height: cfg.preview.height }}
        >
          {url ? (
            <img
              src={url}
              alt={`${variant === 'favicon' ? 'Favicon' : 'Logo'} preview`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-400 text-center px-2">
              {cfg.emptyLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-md bg-ink-900 px-5 text-sm font-medium text-cream-50 hover:bg-ink-800 transition-colors disabled:opacity-50"
          >
            {busy ? 'Uploading…' : url ? `Replace ${variant}` : `Upload ${variant}`}
          </button>
          {url && (
            <button
              type="button"
              onClick={clearAsset}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-md border border-ink-200 bg-white px-5 text-sm font-medium text-ink-700 hover:border-ink-300 hover:bg-cream-50 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={cfg.accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      <p className="mt-3 text-xs text-ink-500 leading-relaxed">{cfg.helper}</p>
      {error && (<p className="mt-2 text-xs text-bordeaux-700">{error}</p>)}
    </div>
  );
}

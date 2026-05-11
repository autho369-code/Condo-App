'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// =============================================================================
// Editorial toast system
// =============================================================================
// API:
//   const toast = useToast();
//   toast.success('Brand identity saved');
//   toast.error('Could not save', { detail: 'Network timeout. Retry?' });
//   toast.info('Margaret signed in');
//   toast.action('Bill paid', { actionLabel: 'View', onAction: () => …, variant: 'success' });
//
// Mount <Toaster /> once at the root layout. Toasts stack from the top-right,
// auto-dismiss after 5s (longer for errors), and can be hovered to pause.
// =============================================================================

type Variant = 'info' | 'success' | 'warning' | 'error';

type ToastInput = {
  id?: string;
  variant?: Variant;
  detail?: ReactNode;
  duration?: number;          // ms; defaults: success/info 5000, warning 7000, error 9000
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

type Toast = Required<Pick<ToastInput, 'id' | 'variant' | 'duration'>> &
  Omit<ToastInput, 'id' | 'variant' | 'duration'> & {
    title: ReactNode;
    createdAt: number;
  };

type ToastApi = {
  show:    (title: ReactNode, opts?: ToastInput) => string;
  success: (title: ReactNode, opts?: ToastInput) => string;
  error:   (title: ReactNode, opts?: ToastInput) => string;
  info:    (title: ReactNode, opts?: ToastInput) => string;
  warning: (title: ReactNode, opts?: ToastInput) => string;
  action:  (title: ReactNode, opts?: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <Toaster>');
  return ctx;
}

const DEFAULT_DURATION: Record<Variant, number> = {
  info:    5000,
  success: 5000,
  warning: 7000,
  error:   9000,
};

let serial = 0;

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((title: ReactNode, opts: ToastInput = {}): string => {
    const id = opts.id ?? `t-${Date.now()}-${++serial}`;
    const variant = opts.variant ?? 'info';
    const duration = opts.duration ?? DEFAULT_DURATION[variant];
    setToasts((cur) => [
      { id, title, variant, duration, createdAt: Date.now(), ...opts },
      ...cur,
    ].slice(0, 6));
    return id;
  }, []);

  const api: ToastApi = useMemo(() => ({
    show,
    success: (t, o) => show(t, { ...o, variant: 'success' }),
    error:   (t, o) => show(t, { ...o, variant: 'error' }),
    info:    (t, o) => show(t, { ...o, variant: 'info' }),
    warning: (t, o) => show(t, { ...o, variant: 'warning' }),
    action:  (t, o) => show(t, { ...o, variant: o?.variant ?? 'info' }),
    dismiss,
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Viewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// -----------------------------------------------------------------------------
function Viewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-2 sm:right-6 sm:top-6"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(toast.duration);

  useEffect(() => {
    if (paused) return;
    if (remaining <= 0) { onDismiss(); return; }
    const start = Date.now();
    const timer = setTimeout(onDismiss, remaining);
    return () => {
      clearTimeout(timer);
      setRemaining((r) => Math.max(0, r - (Date.now() - start)));
    };
  }, [paused, remaining, onDismiss]);

  const palette = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto overflow-hidden rounded-lg border ${palette.border} ${palette.bg} shadow-soft-lg backdrop-blur-sm`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${palette.iconBg} ${palette.iconColor}`}>
          {palette.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[14px] font-medium leading-snug ${palette.title}`}>{toast.title}</div>
          {toast.detail && (
            <div className={`mt-0.5 text-[12.5px] leading-relaxed ${palette.detail}`}>
              {toast.detail}
            </div>
          )}
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={async () => {
                await toast.onAction!();
                onDismiss();
              }}
              className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${palette.action} hover:opacity-80 transition-opacity`}
            >
              {toast.actionLabel} →
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={`shrink-0 rounded-md p-1 ${palette.dismiss} hover:bg-black/5 transition-colors`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Progress hairline */}
      <div className={`h-[2px] ${palette.progressBg}`}>
        <div
          className={`h-full ${palette.progressFill}`}
          style={{
            width: '100%',
            animation: paused ? 'none' : `toast-progress ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
      <style>{`
        @keyframes toast-progress {
          from { transform: scaleX(1); transform-origin: left; }
          to   { transform: scaleX(0); transform-origin: left; }
        }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
const VARIANT_STYLES: Record<Variant, {
  bg: string; border: string; title: string; detail: string; dismiss: string;
  icon: ReactNode; iconBg: string; iconColor: string;
  action: string; progressBg: string; progressFill: string;
}> = {
  info: {
    bg: 'bg-white', border: 'border-ink-200',
    title: 'text-ink-900', detail: 'text-ink-600', dismiss: 'text-ink-400',
    icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>),
    iconBg: 'bg-cream-100', iconColor: 'text-ink-700',
    action: 'text-champagne-700',
    progressBg: 'bg-cream-100', progressFill: 'bg-champagne-400',
  },
  success: {
    bg: 'bg-white', border: 'border-sage-300',
    title: 'text-ink-900', detail: 'text-ink-600', dismiss: 'text-ink-400',
    icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>),
    iconBg: 'bg-sage-100', iconColor: 'text-sage-700',
    action: 'text-sage-700',
    progressBg: 'bg-sage-100', progressFill: 'bg-sage-500',
  },
  warning: {
    bg: 'bg-white', border: 'border-champagne-300',
    title: 'text-ink-900', detail: 'text-ink-600', dismiss: 'text-ink-400',
    icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>),
    iconBg: 'bg-champagne-100', iconColor: 'text-champagne-800',
    action: 'text-champagne-800',
    progressBg: 'bg-champagne-100', progressFill: 'bg-champagne-500',
  },
  error: {
    bg: 'bg-white', border: 'border-bordeaux-300',
    title: 'text-ink-900', detail: 'text-ink-600', dismiss: 'text-ink-400',
    icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>),
    iconBg: 'bg-bordeaux-100', iconColor: 'text-bordeaux-700',
    action: 'text-bordeaux-700',
    progressBg: 'bg-bordeaux-100', progressFill: 'bg-bordeaux-500',
  },
};

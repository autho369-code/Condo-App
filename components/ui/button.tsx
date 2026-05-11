import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Editorial button system. Primary is ink-on-cream with a refined hover lift;
 * accent is brushed-champagne for purchase / publish moments; secondary is a
 * cream slab with hairline border for low-emphasis actions.
 */
const styles: Record<Variant, string> = {
  primary:
    'bg-ink-900 text-cream-50 hover:bg-ink-800 active:bg-ink-950 shadow-soft-sm',
  accent:
    'bg-champagne-shimmer text-ink-900 hover:brightness-105 active:brightness-95 shadow-soft border border-champagne-600/40',
  secondary:
    'bg-cream-50 text-ink-800 border border-ink-200 hover:bg-cream-100 hover:border-ink-300',
  outline:
    'bg-transparent text-ink-800 border border-ink-300 hover:border-ink-500 hover:bg-ink-50',
  ghost:
    'bg-transparent text-ink-700 hover:bg-ink-50 hover:text-ink-900',
  danger:
    'bg-bordeaux-600 text-cream-50 hover:bg-bordeaux-700 active:bg-bordeaux-700',
};

const sizes = {
  sm: 'h-8 px-3.5 text-[13px] rounded-md',
  md: 'h-10 px-5 text-sm rounded-md',
  lg: 'h-12 px-7 text-[15px] rounded-md',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...p }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium tracking-tight',
        'transition-all duration-150 ease-out',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        styles[variant],
        sizes[size],
        className,
      )}
      {...p}
    />
  ),
);
Button.displayName = 'Button';

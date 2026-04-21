import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

const styles: Record<Variant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50',
  ghost:     'bg-transparent text-gray-700 hover:bg-gray-100',
  danger:    'bg-red-600 text-white hover:bg-red-700',
};
const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...p }, ref) => (
    <button ref={ref}
      className={cn('inline-flex items-center justify-center rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
        styles[variant], sizes[size], className)}
      {...p} />
  ),
);
Button.displayName = 'Button';

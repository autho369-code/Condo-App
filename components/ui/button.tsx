import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

const styles: Record<Variant, string> = {
  primary:   'bg-gray-950 text-white shadow-sm hover:bg-gray-800 focus-visible:ring-gray-950',
  secondary: 'bg-white text-gray-800 border border-gray-300 shadow-sm hover:bg-gray-50 focus-visible:ring-gray-400',
  ghost:     'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400',
  danger:    'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600',
  link:      'bg-transparent text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline focus-visible:ring-blue-500 px-0',
};
const sizes = { sm: 'h-8 px-3 text-[13px] rounded-lg', md: 'h-10 px-4 text-sm rounded-lg', lg: 'h-11 px-5 text-sm rounded-xl' };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...p }, ref) => (
    <button ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        styles[variant], variant !== 'link' && sizes[size], className)}
      {...p} />
  ),
);
Button.displayName = 'Button';

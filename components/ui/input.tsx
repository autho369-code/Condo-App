import { cn } from '@/lib/utils';
import * as React from 'react';

const fieldBase =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 transition-colors outline-none ' +
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(fieldBase, className)} {...p} />,
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...p }, ref) => <select ref={ref} className={cn(fieldBase, 'cursor-pointer', className)} {...p} />,
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, 'h-auto min-h-[88px] py-2 leading-6', className)} {...p} />
  ),
);
Textarea.displayName = 'Textarea';

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-gray-700', className)} {...p} />;
}

/** Label + control wrapper with optional hint and required marker. */
export function Field({
  label, htmlFor, hint, required, children, className,
}: {
  label?: string; htmlFor?: string; hint?: React.ReactNode; required?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
      )}
      {children}
      {hint && <p className="mt-1 text-[12px] leading-4 text-gray-400">{hint}</p>}
    </div>
  );
}

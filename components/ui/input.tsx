import { cn } from '@/lib/utils';
import * as React from 'react';

const fieldBase =
  'h-10 w-full rounded-[10px] border border-gray-300 bg-white px-3 text-sm text-gray-900 ' +
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

const labelText = 'mb-1.5 block text-[13.5px] font-medium text-gray-700';

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  // Generic wrapper: callers pass htmlFor (Field does).
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn(labelText, className)} {...p} />;
}

const CONTROLS: unknown[] = [Input, Select, Textarea, 'input', 'select', 'textarea'];

/**
 * Label + control wrapper with optional hint and required marker.
 * The label is always tied to its control: by `htmlFor` when given, or, when
 * the only child is an Input/Select/Textarea, by wrapping it (no id needed),
 * so screen readers name the field and clicking the label focuses it.
 * Anything else (a group, several controls) gets a plain heading: pass
 * htmlFor and an id on the control to label one of them.
 */
export function Field({
  label, htmlFor, hint, required, children, className,
}: {
  label?: string; htmlFor?: string; hint?: React.ReactNode; required?: boolean;
  children: React.ReactNode; className?: string;
}) {
  const text = label && (
    <>
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </>
  );
  const only = React.Children.toArray(children);
  const wrapControl = Boolean(label) && !htmlFor && only.length === 1
    && React.isValidElement(only[0]) && CONTROLS.includes(only[0].type);
  return (
    <div className={className}>
      {wrapControl ? (
        <label className="block">
          <span className={labelText}>{text}</span>
          {children}
        </label>
      ) : (
        <>
          {/* No single control to tie to (a group, or several controls): a
              heading, not a <label> pointing at nothing. */}
          {label && (htmlFor
            ? <Label htmlFor={htmlFor}>{text}</Label>
            : <p className={labelText}>{text}</p>)}
          {children}
        </>
      )}
      {hint && <p className="mt-1.5 text-[13px] leading-5 text-gray-500">{hint}</p>}
    </div>
  );
}

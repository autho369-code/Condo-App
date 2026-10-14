'use client';

// A file input that refuses a file over `maxBytes` in the browser, so a file
// too big for the server action's request body shows a message here instead
// of an error page. The server checks the size again.
import * as React from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  maxBytes: number;
};

export function MaxSizeFileInput({ maxBytes, onChange, className, ...rest }: Props) {
  const [error, setError] = React.useState<string | null>(null);
  const errorId = React.useId();
  const limit = `${Math.round((maxBytes / (1024 * 1024)) * 10) / 10} MB`;
  return (
    <>
      <input
        {...rest}
        type="file"
        className={className}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : rest['aria-describedby']}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          const tooBig = files.find((f) => f.size > maxBytes);
          const message = tooBig ? `"${tooBig.name}" is larger than ${limit}. Choose a smaller file.` : '';
          e.currentTarget.setCustomValidity(message);
          setError(message || null);
          if (message) e.currentTarget.reportValidity();
          onChange?.(e);
        }}
      />
      {error && <p id={errorId} role="alert" className="mt-1 text-[13px] text-red-700">{error}</p>}
    </>
  );
}

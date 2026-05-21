'use client';
import * as React from 'react';

/** Toggles every checkbox with a matching name within a parent form. */
export function SelectAllCheckbox({ targetName }: { targetName: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const form = e.target.closest('form');
    if (!form) return;
    form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${targetName}"]`)
      .forEach((cb) => { cb.checked = e.target.checked; });
  }
  return <input ref={ref} type="checkbox" defaultChecked onChange={onToggle} aria-label="Select all" />;
}

'use client';
import * as React from 'react';

/**
 * Toggles every checkbox with a matching name within a parent form. With
 * `max`, checking selects only the first `max` boxes, so "select all" never
 * produces a batch the server action would reject as too large.
 */
export function SelectAllCheckbox({ targetName, defaultChecked = true, max }: { targetName: string; defaultChecked?: boolean; max?: number }) {
  const ref = React.useRef<HTMLInputElement>(null);
  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const form = e.target.closest('form');
    if (!form) return;
    form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${targetName}"]`)
      .forEach((cb, i) => { cb.checked = e.target.checked && (max === undefined || i < max); });
  }
  return (
    <input ref={ref} type="checkbox" defaultChecked={defaultChecked} onChange={onToggle}
      aria-label={max ? `Select the first ${max}` : 'Select all'}
      title={max ? `Selects up to ${max} at a time` : undefined}
      className="h-4 w-4 rounded border-gray-300" />
  );
}

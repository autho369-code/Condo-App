'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A color swatch and a hex text field kept in sync; submits `name` as the hex value. */
export function ColorField({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick a color"
        value={HEX.test(value) ? value : '#000000'}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 w-10 cursor-pointer rounded-lg border border-gray-300"
      />
      <Input id={id} name={name} value={value} onChange={(e) => setValue(e.target.value)} className="flex-1 font-mono" />
    </div>
  );
}

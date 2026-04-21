'use client';
import { Button } from './button';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return <Button type="button" onClick={() => window.print()}>{label}</Button>;
}

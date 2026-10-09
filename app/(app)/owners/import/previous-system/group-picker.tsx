'use client';

// A company-wide export lists many associations. Instead of laying out every
// one at once, the section shows a picker and only the association chosen
// (the first in the file to start with).
import * as React from 'react';
import { Surface } from '@/components/ui/shell';
import { Label, Select } from '@/components/ui/input';

type Group = { name: string; address?: string | null };

export function GroupPicker<G extends Group>({
  groups,
  render,
}: {
  groups: G[];
  render: (group: G) => React.ReactNode;
}) {
  const id = React.useId();
  const [index, setIndex] = React.useState(0);
  // A new file starts again at its first association.
  React.useEffect(() => setIndex(0), [groups]);
  if (!groups.length) return null;
  const shown = groups[Math.min(index, groups.length - 1)];
  return (
    <>
      {groups.length > 1 && (
        <Surface padded>
          <div className="max-w-md">
            <Label htmlFor={id}>Association in the file ({groups.length})</Label>
            <Select id={id} value={String(index)} onChange={(e) => setIndex(Number(e.target.value))}>
              {groups.map((g, i) => (
                <option key={`${g.name}|${g.address ?? ''}`} value={i}>{g.name || '(no association name)'}</option>
              ))}
            </Select>
          </div>
        </Surface>
      )}
      {render(shown)}
    </>
  );
}

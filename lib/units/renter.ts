export type RenterNameParts = {
  firstName: string;
  lastName: string;
};

export function splitRenterName(name: string | null | undefined): RenterNameParts {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function joinRenterName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [firstName, lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
}

export function occupancyLabel(hasActiveRenter: boolean) {
  return hasActiveRenter ? 'Renter occupied' : 'Owner occupied';
}

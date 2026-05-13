const BOARD_ROLES = ['president', 'vice_president', 'secretary', 'treasurer', 'director'] as const;

type BoardRole = (typeof BOARD_ROLES)[number];

export type BoardMemberInsert = {
  association_id: string;
  full_name: string;
  role: BoardRole;
  term_start: string | null;
  term_end: string | null;
  phone: string | null;
  email: string | null;
  signature_on_file: boolean;
  active: boolean;
};

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dateField(formData: FormData, name: string) {
  const value = stringField(formData, name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function boardRole(value: FormDataEntryValue | null): BoardRole {
  return BOARD_ROLES.includes(value as BoardRole) ? (value as BoardRole) : 'director';
}

export function normalizeBoardMemberForm(associationId: string, formData: FormData): BoardMemberInsert {
  const fullName = stringField(formData, 'full_name');
  if (!fullName) throw new Error('Board member name is required.');

  return {
    association_id: associationId,
    full_name: fullName,
    role: boardRole(formData.get('role')),
    term_start: dateField(formData, 'term_start'),
    term_end: dateField(formData, 'term_end'),
    phone: stringField(formData, 'phone'),
    email: stringField(formData, 'email')?.toLowerCase() ?? null,
    signature_on_file: formData.get('signature_on_file') === 'on',
    active: true,
  };
}

export function boardRoleLabel(role: string | null) {
  if (!role) return '-';
  return role.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

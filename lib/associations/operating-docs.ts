// Operating documents every client (association) must have on file.
// doc_type keywords intentionally match the owner portal's bucketFor()
// so these surface under "Governing Documents" for owners and board.
export const OPERATING_DOCS = [
  { type: 'declaration_ccrs',          label: 'Declaration / CC&Rs',       required: true },
  { type: 'bylaws',                    label: 'Bylaws',                    required: true },
  { type: 'articles_of_incorporation', label: 'Articles of Incorporation', required: true },
  { type: 'rules_regulations',         label: 'Rules & Regulations',       required: true },
  { type: 'operating_budget',          label: 'Current Operating Budget',  required: false },
  { type: 'master_insurance_policy',   label: 'Master Insurance Policy',   required: false },
] as const;

export const REQUIRED_OPERATING_TYPES = OPERATING_DOCS.filter((d) => d.required).map((d) => d.type as string);
export const OPERATING_TYPES = OPERATING_DOCS.map((d) => d.type as string);

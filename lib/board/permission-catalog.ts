// Board officer permission tiers — the catalog shared by the staff settings
// form, the board portal and the server action. Enforcement lives in the
// database (migration board_officer_permissions); this file only describes it.

export const BOARD_ROLES = ['president', 'vice_president', 'treasurer', 'secretary', 'director'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

export const BOARD_PERMISSIONS = ['vote_approvals', 'view_financials', 'view_delinquency', 'comment_cases'] as const;
export type BoardPermission = (typeof BOARD_PERMISSIONS)[number];

export const ROLE_LABELS: Record<BoardRole, string> = {
  president: 'President',
  vice_president: 'Vice President',
  treasurer: 'Treasurer',
  secretary: 'Secretary',
  director: 'Director',
};

export const PERMISSION_LABELS: Record<BoardPermission, { title: string; detail: string }> = {
  vote_approvals: {
    title: 'Vote on approvals',
    detail: 'Bills, purchase orders, contracts, budgets and policies sent to the board. Only these roles count toward majority or unanimous rules.',
  },
  view_financials: {
    title: 'See financials',
    detail: 'General ledger, bank balances, bills, budget vs actual, reserves and year-end packages.',
  },
  view_delinquency: {
    title: 'See owner balances',
    detail: 'Owner charges, payments, balances and collection cases.',
  },
  comment_cases: {
    title: 'Comment on cases',
    detail: 'Post comments on violations, architectural requests and work orders.',
  },
};

/** Recommended officer split: money decisions and owner balances stay with the president and treasurer. */
export const RECOMMENDED_PERMISSIONS: Record<BoardPermission, readonly BoardRole[]> = {
  vote_approvals: ['president', 'treasurer'],
  view_financials: BOARD_ROLES,
  view_delinquency: ['president', 'treasurer'],
  comment_cases: BOARD_ROLES,
};

/** Board portal sections that need a permission in at least one of the member's associations. */
export const SECTION_PERMISSIONS: Record<string, BoardPermission> = {
  '/board/financials': 'view_financials',
  '/board/budget': 'view_financials',
  '/board/capital-reserves': 'view_financials',
  '/board/delinquencies': 'view_delinquency',
};

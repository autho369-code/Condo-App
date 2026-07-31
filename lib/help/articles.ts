export type HelpArticle = {
  title: string;
  summary: string;
  steps: readonly string[];
  action: { href: string; label: string };
};

export const HELP_ARTICLES = {
  'board-reports': {
    title: 'Board reports',
    summary: 'Prepare board-ready financial and operating reports from the current association records.',
    steps: [
      'Open Reports and select the association and reporting period.',
      'Run each report and review the totals before sharing it with the board.',
      'Download the approved report as a PDF or include it in the monthly package.',
    ],
    action: { href: '/reports', label: 'Open reports' },
  },
  'board-member-overview': {
    title: 'Board member association overview',
    summary: 'Keep the active board roster and association context accurate for staff and board users.',
    steps: [
      'Open Associations and choose the property you want to manage.',
      'Select the Board section to review members, offices, and current terms.',
      'Confirm email addresses and term dates before sending board communications.',
    ],
    action: { href: '/associations', label: 'Open associations' },
  },
  'board-member-packets': {
    title: 'Board member packets',
    summary: 'Assemble meeting materials from approved reports and documents before distributing them.',
    steps: [
      'Generate the required financial reports for the correct association and period.',
      'Review supporting documents and confirm that confidential material is appropriate for the recipients.',
      'Export the final reports as PDFs and share them through the approved communication workflow.',
    ],
    action: { href: '/reports/monthly-package', label: 'Build a monthly package' },
  },
  'adding-board-members': {
    title: 'Adding board members',
    summary: 'Add a board member from the selected association so their role stays scoped to the correct property.',
    steps: [
      'Open the association and select its Board section.',
      'Add the member with their office, contact information, and term dates.',
      'Review the roster and send an invitation only after the details are correct.',
    ],
    action: { href: '/associations', label: 'Choose an association' },
  },
  'tracking-board-terms': {
    title: 'Tracking board terms',
    summary: 'Maintain reliable board tenure records so expired and upcoming terms are visible.',
    steps: [
      'Open the association Board section and review every active member.',
      'Record the term start and end dates established by the association.',
      'Update the roster promptly after elections, appointments, resignations, or office changes.',
    ],
    action: { href: '/associations', label: 'Review board rosters' },
  },
  'creating-approvals': {
    title: 'Creating approvals',
    summary: 'Create a traceable board approval within the association that owns the decision.',
    steps: [
      'Open the association and select Approvals.',
      'Describe the decision, supporting context, and voting deadline clearly.',
      'Confirm the eligible board members before opening the approval for votes.',
    ],
    action: { href: '/associations', label: 'Choose an association' },
  },
  'voting-schemes': {
    title: 'Voting schemes',
    summary: 'Use the association approval workflow to record who may vote and the resulting decision.',
    steps: [
      'Confirm the association rules and eligible voters before creating the approval.',
      'Set a clear deadline and provide the same supporting information to every voter.',
      'Review the recorded votes and final status before treating the decision as approved.',
    ],
    action: { href: '/associations', label: 'Open association approvals' },
  },
  committees: {
    title: 'Managing committees',
    summary: 'Keep committee membership and responsibilities associated with the correct property.',
    steps: [
      'Open an association and select its Committees section.',
      'Create or update the committee name, purpose, and membership.',
      'Review member contact details before sending committee communications.',
    ],
    action: { href: '/associations', label: 'Open associations' },
  },
  'architectural-reviews': {
    title: 'Architectural reviews',
    summary: 'Track owner architectural requests from submission through a documented decision.',
    steps: [
      'Review new submissions and verify that required details and attachments are present.',
      'Record review activity and the final decision in the request history.',
      'Communicate the outcome and retain the supporting record for the association.',
    ],
    action: { href: '/architectural-reviews', label: 'Open architectural reviews' },
  },
  'configuring-review-forms': {
    title: 'Configuring review forms',
    summary: 'Create a consistent form for collecting the information an architectural review requires.',
    steps: [
      'Open Forms and create a template for the request type.',
      'Add only the fields and supporting details the review committee needs.',
      'Preview the form and confirm its association workflow before publishing it.',
    ],
    action: { href: '/forms', label: 'Open forms' },
  },
  'add-property-budget': {
    title: 'Add a property budget',
    summary: 'Build the association budget from its chart of accounts and verify it before reporting.',
    steps: [
      'Open Budget and select the association and fiscal period.',
      'Enter budget amounts against the appropriate income and expense accounts.',
      'Review Budget vs Actual and the approved budget reports before distribution.',
    ],
    action: { href: '/budget', label: 'Open budgets' },
  },
  amenities: {
    title: 'Setting up amenities',
    summary: 'Define reservable association amenities and the operating details residents need.',
    steps: [
      'Open Amenities and create the amenity for the correct association.',
      'Add availability, capacity, location, and reservation requirements.',
      'Review the saved amenity before accepting resident reservations.',
    ],
    action: { href: '/amenities', label: 'Open amenities' },
  },
  'amenity-reservations': {
    title: 'Amenity reservation workflow',
    summary: 'Review and manage resident amenity requests against the current availability and rules.',
    steps: [
      'Open Amenities and select the relevant amenity.',
      'Review the requested date, resident, and any association requirements.',
      'Record the reservation status and resolve conflicts before confirming the booking.',
    ],
    action: { href: '/amenities', label: 'Review reservations' },
  },
  'managing-hoas': {
    title: 'Managing associations',
    summary: 'Use the association record as the source of truth for property, unit, board, and policy details.',
    steps: [
      'Open Associations and select the property you need to manage.',
      'Review its profile, units, board, amenities, budget, and operational settings.',
      'Save changes only to the selected association and verify them before leaving the page.',
    ],
    action: { href: '/associations', label: 'Open associations' },
  },
  'adding-a-property': {
    title: 'Adding a property',
    summary: 'Create the core association record before adding units, owners, financials, or board members.',
    steps: [
      'Enter the legal property name, address, and required management details.',
      'Review the information carefully so later records are attached to the correct association.',
      'Create the property, then add or import its units and owners.',
    ],
    action: { href: '/associations/new', label: 'Add a property' },
  },
  'property-groups': {
    title: 'Property groups',
    summary: 'Organize associations for portfolio work without changing their individual records or reporting scope.',
    steps: [
      'Review the associations that should be managed together.',
      'Use consistent portfolio naming and confirm each association belongs in the group.',
      'Continue to run accounting reports at the intended association or portfolio scope.',
    ],
    action: { href: '/associations', label: 'Review associations' },
  },
  'lease-templates': {
    title: 'Lease templates',
    summary: 'Store approved association documents where staff can find the current version.',
    steps: [
      'Open Documents and choose the correct association before uploading a template.',
      'Use a clear name and retain only the approved current version.',
      'Verify access and document contents before sharing it with an owner or resident.',
    ],
    action: { href: '/documents', label: 'Open documents' },
  },
  'late-fee-policies': {
    title: 'Late fee policies',
    summary: 'Keep late-fee configuration aligned with the association policy before applying owner charges.',
    steps: [
      'Review the governing policy and effective date for the association.',
      'Confirm the charge category and amount before posting any fee.',
      'Review the owner ledger after posting and correct any exception through the accounting workflow.',
    ],
    action: { href: '/charges', label: 'Open charges' },
  },
  'owner-statements': {
    title: 'Sending owner statements',
    summary: 'Generate statements from current owner ledger activity and review them before delivery.',
    steps: [
      'Open Send Statements and select the correct association and statement date.',
      'Review balances, charges, payments, and owner delivery details before generating statements.',
      'Send only the reviewed statement batch and retain the delivery result for follow-up.',
    ],
    action: { href: '/statements/send', label: 'Send statements' },
  },
} as const satisfies Record<string, HelpArticle>;

export type HelpArticleSlug = keyof typeof HELP_ARTICLES;

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES[slug as HelpArticleSlug];
}

export type ActionCenterAttentionItem = {
  label: string;
  count: number;
  href: string;
  tone: 'danger' | 'pending' | 'info';
};

type CountResult = { count: number | null; error?: unknown };
type CountQuery = PromiseLike<CountResult>;
type AttentionDatabase = {
  from: (table: string) => any;
};

export async function loadActionCenterAttention(
  db: AttentionDatabase,
  options: { isFinanceStaff: boolean },
): Promise<ActionCenterAttentionItem[]> {
  const today = new Date().toISOString().slice(0, 10);

  const overdueWorkOrders = db
    .from('work_orders')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .lt('scheduled_date', today)
    .not('status', 'in', '("done","completed","billed","closed","cancelled")') as CountQuery;

  const untriagedServiceRequests = db
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .in('status', ['open', 'waiting'])
    .eq('has_open_work_order', false) as CountQuery;

  const overdueReplies = db
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .in('status', ['open', 'waiting'])
    .is('acknowledged_at', null)
    .lt('first_response_due_at', new Date().toISOString()) as CountQuery;

  const unansweredMessages = db
    .from('message_threads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .eq('last_message_role', 'resident') as CountQuery;

  const overdueViolations = db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .lt('cure_deadline', today)
    .not('status', 'in', '("cured","closed")') as CountQuery;

  const violationFollowUps = db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .lte('next_followup_on', today)
    .not('status', 'in', '("cured","closed")') as CountQuery;

  const violationReports = db
    .from('violation_cases')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq('status', 'reported') as CountQuery;

  const lettersToMail = db
    .from('violation_letters')
    .select('id', { count: 'exact', head: true })
    .eq('mail_status', 'to_mail') as CountQuery;

  const architecturalReviews = db
    .from('architectural_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['submitted', 'under_review', 'more_info']) as CountQuery;

  const failedCommunications = db
    .from('communication_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed') as CountQuery;

  const poApprovals = options.isFinanceStaff
    ? db
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .eq('approval_status', 'pending_approval')
        .neq('status', 'cancelled') as CountQuery
    : Promise.resolve({ count: 0 });

  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const loansDue = options.isFinanceStaff
    ? db
        .from('association_loans')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .eq('status', 'active')
        .lte('next_payment_date', weekAhead) as CountQuery
    : Promise.resolve({ count: 0 });

  const pendingBills = options.isFinanceStaff
    ? db
        .from('payable_bills')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .eq('status', 'pending_approval') as CountQuery
    : Promise.resolve({ count: 0 });

  const [workOrders, serviceRequests, replies, messages, violations, followUps, reports, letters, reviews, communications, bills, loans, pos] = await Promise.all([
    overdueWorkOrders,
    untriagedServiceRequests,
    overdueReplies,
    unansweredMessages,
    overdueViolations,
    violationFollowUps,
    violationReports,
    lettersToMail,
    architecturalReviews,
    failedCommunications,
    pendingBills,
    loansDue,
    poApprovals,
  ]);

  return [
    { label: 'service requests past their reply time', count: replies.count ?? 0, href: '/service-requests?intake=overdue', tone: 'danger' as const },
    { label: 'resident messages waiting for a reply', count: messages.count ?? 0, href: '/inbox?q=unread', tone: 'pending' as const },
    { label: 'service requests awaiting triage', count: serviceRequests.count ?? 0, href: '/service-requests?intake=new', tone: 'pending' as const },
    { label: 'overdue work orders', count: workOrders.count ?? 0, href: '/work-orders?status=overdue', tone: 'danger' as const },
    { label: 'violation follow-ups due', count: followUps.count ?? 0, href: '/violations?status=followup_due', tone: 'pending' as const },
    { label: 'resident violation reports to review', count: reports.count ?? 0, href: '/violations/reports', tone: 'pending' as const },
    { label: 'violation letters to mail', count: letters.count ?? 0, href: '/violations/letters', tone: 'pending' as const },
    { label: 'violations past cure date', count: violations.count ?? 0, href: '/violations?status=overdue', tone: 'danger' as const },
    { label: 'architectural reviews awaiting action', count: reviews.count ?? 0, href: '/architectural-reviews?status=open', tone: 'pending' as const },
    { label: 'failed communications', count: communications.count ?? 0, href: '/communication-center?status=failed', tone: 'pending' as const },
    { label: 'loan payments due this week', count: loans.count ?? 0, href: '/accounting/loans', tone: 'pending' as const },
    { label: 'purchase orders awaiting approval', count: pos.count ?? 0, href: '/purchase-orders?status=pending_approval', tone: 'pending' as const },
    { label: 'bills pending approval', count: bills.count ?? 0, href: '/bills?status=pending_approval', tone: 'info' as const },
  ].filter((item) => item.count > 0);
}

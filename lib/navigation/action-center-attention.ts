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
    .select('id, work_orders!left(id)', { count: 'exact', head: true })
    .is('archived_at', null)
    .in('status', ['open', 'waiting'])
    .is('work_orders.id', null) as CountQuery;

  const overdueViolations = db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .lt('cure_deadline', today)
    .not('status', 'in', '("cured","closed")') as CountQuery;

  const architecturalReviews = db
    .from('architectural_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['submitted', 'under_review', 'more_info']) as CountQuery;

  const failedCommunications = db
    .from('communication_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed') as CountQuery;

  const pendingBills = options.isFinanceStaff
    ? db
        .from('payable_bills')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .eq('status', 'pending_approval') as CountQuery
    : Promise.resolve({ count: 0 });

  const [workOrders, serviceRequests, violations, reviews, communications, bills] = await Promise.all([
    overdueWorkOrders,
    untriagedServiceRequests,
    overdueViolations,
    architecturalReviews,
    failedCommunications,
    pendingBills,
  ]);

  return [
    { label: 'service requests awaiting triage', count: serviceRequests.count ?? 0, href: '/service-requests?intake=new', tone: 'pending' as const },
    { label: 'overdue work orders', count: workOrders.count ?? 0, href: '/work-orders?status=overdue', tone: 'danger' as const },
    { label: 'violations past cure date', count: violations.count ?? 0, href: '/violations?status=overdue', tone: 'danger' as const },
    { label: 'architectural reviews awaiting action', count: reviews.count ?? 0, href: '/architectural-reviews?status=open', tone: 'pending' as const },
    { label: 'failed communications', count: communications.count ?? 0, href: '/communication-center?status=failed', tone: 'pending' as const },
    { label: 'bills pending approval', count: bills.count ?? 0, href: '/bills?status=pending_approval', tone: 'info' as const },
  ].filter((item) => item.count > 0);
}

create or replace view public.payable_invoices_ledger
with (security_invoker = true) as
select
  b.id as bill_id,
  b.bill_number,
  b.bill_date,
  b.due_date,
  b.occurred_on,
  b.created_at,
  b.updated_at,
  b.amount,
  b.memo,
  b.status,
  b.approval_required,
  b.approved_at,
  b.paid_at,
  b.vendor_id,
  v.name as vendor_name,
  v.payment_type as vendor_payment_type,
  v.hold_payments as vendor_hold_payments,
  b.association_id,
  a.name as association_name,
  b.gl_account_id,
  ga.number as gl_account_number,
  ga.name as gl_account_name,
  b.bank_account_id,
  ba.name as bank_account_name,
  ba.bank_name,
  b.work_order_id,
  wo.number as work_order_number,
  wo.title as work_order_title,
  case
    when b.status = 'paid' then 'Paid'
    when b.status = 'approved' then 'Approved'
    when b.status = 'pending_approval' then 'Pending Approval'
    when b.status = 'draft' then 'Draft'
    when b.status = 'void' then 'Void'
    else initcap(replace(b.status::text, '_', ' '))
  end as status_label,
  case
    when b.status = 'paid' then 'Closed'
    when b.status = 'approved' then 'Ready to Pay'
    when b.status = 'pending_approval' then 'Approval Needed'
    when b.status = 'draft' then 'Needs Review'
    else 'Review'
  end as task_label
from public.payable_bills b
left join public.vendors v on v.id = b.vendor_id
left join public.associations a on a.id = b.association_id
left join public.gl_accounts ga on ga.id = b.gl_account_id
left join public.bank_accounts ba on ba.id = b.bank_account_id
left join public.work_orders wo on wo.id = b.work_order_id
where b.archived_at is null;

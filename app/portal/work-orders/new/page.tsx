import { redirect } from 'next/navigation'

// Owners cannot write directly to work_orders (no INSERT policy, and the table
// has no owner_id column). Resident-submitted maintenance goes through the
// service-request intake, which managers triage into work orders.
export default function NewOwnerWorkOrderPage() {
  redirect('/portal/service-requests/new')
}

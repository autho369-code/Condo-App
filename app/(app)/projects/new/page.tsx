import { redirect } from 'next/navigation';

// Projects are derived by grouping work orders that share a title + association —
// there is no separate projects table. Creating a project means creating its
// first work order, so send the manager straight to the work-order form.
export default function NewProjectPage() {
  redirect('/work-orders/new');
}

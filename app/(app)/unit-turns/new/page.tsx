import { redirect } from 'next/navigation';

// Unit turns are derived from work orders assigned to a unit — there is no
// separate unit_turns table. A new turn is a unit-assigned work order, so send
// the manager to the work-order form.
export default function NewUnitTurnPage() {
  redirect('/work-orders/new');
}

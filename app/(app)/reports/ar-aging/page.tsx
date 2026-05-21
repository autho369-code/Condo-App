// Legacy route — redirects to the new three-column Reports workspace.
import { redirect } from 'next/navigation';

export default function ARAgingRedirect() {
  redirect('/reports/ar_aging');
}

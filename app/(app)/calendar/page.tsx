import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Alert, PageShell, PageHeader, Surface } from '@/components/ui/shell';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import '@/components/calendar/calendar-theme.css';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ assoc?: string; type?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: associations } = await db.from('associations').select('id, name').is('archived_at', null).order('name');

  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        description="Month, week, day and agenda views"
        actions={
          <Link href={`/calendar/new${sp.assoc ? `?assoc=${encodeURIComponent(sp.assoc)}` : ''}`}>
            <Button><Plus className="h-4 w-4" /> Create event</Button>
          </Link>
        }
      />
      {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
      <Surface padded={false} className="overflow-hidden">
        <CalendarGrid associations={associations ?? []} initialAssocId={sp.assoc ?? ''} initialType={sp.type ?? ''} />
      </Surface>
    </PageShell>
  );
}

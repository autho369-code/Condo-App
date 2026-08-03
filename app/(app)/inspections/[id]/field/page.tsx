import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Button } from '@/components/ui/button';
import { OfflineInspectionCapture } from '../offline-inspection-capture';

export const dynamic = 'force-dynamic';

export default async function InspectionFieldPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const { data: inspection } = await (await createClient() as any).from('inspections').select('id, inspection_type, status, associations(name), units(unit_number)').eq('id', id).maybeSingle();
  if (!inspection) notFound();
  return <Workspace header={<WorkspaceHeader eyebrow="Offline field operations" title={inspection.inspection_type ?? 'Inspection capture'} subtitle={`${inspection.associations?.name ?? 'Association'}${inspection.units?.unit_number ? ` · Unit ${inspection.units.unit_number}` : ' · Common areas'}`} actions={<Link href={`/inspections/${id}`}><Button variant="secondary">Back to inspection</Button></Link>} />}><Section title="Disconnected finding capture" subtitle="This queue stays on this device until each finding is accepted by Portier." padded><OfflineInspectionCapture inspectionId={id} /></Section></Workspace>;
}

import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { AssetFields } from '@/components/fixed-assets/asset-fields';
import { Button } from '@/components/ui/button';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { loadAssetOptions } from '@/lib/fixed-assets/options';
import { createFixedAsset } from '@/lib/rpcs/fixed-assets';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewFixedAssetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const options = await loadAssetOptions(db);

  return (
    <DataWorkspace
      title="Add fixed asset"
      description="Record an association's equipment, appliance or other capital asset."
      actions={<Link href="/fixed-assets"><Button variant="secondary">Back to fixed assets</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not add asset">{sp.error}</Alert>}
        {options.error && <Alert tone="danger" title="Could not load associations and units">{options.error}</Alert>}
        {options.truncated && <Alert tone="warning">Not every unit could be listed.</Alert>}
        <form action={createFixedAsset}>
          <Surface>
            <AssetFields associations={options.associations} units={options.units} />
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <Link href="/fixed-assets" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
              <Button type="submit">Add asset</Button>
            </div>
          </Surface>
        </form>
      </div>
    </DataWorkspace>
  );
}

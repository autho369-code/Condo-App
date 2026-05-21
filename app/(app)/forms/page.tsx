import { requireStaff } from '@/lib/auth/me';
import { ModulePage, ComingSoon } from '@/components/workspace/module-page';

export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  await requireStaff();
  return (
    <ModulePage title="Forms" description="PDF forms with fillable fields — move-in checklists, architectural change requests, key-fob forms.">
      <ComingSoon
        reason="PDF template engine not yet built. Letters (Markdown-based) already work at /letters. PDF forms require a separate templating + fill pipeline."
        supabaseTable="document_templates (shared with /letters) + future pdf_form_templates"
        roadmapPhase="Phase 4 — Communication"
      />
    </ModulePage>
  );
}

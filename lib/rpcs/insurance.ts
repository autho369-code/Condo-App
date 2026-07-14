'use server';

// Owner HO6 policy submission. The certificate goes browser→Supabase Storage
// via a signed upload URL (Vercel caps server-action bodies at ~4.5 MB, so
// large policy PDFs must not travel through the action). These actions return
// { error } for the client form to render — they are not <form action> posts.
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';

const BUCKET = 'association-documents';
const MAX_CERT_BYTES = 25 * 1024 * 1024;

export async function createInsuranceCertUpload(
  fileName: string,
  fileSize: number,
): Promise<{ error?: string; path?: string; token?: string }> {
  const me = await getMe();
  if (!me.auth_user_id || !me.owner_id) return { error: 'Not signed in as an owner' };
  if (!fileName) return { error: 'Missing file name' };
  if (!fileSize || fileSize <= 0) return { error: 'Empty file' };
  if (fileSize > MAX_CERT_BYTES) return { error: `Policy document must be under ${Math.round(MAX_CERT_BYTES / 1048576)} MB` };

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `insurance/${me.owner_id}/${Date.now()}-${safeName}`;
  const svc = createServiceClient() as any;
  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? 'Could not authorize the upload' };
  return { path, token: data.token };
}

export async function saveInsurancePolicy(input: {
  carrier: string;
  policyNumber: string;
  coverageAmount: string;
  effectiveDate: string;
  expirationDate: string;
  remindOwner: boolean;
  remindManager: boolean;
  cert?: { path: string; name: string } | null;
}): Promise<{ error?: string; ok?: boolean }> {
  const me = await getMe();
  if (!me.auth_user_id || !me.owner_id) return { error: 'Not signed in as an owner' };

  const carrier = (input.carrier ?? '').trim();
  const policyNumber = (input.policyNumber ?? '').trim();
  const effective = input.effectiveDate || '';
  const expiration = input.expirationDate || '';
  const coverageRaw = (input.coverageAmount ?? '').replace(/[$,\s]/g, '');
  const coverage = coverageRaw ? Number(coverageRaw) : null;

  if (!carrier) return { error: 'Insurance carrier is required.' };
  if (!policyNumber) return { error: 'Policy number is required.' };
  if (!effective) return { error: 'Policy start date is required.' };
  if (!expiration) return { error: 'Policy end date is required.' };
  if (expiration <= effective) return { error: 'Policy end date must be after the start date.' };
  if (coverage !== null && !Number.isFinite(coverage)) return { error: 'Coverage amount must be a number.' };
  if (input.cert && !input.cert.path.startsWith(`insurance/${me.owner_id}/`)) return { error: 'Invalid document reference.' };

  const supabase = await createClient();
  const db = supabase as any;

  const { data: occ } = await db
    .from('occupancies')
    .select('association_id')
    .eq('owner_id', me.owner_id)
    .limit(1)
    .maybeSingle();

  const { error } = await db.from('insurance_policies').insert({
    owner_id: me.owner_id,
    association_id: occ?.association_id ?? null,
    insurance_company: carrier,
    policy_number: policyNumber,
    coverage_amount: coverage,
    effective_date: effective,
    expiration_date: expiration,
    certificate_file_url: input.cert?.path ?? null,
    extraction_status: 'manual',
    remind_owner: !!input.remindOwner,
    remind_manager: !!input.remindManager,
    status: 'active',
  });
  if (error) return { error: error.message };

  // File the certificate into the association records (documents table)
  if (input.cert) {
    try {
      const svc = createServiceClient() as any;
      await svc.from('documents').insert({
        entity_type: 'owner',
        entity_id: me.owner_id,
        doc_type: 'insurance_policy',
        file_name: input.cert.name,
        file_url: input.cert.path,
        uploaded_at: new Date().toISOString(),
        uploaded_by: me.auth_user_id,
        expires_at: new Date(expiration + 'T00:00:00Z').toISOString(),
      });
    } catch {}
  }

  revalidatePath('/portal/insurance');
  return { ok: true };
}

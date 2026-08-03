import { NextRequest, NextResponse } from 'next/server';
import { getMe } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEVERITIES = new Set(['info', 'minor', 'moderate', 'major', 'critical']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me.auth_user_id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!me.is_staff && !me.is_company_admin && !me.is_platform_operator) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
  const { id } = await params;
  if (!ID.test(id)) return NextResponse.json({ error: 'Invalid inspection identifier' }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.findings) || body.findings.length < 1 || body.findings.length > 100) {
    return NextResponse.json({ error: 'Submit between 1 and 100 findings' }, { status: 400 });
  }

  const db = (await createClient()) as any;
  const { data: inspection } = await db.from('inspections').select('id').eq('id', id).maybeSingle();
  if (!inspection) return NextResponse.json({ error: 'Inspection not found or not accessible' }, { status: 404 });

  const validated = body.findings.map((raw: any) => {
    const clientMutationId = String(raw?.clientMutationId ?? '');
    const issue = String(raw?.issue ?? '').trim();
    const area = String(raw?.area ?? '').trim();
    const severity = String(raw?.severity ?? 'minor');
    const capturedAt = new Date(String(raw?.capturedAt ?? ''));
    if (!ID.test(clientMutationId) || !issue || issue.length > 2000 || area.length > 200 || !SEVERITIES.has(severity) || Number.isNaN(capturedAt.getTime()) || capturedAt.getTime() > Date.now() + 5 * 60 * 1000) return null;
    return { clientMutationId, issue, area, severity, capturedAt };
  });
  if (validated.some((finding: unknown) => !finding)) return NextResponse.json({ error: 'One or more queued findings are invalid' }, { status: 400 });

  const accepted: string[] = [];
  for (const finding of validated) {
    const { clientMutationId, issue, area, severity, capturedAt } = finding!;
    const { data: existing } = await db.from('inspection_items').select('id').eq('inspection_id', id).eq('client_mutation_id', clientMutationId).maybeSingle();
    if (existing) { accepted.push(clientMutationId); continue; }
    const { error } = await db.from('inspection_items').insert({
      inspection_id: id,
      client_mutation_id: clientMutationId,
      area: area || null,
      issue,
      severity,
      captured_at: capturedAt.toISOString(),
      captured_by: me.auth_user_id,
    });
    if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
    accepted.push(clientMutationId);
  }
  return NextResponse.json({ accepted });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emailQueueRow, richTextToPlainText, textToHtml } from '@/lib/email/queue';
import { requireStaff, type MeResult } from '@/lib/auth/me';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  // Staff-only: server actions/route handlers are callable endpoints, so the
  // guard lives in the handler itself (middleware alone is not sufficient).
  let me: MeResult;
  try {
    me = await requireStaff();
    if (!me.auth_user_id || !me.portfolio?.id) throw new Error('Staff portfolio is unavailable.');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { templateId, associationId, requestKey, to, subject, body } = await request.json();

    const recipient = String(to ?? '').trim().toLowerCase();
    const cleanSubject = String(subject ?? '').replace(/[\r\n]+/g, ' ').trim();
    const plainBody = richTextToPlainText(String(body ?? ''));

    if (!UUID_PATTERN.test(String(templateId ?? '')) || !UUID_PATTERN.test(String(requestKey ?? ''))) {
      return NextResponse.json({ error: 'A valid template and request key are required.' }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(recipient) || recipient.length > 320) {
      return NextResponse.json({ error: 'Enter a valid recipient email address.' }, { status: 400 });
    }
    if (cleanSubject.length < 1 || cleanSubject.length > 300 || plainBody.length < 1 || plainBody.length > 50_000) {
      return NextResponse.json({ error: 'Subject or message length is invalid.' }, { status: 400 });
    }

    const supabase = await createClient();
    const db = supabase as any;
    const { data: template, error: templateError } = await db
      .from('document_templates')
      .select('id, portfolio_id, active, archived_at')
      .eq('id', templateId)
      .eq('active', true)
      .is('archived_at', null)
      .maybeSingle();
    if (templateError || !template || (!me.is_platform_operator && template.portfolio_id !== me.portfolio?.id)) {
      return NextResponse.json({ error: 'Template not found or unavailable.' }, { status: 404 });
    }

    let scopedAssociationId: string | null = null;
    if (associationId) {
      if (!UUID_PATTERN.test(String(associationId))) {
        return NextResponse.json({ error: 'Invalid association.' }, { status: 400 });
      }
      const { data: association } = await db
        .from('associations')
        .select('id, portfolio_id')
        .eq('id', associationId)
        .maybeSingle();
      if (!association || association.portfolio_id !== template.portfolio_id) {
        return NextResponse.json({ error: 'Association not found or unavailable.' }, { status: 404 });
      }
      scopedAssociationId = association.id;
    }

    const row = emailQueueRow({
      to: recipient,
      subject: cleanSubject,
      html: textToHtml(plainBody),
      portfolioId: template.portfolio_id,
      associationId: scopedAssociationId,
      templateId: template.id,
      sentBy: me.auth_user_id,
      fromName: me.portfolio?.company_name ?? 'Portier369',
      replyTo: me.portfolio?.support_email ?? 'hello@portier369.com',
      idempotencyKey: `letter:${requestKey}`,
    });
    const { data: queued, error } = await db
      .from('email_queue')
      .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ success: true, queued: true, id: queued?.id ?? null });
  } catch (err: any) {
    console.error('Send letter error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

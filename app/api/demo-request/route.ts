import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import {
  consumePublicRateLimit,
  consumeScopedRateLimit,
  rateLimitHeaders,
  type RateLimitResult,
} from '@/lib/server/rate-limit';

const MAX_REQUEST_BYTES = 64 * 1024;
const IP_POLICY = { scope: 'public:demo:ip', windowSeconds: 3600, maxRequests: 5 };
const EMAIL_POLICY = { scope: 'public:demo:email', windowSeconds: 86400, maxRequests: 2 };

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function clean(value: FormDataEntryValue | null, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function getList(formData: FormData, key: string): string {
  return formData
    .getAll(key)
    .slice(0, 20)
    .map((value) => clean(value, 100))
    .filter(Boolean)
    .join(', ');
}

function validEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function redirectTo(request: Request, params: Record<string, string>) {
  const url = new URL('/demo', request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

function blocked(request: Request, result: RateLimitResult) {
  const response = redirectTo(request, {
    error: result.unavailable ? 'unavailable' : 'rate-limit',
  });
  for (const [key, value] of Object.entries(rateLimitHeaders(result))) {
    response.headers.set(key, value);
  }
  return response;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  let service: any;
  try {
    service = createServiceClient() as any;
    const ipLimit = await consumePublicRateLimit(service, request, IP_POLICY);
    if (!ipLimit.allowed) return blocked(request, ipLimit);
  } catch (error) {
    console.error('demo request rate-limit setup failed:', error instanceof Error ? error.message : 'unknown error');
    return blocked(request, { allowed: false, remaining: 0, retryAfterSeconds: 60, unavailable: true });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  // Deliberately return the normal success page so automated fillers do not
  // learn which field identified them as a bot.
  if (clean(formData.get('office_fax'), 100)) {
    return redirectTo(request, { submitted: '1' });
  }

  const company = clean(formData.get('company_name'), 200);
  const contact = clean(formData.get('contact_name'), 200);
  const title = clean(formData.get('title'), 100);
  const email = clean(formData.get('email'), 320).toLowerCase();
  const phone = clean(formData.get('phone'), 50);
  const website = clean(formData.get('website'), 500);
  const associations = clean(formData.get('num_associations'), 50);
  const doors = clean(formData.get('total_doors'), 50);
  const selectedPlan = clean(formData.get('selected_plan'), 100);
  const timeline = clean(formData.get('timeline'), 100);
  const contactTime = clean(formData.get('contact_time'), 100);
  const message = clean(formData.get('message'), 3000);

  if (!company || !contact || !title || !validEmail(email) || !associations || !doors) {
    return redirectTo(request, { error: 'invalid' });
  }

  const emailLimit = await consumeScopedRateLimit(service, email, EMAIL_POLICY);
  if (!emailLimit.allowed) return blocked(request, emailLimit);

  const lines = [
    '=== PORTFOLIO ASSESSMENT REQUEST ===',
    '',
    'COMPANY',
    `Company: ${company}`,
    `Contact: ${contact}`,
    `Title: ${title}`,
    `Email: ${email}`,
    `Phone: ${phone || '-'}`,
    `Website: ${website || '-'}`,
    '',
    'PORTFOLIO',
    `Associations: ${associations}`,
    `Total Doors: ${doors}`,
    `Market: ${getList(formData, 'market') || '-'}`,
    '',
    `SELECTED PLAN: ${selectedPlan || 'Not selected'}`,
    '',
    'ADD-ON SERVICES',
    getList(formData, 'addon_services') || 'None selected',
    '',
    'CURRENT OPERATIONS',
    `Software: ${getList(formData, 'current_software') || '-'}`,
    `Challenges: ${getList(formData, 'challenges') || '-'}`,
    '',
    'IMPLEMENTATION',
    `Timeline: ${timeline || '-'}`,
    `Looking For: ${getList(formData, 'looking_for') || '-'}`,
    '',
    `CONTACT TIME: ${contactTime || '-'}`,
    '',
    'MESSAGE',
    message || '-',
    '',
    `Submitted: ${new Date().toISOString()}`,
  ];

  const resend = getResend();
  if (!resend) {
    console.error('demo request delivery is unavailable: RESEND_API_KEY is not configured');
    return redirectTo(request, { error: 'unavailable' });
  }

  try {
    const result = await resend.emails.send({
      from: 'Portier369 <hello@portier369.com>',
      to: 'hello@portier369.com',
      replyTo: email,
      subject: `Proposal request - ${company} (${doors} doors)`,
      text: lines.join('\n'),
    });
    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    console.error('demo request delivery failed:', error instanceof Error ? error.message : 'unknown error');
    return redirectTo(request, { error: 'unavailable' });
  }

  return redirectTo(request, { submitted: '1' });
}

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import {
  consumePublicRateLimit,
  consumeScopedRateLimit,
  type RateLimitResult,
} from '@/lib/server/rate-limit';

const VIOLATION_TYPES = new Set([
  'noise', 'construction', 'pet', 'parking', 'harassment', 'smoking',
  'waste', 'subletting', 'balcony', 'other',
]);
const REQUESTED_ACTIONS = new Set(['warning', 'fine', 'hearing']);
const AI_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IP_POLICY = { scope: 'public:violation-report:ip', windowSeconds: 3600, maxRequests: 5 };
const ASSOCIATION_POLICY = { scope: 'public:violation-report:association', windowSeconds: 3600, maxRequests: 50 };

function field(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function submitReport(formData: FormData) {
  // Honeypot submissions are discarded with the normal confirmation so bots
  // receive no signal that they were detected.
  if (field(formData, 'website_confirm', 200)) {
    redirect('/report-violation/confirmation');
  }

  let service: any;
  let ipLimit: RateLimitResult;
  try {
    service = createServiceClient() as any;
    ipLimit = await consumePublicRateLimit(service, await headers(), IP_POLICY);
  } catch (error) {
    console.error('violation report rate-limit setup failed:', error instanceof Error ? error.message : 'unknown error');
    redirect('/report-violation?error=unavailable');
  }
  if (!ipLimit.allowed) {
    redirect(`/report-violation?error=${ipLimit.unavailable ? 'unavailable' : 'rate-limit'}`);
  }

  const violationType = field(formData, 'violation_type', 40);
  const requestedAction = field(formData, 'requested_action', 40) ?? 'warning';
  const report = {
    association_id: field(formData, 'association_id', 64),
    reporter_name: field(formData, 'reporter_name', 200),
    reporter_unit: field(formData, 'reporter_unit', 100),
    reporter_contact: field(formData, 'reporter_contact', 320),
    reporter_is_owner: formData.get('reporter_is_owner') === 'yes',
    violator_name: field(formData, 'violator_name', 200),
    violator_unit: field(formData, 'violator_unit', 100),
    house_rule_id: field(formData, 'house_rule_id', 64),
    violation_type: violationType,
    violation_description: field(formData, 'violation_description', 5000),
    dates_times: field(formData, 'dates_times', 1000),
    witnesses: field(formData, 'witnesses', 2000),
    previously_reported: formData.get('previously_reported') === 'yes',
    requested_action: requestedAction,
    reporter_signature: field(formData, 'reporter_signature', 300),
    ack_share_info: formData.get('ack_share_info') === 'on',
    ack_true_accurate: formData.get('ack_true_accurate') === 'on',
    ack_may_contact: formData.get('ack_may_contact') === 'on',
  };

  const aiSeverity = field(formData, 'ai_severity', 20);
  const aiConfidence = Number.parseInt(field(formData, 'ai_confidence', 3) ?? '', 10);
  if (aiSeverity && AI_SEVERITIES.has(aiSeverity)) (report as any).ai_severity = aiSeverity;
  if (Number.isFinite(aiConfidence)) (report as any).ai_confidence = Math.max(0, Math.min(100, aiConfidence));

  if (!report.association_id || !UUID_PATTERN.test(report.association_id) ||
      !report.reporter_name || !report.reporter_contact ||
      !report.violation_description || !report.reporter_signature ||
      !violationType || !VIOLATION_TYPES.has(violationType) ||
      !REQUESTED_ACTIONS.has(requestedAction) ||
      !report.ack_share_info || !report.ack_true_accurate || !report.ack_may_contact) {
    redirect(`/report-violation?error=missing${report.association_id ? `&assoc=${report.association_id}` : ''}`);
  }

  const { data: association } = await service
    .from('associations')
    .select('id')
    .eq('id', report.association_id)
    .is('archived_at', null)
    .maybeSingle();
  if (!association) redirect('/report-violation?error=missing');

  const associationLimit = await consumeScopedRateLimit(service, association.id, ASSOCIATION_POLICY);
  if (!associationLimit.allowed) {
    redirect(`/report-violation?error=${associationLimit.unavailable ? 'unavailable' : 'rate-limit'}&assoc=${association.id}`);
  }

  if (report.house_rule_id) {
    const { data: rule } = await service
      .from('house_rules')
      .select('id')
      .eq('id', report.house_rule_id)
      .eq('association_id', association.id)
      .eq('active', true)
      .maybeSingle();
    if (!rule) report.house_rule_id = null;
  }

  const { error } = await service.from('violation_cases').insert(report);
  if (error) {
    console.error('report-violation insert failed:', error.message);
    redirect(`/report-violation?error=save&assoc=${association.id}`);
  }
  redirect('/report-violation/confirmation');
}

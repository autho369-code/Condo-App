import { isSupportedReportOutputFormat } from '@/lib/reports/formats';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The report-run choices to send back when a run is refused, as URL
 * parameters the report page reads (scope, association, unit, preset,
 * from, to, account, format). Only well-formed values are kept.
 */
export function keptReportChoices(formData: FormData): URLSearchParams {
  const kept = new URLSearchParams();
  const field = (k: string) => String(formData.get(k) ?? '');
  if (['portfolio', 'association', 'unit'].includes(field('param_scope'))) kept.set('scope', field('param_scope'));
  if (UUID.test(field('param_association_id'))) kept.set('association', field('param_association_id'));
  if (UUID.test(field('param_unit_id'))) kept.set('unit', field('param_unit_id'));
  // The run uses the submitted dates even when the user typed them without
  // picking "Custom", so bring those exact dates back as a custom period.
  if (DAY.test(field('param_date_from')) && DAY.test(field('param_date_to'))) {
    kept.set('preset', 'custom');
    kept.set('from', field('param_date_from'));
    kept.set('to', field('param_date_to'));
  } else if (/^[a-z0-9_]+$/.test(field('preset'))) {
    kept.set('preset', field('preset'));
  }
  if (UUID.test(field('account'))) kept.set('account', field('account'));
  if (isSupportedReportOutputFormat(field('output_format'))) kept.set('format', field('output_format'));
  return kept;
}

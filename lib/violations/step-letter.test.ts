import { describe, expect, it } from 'vitest';
import { buildStepLetter, mergeTemplate, type StepLetterContext } from './step-letter';

const ctx: StepLetterContext = {
  ownerName: 'Liam Chen',
  unitNumber: '102',
  associationName: 'Granville Tower',
  violationTitle: 'Trash cans left at curb',
  violationDescription: 'Bins were left out past collection day.',
  rule: 'R-4 — Trash and recycling',
  dateObserved: '2026-09-02',
  cureDeadline: '2026-09-16',
  stepName: 'Courtesy notice',
  fee: 0,
  finesTotal: 0,
  offersHearing: false,
  hearingDeadline: null,
  today: '2026-09-30',
};

describe('buildStepLetter', () => {
  it('writes a standard courtesy letter when the step has no template', () => {
    const { subject, body } = buildStepLetter(ctx, null);
    expect(subject).toBe('Granville Tower: Courtesy notice — Trash cans left at curb');
    expect(body).toContain('Dear Liam Chen,');
    expect(body).toContain('Granville Tower, unit 102');
    expect(body).toContain('On September 2, 2026');
    expect(body).toContain('Please correct this by September 16, 2026.');
    expect(body).not.toContain('fine');
    expect(body).not.toContain('hearing');
  });

  it('states the fine and the running total on a fine step', () => {
    const { body } = buildStepLetter({ ...ctx, stepName: 'First fine', fee: 50, finesTotal: 50 }, null);
    expect(body).toContain('a fine of $50.00 has been posted to your account for this step (First fine)');
    expect(body).toContain('now total $50.00');
    expect(body).not.toContain('Please correct this by');
  });

  it('offers a hearing with the deadline when the step offers one', () => {
    const { body } = buildStepLetter({ ...ctx, offersHearing: true, hearingDeadline: '2026-10-14' }, null);
    expect(body).toContain('request a hearing before the board by October 14, 2026');
  });

  it('fills a template and flags unknown merge fields', () => {
    const { subject, body } = buildStepLetter(ctx, {
      subject: 'Notice for unit {{unit_number}}',
      body: 'Hello {{ Owner_Name }}, re: {{violation_title}} ({{mystery}})',
    });
    expect(subject).toBe('Notice for unit 102');
    expect(body).toBe('Hello Liam Chen, re: Trash cans left at curb ([mystery])');
  });

  it('falls back to the standard wording for a blank template body', () => {
    const { body } = buildStepLetter(ctx, { subject: null, body: '   ' });
    expect(body).toContain('Dear Liam Chen,');
  });
});

describe('mergeTemplate', () => {
  it('does not treat merged values as template syntax', () => {
    expect(mergeTemplate('{{a}}', { a: '{{b}}', b: 'x' })).toBe('{{b}}');
  });
});

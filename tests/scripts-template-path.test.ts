import { describe, expect, it } from 'vitest';
import { templatePath } from '../scripts/lib/template-path.mjs';

describe('route audit template links', () => {
  it('turns whole-segment substitutions into dynamic segments', () => {
    expect(templatePath('/owners/${id}/edit')).toBe('/owners/__param__/edit');
    expect(templatePath('/reports/${slug}')).toBe('/reports/__param__');
  });

  it('ends the path at a substitution glued to text', () => {
    expect(templatePath('/budget${qs}')).toBe('/budget');
    expect(templatePath('/reports/delinquency${scopeQuery}')).toBe('/reports/delinquency');
  });

  it('treats ? and # inside a substitution as code, not URL delimiters', () => {
    expect(templatePath('/associations/${assoc.slug ?? assoc.id}/budget')).toBe('/associations/__param__/budget');
    expect(templatePath('/x/${a ? `y` : "z"}/edit?tab=1')).toBe('/x/__param__/edit');
    expect(templatePath('/units?association=${id}')).toBe('/units');
  });

  it('gives up on unparseable templates', () => {
    expect(templatePath('${base}/x')).toBeNull();
    expect(templatePath('/x/${unclosed')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { isFormFilePath } from '@/lib/forms/file-types';

const P = '11111111-2222-4333-8444-555555555555';
const F = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('form file paths', () => {
  it('accepts only forms/<portfolio>/<uuid>.<allowed ext>', () => {
    expect(isFormFilePath(`forms/${P}/${F}.pdf`, P)).toBe(true);
    expect(isFormFilePath(`forms/${P}/${F}.docx`, P)).toBe(true);
  });

  it('rejects other portfolios, folders, traversal and types', () => {
    const other = '99999999-2222-4333-8444-555555555555';
    expect(isFormFilePath(`forms/${other}/${F}.pdf`, P)).toBe(false);
    expect(isFormFilePath(`insurance/${P}/${F}.pdf`, P)).toBe(false);
    expect(isFormFilePath(`forms/${P}/../${F}.pdf`, P)).toBe(false);
    expect(isFormFilePath(`forms/${P}/${F}.html`, P)).toBe(false);
    expect(isFormFilePath(`forms/${P}/x/${F}.pdf`, P)).toBe(false);
    expect(isFormFilePath(null, P)).toBe(false);
    expect(isFormFilePath(`forms/${P}/${F}.pdf`, 'not-a-uuid')).toBe(false);
  });
});

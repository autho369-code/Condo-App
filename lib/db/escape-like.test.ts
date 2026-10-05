import { describe, expect, it } from 'vitest';
import { escapeLike } from './escape-like';

describe('escapeLike', () => {
  it('escapes LIKE wildcards so an email matches only itself', () => {
    expect(escapeLike('a_b@x.com')).toBe('a\\_b@x.com');
    expect(escapeLike('100%@x.com')).toBe('100\\%@x.com');
    expect(escapeLike('back\\slash@x.com')).toBe('back\\\\slash@x.com');
  });

  it('leaves ordinary addresses unchanged', () => {
    expect(escapeLike('owner@example.com')).toBe('owner@example.com');
  });
});

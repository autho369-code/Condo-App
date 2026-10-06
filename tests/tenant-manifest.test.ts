import { beforeEach, describe, expect, it, vi } from 'vitest';

let requestHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: async () => requestHeaders }));

beforeEach(() => { requestHeaders = new Headers(); vi.resetModules(); });

describe('manifest', () => {
  it("installs under the company's name on its own address", async () => {
    requestHeaders = new Headers({ 'x-portfolio-id': 'p1', 'x-portfolio-name': encodeURIComponent('Stellar Property Group') });
    const { default: manifest } = await import('../app/manifest');
    expect(await manifest()).toMatchObject({ name: 'Stellar Property Group', short_name: 'Stellar Property Group' });
  });

  it('keeps the platform name on the platform address', async () => {
    const { default: manifest } = await import('../app/manifest');
    expect(await manifest()).toMatchObject({ name: 'Portier369 — Property Management', short_name: 'Portier369' });
  });
});

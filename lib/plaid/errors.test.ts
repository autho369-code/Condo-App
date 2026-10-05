import { describe, expect, it } from 'vitest';
import { plaidErrorSummary, plaidPublicMessage } from './errors';

describe('plaidErrorSummary', () => {
  it('keeps only documented Plaid error fields, never request config secrets', () => {
    const axiosError = {
      message: 'Request failed with status code 400',
      config: {
        headers: { 'PLAID-SECRET': 'super-secret', 'PLAID-CLIENT-ID': 'client' },
        data: JSON.stringify({ access_token: 'access-sandbox-123' }),
      },
      response: {
        status: 400,
        data: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'login required', request_id: 'req1' },
      },
    };
    const summary = plaidErrorSummary(axiosError);
    expect(summary).toEqual({
      status: 400,
      error_type: 'ITEM_ERROR',
      error_code: 'ITEM_LOGIN_REQUIRED',
      error_message: 'login required',
      request_id: 'req1',
    });
    expect(JSON.stringify(summary)).not.toContain('super-secret');
    expect(JSON.stringify(summary)).not.toContain('access-sandbox');
  });

  it('falls back to the error message for network failures', () => {
    expect(plaidErrorSummary(new Error('socket hang up')).error_message).toBe('socket hang up');
    expect(plaidPublicMessage(null, 'Failed')).toBe('Failed');
  });
});

import { describe, expect, it } from 'vitest';
import { mapTwilioStatus, twilioSignature, validTwilioSignature } from '@/lib/sms/twilio';

describe('Twilio delivery boundary', () => {
  it('matches Twilio official form-signature example', () => {
    const params = new URLSearchParams({
      CallSid: 'CA1234567890ABCDE',
      Caller: '+14158675310',
      Digits: '1234',
      From: '+14158675310',
      To: '+18005551212',
    });
    const url = 'https://example.com/myapp.php?foo=1&bar=2';
    const signature = twilioSignature('12345', url, params);
    expect(signature).toBe('L/OH5YylLD5NRKLltdqwSvS0BnU=');
    expect(validTwilioSignature('12345', url, params, signature)).toBe(true);
    expect(validTwilioSignature('wrong', url, params, signature)).toBe(false);
  });

  it('maps provider statuses without inventing unsupported database states', () => {
    expect(mapTwilioStatus('queued')).toBe('queued');
    expect(mapTwilioStatus('sending')).toBe('sent');
    expect(mapTwilioStatus('delivered')).toBe('delivered');
    expect(mapTwilioStatus('undelivered')).toBe('undelivered');
    expect(mapTwilioStatus('received')).toBeNull();
  });
});

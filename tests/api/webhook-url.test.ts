import { describe, expect, it } from 'vitest';

import { isPublicWebhookIp, validatedWebhookUrl } from '@/lib/webhooks/url';

describe('webhook URL boundary', () => {
  it('rejects loopback, private, link-local, carrier NAT, and documentation ranges', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '203.0.113.5', '::1', 'fd00::1', 'fe80::1']) {
      expect(isPublicWebhookIp(address), address).toBe(false);
    }
    expect(isPublicWebhookIp('8.8.8.8')).toBe(true);
    expect(isPublicWebhookIp('2606:4700:4700::1111')).toBe(true);
  });

  it('rejects private addresses written in IPv6 forms (mapped, compatible, 6to4, NAT64, multicast)', () => {
    for (const address of [
      '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::ffff:10.0.0.1', '::7f00:1', '::127.0.0.1', '0:0:0:0:0:0:0:1',
      '2002:7f00:1::', '2002:a9fe:a9fe::1', '64:ff9b::a9fe:a9fe', '64:ff9b:1::1', 'ff02::1', 'fec0::1',
      '2001:0:4136:e378::1', '2001:db8::1', '100::1', 'FD00::1', 'fe80::1%eth0', 'not-an-ip', '1::2::3',
    ]) {
      expect(isPublicWebhookIp(address), address).toBe(false);
    }
    expect(isPublicWebhookIp('::ffff:8.8.8.8')).toBe(true);
    expect(isPublicWebhookIp('2002:808:808::1')).toBe(true);
    expect(isPublicWebhookIp('2a00:1450:4001:80b::200e')).toBe(true);
  });

  it('rejects a literal IPv6 URL that maps to the cloud metadata address', async () => {
    const noDns = async () => [];
    await expect(validatedWebhookUrl('https://[::ffff:169.254.169.254]/latest', noDns)).rejects.toThrow('public internet addresses');
    await expect(validatedWebhookUrl('https://[::ffff:127.0.0.1]/x', noDns)).rejects.toThrow('public internet addresses');
  });

  it('requires HTTPS, public DNS, no credentials, and the standard port', async () => {
    const publicDns = async () => [{ address: '8.8.8.8', family: 4 }];
    await expect(validatedWebhookUrl('https://hooks.example.com/events', publicDns)).resolves.toBe('https://hooks.example.com/events');
    await expect(validatedWebhookUrl('http://hooks.example.com/events', publicDns)).rejects.toThrow('HTTPS');
    await expect(validatedWebhookUrl('https://user:pass@hooks.example.com/events', publicDns)).rejects.toThrow('credentials');
    await expect(validatedWebhookUrl('https://hooks.example.com:8443/events', publicDns)).rejects.toThrow('standard HTTPS port');
    await expect(validatedWebhookUrl('https://metadata.internal/events', publicDns)).rejects.toThrow('public internet hostname');
  });

  it('rejects a hostname when any DNS answer is non-public', async () => {
    await expect(validatedWebhookUrl('https://hooks.example.com/events', async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.4', family: 4 },
    ])).rejects.toThrow('public internet addresses');
  });
});

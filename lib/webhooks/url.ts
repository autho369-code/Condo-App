import 'server-only';

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

type LookupAddress = { address: string; family: number };
type LookupAll = (hostname: string) => Promise<LookupAddress[]>;

function publicIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function isPublicWebhookIp(address: string) {
  const normalized = address.toLowerCase().split('%')[0];
  const family = isIP(normalized);
  if (family === 4) return publicIpv4(normalized);
  if (family !== 6) return false;
  if (normalized === '::' || normalized === '::1') return false;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  if (/^fe[89ab]/.test(normalized)) return false;
  if (normalized.startsWith('2001:db8:')) return false;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return publicIpv4(mapped[1]);
  return true;
}

const defaultLookup: LookupAll = async (hostname) => lookup(hostname, { all: true, verbatim: true });

export async function resolvePublicWebhookTarget(input: string, resolveAll: LookupAll = defaultLookup) {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Enter a valid HTTPS endpoint URL.');
  }
  if (parsed.protocol !== 'https:') throw new Error('Webhook endpoints must use HTTPS.');
  if (parsed.username || parsed.password) throw new Error('Webhook endpoint URLs cannot contain credentials.');
  if (parsed.port && parsed.port !== '443') throw new Error('Webhook endpoints must use the standard HTTPS port.');

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Webhook endpoint must use a public internet hostname.');
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolveAll(hostname).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicWebhookIp(address))) {
    throw new Error('Webhook endpoint must resolve only to public internet addresses.');
  }
  return { url: parsed, addresses };
}

export async function validatedWebhookUrl(input: string, resolveAll: LookupAll = defaultLookup) {
  const { url } = await resolvePublicWebhookTarget(input, resolveAll);
  return url.toString();
}

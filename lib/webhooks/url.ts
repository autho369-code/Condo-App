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

/**
 * Expand an IPv6 address to eight 16-bit groups (a dotted IPv4 tail becomes
 * the last two). Null when it isn't a valid IPv6 address.
 */
function ipv6Groups(address: string): number[] | null {
  let text = address;
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const parts = dotted[2].split('.').map(Number);
    if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    text = `${dotted[1]}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

function ipv4FromGroups(high: number, low: number) {
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

export function isPublicWebhookIp(address: string) {
  const normalized = address.toLowerCase().split('%')[0];
  const family = isIP(normalized);
  if (family === 4) return publicIpv4(normalized);
  if (family !== 6) return false;
  // Judge the expanded groups, not the text: the URL parser writes
  // [::ffff:169.254.169.254] as ::ffff:a9fe:a9fe, which a text match missed.
  const g = ipv6Groups(normalized);
  if (!g) return false;
  const zeros = (count: number) => g.slice(0, count).every((group) => group === 0);
  // IPv4-mapped (::ffff:a.b.c.d): judge the IPv4 address it carries.
  if (zeros(5) && g[5] === 0xffff) return publicIpv4(ipv4FromGroups(g[6], g[7]));
  // Unspecified, loopback and the old IPv4-compatible form (::a.b.c.d).
  if (zeros(6)) return false;
  // 6to4 (2002::/16) carries an IPv4 address in its next 32 bits.
  if (g[0] === 0x2002) return publicIpv4(ipv4FromGroups(g[1], g[2]));
  if (g[0] === 0x64 && g[1] === 0xff9b) return false; // NAT64
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return false; // discard 100::/64
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return false; // Teredo, documentation
  if ((g[0] & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return false; // link-local, site-local
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
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

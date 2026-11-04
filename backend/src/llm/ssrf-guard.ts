import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { LlmError } from './llm.types';

export type Lookup = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: Lookup = (hostname) => dnsLookup(hostname, { all: true });

const blocked = (reason: string) =>
  new LlmError('BLOCKED', `the server address is not allowed (${reason})`, {
    retryable: false,
  });

/**
 * Addresses a configured server must never point to: link-local (169.254.0.0/16 and fe80::/10, where cloud
 * metadata services answer with credentials), the unspecified address, and IPv6 unique-local fd00:ec2::254 style
 * metadata. Private ranges and loopback are allowed on purpose: the self-hosted model server of a unit lives there.
 */
export function isBlockedAddress(address: string): boolean {
  const lower = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isBlockedAddress(mapped[1]);
  const embedded = embeddedIpv4(lower);
  if (embedded) return isBlockedAddress(embedded);

  if (isIP(lower) === 4) {
    const [a, b] = lower.split('.').map(Number);
    return (a === 169 && b === 254) || a === 0;
  }
  if (isIP(lower) === 6) {
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    if (/^fe[89ab]/.test(lower)) return true; // fe80::/10
    if (lower.startsWith('fd00:ec2:')) return true; // AWS IPv6 metadata
  }
  return false;
}

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
function hextets(address: string): number[] | null {
  if (isIP(address) !== 6) return null;
  const [head, tail] = address.split('::');
  const toGroups = (part: string): number[] =>
    part === ''
      ? []
      : part.split(':').flatMap((g) => {
          if (g.includes('.')) {
            const [a, b, c, d] = g.split('.').map(Number);
            return [(a << 8) | b, (c << 8) | d];
          }
          return [parseInt(g, 16)];
        });
  const first = toGroups(head);
  if (tail === undefined) return first.length === 8 ? first : null;
  const last = toGroups(tail);
  return [
    ...first,
    ...new Array<number>(8 - first.length - last.length).fill(0),
    ...last,
  ];
}

/**
 * The IPv4 address hidden inside an IPv6 one: IPv4-mapped (::ffff:a.b.c.d, in dotted or hex spelling), the NAT64
 * prefix 64:ff9b::/96 and the deprecated IPv4-compatible form. A URL parser rewrites a dotted tail into hex, so a
 * check that only knows the dotted spelling is bypassed by `http://[::ffff:169.254.169.254]`.
 */
function embeddedIpv4(address: string): string | null {
  const g = hextets(address);
  if (!g) return null;
  const tailIpv4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  const upperZero = g.slice(0, 5).every((x) => x === 0);
  if (upperZero && g[5] === 0xffff) return tailIpv4; // mapped
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0))
    return tailIpv4; // NAT64
  if (g.slice(0, 6).every((x) => x === 0) && (g[6] !== 0 || g[7] > 1))
    return tailIpv4; // IPv4-compatible
  return null;
}

/**
 * Checks a self-hosted server URL right before it is called: http(s) only, and every address the name resolves to
 * must be allowed. It runs at call time, not only when the URL is saved, because a name can start resolving
 * somewhere else later. The adapter also refuses redirects, so an allowed host cannot bounce the call to a blocked one.
 */
export async function assertSafeBaseUrl(
  baseUrl: string,
  lookup: Lookup = defaultLookup,
): Promise<void> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw blocked('not a URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw blocked('scheme');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw blocked('address');
    return;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host);
  } catch {
    throw blocked('name does not resolve');
  }
  if (
    addresses.length === 0 ||
    addresses.some((a) => isBlockedAddress(a.address))
  ) {
    throw blocked('address');
  }
}

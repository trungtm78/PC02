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

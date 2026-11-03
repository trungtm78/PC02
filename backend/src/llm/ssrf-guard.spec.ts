import { assertSafeBaseUrl, isBlockedAddress } from './ssrf-guard';

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
};

const resolvesTo =
  (...addresses: string[]) =>
  () =>
    Promise.resolve(
      addresses.map((address) => ({
        address,
        family: address.includes(':') ? 6 : 4,
      })),
    );

describe('isBlockedAddress', () => {
  it('blocks link-local and metadata addresses, the way into cloud credentials', () => {
    for (const a of [
      '169.254.169.254',
      '169.254.0.1',
      'fe80::1',
      'fd00:ec2::254',
      '0.0.0.0',
      '::',
    ]) {
      expect(isBlockedAddress(a)).toBe(true);
    }
  });

  it('blocks an IPv6 form that wraps a blocked IPv4 address', () => {
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
  });

  it("allows the private ranges a unit's own server lives in, and loopback for a server on the same machine", () => {
    for (const a of [
      '10.1.2.3',
      '172.16.0.9',
      '192.168.1.20',
      '127.0.0.1',
      '::1',
    ]) {
      expect(isBlockedAddress(a)).toBe(false);
    }
  });

  it('allows public addresses', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
  });
});

describe('assertSafeBaseUrl', () => {
  it('accepts a private server', async () => {
    await expect(
      assertSafeBaseUrl('http://llm.noi-bo.local:8000', resolvesTo('10.0.0.5')),
    ).resolves.toBeUndefined();
  });

  it('refuses a host that resolves to the metadata address, even behind a friendly name', async () => {
    expect(
      await codeOf(
        assertSafeBaseUrl(
          'http://totally-fine.example',
          resolvesTo('169.254.169.254'),
        ),
      ),
    ).toBe('BLOCKED');
  });

  it('refuses when ANY of the addresses a name resolves to is blocked (a mixed answer is how rebinding hides)', async () => {
    expect(
      await codeOf(
        assertSafeBaseUrl(
          'http://x.example',
          resolvesTo('10.0.0.5', '169.254.169.254'),
        ),
      ),
    ).toBe('BLOCKED');
  });

  it('refuses an address given directly in the URL without a lookup', async () => {
    const lookup = jest.fn(resolvesTo('8.8.8.8'));
    expect(
      await codeOf(assertSafeBaseUrl('http://169.254.169.254/latest', lookup)),
    ).toBe('BLOCKED');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('refuses schemes other than http and https, and a URL that does not parse', async () => {
    expect(
      await codeOf(
        assertSafeBaseUrl('file:///etc/passwd', resolvesTo('10.0.0.5')),
      ),
    ).toBe('BLOCKED');
    expect(
      await codeOf(assertSafeBaseUrl('not a url', resolvesTo('10.0.0.5'))),
    ).toBe('BLOCKED');
  });

  it('refuses a name that does not resolve', async () => {
    expect(
      await codeOf(
        assertSafeBaseUrl('http://nowhere.example', () =>
          Promise.reject(new Error('ENOTFOUND')),
        ),
      ),
    ).toBe('BLOCKED');
  });
});

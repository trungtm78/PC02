import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPinnedFetch } from './pinned-fetch';

const answers =
  (...addresses: string[]) =>
  () =>
    Promise.resolve(
      addresses.map((address) => ({
        address,
        family: address.includes(':') ? 6 : 4,
      })),
    );

describe('createPinnedFetch', () => {
  let server: http.Server;
  let port: number;
  let seen: Array<{
    method?: string;
    url?: string;
    auth?: string;
    body: string;
  }>;

  beforeAll(async () => {
    seen = [];
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        seen.push({
          method: req.method,
          url: req.url,
          auth: req.headers.authorization,
          body,
        });
        if (req.url === '/redirect') {
          res.writeHead(302, { location: 'http://169.254.169.254/latest' });
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  beforeEach(() => {
    seen = [];
  });

  it('connects to the address its lookup returned, with the method, headers and body it was given', async () => {
    // "model.noi-bo.test" exists nowhere in DNS: only the injected lookup can make it reach the local server.
    const fetchPinned = createPinnedFetch(answers('127.0.0.1'));
    const response = await fetchPinned(
      `http://model.noi-bo.test:${port}/v1/chat`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer k',
          'content-type': 'application/json',
        },
        body: '{"a":1}',
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(seen[0]).toEqual({
      method: 'POST',
      url: '/v1/chat',
      auth: 'Bearer k',
      body: '{"a":1}',
    });
  });

  it('never connects when the name resolves to a blocked address, even if it was fine a moment earlier', async () => {
    let flipped = false;
    const rebinding = () =>
      Promise.resolve([
        { address: flipped ? '169.254.169.254' : '127.0.0.1', family: 4 },
      ]);
    const fetchPinned = createPinnedFetch(rebinding);
    await fetchPinned(`http://rebind.test:${port}/ok`);
    flipped = true;
    seen = [];
    await expect(
      fetchPinned(`http://rebind.test:${port}/ok`),
    ).rejects.toMatchObject({
      code: 'BLOCKED',
    });
    expect(seen).toHaveLength(0);
  });

  it('refuses when ANY returned address is blocked', async () => {
    const fetchPinned = createPinnedFetch(
      answers('127.0.0.1', '169.254.169.254'),
    );
    await expect(
      fetchPinned(`http://mixed.test:${port}/x`),
    ).rejects.toMatchObject({ code: 'BLOCKED' });
    expect(seen).toHaveLength(0);
  });

  it('hands a redirect back as it is and does not follow it', async () => {
    const fetchPinned = createPinnedFetch(answers('127.0.0.1'));
    const response = await fetchPinned(
      `http://model.noi-bo.test:${port}/redirect`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://169.254.169.254/latest',
    );
    expect(seen.map((s) => s.url)).toEqual(['/redirect']);
  });

  it('an aborted call (timeout) rejects', async () => {
    const fetchPinned = createPinnedFetch(answers('127.0.0.1'));
    await expect(
      fetchPinned(`http://model.noi-bo.test:${port}/x`, {
        signal: AbortSignal.abort(),
      }),
    ).rejects.toBeDefined();
  });
});

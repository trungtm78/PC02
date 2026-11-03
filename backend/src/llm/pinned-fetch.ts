import * as http from 'node:http';
import * as https from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { isBlockedAddress, type Lookup } from './ssrf-guard';
import { LlmError } from './llm.types';

type Resolve = Lookup;

const resolveAll: Resolve = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (error, addresses) =>
      error ? reject(error) : resolve(addresses),
    );
  });

/**
 * A DNS lookup that refuses blocked addresses AT THE MOMENT THE SOCKET CONNECTS. Checking a name once and then
 * letting `fetch` resolve it again leaves a gap in which a name can start answering with a metadata address (DNS
 * rebinding); here the address that was checked is the address that is connected to.
 */
export function guardedLookup(resolve: Resolve = resolveAll): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname).then(
      (addresses) => {
        if (
          addresses.length === 0 ||
          addresses.some((a) => isBlockedAddress(a.address))
        ) {
          callback(
            new LlmError(
              'BLOCKED',
              'the server address is not allowed (address)',
              {
                retryable: false,
              },
            ),
            '',
            4,
          );
          return;
        }
        if ((options as { all?: boolean }).all) {
          (callback as unknown as (e: null, a: unknown) => void)(
            null,
            addresses,
          );
        } else {
          callback(null, addresses[0].address, addresses[0].family);
        }
      },
      (error: unknown) => callback(error as NodeJS.ErrnoException, '', 4),
    );
  };
}

/**
 * `fetch`-shaped HTTP client for self-hosted model servers: addresses are checked as the connection is made, and a
 * redirect is returned to the caller as it is (never followed), so an allowed host cannot send the call (and its key)
 * on to a blocked one.
 */
export function createPinnedFetch(resolve: Resolve = resolveAll): typeof fetch {
  const lookup = guardedLookup(resolve);
  return ((input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((resolveResponse, reject) => {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      const client = url.protocol === 'https:' ? https : http;
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((value, key) => {
        headers[key] = value;
      });
      const request = client.request(
        url,
        {
          method: init?.method ?? 'GET',
          headers,
          lookup,
          // A fresh socket per call: a kept-alive one would skip the lookup, and with it the address check.
          agent: false,
          signal: init?.signal ?? undefined,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(response.headers)) {
              if (Array.isArray(value))
                value.forEach((v) => responseHeaders.append(key, v));
              else if (value !== undefined) responseHeaders.set(key, value);
            }
            const status = response.statusCode ?? 502;
            // A Response with a body is not allowed for these statuses.
            const noBody = status === 204 || status === 205 || status === 304;
            resolveResponse(
              new Response(noBody ? null : Buffer.concat(chunks), {
                status,
                headers: responseHeaders,
              }),
            );
          });
          response.on('error', reject);
        },
      );
      request.on('error', reject);
      if (init?.body !== undefined && init.body !== null) {
        request.write(
          typeof init.body === 'string'
            ? init.body
            : Buffer.from(init.body as ArrayBuffer),
        );
      }
      request.end();
    })) as typeof fetch;
}

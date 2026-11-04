import * as fs from 'fs';
import * as path from 'path';
import {
  CLOUD_KINDS,
  PROVIDER_KINDS,
  isCloudKind,
  normalizeBaseUrl,
  providerFingerprint,
  roleBlocker,
  validateProviderInput,
} from './provider-rules';

const valid = {
  kind: 'ANTHROPIC' as const,
  label: 'Claude Haiku',
  model: 'claude-haiku-5-5',
  baseUrl: null,
  apiKey: 'sk-ant-1234567890',
};
const codes = (input: Parameters<typeof validateProviderInput>[0]) =>
  validateProviderInput(input, { requireKey: true }).map((v) => v.code);

describe('validateProviderInput', () => {
  it('accepts a complete cloud provider', () => {
    expect(codes(valid)).toEqual([]);
  });

  it('requires a label, a model and a usable key', () => {
    expect(codes({ ...valid, label: '   ' })).toEqual(['LABEL_REQUIRED']);
    expect(codes({ ...valid, model: '' })).toEqual(['MODEL_REQUIRED']);
    expect(codes({ ...valid, apiKey: 'short' })).toEqual(['API_KEY_INVALID']);
    expect(codes({ ...valid, apiKey: 'has space inside key' })).toEqual([
      'API_KEY_INVALID',
    ]);
  });

  it('does not require a key when editing and no new key is supplied', () => {
    expect(
      validateProviderInput(
        { ...valid, apiKey: null },
        { requireKey: false },
      ).map((v) => v.code),
    ).toEqual([]);
  });

  it('cloud kinds have a fixed host and so refuse a base URL', () => {
    for (const kind of CLOUD_KINDS) {
      expect(codes({ ...valid, kind, baseUrl: 'https://example.com' })).toEqual(
        ['BASE_URL_NOT_ALLOWED'],
      );
    }
  });

  it('a self-hosted provider needs a base URL', () => {
    expect(codes({ ...valid, kind: 'SELF_HOSTED', baseUrl: null })).toEqual([
      'BASE_URL_REQUIRED',
    ]);
    expect(
      codes({ ...valid, kind: 'SELF_HOSTED', baseUrl: 'http://10.0.0.5:8000' }),
    ).toEqual([]);
  });

  it('rejects a base URL that is not plain http(s), or carries credentials, a query or a fragment', () => {
    const bad = [
      'ftp://host',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'not a url',
      'http://user:pass@host',
      'http://host/path?x=1',
      'http://host/#frag',
    ];
    for (const baseUrl of bad) {
      expect(codes({ ...valid, kind: 'SELF_HOSTED', baseUrl })).toEqual([
        'BASE_URL_INVALID',
      ]);
    }
  });
});

describe('normalizeBaseUrl', () => {
  it('trims and drops a trailing slash', () => {
    expect(normalizeBaseUrl(' http://10.0.0.5:8000/v1/ ')).toBe(
      'http://10.0.0.5:8000/v1',
    );
  });
  it('returns null for something that is not a usable URL', () => {
    expect(normalizeBaseUrl('http://u:p@host')).toBeNull();
    expect(normalizeBaseUrl('nope')).toBeNull();
  });
});

describe('providerFingerprint', () => {
  const base = {
    kind: 'ANTHROPIC' as const,
    model: 'm',
    baseUrl: null,
    apiKey: 'sk-ant-1234567890',
  };
  it('is stable for the same values', () => {
    expect(providerFingerprint(base)).toBe(providerFingerprint({ ...base }));
    expect(providerFingerprint(base)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('changes when the key, model, kind or URL changes', () => {
    const f = providerFingerprint(base);
    expect(
      providerFingerprint({ ...base, apiKey: 'sk-ant-other-key' }),
    ).not.toBe(f);
    expect(providerFingerprint({ ...base, model: 'm2' })).not.toBe(f);
    expect(providerFingerprint({ ...base, kind: 'GEMINI' })).not.toBe(f);
    expect(
      providerFingerprint({ ...base, baseUrl: 'http://10.0.0.5' }),
    ).not.toBe(f);
  });
  it('does not contain the key', () => {
    expect(providerFingerprint(base)).not.toContain('sk-ant');
  });
});

describe('roleBlocker', () => {
  const ok = {
    kind: 'ANTHROPIC' as const,
    testedFingerprint: 'fp',
    currentFingerprint: 'fp',
    transferAssessmentActive: true,
    archived: false,
  };
  it('lets a tested provider hold a role', () => {
    expect(roleBlocker(ok)).toBeNull();
  });
  it('blocks an archived provider', () => {
    expect(roleBlocker({ ...ok, archived: true })).toBe('ARCHIVED');
  });
  it('blocks a provider that was never tested, or whose key, model or URL changed since the test', () => {
    expect(roleBlocker({ ...ok, testedFingerprint: null })).toBe('NOT_TESTED');
    expect(roleBlocker({ ...ok, currentFingerprint: 'changed' })).toBe(
      'NOT_TESTED',
    );
  });
  it('blocks a cloud provider while no transfer assessment is in force', () => {
    for (const kind of CLOUD_KINDS) {
      expect(
        roleBlocker({ ...ok, kind, transferAssessmentActive: false }),
      ).toBe('TRANSFER_ASSESSMENT_REQUIRED');
    }
  });
  it('a self-hosted provider needs no transfer assessment', () => {
    expect(
      roleBlocker({
        ...ok,
        kind: 'SELF_HOSTED',
        transferAssessmentActive: false,
      }),
    ).toBeNull();
  });
});

describe('kinds', () => {
  it('only SELF_HOSTED is not a cloud kind', () => {
    expect(PROVIDER_KINDS.filter((k) => !isCloudKind(k))).toEqual([
      'SELF_HOSTED',
    ]);
  });
  it('the TypeScript kinds equal the Prisma enum, so they cannot drift', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma'),
      'utf8',
    );
    const body = /enum LlmProviderKind \{([^}]*)\}/.exec(schema)?.[1] ?? '';
    const prismaKinds = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    expect([...PROVIDER_KINDS].sort()).toEqual(prismaKinds.sort());
  });
});

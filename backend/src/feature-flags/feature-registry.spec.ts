import * as fs from 'fs';
import * as path from 'path';
import { FEATURE_REGISTRY, getManifest, getManifestsByDomain } from './feature-registry';

describe('FEATURE_REGISTRY', () => {
  it('has unique keys', () => {
    const keys = FEATURE_REGISTRY.map((m) => m.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('every manifest has a non-empty label and domain', () => {
    for (const m of FEATURE_REGISTRY) {
      expect(m.key.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.domain.length).toBeGreaterThan(0);
    }
  });

  it('domains are from the allowed set', () => {
    const allowed = new Set([
      'core',
      'org-domain',
      'case-domain',
      'petition-domain',
      'workflow-domain',
      'reporting-domain',
    ]);
    for (const m of FEATURE_REGISTRY) {
      expect(allowed.has(m.domain)).toBe(true);
    }
  });

  it('every feature.manifest.ts file on disk is wired into the registry', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const manifestFiles: string[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          walk(full);
        } else if (entry.isFile() && entry.name === 'feature.manifest.ts') {
          manifestFiles.push(full);
        }
      }
    };
    walk(srcRoot);

    // Drop root file paths for reporting, count only
    const fileCount = manifestFiles.length;
    const registryCount = FEATURE_REGISTRY.length;

    if (fileCount !== registryCount) {
      throw new Error(
        `Filesystem has ${fileCount} feature.manifest.ts files but registry has ` +
          `${registryCount} entries. Wire every manifest into feature-registry.ts.\n` +
          `Files found:\n${manifestFiles.join('\n')}`,
      );
    }
    expect(fileCount).toBe(registryCount);
  });

  describe('getManifest', () => {
    it('returns the manifest by key', () => {
      const m = getManifest('cases');
      expect(m).toBeDefined();
      expect(m?.label).toBe('Quản lý vụ án');
    });

    it('returns undefined for unknown keys', () => {
      expect(getManifest('does-not-exist')).toBeUndefined();
    });
  });

  describe('getManifestsByDomain', () => {
    it('returns all manifests of a given domain', () => {
      const caseDomain = getManifestsByDomain('case-domain');
      const keys = caseDomain.map((m) => m.key).sort();
      expect(keys).toContain('cases');
      expect(keys).toContain('subjects');
    });

    it('returns empty array for unknown domains', () => {
      expect(getManifestsByDomain('nope')).toEqual([]);
    });
  });
});

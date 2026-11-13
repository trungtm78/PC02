import * as fs from 'fs';
import * as path from 'path';
import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
  RequireAnyPermissions,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { SEED_PERMISSIONS } from '../../prisma/seed-permissions';
import {
  allowedDepths,
  BASIC_CAPABILITIES,
  depthRank,
  isSensitivePermission,
  pairsOf,
  PERMISSION_DEPTHS,
  PERMISSION_RESOURCES,
  RESOURCE_GROUPS,
  resourceByKey,
  resourceOfPermission,
  scopeSubjectOf,
  type PermissionResource,
} from '../../prisma/permission-resources';

// otplib ships ESM only and jest cannot load it; this gate reads decorator metadata and calls none of it.
jest.mock('otplib', () => ({}));

/**
 * GATE: the catalogue a person sets team permissions from is the same set the guards check.
 *
 * A pair the guards check but the catalogue lacks could never be granted to a team: the screen behind it would
 * vanish for every non-admin the day permissions by team are enforced, and no test would be red. A pair in the
 * catalogue that is not seeded would be a tick box that does nothing.
 */
type Rule = { action: string; subject: string };
type ControllerClass = { name: string; prototype: object };
const SRC = path.resolve(__dirname, '..');

function controllerFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return controllerFiles(p);
    return e.name.endsWith('.controller.ts') ? [p] : [];
  });
}

/** Every pair a controller class asks for, on the class and on each route, in "all of" and "any of" form. */
function pairsAskedBy(cls: ControllerClass): string[] {
  const read = (target: object): Rule[] => [
    ...((Reflect.getMetadata(PERMISSIONS_KEY, target) ?? []) as Rule[]),
    ...((Reflect.getMetadata(ANY_PERMISSIONS_KEY, target) ?? []) as Rule[]),
  ];
  const rules = read(cls);
  for (let p: object | null = cls.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p) as object | null) {
    for (const name of Object.getOwnPropertyNames(p)) {
      const d = Object.getOwnPropertyDescriptor(p, name);
      if (name === 'constructor' || !d || typeof d.value !== 'function') continue;
      if (Reflect.getMetadata(METHOD_METADATA, d.value as object) === undefined) continue;
      rules.push(...read(d.value as object));
    }
  }
  return rules.map((r) => `${r.action}:${r.subject}`);
}

function everyRoutePair(): { pairs: Set<string>; classes: number } {
  const pairs = new Set<string>();
  let classes = 0;
  for (const file of controllerFiles(SRC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function' || Reflect.getMetadata(PATH_METADATA, value) === undefined) continue;
      classes += 1;
      for (const pair of pairsAskedBy(value as ControllerClass)) pairs.add(pair);
    }
  }
  return { pairs, classes };
}

const seeded = SEED_PERMISSIONS.map((p) => `${p.action}:${p.subject}`);
const catalogued = PERMISSION_RESOURCES.flatMap((r) => pairsOf(r).map((pair) => ({ pair, resource: r.key })));

describe('GATE: the permission catalogue is what the guards check', () => {
  it('every seeded permission belongs to exactly one resource', () => {
    const owners = new Map<string, string[]>();
    for (const { pair, resource } of catalogued) owners.set(pair, [...(owners.get(pair) ?? []), resource]);
    expect(seeded.filter((p) => !owners.has(p))).toEqual([]);
    expect([...owners].filter(([, o]) => o.length > 1)).toEqual([]);
  });

  it('the catalogue offers nothing that is not seeded', () => {
    const known = new Set(seeded);
    expect(catalogued.filter((c) => !known.has(c.pair))).toEqual([]);
  });

  it('every pair a route asks for (all-of and any-of, class and method, any order) is in the catalogue', () => {
    const { pairs, classes } = everyRoutePair();
    // A scan that found nothing would be green for the wrong reason.
    expect(classes).toBeGreaterThan(60);
    expect(pairs.size).toBeGreaterThan(55);
    expect(pairs.has('manage_access:CaseGovernance')).toBe(true); // subject-first, second pair of a multi-line usage
    expect([...pairs].filter((p) => !resourceOfPermission(p))).toEqual([]);
  });

  it('negative control: the scan reads second pairs, any-of pairs and class-level pairs', () => {
    @Controller('sample')
    @RequirePermissions({ action: 'read', subject: 'ClassLevel' })
    class Sample {
      @Get('a')
      @RequirePermissions({ action: 'read', subject: 'Case' }, { subject: 'Nowhere', action: 'second' })
      a() {}

      @Get('b')
      @RequireAnyPermissions({ action: 'any', subject: 'Nowhere' })
      b() {}

      notARoute() {}
    }
    const asked = pairsAskedBy(Sample);
    expect(asked.sort()).toEqual(['any:Nowhere', 'read:Case', 'read:ClassLevel', 'second:Nowhere']);
    expect(asked.filter((p) => !resourceOfPermission(p)).sort()).toEqual(['any:Nowhere', 'read:ClassLevel', 'second:Nowhere']);
  });

  it('every menu permission of the frontend is in the catalogue', () => {
    const features = path.resolve(SRC, '../../frontend/src/features');
    const quyen = new Set<string>();
    for (const feature of fs.readdirSync(features)) {
      const menu = path.join(features, feature, 'menu.ts');
      if (!fs.existsSync(menu)) continue;
      for (const list of fs.readFileSync(menu, 'utf8').matchAll(/quyen:\s*\[([^\]]*)\]/g)) {
        for (const item of list[1].matchAll(/'([^']+)'/g)) quyen.add(item[1]);
      }
    }
    expect(quyen.size).toBeGreaterThan(15);
    expect(quyen.has('read:Petition')).toBe(true);
    expect([...quyen].filter((q) => !resourceOfPermission(q))).toEqual([]);
  });
});

describe('the catalogue is well formed', () => {
  it('keys are unique, groups are known, and every basic capability is one of the four', () => {
    const keys = PERMISSION_RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of PERMISSION_RESOURCES) {
      expect(RESOURCE_GROUPS).toContain(r.group);
      for (const capability of Object.keys(r.basic)) expect(BASIC_CAPABILITIES).toContain(capability);
      expect(pairsOf(r).length).toBeGreaterThan(0);
    }
  });

  it('a pair is not both a basic capability and an extra of its resource, and sensitive pairs are its own', () => {
    for (const r of PERMISSION_RESOURCES) {
      const basic = new Set(Object.values(r.basic));
      expect(Object.values(r.extras ?? {}).filter((p) => basic.has(p))).toEqual([]);
      expect((r.sensitive ?? []).filter((p) => !pairsOf(r).includes(p))).toEqual([]);
    }
  });

  it('a child resource points at a resource that exists and ends at one with records of its own', () => {
    for (const r of PERMISSION_RESOURCES) {
      if (r.recordScope?.kind !== 'parent') continue;
      expect(resourceByKey(r.recordScope.resource)).toBeDefined();
      expect(scopeSubjectOf(r)).toBeDefined();
    }
    expect(scopeSubjectOf(resourceByKey('documents') as PermissionResource)).toBe('Case');
    expect(scopeSubjectOf(resourceByKey('petitions') as PermissionResource)).toBe('Petition');
    expect(scopeSubjectOf(resourceByKey('users') as PermissionResource)).toBeUndefined();
  });

  it('a parent chain that loops ends instead of hanging', () => {
    const loop: PermissionResource = { key: 'documents', group: 'business', basic: {}, recordScope: { kind: 'parent', resource: 'documents' } };
    expect(scopeSubjectOf(loop)).toBeUndefined();
    const orphan: PermissionResource = { key: 'x', group: 'business', basic: {}, recordScope: { kind: 'parent', resource: 'nowhere' } };
    expect(scopeSubjectOf(orphan)).toBeUndefined();
  });

  it('record resources can be granted at every depth; the others are all or nothing', () => {
    expect(allowedDepths('read:Petition')).toEqual(PERMISSION_DEPTHS);
    expect(allowedDepths('edit:Document')).toEqual(PERMISSION_DEPTHS);
    expect(allowedDepths('write:User')).toEqual(['NONE', 'ALL']);
    expect(allowedDepths('made:Up')).toEqual(['NONE', 'ALL']);
  });

  it('depths are ordered from none to all', () => {
    expect(PERMISSION_DEPTHS.map(depthRank)).toEqual([0, 1, 2, 3, 4]);
  });

  it('knows which grants need a reason', () => {
    expect(isSensitivePermission('export_full:Petition')).toBe(true);
    expect(isSensitivePermission('write:Role')).toBe(true);
    expect(isSensitivePermission('read:Petition')).toBe(false);
    expect(isSensitivePermission('made:Up')).toBe(false);
  });
});

import { NotFoundException } from '@nestjs/common';
import { PERMISSION_RESOURCES, pairsOf, scopeSubjectOf } from '../../../prisma/permission-resources';
import { AuthzAdminService } from './authz-admin.service';
import { entryProblems } from '../engine/validate';
import type { Reach } from '../engine/types';
import { STARTER_TEMPLATES, starterTemplates } from './starter-templates';

/** Every pair of the real catalogue: the widest thing an officer role could hold. */
const EVERYTHING: string[] = PERMISSION_RESOURCES.flatMap(pairsOf);
const aboutRecords = new Set<string>(PERMISSION_RESOURCES.filter((r) => scopeSubjectOf(r)).flatMap(pairsOf));
const views = new Set(PERMISSION_RESOURCES.flatMap((r) => (r.basic.view ? [r.basic.view as string] : [])));
const problemsOf = (entries: Record<string, Reach>) => entryProblems(new Map(Object.entries(entries)));

describe('starter templates', () => {
  it('there are three, with distinct codes and names', () => {
    expect(STARTER_TEMPLATES.map((t) => t.code)).toEqual(['STARTER_AS_TODAY', 'STARTER_OWN_ONLY', 'STARTER_VIEW_ONLY']);
    expect(new Set(STARTER_TEMPLATES.map((t) => t.name)).size).toBe(3);
  });

  it('the catalogue has both kinds of permission, or the assertions below would prove nothing', () => {
    expect(aboutRecords.size).toBeGreaterThan(5);
    expect(EVERYTHING.length - aboutRecords.size).toBeGreaterThan(5);
    expect(views.size).toBeGreaterThan(5);
  });

  describe.each([
    ['a role that holds everything in the catalogue', EVERYTHING],
    ['a role that holds a few things', ['read:Petition', 'edit:Petition', 'read:Case', 'read:Directory']],
  ])('from %s', (_name, held) => {
    const made = starterTemplates(held);

    it('every template is valid as it stands (it can be saved without a correction)', () => {
      for (const doc of Object.values(made)) expect(problemsOf(doc.entries)).toEqual([]);
    });

    it('"as today": exactly what the role holds; records reach the team tree, the rest is simply held', () => {
      const entries = made.STARTER_AS_TODAY.entries;
      expect(Object.keys(entries).sort()).toEqual([...new Set(held)].sort());
      for (const [permission, reach] of Object.entries(entries)) {
        expect(reach).toBe(aboutRecords.has(permission) ? 'TEAM_TREE' : 'ALL');
      }
    });

    it('"own only": the same permissions, records limited to the person\'s own', () => {
      const entries = made.STARTER_OWN_ONLY.entries;
      expect(Object.keys(entries).sort()).toEqual(Object.keys(made.STARTER_AS_TODAY.entries).sort());
      for (const [permission, reach] of Object.entries(entries)) {
        expect(reach).toBe(aboutRecords.has(permission) ? 'OWN' : 'ALL');
      }
    });

    it('"view only": the view permission of each resource the role may open, and nothing that changes anything', () => {
      const keys = Object.keys(made.STARTER_VIEW_ONLY.entries);
      expect(keys.sort()).toEqual([...new Set(held)].filter((p) => views.has(p)).sort());
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  it('a permission the catalogue does not know is left out (it could be neither shown nor validated)', () => {
    const made = starterTemplates(['read:Petition', 'frobnicate:Nothing']);
    expect(Object.keys(made.STARTER_AS_TODAY.entries)).toEqual(['read:Petition']);
  });

  it('a role that holds nothing gives empty templates, not an error', () => {
    for (const doc of Object.values(starterTemplates([]))) expect(doc.entries).toEqual({});
  });
});

describe('AuthzAdminService.createStarterTemplates', () => {
  /** The service with a database that has the officer role and the given templates, and `commit` observed. */
  function build(options: { role?: { action: string; subject: string }[] | null; existingCodes?: string[] } = {}) {
    const role = options.role === null ? null : { permissions: (options.role ?? [{ action: 'read', subject: 'Petition' }, { action: 'edit', subject: 'Petition' }]).map((permission) => ({ permission })) };
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(role) },
      permissionTemplate: { findMany: jest.fn().mockResolvedValue((options.existingCodes ?? []).map((code) => ({ code }))) },
    };
    const service = new AuthzAdminService(prisma as never, {} as never, {} as never);
    const commit = jest.spyOn(service, 'commit').mockResolvedValue({ changed: true, changeSetId: 'set-1', items: [] });
    return { service, prisma, commit };
  }

  it('creates the three in ONE change, from the officer role of the database, judged like any save', async () => {
    const { service, prisma, commit } = build();
    const result = await service.createStarterTemplates('admin-1', { ipAddress: '10.0.0.1' });
    expect(prisma.role.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'OFFICER' } }));
    expect(commit).toHaveBeenCalledTimes(1);
    const [actorId, kind, wanted, options] = commit.mock.calls[0];
    expect(actorId).toBe('admin-1');
    expect(kind).toBe('STARTER_TEMPLATES_CREATED');
    expect(options).toMatchObject({ reason: expect.any(String), meta: { ipAddress: '10.0.0.1' } });
    expect(wanted.map((w) => (w.after as { code: string }).code)).toEqual(['STARTER_AS_TODAY', 'STARTER_OWN_ONLY', 'STARTER_VIEW_ONLY']);
    expect((wanted[1].after as { entries: Record<string, string> }).entries).toEqual({ 'edit:Petition': 'OWN', 'read:Petition': 'OWN' });
    expect((wanted[2].after as { entries: Record<string, string> }).entries).toEqual({ 'read:Petition': 'TEAM_TREE' });
    expect(result.created.map((c) => c.code)).toEqual(['STARTER_AS_TODAY', 'STARTER_OWN_ONLY', 'STARTER_VIEW_ONLY']);
    expect(new Set(result.created.map((c) => c.id)).size).toBe(3);
    expect(result.existing).toEqual([]);
  });

  it('one that exists already (also renamed or archived: the code is what counts) is left alone', async () => {
    const { service, commit } = build({ existingCodes: ['STARTER_OWN_ONLY'] });
    const result = await service.createStarterTemplates('admin-1');
    expect(commit.mock.calls[0][2].map((w) => (w.after as { code: string }).code)).toEqual(['STARTER_AS_TODAY', 'STARTER_VIEW_ONLY']);
    expect(result.existing).toEqual(['STARTER_OWN_ONLY']);
  });

  it('all three exist: nothing is written and it says so', async () => {
    const { service, commit } = build({ existingCodes: ['STARTER_AS_TODAY', 'STARTER_OWN_ONLY', 'STARTER_VIEW_ONLY'] });
    await expect(service.createStarterTemplates('admin-1')).resolves.toMatchObject({ changed: false, created: [], changeSetId: null });
    expect(commit).not.toHaveBeenCalled();
  });

  it('a database without the officer role is told apart from "nothing to do"', async () => {
    const { service, commit } = build({ role: null });
    await expect(service.createStarterTemplates('admin-1')).rejects.toThrow(NotFoundException);
    expect(commit).not.toHaveBeenCalled();
  });
});

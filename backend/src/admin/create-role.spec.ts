import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ROLE_NAMES } from '../common/constants/role.constants';

/**
 * D4. The permission screen let an administrator edit roles but never create
 * one — a new role meant going into the database by hand. So the screen
 * described a system that was only half true.
 *
 * The guards here matter more than the insert. Role names are wire format:
 * `ROLE_NAMES` is compared as a string in guards, in the permission seed and in
 * several business branches, so a hand-made role that takes a built-in name
 * impersonates it, and one named `Điều tra viên` is recognised by nothing.
 */
function makeService(over: Record<string, any> = {}) {
  const tx = {
    role: {
      create: jest.fn(() =>
        Promise.resolve({
          id: 'r-new',
          name: 'TRUONG_PHONG',
          description: null,
        }),
      ),
    },
    rolePermission: {
      createMany: jest.fn(() => Promise.resolve({ count: 2 })),
    },
  };
  const prisma: any = {
    role: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findUnique: jest.fn(() => Promise.resolve(null)),
    },
    $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    ...over,
  };
  const audit = { log: jest.fn(() => Promise.resolve(undefined)) };
  const svc = Object.create(AdminService.prototype) as AdminService;
  (svc as any).prisma = prisma;
  (svc as any).audit = audit;
  return { svc, prisma, audit, tx };
}

const DTO = { name: 'TRUONG_PHONG', description: 'Trưởng phòng nghiệp vụ' };

describe('createRole', () => {
  it('creates the role and audits it', async () => {
    const { svc, tx, audit } = makeService();

    const res = await svc.createRole(DTO, 'admin-1');

    expect(tx.role.create).toHaveBeenCalledWith({
      data: { name: 'TRUONG_PHONG', description: 'Trưởng phòng nghiệp vụ' },
    });
    expect(res.permissionCount).toBe(0);
    expect((audit.log as jest.Mock).mock.calls[0][0]).toMatchObject({
      action: 'ROLE_CREATED',
      subject: 'Role',
      subjectId: 'r-new',
    });
  });

  it('refuses a built-in role name', async () => {
    // A custom role wearing a built-in name is recognised by every guard that
    // compares names — which is to say it impersonates the real one.
    const { svc } = makeService();

    await expect(
      svc.createRole({ name: ROLE_NAMES.ADMIN }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a duplicate name', async () => {
    const { svc } = makeService({
      role: {
        findFirst: jest.fn(() => Promise.resolve({ id: 'r-old' })),
        findUnique: jest.fn(),
      },
    });

    await expect(svc.createRole(DTO, 'admin-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('copies permissions from the source role', async () => {
    const { svc, tx } = makeService({
      role: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 'r-src',
            permissions: [{ permissionId: 'p-1' }, { permissionId: 'p-2' }],
          }),
        ),
      },
    });

    const res = await svc.createRole(
      { ...DTO, copyPermissionsFromRoleId: 'r-src' },
      'admin-1',
    );

    expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 'r-new', permissionId: 'p-1' },
        { roleId: 'r-new', permissionId: 'p-2' },
      ],
    });
    expect(res.permissionCount).toBe(2);
  });

  it('refuses a source role that does not exist', async () => {
    const { svc } = makeService({
      role: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        findUnique: jest.fn(() => Promise.resolve(null)),
      },
    });

    await expect(
      svc.createRole({ ...DTO, copyPermissionsFromRoleId: 'nope' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes the role and its permissions in one transaction', async () => {
    // A role created without the permissions it was meant to copy is a role
    // whose holder signs in to an empty system — correct fail-closed behaviour
    // for a problem nobody reported.
    const { svc, prisma } = makeService({
      role: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 'r-src',
            permissions: [{ permissionId: 'p-1' }],
          }),
        ),
      },
    });

    await svc.createRole(
      { ...DTO, copyPermissionsFromRoleId: 'r-src' },
      'admin-1',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

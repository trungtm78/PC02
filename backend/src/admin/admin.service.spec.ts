/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserStatus } from './dto/create-user.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  permission: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  rolePermission: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  // ── getUsers ──────────────────────────────────────────────────────────────

  describe('getUsers', () => {
    it('returns paginated users', async () => {
      const fakeUsers = [{ id: 'u1', username: 'admin' }];
      mockPrisma.user.findMany.mockResolvedValue(fakeUsers);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({});

      expect(result.data).toEqual(fakeUsers);
      expect(result.total).toBe(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    });

    it('filters by status active', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getUsers({ status: UserStatus.ACTIVE });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('filters by status inactive', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getUsers({ status: UserStatus.INACTIVE });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });
  });

  // ── getUserById ───────────────────────────────────────────────────────────

  describe('getUserById', () => {
    it('returns user when found', async () => {
      const fakeUser = {
        id: 'u1',
        username: 'admin',
        role: { id: 'r1', name: 'Admin' },
      };
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);

      const result = await service.getUserById('u1');
      expect(result).toEqual(fakeUser);
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── createUser ────────────────────────────────────────────────────────────

  describe('createUser', () => {
    const createDto = {
      username: 'newuser',
      email: 'new@pc02.local',
      password: 'Pass@1234',
      firstName: 'Văn',
      lastName: 'A',
      roleId: 'role-1',
    };

    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'Admin',
      });
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-id',
        username: 'newuser',
        email: 'new@pc02.local',
      });
    });

    it('creates user successfully', async () => {
      const result = await service.createUser(createDto, 'requester-1');
      expect(result.username).toBe('newuser');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_CREATED' }),
      );
    });

    it('EC-02: throws ConflictException for duplicate username', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'old',
        username: 'newuser',
      });

      await expect(
        service.createUser(createDto, 'requester-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('EC-02: throws ConflictException for duplicate email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'old',
        username: 'other',
        email: 'new@pc02.local',
      });

      await expect(
        service.createUser(createDto, 'requester-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if role does not exist', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.createUser(createDto, 'requester-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('deletes user and logs audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        username: 'other',
      });
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await service.deleteUser('u2', 'requester-1');
      expect(result.message).toContain('xóa');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_DELETED' }),
      );
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser('nonexistent', 'req')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when deleting own account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'self',
        username: 'admin',
      });

      await expect(service.deleteUser('self', 'self')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── getUsers with search ────────────────────────────────────────────────

  describe('getUsers (search)', () => {
    it('applies search filter across multiple fields', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getUsers({ search: 'admin' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('applies roleId and departmentId filters', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getUsers({ roleId: 'role-1', departmentId: 'dept-1' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roleId: 'role-1',
            departmentId: 'dept-1',
          }),
        }),
      );
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    const existingUser = {
      id: 'u1',
      username: 'existing',
      email: 'old@pc02.local',
    };

    it('updates user fields successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        username: 'existing',
        email: 'new@pc02.local',
        role: { id: 'r1', name: 'Admin' },
      });

      const result = await service.updateUser(
        'u1',
        { email: 'new@pc02.local', firstName: 'Updated' },
        'requester-1',
      );
      expect(result.email).toBe('new@pc02.local');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_UPDATED' }),
      );
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUser('bad-id', { firstName: 'X' }, 'req'),
      ).rejects.toThrow(NotFoundException);
    });

    it('EC-02: throws ConflictException for duplicate email on update', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'other',
        email: 'dup@pc02.local',
      });

      await expect(
        service.updateUser('u1', { email: 'dup@pc02.local' }, 'req'),
      ).rejects.toThrow(ConflictException);
    });

    it('EC-02: throws ConflictException for duplicate username on update', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      // Only username check fires (no email in dto), so first findFirst is the username dup check
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'other',
        username: 'taken',
      });

      await expect(
        service.updateUser('u1', { username: 'taken' }, 'req'),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password and clears refreshTokenHash when password changes', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        username: 'existing',
        role: { id: 'r1', name: 'Admin' },
      });

      await service.updateUser(
        'u1',
        { password: 'NewPass@123' },
        'requester-1',
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.any(String),
            refreshTokenHash: null,
          }),
        }),
      );
    });

    it('updates isActive when status changes', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        isActive: false,
        role: { id: 'r1', name: 'Admin' },
      });

      await service.updateUser('u1', { status: UserStatus.INACTIVE }, 'req');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  // ── getRoles ──────────────────────────────────────────────────────────────

  describe('getRoles', () => {
    it('returns all roles with counts and permissions', async () => {
      const fakeRoles = [
        { id: 'r1', name: 'Admin', _count: { users: 1 }, permissions: [] },
      ];
      mockPrisma.role.findMany.mockResolvedValue(fakeRoles);

      const result = await service.getRoles();
      expect(result).toEqual(fakeRoles);
      expect(mockPrisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ _count: expect.any(Object) }),
        }),
      );
    });
  });

  // ── getRoleById ───────────────────────────────────────────────────────────

  describe('getRoleById', () => {
    it('returns role when found', async () => {
      const fakeRole = {
        id: 'r1',
        name: 'Admin',
        _count: { users: 1 },
        permissions: [],
      };
      mockPrisma.role.findUnique.mockResolvedValue(fakeRole);

      const result = await service.getRoleById('r1');
      expect(result).toEqual(fakeRole);
    });

    it('throws NotFoundException when role not found', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      await expect(service.getRoleById('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateRole ────────────────────────────────────────────────────────────

  describe('updateRole', () => {
    it('updates role name and description', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'Old' });
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.update.mockResolvedValue({ id: 'r1', name: 'New' });

      const result = await service.updateRole(
        'r1',
        { name: 'New', description: 'Updated' },
        'req',
      );
      expect(result.name).toBe('New');
    });

    it('throws NotFoundException when role not found', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      await expect(
        service.updateRole('bad', { name: 'X' }, 'req'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException for duplicate name', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'Old' });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'r2', name: 'Taken' });

      await expect(
        service.updateRole('r1', { name: 'Taken' }, 'req'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── updateRolePermissions ─────────────────────────────────────────────────

  describe('updateRolePermissions', () => {
    it('replaces role permissions atomically', async () => {
      mockPrisma.role.findUnique
        .mockResolvedValueOnce({ id: 'r1', name: 'Admin' }) // first check
        .mockResolvedValueOnce({
          id: 'r1',
          name: 'Admin',
          _count: { users: 1 },
          permissions: [],
        }); // getRoleById after
      mockPrisma.permission.upsert.mockResolvedValue({ id: 'p1' });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateRolePermissions(
        'r1',
        { permissions: [{ action: 'read', subject: 'Case' }] },
        'requester-1',
      );
      expect(mockPrisma.permission.upsert).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROLE_PERMISSIONS_UPDATED' }),
      );
    });

    it('throws NotFoundException when role not found', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRolePermissions('bad', { permissions: [] }, 'req'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getAllPermissions ──────────────────────────────────────────────────────

  describe('getAllPermissions', () => {
    it('returns all permissions sorted', async () => {
      const perms = [{ id: 'p1', action: 'read', subject: 'Case' }];
      mockPrisma.permission.findMany.mockResolvedValue(perms);

      const result = await service.getAllPermissions();
      expect(result).toEqual(perms);
    });
  });

  // ── deleteRole ────────────────────────────────────────────────────────────

  describe('deleteRole', () => {
    it('EC-01: throws BadRequestException when role has users', async () => {
      mockPrisma.user.count.mockResolvedValue(3);

      await expect(
        service.deleteRole('role-with-users', 'req'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes role when no users assigned', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.role.delete.mockResolvedValue({});

      const result = await service.deleteRole('empty-role', 'req');
      expect(result.message).toContain('xóa role');
    });
  });
});

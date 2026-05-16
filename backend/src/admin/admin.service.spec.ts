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
import { TeamsService } from '../teams/teams.service';
import { EnrollmentService } from '../auth/services/enrollment.service';
import { UserStatus } from './dto/create-user.dto';
import { STRONG_PASSWORD_REGEX } from '../auth/constants/password.constants';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

const mockTeamsService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getDescendantIds: jest.fn().mockResolvedValue([]),
  getUserIdsForTeams: jest.fn().mockResolvedValue([]),
};

const mockEnrollmentService = {
  generateEnrollmentLink: jest.fn().mockResolvedValue({
    url: 'http://prod.test/auth/enroll?token=fake-token&uid=new-id',
    qrPayload: 'http://prod.test/auth/enroll?token=fake-token&uid=new-id',
    expiresAt: new Date('2026-05-19T12:00:00.000Z'),
  }),
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
        { provide: TeamsService, useValue: mockTeamsService },
        { provide: EnrollmentService, useValue: mockEnrollmentService },
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
    // Magic link enrollment (post-/autoplan): admin tạo user → backend gen
    // 1-time enrollment link, admin gửi user qua channel bất kỳ → user click
    // → tự đặt password (NIST SP 800-63B compliant, no shared secret).
    const createDto = {
      username: 'newuser',
      email: 'new@pc02.local',
      firstName: 'Văn',
      lastName: 'A',
      roleId: 'role-1',
    };

    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'Admin',
      });
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-id',
        username: 'newuser',
        email: 'new@pc02.local',
      });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockEnrollmentService.generateEnrollmentLink.mockClear();
      mockEnrollmentService.generateEnrollmentLink.mockResolvedValue({
        url: 'http://prod.test/auth/enroll?token=fake-token&uid=new-id',
        qrPayload: 'http://prod.test/auth/enroll?token=fake-token&uid=new-id',
        expiresAt: new Date('2026-05-19T12:00:00.000Z'),
      });
    });

    it('creates user successfully', async () => {
      const result = await service.createUser(createDto, 'requester-1');
      expect(result.username).toBe('newuser');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_CREATED' }),
        expect.anything(),
      );
    });

    // Magic link: response carries 1-time enrollment URL (NO password).
    it('returns enrollment object (url + qrPayload + expiresAt), KHÔNG có tempPassword', async () => {
      const result: any = await service.createUser(createDto, 'requester-1');
      expect(result.enrollment).toEqual(
        expect.objectContaining({
          url: expect.stringContaining('/auth/enroll?token='),
          qrPayload: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
      expect(result.tempPassword).toBeUndefined();
    });

    it('calls EnrollmentService.generateEnrollmentLink với userId + actorId', async () => {
      await service.createUser(createDto, 'requester-1');
      expect(mockEnrollmentService.generateEnrollmentLink).toHaveBeenCalledWith(
        'new-id',
        'requester-1',
        undefined,
      );
    });

    // Magic link: user record có passwordHash placeholder (unusable bcrypt hash)
    // + mustChangePassword=true. User KHÔNG thể login bằng password — chỉ qua
    // enrollment link. consumeEnrollmentToken sẽ set password thật.
    it('sets mustChangePassword=true và placeholder bcrypt hash unusable', async () => {
      await service.createUser(createDto, 'requester-1');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mustChangePassword: true,
            passwordHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/),
          }),
        }),
      );
    });

    it('audit metadata records enrollment link generated (no tempPassword)', async () => {
      await service.createUser(createDto, 'requester-1');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_CREATED',
          metadata: expect.objectContaining({
            enrollmentLinkGenerated: true,
          }),
        }),
        expect.anything(),
      );
    });

    it('runs user insert + audit inside a single $transaction', async () => {
      await service.createUser(createDto, 'requester-1');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('EC-02: throws ConflictException for duplicate username', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 'old',
        username: 'newuser',
      });

      await expect(
        service.createUser(createDto, 'requester-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('EC-02: throws ConflictException for duplicate email', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
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

    // Magic link: email là optional cho cán bộ không có email công vụ.
    // Service phải accept user chỉ có workId hoặc phone.
    it('accepts dto KHÔNG có email (chỉ có workId + phone)', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-id',
        username: 'tungh',
      });
      const dtoNoEmail = {
        username: 'tungh',
        workId: '277-794',
        phone: '0909225525',
        firstName: 'Hoàng Công',
        lastName: 'Tùng',
        roleId: 'role-1',
      };
      const result: any = await service.createUser(dtoNoEmail, 'requester-1');
      expect(result.username).toBe('tungh');
      expect(result.enrollment).toBeDefined();
    });

    // Validation: phải có ÍT NHẤT 1 trong (workId / phone / email).
    it('rejects khi KHÔNG có workId/phone/email (BadRequestException)', async () => {
      const dtoEmpty = {
        username: 'nobody',
        firstName: 'No',
        lastName: 'Body',
        roleId: 'role-1',
      };
      await expect(
        service.createUser(dtoEmpty, 'requester-1'),
      ).rejects.toThrow(BadRequestException);
    });

    // workId @unique constraint: chặn duplicate workId trước khi insert.
    it('EC-02: throws ConflictException for duplicate workId', async () => {
      const dtoWithWorkId = { ...createDto, workId: '277-794' };
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(null) // username/email check
        .mockResolvedValueOnce({ id: 'old', workId: '277-794' }); // workId check
      await expect(
        service.createUser(dtoWithWorkId, 'requester-1'),
      ).rejects.toThrow(ConflictException);
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
      // First findUnique = pre-update fetch; second = post-update re-read
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValue({
          id: 'u1',
          username: 'existing',
          email: 'new@pc02.local',
          role: { id: 'r1', name: 'Admin' },
        });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        username: 'existing',
        email: 'new@pc02.local',
        role: { id: 'r1', name: 'Admin' },
      });
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      );

      const result = await service.updateUser(
        'u1',
        { email: 'new@pc02.local', firstName: 'Updated' },
        'requester-1',
      );
      expect(result.email).toBe('new@pc02.local');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_UPDATED' }),
        expect.anything(), // tx (audit is now transactional)
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

    // F1: admin no longer chooses the password. Reset is triggered by the
    // resetPassword flag — backend generates a new temp password.
    describe('with resetPassword=true', () => {
      beforeEach(() => {
        // The first findUnique fetches the user (gets tokenVersion).
        // The second findUnique runs inside the transaction after updateMany.
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({ ...existingUser, tokenVersion: 0 })
          .mockResolvedValue({
            id: 'u1',
            username: 'existing',
            role: { id: 'r1', name: 'Admin' },
          });
        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.$transaction.mockImplementation(async (fn: any) =>
          fn(mockPrisma),
        );
      });

      it('generates a new temp password and returns it in the response', async () => {
        const result = (await service.updateUser(
          'u1',
          { resetPassword: true } as any,
          'requester-1',
        )) as { tempPassword: string };
        expect(result.tempPassword).toBeDefined();
        expect(typeof result.tempPassword).toBe('string');
        expect(result.tempPassword).toMatch(STRONG_PASSWORD_REGEX);
      });

      // C3 fix: tokenVersion MUST be incremented so the user's existing
      // access token cannot be used after the reset (closes the 15-min
      // bypass window). Codex #6: now uses updateMany with optimistic lock.
      it('increments tokenVersion AND clears refreshTokenHash AND sets mustChangePassword + passwordChangedAt', async () => {
        await service.updateUser(
          'u1',
          { resetPassword: true } as any,
          'requester-1',
        );
        expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'u1', tokenVersion: 0 },
            data: expect.objectContaining({
              passwordHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/),
              refreshTokenHash: null,
              tokenVersion: { increment: 1 },
              mustChangePassword: true,
              passwordChangedAt: expect.any(Date),
            }),
          }),
        );
      });

      // Codex challenge #6: concurrent admin resets must NOT both succeed
      // with different temp passwords. Optimistic lock on tokenVersion: the
      // second admin's update matches 0 rows and throws ConflictException
      // instead of silently last-write-wins (which would leave Admin A
      // handing over a dead password).
      it('rejects concurrent admin reset with ConflictException (Codex #6)', async () => {
        // Override the beforeEach mock chain — only need the initial fetch.
        mockPrisma.user.findUnique.mockReset();
        mockPrisma.user.findUnique.mockResolvedValue({
          ...existingUser,
          tokenVersion: 3,
        });
        mockPrisma.user.findFirst.mockResolvedValue(null);
        // updateMany returning count=0 simulates Admin B's update running
        // after Admin A already bumped tokenVersion from 3 to 4.
        mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });

        await expect(
          service.updateUser('u1', { resetPassword: true } as any, 'admin-b'),
        ).rejects.toThrow(/yêu cầu khác|concurrent|reset lại|superseded/i);
      });

      // F3: explicit ADMIN_PASSWORD_RESET event (NOT generic USER_UPDATED)
      // so compliance can SELECT all admin-driven password resets.
      it('audits ADMIN_PASSWORD_RESET (not USER_UPDATED) inside the transaction', async () => {
        await service.updateUser(
          'u1',
          { resetPassword: true } as any,
          'requester-1',
        );
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'ADMIN_PASSWORD_RESET',
            subject: 'User',
            subjectId: 'u1',
            metadata: expect.objectContaining({
              tempPasswordGenerated: true,
            }),
          }),
          expect.anything(), // tx
        );
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      });
    });

    // canDispatch update path stays as before but no longer touches password.
    it('canDispatch change still bumps tokenVersion (existing behavior preserved)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        username: 'existing',
        canDispatch: true,
        role: { id: 'r1', name: 'Admin' },
      });

      await service.updateUser(
        'u1',
        { canDispatch: true },
        'requester-1',
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canDispatch: true,
            tokenVersion: { increment: 1 },
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

    it('sets canDispatch and increments tokenVersion in same update (JWT invalidation)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        username: 'existing',
        role: { id: 'r1', name: 'Admin' },
      });

      await service.updateUser('u1', { canDispatch: true }, 'req');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canDispatch: true,
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });

    it('clears canDispatch and increments tokenVersion when revoked', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        username: 'existing',
        role: { id: 'r1', name: 'Admin' },
      });

      await service.updateUser('u1', { canDispatch: false }, 'req');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canDispatch: false,
            tokenVersion: { increment: 1 },
          }),
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

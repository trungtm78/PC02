/**
 * BƯỚC 3 – Integration tests: Admin & Directory API contract
 *
 * These tests spin up the NestJS app with mocked Prisma + Audit so they
 * run without a real database and verify HTTP contracts (status codes,
 * error shapes, guard behaviour).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AdminService } from '../src/admin/admin.service';
import { AdminController } from '../src/admin/admin.controller';
import { DirectoryService } from '../src/directory/directory.service';
import { DirectoryController } from '../src/directory/directory.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  user: {
    findMany:   jest.fn().mockResolvedValue([]),
    count:      jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst:  jest.fn().mockResolvedValue(null),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  role: {
    findMany:   jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst:  jest.fn().mockResolvedValue(null),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  permission: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert:   jest.fn(),
  },
  rolePermission: {
    deleteMany: jest.fn(),
    create:     jest.fn(),
  },
  directory: {
    findMany:   jest.fn().mockResolvedValue([]),
    count:      jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue(null),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
    upsert:     jest.fn(),
  },
  $transaction: jest.fn().mockResolvedValue([]),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// Bypass guards — also inject a mock user so @CurrentUser() works
const MOCK_USER = { id: 'test-admin-id', email: 'admin@pc02.local', role: 'ADMIN', roleId: 'role-1' };
const bypassGuard = {
  canActivate: (ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = MOCK_USER;
    return true;
  },
};

// ─── App setup ────────────────────────────────────────────────────────────────

describe('Admin & Directory API (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController, DirectoryController],
      providers: [
        AdminService,
        DirectoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService,  useValue: mockAuditService  },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(bypassGuard)
      .overrideGuard(PermissionsGuard).useValue(bypassGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default resolved values after clearAllMocks
    mockPrismaService.user.findMany.mockResolvedValue([]);
    mockPrismaService.user.count.mockResolvedValue(0);
    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.user.findFirst.mockResolvedValue(null);
    mockPrismaService.role.findMany.mockResolvedValue([]);
    mockPrismaService.role.findUnique.mockResolvedValue(null);
    mockPrismaService.role.findFirst.mockResolvedValue(null);
    mockPrismaService.permission.findMany.mockResolvedValue([]);
    mockPrismaService.directory.findMany.mockResolvedValue([]);
    mockPrismaService.directory.count.mockResolvedValue(0);
    mockPrismaService.directory.findUnique.mockResolvedValue(null);
    mockPrismaService.$transaction.mockResolvedValue([]);
  });

  // ─── /api/v1/admin/users ──────────────────────────────────────────────────

  describe('GET /api/v1/admin/users', () => {
    it('returns empty list when no users', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/users');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ data: [], total: 0 });
    });

    it('returns users from prisma', async () => {
      const fakeUser = { id: 'u1', username: 'admin', email: 'a@b.com' };
      mockPrismaService.user.findMany.mockResolvedValue([fakeUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer()).get('/api/v1/admin/users');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });
  });

  // ─── POST /api/v1/admin/users ─────────────────────────────────────────────

  describe('POST /api/v1/admin/users', () => {
    const validBody = {
      username: 'newuser',
      email: 'new@pc02.local',
      password: 'Pass@1234!',
      firstName: 'Văn',
      lastName: 'A',
      roleId: 'role-uuid-1',
    };

    it('400 when required fields missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .send({ username: 'noemail' });
      expect(res.status).toBe(400);
    });

    it('409 when username already exists (EC-02)', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'existing', username: 'newuser' });
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-uuid-1', name: 'Admin' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .send(validBody);
      expect(res.status).toBe(409);
    });

    it('201 when user created successfully', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-uuid-1', name: 'Admin' });
      mockPrismaService.user.create.mockResolvedValue({ id: 'new-id', username: 'newuser', email: 'new@pc02.local' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .send(validBody);
      expect(res.status).toBe(201);
    });
  });

  // ─── GET /api/v1/admin/roles ──────────────────────────────────────────────

  describe('GET /api/v1/admin/roles', () => {
    it('returns role list', async () => {
      const fakeRole = { id: 'r1', name: 'Admin', _count: { users: 2 }, permissions: [] };
      mockPrismaService.role.findMany.mockResolvedValue([fakeRole]);

      const res = await request(app.getHttpServer()).get('/api/v1/admin/roles');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  // ─── DELETE /api/v1/admin/roles/:id ──────────────────────────────────────

  describe('DELETE /api/v1/admin/roles/:id', () => {
    it('400 when role has users (EC-01)', async () => {
      mockPrismaService.user.count.mockResolvedValue(5);

      const res = await request(app.getHttpServer())
        .delete('/api/v1/admin/roles/role-with-users');
      expect(res.status).toBe(400);
    });

    it('200 when role has no users', async () => {
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.role.delete.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .delete('/api/v1/admin/roles/empty-role');
      expect(res.status).toBe(200);
    });
  });

  // ─── /api/v1/directories ─────────────────────────────────────────────────

  describe('GET /api/v1/directories', () => {
    it('returns empty directory list', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/directories');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ data: [], total: 0 });
    });

    it('returns directories from prisma', async () => {
      const fakeDir = { id: 'd1', type: 'CRIME', code: 'TH001', name: 'Trộm cắp' };
      mockPrismaService.directory.findMany.mockResolvedValue([fakeDir]);
      mockPrismaService.directory.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/v1/directories?type=CRIME');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/v1/directories', () => {
    it('400 when required fields missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/directories')
        .send({ type: 'CRIME' }); // missing code and name
      expect(res.status).toBe(400);
    });

    it('409 when code already exists in type (EC-02)', async () => {
      mockPrismaService.directory.findUnique.mockResolvedValue({ id: 'existing' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/directories')
        .send({ type: 'CRIME', code: 'DUP', name: 'Duplicate' });
      expect(res.status).toBe(409);
    });

    it('201 when directory created successfully', async () => {
      mockPrismaService.directory.findUnique.mockResolvedValue(null);
      mockPrismaService.directory.create.mockResolvedValue({
        id: 'new-d', type: 'CRIME', code: 'NEW001', name: 'New Crime',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/directories')
        .send({ type: 'CRIME', code: 'NEW001', name: 'New Crime' });
      expect(res.status).toBe(201);
    });
  });

  describe('DELETE /api/v1/directories/:id', () => {
    it('404 when directory not found', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/directories/nonexistent');
      expect(res.status).toBe(404);
    });

    it('400 when directory has children (EC-01 variant for Directory)', async () => {
      mockPrismaService.directory.findUnique.mockResolvedValue({ id: 'd1', name: 'Parent' });
      mockPrismaService.directory.count.mockResolvedValue(3);

      const res = await request(app.getHttpServer())
        .delete('/api/v1/directories/d1');
      expect(res.status).toBe(400);
    });

    it('200 when directory deleted successfully', async () => {
      mockPrismaService.directory.findUnique.mockResolvedValue({ id: 'd1', name: 'Leaf' });
      mockPrismaService.directory.count.mockResolvedValue(0);
      mockPrismaService.directory.delete.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .delete('/api/v1/directories/d1');
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('xóa');
    });
  });
});

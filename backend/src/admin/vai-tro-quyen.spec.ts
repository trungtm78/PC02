import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TeamsService } from '../teams/teams.service';
import { EnrollmentService } from '../auth/services/enrollment.service';
import {
  ROLE_NAMES,
  VAI_TRO_HE_THONG,
} from '../common/constants/role.constants';

/**
 * Ma trận phân quyền vai trò — sự cố tiềm ẩn đo trên prod 19/09/2026:
 *
 * Màn "Vai trò & phân quyền" gọi `GET /admin/roles/:id/permissions` — điểm cuối KHÔNG tồn tại, lỗi bị nuốt →
 * lưới hiện TRỐNG; bấm "Lưu" gửi danh sách rỗng và máy chủ nhận → xoá SẠCH quyền của vai trò (OFFICER: 248
 * cán bộ). Kể cả khi tải được, lưới cứng 8×5 chỉ phủ 22/56 quyền của ADMIN, 11/17 của OFFICER, 0/3 của
 * DEADLINE_APPROVER — lưu là mất phần ngoài lưới. Máy chủ còn `upsert` mọi cặp (action, subject) lạ thành
 * quyền mới, xoá/đổi tên được vai trò mà mã so theo TÊN, và không ghi nhật ký.
 */

const DANH_MUC = [
  { id: 'p-read-user', action: 'read', subject: 'User' },
  { id: 'p-write-user', action: 'write', subject: 'User' },
  { id: 'p-read-case', action: 'read', subject: 'Case' },
  { id: 'p-write-case', action: 'write', subject: 'Case' },
  { id: 'p-restore-case', action: 'restore', subject: 'Case' },
];
const idCua = (action: string, subject: string) =>
  DANH_MUC.find((p) => p.action === action && p.subject === subject)!.id;

function dungMoi() {
  const tx = {
    rolePermission: {
      findMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    role: {
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    user: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({ roleId: 'r-khac' }),
    },
    permission: {
      findMany: jest.fn((args?: { where?: { OR?: unknown[] } }) =>
        Promise.resolve(
          args?.where?.OR
            ? DANH_MUC.filter((p) =>
                (
                  args.where!.OR as Array<{ action: string; subject: string }>
                ).some((c) => c.action === p.action && c.subject === p.subject),
              )
            : DANH_MUC,
        ),
      ),
      upsert: jest.fn(),
    },
    rolePermission: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { prisma, tx, audit };
}

/** Lượt ghi nhật ký DUY NHẤT: [bản ghi, client giao dịch]. */
function nhatKy(m: ReturnType<typeof dungMoi>): [unknown, unknown] {
  expect(m.audit.log).toHaveBeenCalledTimes(1);
  return m.audit.log.mock.calls[0] as [unknown, unknown];
}

async function taoService(m: ReturnType<typeof dungMoi>) {
  const mod = await Test.createTestingModule({
    providers: [
      AdminService,
      { provide: PrismaService, useValue: m.prisma },
      { provide: AuditService, useValue: m.audit },
      { provide: TeamsService, useValue: {} },
      { provide: EnrollmentService, useValue: {} },
    ],
  }).compile();
  return mod.get(AdminService);
}

const vaiTro = (
  id: string,
  name: string,
  quyen: Array<[string, string]> = [],
) => ({
  id,
  name,
  _count: { users: 0 },
  permissions: quyen.map(([action, subject]) => ({
    permission: { id: idCua(action, subject), action, subject },
  })),
});

describe('vai trò hệ thống', () => {
  it('ROLE_NAMES có đủ vai trò đang tồn tại trên prod (OFFICER, DEADLINE_APPROVER)', () => {
    expect(ROLE_NAMES.OFFICER).toBe('OFFICER');
    expect(ROLE_NAMES.DEADLINE_APPROVER).toBe('DEADLINE_APPROVER');
    expect(VAI_TRO_HE_THONG).toEqual(
      expect.arrayContaining(['ADMIN', 'OFFICER', 'DEADLINE_APPROVER']),
    );
  });
});

describe('getRolePermissions — điểm cuối màn hình gọi mà trước đây không tồn tại', () => {
  it('trả các cặp (action, subject) của vai trò, sắp theo subject rồi action', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(
      vaiTro('r1', 'OFFICER', [
        ['write', 'Case'],
        ['read', 'User'],
        ['read', 'Case'],
      ]),
    );
    const s = await taoService(m);
    expect(await s.getRolePermissions('r1')).toEqual([
      { action: 'read', subject: 'Case' },
      { action: 'write', subject: 'Case' },
      { action: 'read', subject: 'User' },
    ]);
  });

  it('vai trò không tồn tại → 404', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(null);
    const s = await taoService(m);
    await expect(s.getRolePermissions('x')).rejects.toThrow(NotFoundException);
  });
});

describe('updateRolePermissions', () => {
  it('danh sách RỖNG mà không xác nhận → 400, không ghi gì', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(vaiTro('r1', 'OFFICER'));
    const s = await taoService(m);
    await expect(
      s.updateRolePermissions('r1', { permissions: [] }, 'u1'),
    ).rejects.toThrow(BadRequestException);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rỗng CÓ xác nhận (choPhepRong) → cho phép với vai trò tự tạo', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(
      vaiTro('r9', 'TO_TAM', [['read', 'Case']]),
    );
    m.tx.rolePermission.findMany.mockResolvedValue([
      { permission: { action: 'read', subject: 'Case' } },
    ]);
    const s = await taoService(m);
    await s.updateRolePermissions(
      'r9',
      { permissions: [], choPhepRong: true },
      'u1',
    );
    expect(m.tx.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'r9' },
    });
    expect(m.tx.rolePermission.createMany).not.toHaveBeenCalled();
  });

  it('cặp (action, subject) KHÔNG có trong danh mục → 400 nêu tên, KHÔNG tự tạo quyền mới', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(vaiTro('r1', 'OFFICER'));
    const s = await taoService(m);
    const loi = s.updateRolePermissions(
      'r1',
      {
        permissions: [
          { action: 'read', subject: 'Case' },
          { action: 'fly', subject: 'Case' },
        ],
      },
      'u1',
    );
    await expect(loi).rejects.toThrow(BadRequestException);
    await expect(loi).rejects.toThrow(/fly:Case/);
    expect(m.prisma.permission.upsert).not.toHaveBeenCalled();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('vai trò ADMIN bỏ write:User → 400 (không ai quản trị được nữa)', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(vaiTro('ra', 'ADMIN'));
    const s = await taoService(m);
    await expect(
      s.updateRolePermissions(
        'ra',
        { permissions: [{ action: 'read', subject: 'User' }] },
        'u1',
      ),
    ).rejects.toThrow(/write:User/);
  });

  it('người sửa bỏ write:User khỏi CHÍNH vai trò của mình → 400 (tự khoá)', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(vaiTro('r7', 'QUAN_TRI_TO'));
    m.prisma.user.findUnique.mockResolvedValue({ roleId: 'r7' });
    const s = await taoService(m);
    await expect(
      s.updateRolePermissions(
        'r7',
        { permissions: [{ action: 'read', subject: 'Case' }] },
        'u1',
      ),
    ).rejects.toThrow(/write:User/);
  });

  it('thay trọn bộ trong MỘT giao dịch bằng id danh mục; trùng lặp gộp; nhật ký thêm/bớt ghi trong cùng giao dịch', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(
      vaiTro('r1', 'OFFICER', [
        ['read', 'Case'],
        ['write', 'Case'],
      ]),
    );
    m.tx.rolePermission.findMany.mockResolvedValue([
      { permission: { action: 'read', subject: 'Case' } },
      { permission: { action: 'write', subject: 'Case' } },
    ]);
    const s = await taoService(m);
    await s.updateRolePermissions(
      'r1',
      {
        permissions: [
          { action: 'read', subject: 'Case' },
          { action: 'restore', subject: 'Case' },
          { action: 'read', subject: 'Case' },
        ],
      },
      'u1',
      { ipAddress: '10.0.0.1' },
    );

    expect(m.tx.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'r1' },
    });
    expect(m.tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 'r1', permissionId: 'p-read-case' },
        { roleId: 'r1', permissionId: 'p-restore-case' },
      ],
    });
    const [ghi, txGhi] = nhatKy(m);
    expect(txGhi).toBe(m.tx);
    expect(ghi).toMatchObject({
      action: 'ROLE_PERMISSIONS_UPDATED',
      subjectId: 'r1',
      ipAddress: '10.0.0.1',
      metadata: {
        roleName: 'OFFICER',
        them: ['restore:Case'],
        bo: ['write:Case'],
        truoc: 2,
        sau: 2,
      },
    });
    expect(m.prisma.permission.upsert).not.toHaveBeenCalled();
  });
});

describe('deleteRole', () => {
  it('vai trò không tồn tại → 404', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(null);
    const s = await taoService(m);
    await expect(s.deleteRole('x', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('vai trò HỆ THỐNG (mã so theo tên) không xoá được, kể cả khi 0 người dùng', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(
      vaiTro('rd', 'DEADLINE_APPROVER'),
    );
    const s = await taoService(m);
    await expect(s.deleteRole('rd', 'u1')).rejects.toThrow(BadRequestException);
    expect(m.tx.role.delete).not.toHaveBeenCalled();
  });

  it('vai trò tự tạo, 0 người dùng → xoá và ghi nhật ký trong cùng giao dịch', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(vaiTro('r9', 'TO_TAM'));
    const s = await taoService(m);
    await s.deleteRole('r9', 'u1');
    expect(m.tx.role.delete).toHaveBeenCalledWith({ where: { id: 'r9' } });
    const [ghi, txGhi] = nhatKy(m);
    expect(txGhi).toBe(m.tx);
    expect(ghi).toMatchObject({
      action: 'ROLE_DELETED',
      subjectId: 'r9',
      metadata: { roleName: 'TO_TAM' },
    });
  });
});

describe('updateRole', () => {
  it('đổi TÊN vai trò hệ thống → 400 (mọi phép so theo tên sẽ gãy)', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(vaiTro('ro', 'OFFICER'));
    const s = await taoService(m);
    await expect(s.updateRole('ro', { name: 'CAN_BO' }, 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('sửa MÔ TẢ vai trò hệ thống thì được, có ghi nhật ký trước/sau', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue({
      ...vaiTro('ro', 'OFFICER'),
      description: 'cũ',
    });
    m.tx.role.update.mockResolvedValue({ id: 'ro', name: 'OFFICER' });
    const s = await taoService(m);
    await s.updateRole('ro', { name: 'OFFICER', description: 'mới' }, 'u1');
    expect(m.tx.role.update).toHaveBeenCalled();
    const [ghi, txGhi] = nhatKy(m);
    expect(txGhi).toBe(m.tx);
    expect(ghi).toMatchObject({
      action: 'ROLE_UPDATED',
      metadata: {
        truoc: { name: 'OFFICER', description: 'cũ' },
        sau: { name: 'OFFICER', description: 'mới' },
      },
    });
  });

  it('đặt tên vai trò tự tạo TRÙNG tên hệ thống (không phân biệt hoa thường) → 409', async () => {
    const m = dungMoi();
    m.prisma.role.findUnique.mockResolvedValue(vaiTro('r9', 'TO_TAM'));
    const s = await taoService(m);
    await expect(s.updateRole('r9', { name: 'admin' }, 'u1')).rejects.toThrow(
      ConflictException,
    );
  });
});

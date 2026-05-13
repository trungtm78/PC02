import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TeamsService } from '../teams/teams.service';
import { CreateUserDto, UserStatus } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { generateTempPassword } from '../auth/utils/temp-password.util';
import { hashPassword } from '../auth/utils/password-hash.util';
import {
  UpdateRolePermissionsDto,
  UpdateRoleDto,
} from './dto/update-role-permissions.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateDataGrantDto } from './dto/create-data-grant.dto';
import { AccessLevel } from '@prisma/client';
import { ROLE_NAMES } from '../common/constants/role.constants';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly teamsService: TeamsService,
  ) {}

  // ──────────────────────────────────────────────────────
  // USER MANAGEMENT
  // ──────────────────────────────────────────────────────

  async getUsers(query: QueryUsersDto) {
    const {
      search,
      roleId,
      status,
      departmentId,
      limit = 20,
      offset = 0,
    } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { workId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (roleId) where.roleId = roleId;
    if (status) where.isActive = status === UserStatus.ACTIVE;
    if (departmentId) where.departmentId = departmentId;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          workId: true,
          phone: true,
          departmentId: true,
          isActive: true,
          canDispatch: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          role: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        workId: true,
        phone: true,
        departmentId: true,
        isActive: true,
        canDispatch: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException(`User #${id} không tồn tại`);
    return user;
  }

  async createUser(
    dto: CreateUserDto,
    requesterId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    // EC-02: Check duplicate username/email
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.username === dto.username
          ? `Username "${dto.username}" đã tồn tại`
          : `Email "${dto.email}" đã tồn tại`,
      );
    }

    // Verify role exists
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new NotFoundException(`Role #${dto.roleId} không tồn tại`);

    // F1: backend generates the temp password. Admin sees it ONCE in the
    // response (rendered via TempPasswordHandoverModal), never stored anywhere
    // admin can re-retrieve. User is forced to change on first login (D1).
    const tempPassword = generateTempPassword(16);
    const passwordHash = await hashPassword(tempPassword);

    // H2: user insert + audit must be transactional. If audit fails after
    // the user is created, the whole operation rolls back so admin doesn't
    // see "user created" with no audit trail of the temp password handover.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          mustChangePassword: true, // D1: force change on first login
          firstName: dto.firstName,
          lastName: dto.lastName,
          workId: dto.workId,
          phone: dto.phone,
          departmentId: dto.departmentId,
          roleId: dto.roleId,
          isActive: dto.status !== UserStatus.INACTIVE,
        },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          workId: true,
          isActive: true,
          role: { select: { id: true, name: true } },
          createdAt: true,
        },
      });

      await this.audit.log(
        {
          userId: requesterId,
          action: 'USER_CREATED',
          subject: 'User',
          subjectId: created.id,
          metadata: {
            createdUsername: created.username,
            email: created.email,
            tempPasswordGenerated: true, // F3: distinguishes admin-typed (legacy) from system-generated
          },
          ...meta,
        },
        tx,
      );

      return created;
    });

    // SECURITY: tempPassword is plaintext — returned ONCE in the response,
    // never logged, never persisted in plaintext. Admin frontend must show
    // it via the non-dismissible TempPasswordHandoverModal then discard.
    return { ...user, tempPassword };
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    requesterId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} không tồn tại`);

    // EC-02: Check uniqueness on change
    if (dto.email && dto.email !== user.email) {
      const dup = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (dup) throw new ConflictException(`Email "${dto.email}" đã tồn tại`);
    }
    if (dto.username && dto.username !== user.username) {
      const dup = await this.prisma.user.findFirst({
        where: { username: dto.username, id: { not: id } },
      });
      if (dup)
        throw new ConflictException(`Username "${dto.username}" đã tồn tại`);
    }

    const data: Record<string, unknown> = {
      ...(dto.username && { username: dto.username }),
      ...(dto.email && { email: dto.email }),
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.workId !== undefined && { workId: dto.workId }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.roleId && { roleId: dto.roleId }),
      ...(dto.status !== undefined && {
        isActive: dto.status === UserStatus.ACTIVE,
      }),
    };

    // F1 + C3: admin reset path. Generate temp pw, force change on next login,
    // invalidate any active access tokens (tokenVersion bump).
    let tempPassword: string | undefined;
    if (dto.resetPassword) {
      tempPassword = generateTempPassword(16);
      data.passwordHash = await hashPassword(tempPassword);
      data.refreshTokenHash = null;
      data.mustChangePassword = true;
      data.passwordChangedAt = new Date();
      data.tokenVersion = { increment: 1 };
    }

    if (dto.canDispatch !== undefined) {
      data.canDispatch = dto.canDispatch;
      // tokenVersion already incremented above if reset; otherwise increment here.
      if (data.tokenVersion === undefined) {
        data.tokenVersion = { increment: 1 };
      }
    }

    // H2 + Codex #6: transactional update + audit. For password resets,
    // use updateMany with WHERE tokenVersion=expected as an optimistic lock
    // so concurrent admin resets don't both succeed (which would give two
    // admins different temp passwords, only one of which actually works).
    const expectedVersion = user.tokenVersion;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.resetPassword) {
        const result = await tx.user.updateMany({
          where: { id, tokenVersion: expectedVersion },
          data,
        });
        if (result.count === 0) {
          throw new ConflictException(
            'User vừa được admin khác cập nhật hoặc reset lại — vui lòng tải lại trang và thử lại',
          );
        }
      } else {
        await tx.user.update({ where: { id }, data });
      }

      const u = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          canDispatch: true,
          role: { select: { id: true, name: true } },
          updatedAt: true,
        },
      });
      if (!u) {
        // Should be impossible given the WHERE id check above, but Prisma's
        // findUnique returns nullable so satisfy the type system.
        throw new NotFoundException(`User #${id} không tồn tại`);
      }

      if (dto.resetPassword) {
        await this.audit.log(
          {
            userId: requesterId,
            action: 'ADMIN_PASSWORD_RESET',
            subject: 'User',
            subjectId: id,
            metadata: {
              tempPasswordGenerated: true,
              targetUsername: u.username,
            },
            ...meta,
          },
          tx,
        );
      } else {
        await this.audit.log(
          {
            userId: requesterId,
            action: 'USER_UPDATED',
            subject: 'User',
            subjectId: id,
            metadata: { fields: Object.keys(data) },
            ...meta,
          },
          tx,
        );
      }

      return u;
    });

    return tempPassword ? { ...updated, tempPassword } : updated;
  }

  async deleteUser(
    id: string,
    requesterId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} không tồn tại`);

    // Prevent self-delete
    if (id === requesterId) {
      throw new ForbiddenException(
        'Không thể xóa chính tài khoản đang đăng nhập',
      );
    }

    await this.prisma.user.delete({ where: { id } });

    await this.audit.log({
      userId: requesterId,
      action: 'USER_DELETED',
      subject: 'User',
      subjectId: id,
      metadata: { deletedUsername: user.username },
      ...meta,
    });

    return { message: 'Đã xóa người dùng thành công' };
  }

  // ──────────────────────────────────────────────────────
  // ROLE MANAGEMENT
  // ──────────────────────────────────────────────────────

  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        _count: { select: { users: true } },
        permissions: { include: { permission: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
        permissions: { include: { permission: true } },
      },
    });
    if (!role) throw new NotFoundException(`Role #${id} không tồn tại`);
    return role;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateRole(id: string, dto: UpdateRoleDto, requesterId: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role #${id} không tồn tại`);

    if (dto.name && dto.name !== role.name) {
      const dup = await this.prisma.role.findFirst({
        where: { name: dto.name, id: { not: id } },
      });
      if (dup) throw new ConflictException(`Tên role "${dto.name}" đã tồn tại`);
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteRole(id: string, requesterId: string) {
    // EC-01: Chặn xóa role đang có user
    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new BadRequestException(
        `Không thể xóa role này vì còn ${userCount} người dùng đang sử dụng. Hãy chuyển người dùng sang role khác trước.`,
      );
    }
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Đã xóa role thành công' };
  }

  // ──────────────────────────────────────────────────────
  // PERMISSION MATRIX (AC-02: áp dụng ngay)
  // ──────────────────────────────────────────────────────

  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
    requesterId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role #${roleId} không tồn tại`);

    // EC-05: Prevent admin from removing own critical permissions
    // (Allow but audit clearly)

    // Upsert all requested permissions
    const permIds: string[] = [];
    for (const p of dto.permissions) {
      const perm = await this.prisma.permission.upsert({
        where: { action_subject: { action: p.action, subject: p.subject } },
        update: {},
        create: { action: p.action, subject: p.subject },
      });
      permIds.push(perm.id);
    }

    // Replace all role-permission links atomically
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...permIds.map((permissionId) =>
        this.prisma.rolePermission.create({ data: { roleId, permissionId } }),
      ),
    ]);

    await this.audit.log({
      userId: requesterId,
      action: 'ROLE_PERMISSIONS_UPDATED',
      subject: 'Role',
      subjectId: roleId,
      metadata: {
        roleName: role.name,
        permissionCount: dto.permissions.length,
      },
      ...meta,
    });

    return this.getRoleById(roleId);
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });
  }

  // ──────────────────────────────────────────────────────
  // DATA ACCESS GRANTS
  // ──────────────────────────────────────────────────────

  async createDataAccessGrant(
    dto: CreateDataGrantDto,
    granterId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    // Validate grantee exists
    const grantee = await this.prisma.user.findUnique({
      where: { id: dto.granteeId },
    });
    if (!grantee) throw new NotFoundException('Người được cấp quyền không tồn tại');

    // Validate team exists
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
    });
    if (!team) throw new NotFoundException('Tổ/nhóm không tồn tại');

    // Check granter is leader of the team or an ancestor team
    const granterTeams = await this.prisma.userTeam.findMany({
      where: { userId: granterId, isLeader: true },
      include: { team: true },
    });

    let isAuthorized = false;
    for (const ut of granterTeams) {
      if (ut.teamId === dto.teamId) {
        isAuthorized = true;
        break;
      }
      // Check if team is a descendant of a team the granter leads
      const descendants = await this.teamsService.getDescendantIds(ut.teamId);
      if (descendants.includes(dto.teamId)) {
        isAuthorized = true;
        break;
      }
    }

    // Also allow admin role
    const granterUser = await this.prisma.user.findUnique({
      where: { id: granterId },
      include: { role: true },
    });
    if (granterUser?.role?.name === ROLE_NAMES.ADMIN) isAuthorized = true;

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Bạn không có quyền cấp quyền truy cập cho tổ/nhóm này',
      );
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const grant = await this.prisma.dataAccessGrant.upsert({
      where: {
        granteeId_teamId_accessLevel: {
          granteeId: dto.granteeId,
          teamId: dto.teamId,
          accessLevel: dto.accessLevel,
        },
      },
      update: { grantedById: granterId, expiresAt },
      create: {
        granteeId: dto.granteeId,
        teamId: dto.teamId,
        accessLevel: dto.accessLevel,
        grantedById: granterId,
        expiresAt,
      },
    });

    await this.audit.log({
      userId: granterId,
      action: 'DATA_GRANT_CREATED',
      subject: 'DataAccessGrant',
      subjectId: grant.id,
      metadata: {
        granteeId: dto.granteeId,
        teamId: dto.teamId,
        accessLevel: dto.accessLevel,
      },
      ...meta,
    });

    return grant;
  }

  async revokeDataAccessGrant(
    grantId: string,
    revokerId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const grant = await this.prisma.dataAccessGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant) throw new NotFoundException('Quyền truy cập không tồn tại');

    // Allow revoker if they are the granter or a team leader
    const isGranter = grant.grantedById === revokerId;

    let isLeader = false;
    if (!isGranter) {
      const leaderCheck = await this.prisma.userTeam.findFirst({
        where: { userId: revokerId, teamId: grant.teamId, isLeader: true },
      });
      isLeader = !!leaderCheck;
    }

    // Also allow admin
    const revokerUser = await this.prisma.user.findUnique({
      where: { id: revokerId },
      include: { role: true },
    });
    const isAdmin = revokerUser?.role?.name === ROLE_NAMES.ADMIN;

    if (!isGranter && !isLeader && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền thu hồi quyền truy cập này');
    }

    await this.prisma.dataAccessGrant.delete({ where: { id: grantId } });

    await this.audit.log({
      userId: revokerId,
      action: 'DATA_GRANT_REVOKED',
      subject: 'DataAccessGrant',
      subjectId: grantId,
      metadata: { granteeId: grant.granteeId, teamId: grant.teamId },
      ...meta,
    });

    return { message: 'Thu hồi quyền truy cập thành công' };
  }

  async listDataAccessGrants() {
    return this.prisma.dataAccessGrant.findMany({
      include: {
        grantee: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
        team: { select: { id: true, name: true, code: true } },
        grantedBy: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── 2FA Admin Reset ────────────────────────────────────────────────────────
  async adminResetTwoFa(targetUserId: string, adminUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User không tồn tại');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpSetupPending: false,
        totpSetupPendingAt: null,
        backupCodes: [],
        backupCodeSalts: [],
        lastTotpCode: null,
        twoFaSetupAt: null,
      },
    });

    await this.audit.log({
      userId: adminUserId,
      action: 'ADMIN_2FA_RESET',
      subject: 'User',
      subjectId: targetUserId,
      metadata: { targetUserId },
    });

    return { success: true, message: 'Đã reset 2FA cho user thành công' };
  }
}

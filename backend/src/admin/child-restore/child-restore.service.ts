import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { buildScopeFilter } from '../../common/utils/scope-filter.util';
import type { DataScope } from '../../auth/services/unit-scope.service';
import {
  CHILD_RESTORE_TARGETS,
  findTarget,
  type ChildRestoreTarget,
} from './child-restore.registry';

interface Delegate {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  count: (args: unknown) => Promise<number>;
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
}

/**
 * E3 — khôi phục hồ sơ con đã xoá mềm.
 *
 * Chín loại có `deletedAt` mà không có đường khôi phục nào. Xoá mềm không khôi
 * phục được thì "mềm" chỉ là cách nói: bản ghi biến mất khỏi mọi màn hình, và
 * cách duy nhất lấy lại là chạy `UPDATE` bằng psql.
 */
@Injectable()
export class ChildRestoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Danh sách loại hồ sơ khôi phục được, cho tab trên màn hình quản trị. */
  listTargets() {
    return CHILD_RESTORE_TARGETS.map((t) => ({
      resource: t.resource,
      label: t.label,
    }));
  }

  private delegate(target: ChildRestoreTarget): Delegate {
    const d = (this.prisma as unknown as Record<string, Delegate>)[
      target.model
    ];
    if (!d) {
      // Chỉ xảy ra khi ai đó đổi tên model mà quên sửa registry — hỏng ngay ở
      // request đầu tiên thay vì trả danh sách rỗng trông như "không có gì".
      throw new BadRequestException(
        `Cấu hình khôi phục sai: không có model "${target.model}"`,
      );
    }
    return d;
  }

  /**
   * Điều kiện phạm vi cho một loại.
   *
   * Loại nối tới vụ án thì lọc qua cha. Loại không có cha thì KHÔNG có phạm vi
   * tổ nào để áp — chúng chỉ tới được qua quyền `restore`, mà seed chỉ cấp cho
   * ADMIN. Trả `{}` ở đây là đúng, và điều đó phải nói ra chứ không để người
   * đọc sau tự đoán là bỏ sót.
   */
  private scopeWhere(target: ChildRestoreTarget, scope?: DataScope | null) {
    if (target.parent.kind === 'none') return {};
    const filter = buildScopeFilter(scope, 'write');
    if (!filter) return {};
    const rel =
      target.parent.column === 'relatedCaseId' ? 'relatedCase' : 'case';
    return { [rel]: { is: filter } };
  }

  async listDeleted(
    resource: string,
    query: { limit?: number; offset?: number; search?: string },
    scope?: DataScope | null,
  ) {
    const target = findTarget(resource);
    if (!target) {
      throw new NotFoundException(`Không có loại hồ sơ "${resource}"`);
    }
    const limit = Math.min(Number(query.limit) || 20, 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const search = query.search?.trim();

    const where: Record<string, unknown> = {
      deletedAt: { not: null },
      ...this.scopeWhere(target, scope),
      ...(search && {
        OR: target.searchFields.map((f) => ({
          [f]: { contains: search, mode: 'insensitive' },
        })),
      }),
    };

    const delegate = this.delegate(target);
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      delegate.count({ where }),
    ]);

    return { resource, label: target.label, data, total, limit, offset };
  }

  async restore(
    resource: string,
    id: string,
    reason: string,
    actorId: string,
    scope?: DataScope | null,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const target = findTarget(resource);
    if (!target) {
      throw new NotFoundException(`Không có loại hồ sơ "${resource}"`);
    }
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException(
        'Lý do khôi phục phải có ít nhất 10 ký tự — đây là thao tác trên hồ sơ đã bị xoá',
      );
    }

    const delegate = this.delegate(target);
    const existing = await delegate.findFirst({
      where: {
        id,
        deletedAt: { not: null },
        ...this.scopeWhere(target, scope),
      },
    });
    if (!existing) {
      // Không phân biệt "không tồn tại", "chưa bị xoá" và "ngoài phạm vi": tách
      // ra là cho người gọi dò được id hồ sơ tổ khác.
      throw new NotFoundException(
        `Không tìm thấy ${target.label} đã xoá, hoặc nằm ngoài phạm vi dữ liệu của bạn`,
      );
    }

    const record = await delegate.update({
      where: { id },
      data: { deletedAt: null },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CHILD_RECORD_RESTORED',
      subject: target.model,
      subjectId: id,
      metadata: { resource, label: target.label, reason: reason.trim() },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record };
  }
}

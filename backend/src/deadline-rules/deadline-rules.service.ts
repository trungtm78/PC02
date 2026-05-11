import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  DeadlineRuleStatus,
  DeadlineRuleVersion,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProposeRuleDto } from './dto/propose-rule.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { ApproveRuleDto } from './dto/approve-rule.dto';
import { RejectRuleDto } from './dto/reject-rule.dto';
import { QueryRulesDto } from './dto/query-rules.dto';
import {
  DEADLINE_RULE_KEYS,
  DEADLINE_RULE_KEY_SET,
  DEADLINE_RULE_ACTIONS,
} from './constants/deadline-rule-keys.constants';

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * DeadlineRulesService — authoritative source for the 12 legal-deadline values.
 *
 * Concurrency model:
 *   - DB partial unique indexes guarantee at most one active / one submitted /
 *     one approved-pending row per ruleKey at any time.
 *   - approve() and the activator cron both use a Postgres advisory lock
 *     (pg_advisory_xact_lock(hashtext(ruleKey))) wrapped in a Serializable
 *     transaction to serialize per-key state transitions.
 *
 * Cache: none. Reads hit the indexed (ruleKey, status='active') query directly;
 * sub-millisecond on a 12-row table. Avoids multi-instance staleness.
 *
 * Authorization is enforced at the controller layer via @RequirePermissions.
 * The service still enforces invariants (proposer ≠ approver, status gates,
 * effectiveFrom clamps) defensively so internal callers can't bypass.
 */
@Injectable()
export class DeadlineRulesService {
  private readonly logger = new Logger(DeadlineRulesService.name);

  // effectiveFrom clamp window — defensive bounds, not policy
  private readonly MAX_FUTURE_DAYS = 730; // ~2 years
  private readonly MAX_PAST_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // READ paths
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the current active rule version for a key. Returns null if no active
   * version exists (e.g. fresh DB, no seed yet). Callers should treat that as
   * an internal error — the seed/migration must always create v1.
   */
  async getActive(ruleKey: string): Promise<DeadlineRuleVersion | null> {
    if (!DEADLINE_RULE_KEY_SET.has(ruleKey)) {
      throw new BadRequestException(`'${ruleKey}' is not a deadline rule key`);
    }
    return this.prisma.deadlineRuleVersion.findFirst({
      where: { ruleKey, status: 'active' as DeadlineRuleStatus },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Convenience: get the numeric value of the active rule. Throws if no active
   * version exists (consumers like incidents.create depend on this — fail loud
   * rather than silently fall back).
   */
  async getActiveValue(ruleKey: string, fallback?: number): Promise<number> {
    const v = await this.getActive(ruleKey);
    if (!v) {
      if (fallback !== undefined) return fallback;
      throw new InternalServerErrorException(
        `Không tìm thấy quy tắc đang hiệu lực cho '${ruleKey}' — kiểm tra migration/seed`,
      );
    }
    return v.value;
  }

  /** List all active rules (1 query, not 12). Used by ListPage. */
  async listActive() {
    const rules = await this.prisma.deadlineRuleVersion.findMany({
      where: {
        ruleKey: { in: [...DEADLINE_RULE_KEYS] },
        status: 'active' as DeadlineRuleStatus,
      },
      orderBy: { ruleKey: 'asc' },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        attachment: { select: { id: true, title: true, fileName: true, mimeType: true } },
      },
    });
    return { success: true, data: rules };
  }

  /** Summary counts for the list page top strip. */
  async getSummary() {
    const [active, submitted, approvedPending, needsDoc] = await Promise.all([
      this.prisma.deadlineRuleVersion.count({ where: { status: 'active' } }),
      this.prisma.deadlineRuleVersion.count({ where: { status: 'submitted' } }),
      this.prisma.deadlineRuleVersion.count({ where: { status: 'approved' } }),
      this.prisma.deadlineRuleVersion.count({
        where: { status: 'active', migrationConfidence: 'legacy-default' },
      }),
    ]);
    return {
      success: true,
      data: { active, submitted, approvedPending, needsDocumentation: needsDoc },
    };
  }

  /** History for a single ruleKey, newest first. */
  async getHistory(ruleKey: string) {
    if (!DEADLINE_RULE_KEY_SET.has(ruleKey)) {
      throw new BadRequestException(`'${ruleKey}' is not a deadline rule key`);
    }
    const versions = await this.prisma.deadlineRuleVersion.findMany({
      where: { ruleKey },
      orderBy: { createdAt: 'desc' },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        attachment: { select: { id: true, title: true, fileName: true } },
      },
    });
    return { success: true, data: versions };
  }

  /** Approval queue (status='submitted'), ordered by oldest first. */
  async getApprovalQueue() {
    const rows = await this.prisma.deadlineRuleVersion.findMany({
      where: { status: 'submitted' as DeadlineRuleStatus },
      orderBy: { proposedAt: 'asc' },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        attachment: { select: { id: true, title: true, fileName: true } },
      },
    });
    return { success: true, data: rows };
  }

  /** Detail view of one version. */
  async getById(id: string) {
    const v = await this.prisma.deadlineRuleVersion.findUnique({
      where: { id },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        supersedes: true,
        attachment: { select: { id: true, title: true, fileName: true, mimeType: true } },
      },
    });
    if (!v) throw new NotFoundException(`Không tìm thấy phiên bản (id: ${id})`);
    return { success: true, data: v };
  }

  /** Filter list (used by some UI screens). */
  async query(q: QueryRulesDto) {
    const where: Prisma.DeadlineRuleVersionWhereInput = {};
    if (q.ruleKey) where.ruleKey = q.ruleKey;
    if (q.status) where.status = q.status;
    const rows = await this.prisma.deadlineRuleVersion.findMany({
      where,
      orderBy: [{ ruleKey: 'asc' }, { createdAt: 'desc' }],
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });
    return { success: true, data: rows };
  }

  /**
   * Impact preview — counts cases/incidents/petitions that will be affected
   * by activating a proposed value. Buckets:
   *   - notAffected: records created before effectiveFrom — keep old rule
   *   - openWillReextend: records still in extension flow — gia hạn will use new rule
   *   - futureAll: records created on/after effectiveFrom — use new rule
   * Also returns soonest 5 active incidents/petitions for context.
   */
  async previewImpact(id: string) {
    const v = await this.prisma.deadlineRuleVersion.findUnique({ where: { id } });
    if (!v) throw new NotFoundException(`Không tìm thấy phiên bản (id: ${id})`);

    const isIncidentRule = ['THOI_HAN_XAC_MINH', 'THOI_HAN_GIA_HAN_1', 'THOI_HAN_GIA_HAN_2', 'SO_LAN_GIA_HAN_TOI_DA'].includes(v.ruleKey);
    const isPetitionRule = ['THOI_HAN_TO_CAO', 'THOI_HAN_KHIEU_NAI', 'THOI_HAN_KIEN_NGHI', 'THOI_HAN_PHAN_ANH'].includes(v.ruleKey);

    const counts = { notAffected: 0, openWillReextend: 0, futureAll: 0 };
    let soonestIncidents: { id: string; code: string; deadline: Date | null }[] = [];
    let soonestPetitions: { id: string; stt: string; deadline: Date | null }[] = [];

    if (isIncidentRule) {
      const [open, withSnapshot] = await Promise.all([
        this.prisma.incident.count({
          where: { deletedAt: null, deadline: { not: null }, soLanGiaHan: { lt: 2 } },
        }),
        this.prisma.incident.count({ where: { deletedAt: null, deadlineRuleVersionId: { not: null } } }),
      ]);
      counts.notAffected = withSnapshot;
      counts.openWillReextend = open;
      soonestIncidents = await this.prisma.incident.findMany({
        where: { deletedAt: null, deadline: { not: null } },
        orderBy: { deadline: 'asc' },
        take: 5,
        select: { id: true, code: true, deadline: true },
      });
    }

    if (isPetitionRule) {
      const withSnapshot = await this.prisma.petition.count({
        where: { deletedAt: null, deadlineRuleVersionId: { not: null } },
      });
      counts.notAffected = withSnapshot;
      soonestPetitions = await this.prisma.petition.findMany({
        where: { deletedAt: null, deadline: { not: null } },
        orderBy: { deadline: 'asc' },
        take: 5,
        select: { id: true, stt: true, deadline: true },
      });
    }

    return {
      success: true,
      data: {
        ruleKey: v.ruleKey,
        proposedValue: v.value,
        effectiveFrom: v.effectiveFrom,
        counts,
        soonestIncidents,
        soonestPetitions,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WRITE paths
  // ─────────────────────────────────────────────────────────────────────────

  async propose(dto: ProposeRuleDto, userId: string, meta?: AuditMeta) {
    if (!DEADLINE_RULE_KEY_SET.has(dto.ruleKey)) {
      throw new BadRequestException(`'${dto.ruleKey}' is not a deadline rule key`);
    }
    const effectiveFrom = dto.effectiveFrom ? this.clampEffectiveFrom(new Date(dto.effectiveFrom)) : null;

    const created = await this.prisma.deadlineRuleVersion.create({
      data: {
        ruleKey: dto.ruleKey,
        value: dto.value,
        label: dto.label,
        legalBasis: dto.legalBasis,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        documentIssuer: dto.documentIssuer,
        documentDate: dto.documentDate ? new Date(dto.documentDate) : null,
        attachmentId: dto.attachmentId,
        reason: dto.reason,
        status: 'draft',
        effectiveFrom,
        proposedById: userId,
        proposedByType: 'USER',
      },
    });

    await this.audit.log({
      userId,
      action: DEADLINE_RULE_ACTIONS.PROPOSED,
      subject: 'DeadlineRuleVersion',
      subjectId: created.id,
      metadata: { ruleKey: dto.ruleKey, value: dto.value },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: created, message: 'Đã tạo bản nháp đề xuất' };
  }

  async updateDraft(id: string, dto: UpdateDraftDto, userId: string, meta?: AuditMeta) {
    const existing = await this.prisma.deadlineRuleVersion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Không tìm thấy phiên bản (id: ${id})`);
    if (existing.status !== 'draft') {
      throw new ConflictException(
        `Chỉ có thể sửa bản nháp. Trạng thái hiện tại: ${existing.status}`,
      );
    }
    if (existing.proposedById !== userId) {
      throw new ForbiddenException('Chỉ người đề xuất mới được sửa bản nháp');
    }

    const data: Prisma.DeadlineRuleVersionUpdateInput = {};
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.legalBasis !== undefined) data.legalBasis = dto.legalBasis;
    if (dto.documentType !== undefined) data.documentType = dto.documentType;
    if (dto.documentNumber !== undefined) data.documentNumber = dto.documentNumber;
    if (dto.documentIssuer !== undefined) data.documentIssuer = dto.documentIssuer;
    if (dto.documentDate !== undefined) {
      data.documentDate = dto.documentDate ? new Date(dto.documentDate) : null;
    }
    if (dto.attachmentId !== undefined) {
      data.attachment = dto.attachmentId
        ? { connect: { id: dto.attachmentId } }
        : { disconnect: true };
    }
    if (dto.reason !== undefined) data.reason = dto.reason;
    if (dto.effectiveFrom !== undefined) {
      data.effectiveFrom = dto.effectiveFrom
        ? this.clampEffectiveFrom(new Date(dto.effectiveFrom))
        : null;
    }

    const updated = await this.prisma.deadlineRuleVersion.update({ where: { id }, data });

    await this.audit.log({
      userId,
      action: DEADLINE_RULE_ACTIONS.UPDATED_DRAFT,
      subject: 'DeadlineRuleVersion',
      subjectId: id,
      metadata: { changes: dto as Record<string, unknown> },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: updated };
  }

  async submit(id: string, userId: string, meta?: AuditMeta) {
    const existing = await this.prisma.deadlineRuleVersion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Không tìm thấy phiên bản (id: ${id})`);
    if (existing.status !== 'draft') {
      throw new ConflictException(`Chỉ có thể submit bản nháp. Trạng thái: ${existing.status}`);
    }
    if (existing.proposedById !== userId) {
      throw new ForbiddenException('Chỉ người đề xuất mới được gửi duyệt');
    }

    // Partial unique index "one submitted per ruleKey" enforces invariant
    try {
      const updated = await this.prisma.deadlineRuleVersion.update({
        where: { id, status: 'draft' as DeadlineRuleStatus },
        data: { status: 'submitted', proposedAt: new Date() },
      });

      await this.audit.log({
        userId,
        action: DEADLINE_RULE_ACTIONS.SUBMITTED,
        subject: 'DeadlineRuleVersion',
        subjectId: id,
        metadata: { ruleKey: existing.ruleKey, value: existing.value },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      await this.notifyApprovers(updated, NotificationType.DEADLINE_RULE_SUBMITTED, userId);

      return { success: true, data: updated, message: 'Đã gửi duyệt' };
    } catch (e) {
      if ((e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException(
          `Đã có một đề xuất khác đang chờ duyệt cho quy tắc '${existing.ruleKey}'. Chỉ 1 đề xuất pending tại 1 thời điểm.`,
        );
      }
      throw e;
    }
  }

  async approve(
    id: string,
    dto: ApproveRuleDto,
    userId: string,
    meta?: AuditMeta,
  ): Promise<{ success: true; data: DeadlineRuleVersion; message: string }> {
    return this.prisma.$transaction(
      async (tx) => {
        // Advisory lock per ruleKey — serializes approve+cron+race
        const existing = await tx.deadlineRuleVersion.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Không tìm thấy phiên bản (id: ${id})`);
        if (existing.status !== 'submitted') {
          throw new ConflictException(
            `Phiên bản này không còn là bản đang chờ duyệt (trạng thái: ${existing.status})`,
          );
        }
        if (existing.proposedById === userId) {
          throw new ForbiddenException(
            'Bạn là người đề xuất phiên bản này. Quy trình maker-checker yêu cầu một người duyệt khác.',
          );
        }

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.ruleKey}))`;

        const effectiveFrom = dto.effectiveFrom
          ? this.clampEffectiveFrom(new Date(dto.effectiveFrom))
          : (existing.effectiveFrom ?? new Date());

        const now = new Date();
        const shouldActivateNow = effectiveFrom <= now;
        const targetStatus: DeadlineRuleStatus = shouldActivateNow ? 'active' : 'approved';

        let supersedesId: string | null = null;

        if (shouldActivateNow) {
          // Supersede the current active version (if any) atomically
          const currentActive = await tx.deadlineRuleVersion.findFirst({
            where: { ruleKey: existing.ruleKey, status: 'active' as DeadlineRuleStatus },
          });
          if (currentActive) {
            await tx.deadlineRuleVersion.update({
              where: { id: currentActive.id },
              data: { status: 'superseded', effectiveTo: now },
            });
            supersedesId = currentActive.id;
          }
        }

        const updated = await tx.deadlineRuleVersion.update({
          where: { id, status: 'submitted' as DeadlineRuleStatus },
          data: {
            status: targetStatus,
            effectiveFrom,
            reviewedById: userId,
            reviewedAt: now,
            reviewNotes: dto.notes,
            supersedesId,
          },
        });

        await this.audit.log(
          {
            userId,
            action: DEADLINE_RULE_ACTIONS.APPROVED,
            subject: 'DeadlineRuleVersion',
            subjectId: id,
            metadata: {
              ruleKey: existing.ruleKey,
              fromValue: null,
              toValue: existing.value,
              effectiveFrom,
              status: targetStatus,
              supersededVersionId: supersedesId,
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        if (shouldActivateNow) {
          await this.audit.log(
            {
              userId,
              action: DEADLINE_RULE_ACTIONS.ACTIVATED,
              subject: 'DeadlineRuleVersion',
              subjectId: id,
              metadata: { ruleKey: existing.ruleKey, effectiveFrom },
              ipAddress: meta?.ipAddress,
              userAgent: meta?.userAgent,
            },
            tx,
          );
        }

        // Notify proposer outside transaction (notifications are non-critical)
        setImmediate(() => {
          this.notifyProposer(
            updated,
            shouldActivateNow ? NotificationType.DEADLINE_RULE_ACTIVATED : NotificationType.DEADLINE_RULE_APPROVED,
            userId,
          ).catch((err) => this.logger.error(`notifyProposer failed: ${String(err)}`));
        });

        return {
          success: true as const,
          data: updated,
          message: shouldActivateNow
            ? 'Đã duyệt và kích hoạt ngay'
            : `Đã duyệt — sẽ tự động hiệu lực từ ${effectiveFrom.toISOString().slice(0, 10)}`,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 },
    );
  }

  async reject(id: string, dto: RejectRuleDto, userId: string, meta?: AuditMeta) {
    const existing = await this.prisma.deadlineRuleVersion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Không tìm thấy phiên bản (id: ${id})`);
    if (existing.status !== 'submitted') {
      throw new ConflictException(`Chỉ có thể từ chối bản đang chờ duyệt. Trạng thái: ${existing.status}`);
    }
    if (existing.proposedById === userId) {
      throw new ForbiddenException(
        'Bạn là người đề xuất phiên bản này. Quy trình maker-checker yêu cầu một người duyệt khác.',
      );
    }

    const updated = await this.prisma.deadlineRuleVersion.update({
      where: { id, status: 'submitted' as DeadlineRuleStatus },
      data: { status: 'rejected', reviewedById: userId, reviewedAt: new Date(), reviewNotes: dto.notes },
    });

    await this.audit.log({
      userId,
      action: DEADLINE_RULE_ACTIONS.REJECTED,
      subject: 'DeadlineRuleVersion',
      subjectId: id,
      metadata: { ruleKey: existing.ruleKey, notes: dto.notes },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    setImmediate(() => {
      this.notifyProposer(updated, NotificationType.DEADLINE_RULE_REJECTED, userId).catch((err) =>
        this.logger.error(`notifyProposer failed: ${String(err)}`),
      );
    });

    return { success: true, data: updated, message: 'Đã từ chối đề xuất' };
  }

  async deleteDraft(id: string, userId: string, meta?: AuditMeta) {
    const existing = await this.prisma.deadlineRuleVersion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Không tìm thấy phiên bản (id: ${id})`);
    if (existing.status !== 'draft') {
      throw new ConflictException(`Chỉ có thể xóa bản nháp. Trạng thái: ${existing.status}`);
    }
    if (existing.proposedById !== userId) {
      throw new ForbiddenException('Chỉ người đề xuất mới được xóa bản nháp');
    }

    await this.prisma.deadlineRuleVersion.delete({ where: { id, status: 'draft' as DeadlineRuleStatus } });

    await this.audit.log({
      userId,
      action: DEADLINE_RULE_ACTIONS.DELETED_DRAFT,
      subject: 'DeadlineRuleVersion',
      subjectId: id,
      metadata: { ruleKey: existing.ruleKey },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Đã xóa bản nháp' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Activator / Stale notifier (called by scheduler)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Promote approved versions whose effectiveFrom <= now to 'active'. Called by
   * the daily cron and on demand. Processes versions in effectiveFrom ASC order
   * to handle multi-day catch-up correctly.
   */
  async activateDueRules(now: Date = new Date()): Promise<{ activated: string[] }> {
    const dueVersions = await this.prisma.deadlineRuleVersion.findMany({
      where: { status: 'approved' as DeadlineRuleStatus, effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
    });

    const activated: string[] = [];
    for (const v of dueVersions) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${v.ruleKey}))`;
            const current = await tx.deadlineRuleVersion.findFirst({
              where: { ruleKey: v.ruleKey, status: 'active' as DeadlineRuleStatus },
            });
            if (current) {
              await tx.deadlineRuleVersion.update({
                where: { id: current.id },
                data: { status: 'superseded', effectiveTo: now },
              });
            }
            await tx.deadlineRuleVersion.update({
              where: { id: v.id, status: 'approved' as DeadlineRuleStatus },
              data: { status: 'active', supersedesId: current?.id ?? null },
            });
            await this.audit.log(
              {
                action: DEADLINE_RULE_ACTIONS.ACTIVATED,
                subject: 'DeadlineRuleVersion',
                subjectId: v.id,
                metadata: { ruleKey: v.ruleKey, by: 'cron', supersededVersionId: current?.id ?? null },
              },
              tx,
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 },
        );
        activated.push(v.id);

        // Notify proposer (best-effort)
        if (v.proposedById) {
          await this.notifications
            .create({
              userId: v.proposedById,
              type: NotificationType.DEADLINE_RULE_ACTIVATED,
              title: 'Quy tắc đã hiệu lực',
              message: `Phiên bản đề xuất của bạn cho '${v.ruleKey}' đã được kích hoạt.`,
              link: `/admin/deadline-rules/version/${v.id}`,
              metadata: { ruleKey: v.ruleKey, versionId: v.id },
            })
            .catch((err) => this.logger.error(`activate notification failed: ${String(err)}`));
        }
      } catch (err) {
        this.logger.error(`Failed to activate version ${v.id}: ${String(err)}`);
      }
    }

    return { activated };
  }

  /**
   * Find submitted versions older than threshold and notify approvers. Called
   * by the daily stale-review cron.
   */
  async notifyStaleSubmissions(thresholdHours = 24, now: Date = new Date()): Promise<{ notified: string[] }> {
    const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
    const stale = await this.prisma.deadlineRuleVersion.findMany({
      where: { status: 'submitted' as DeadlineRuleStatus, proposedAt: { lte: cutoff } },
      include: { proposedBy: { select: { firstName: true, lastName: true, username: true } } },
    });
    const notified: string[] = [];
    for (const v of stale) {
      const approvers = await this.findActiveApproverIds();
      for (const approverId of approvers) {
        await this.notifications
          .create({
            userId: approverId,
            type: NotificationType.DEADLINE_RULE_STALE_REVIEW,
            title: 'Đề xuất chờ duyệt quá hạn',
            message: `Đề xuất cho '${v.ruleKey}' đã chờ duyệt hơn ${thresholdHours} giờ.`,
            link: `/admin/deadline-rules/version/${v.id}`,
            metadata: { ruleKey: v.ruleKey, versionId: v.id, hoursWaiting: thresholdHours },
          })
          .catch((err) => this.logger.error(`stale notification failed: ${String(err)}`));
      }
      await this.audit.log({
        action: DEADLINE_RULE_ACTIONS.STALE_REVIEW_NOTIFIED,
        subject: 'DeadlineRuleVersion',
        subjectId: v.id,
        metadata: { ruleKey: v.ruleKey, approverCount: approvers.length, thresholdHours },
      });
      notified.push(v.id);
    }
    return { notified };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private clampEffectiveFrom(date: Date): Date {
    const now = new Date();
    const maxFuture = new Date(now.getTime() + this.MAX_FUTURE_DAYS * 86400000);
    const minPast = new Date(now.getTime() - this.MAX_PAST_DAYS * 86400000);
    if (date > maxFuture) {
      throw new BadRequestException(`Ngày hiệu lực không được quá ${this.MAX_FUTURE_DAYS} ngày trong tương lai`);
    }
    if (date < minPast) {
      throw new BadRequestException(`Ngày hiệu lực không được lùi quá ${this.MAX_PAST_DAYS} ngày`);
    }
    return date;
  }

  private async findActiveApproverIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ['DEADLINE_APPROVER', 'ADMIN'] } },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async notifyApprovers(
    version: DeadlineRuleVersion,
    type: NotificationType,
    excludeUserId: string,
  ): Promise<void> {
    const approverIds = await this.findActiveApproverIds();
    const targets = approverIds.filter((id) => id !== excludeUserId);
    const title = 'Đề xuất quy tắc thời hạn mới chờ duyệt';
    const message = `Đề xuất cho '${version.ruleKey}' với giá trị ${version.value} đang chờ bạn duyệt.`;
    for (const userId of targets) {
      await this.notifications
        .create({
          userId,
          type,
          title,
          message,
          link: `/admin/deadline-rules/version/${version.id}`,
          metadata: { ruleKey: version.ruleKey, versionId: version.id, value: version.value },
        })
        .catch((err) => this.logger.error(`notifyApprovers failed: ${String(err)}`));
    }
  }

  private async notifyProposer(
    version: DeadlineRuleVersion,
    type: NotificationType,
    actorId: string,
  ): Promise<void> {
    if (!version.proposedById || version.proposedById === actorId) return;
    const titleByType: Partial<Record<NotificationType, string>> = {
      [NotificationType.DEADLINE_RULE_APPROVED]: 'Đề xuất đã được duyệt',
      [NotificationType.DEADLINE_RULE_ACTIVATED]: 'Đề xuất đã có hiệu lực',
      [NotificationType.DEADLINE_RULE_REJECTED]: 'Đề xuất bị từ chối',
    };
    const title = titleByType[type] ?? 'Đề xuất có cập nhật';
    await this.notifications
      .create({
        userId: version.proposedById,
        type,
        title,
        message: `Phiên bản của bạn cho '${version.ruleKey}' đã ${type === NotificationType.DEADLINE_RULE_REJECTED ? 'bị từ chối' : 'được duyệt'}.`,
        link: `/admin/deadline-rules/version/${version.id}`,
        metadata: { ruleKey: version.ruleKey, versionId: version.id },
      })
      .catch((err) => this.logger.error(`notifyProposer failed: ${String(err)}`));
  }
}

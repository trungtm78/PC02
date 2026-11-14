import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { hoTenCanBo } from '../../common/xuat-danh-sach/dinh-dang';
import { AggregateService } from '../aggregate/aggregate.service';
import { itemKeyOf } from '../aggregate/contributors';
import {
  normaliseDefinition,
  normaliseViewName,
  readStoredItemKeys,
  readStoredTeamIds,
  storedItemKeys,
  teamIdsOf,
  ViewError,
} from './report-view';
import type { ViewDefinitionInput } from './report-view';

/** Refusals of this feature, by code. The screen translates the code; no display text travels. */
export const VIEW_ERROR = {
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  VIEW_NOT_FOUND: 'VIEW_NOT_FOUND',
  VIEW_NAME_TAKEN: 'VIEW_NAME_TAKEN',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  VIEW_ARCHIVED: 'VIEW_ARCHIVED',
  VIEW_ALREADY_ARCHIVED: 'VIEW_ALREADY_ARCHIVED',
  VIEW_NOT_ARCHIVED: 'VIEW_NOT_ARCHIVED',
} as const;

export interface ViewActor {
  id: string;
  roleId: string;
}

export interface ReportViewDto {
  id: string;
  reportId: string;
  name: string;
  /** null = the title is made from the report and the period. */
  title: string | null;
  showFilterLine: boolean;
  /** null = every criterion. */
  itemKeys: string[] | null;
  /** null = every team of the period. */
  teamIds: string[] | null;
  teamColumns: boolean;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
}

export type ViewCreateInput = ViewDefinitionInput & { name?: string | null };
/** Only what is present is changed; `null` is a value (no title, every criterion, every team). */
export type ViewUpdateInput = ViewCreateInput & { expectedRevision: number };

type ViewRow = Prisma.DynReportViewGetPayload<object>;

/**
 * A refusal of the pure layer becomes a 400 carrying its code and, in `details`, the keys or ids it is about (the
 * field of an error body the global filter passes on to the screen).
 */
export function viewErrorToHttp(err: unknown): unknown {
  if (!(err instanceof ViewError)) return err;
  return new BadRequestException({ code: err.code, ...(err.unknown.length > 0 ? { details: err.unknown } : {}) });
}

/**
 * The custom reports ("views") saved on a dynamic report: create, edit, archive and restore, delete.
 *
 * For a manager or an admin of the report, exactly like exporting a period; anybody else is told "not found". Every
 * write takes the report row FOR UPDATE first: that is what makes "one name per report among the views in use" hold
 * when two people save at once, and what orders these writes with the deletion of the report. Each write leaves an
 * audit row in the same transaction (ids, names, counts; never figures).
 */
@Injectable()
export class ReportViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: AggregateService,
    private readonly audit: AuditService,
  ) {}

  async list(reportId: string, actor: ViewActor, includeArchived: boolean): Promise<ReportViewDto[]> {
    await this.assertManages(reportId, actor, VIEW_ERROR.REPORT_NOT_FOUND);
    const rows = await this.prisma.dynReportView.findMany({
      where: { reportId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    // In use first, archived after; by name inside each.
    return this.toDtos([...rows.filter((r) => r.archivedAt === null), ...rows.filter((r) => r.archivedAt !== null)]);
  }

  async create(reportId: string, actor: ViewActor, input: ViewCreateInput): Promise<ReportViewDto> {
    await this.assertManages(reportId, actor, VIEW_ERROR.REPORT_NOT_FOUND);
    const known = await this.knownItemKeys(reportId);
    const view = await this.checked(() => this.normalised(input, known));
    const name = this.checkedSync(() => normaliseViewName(input.name));

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockReport(tx, reportId, VIEW_ERROR.REPORT_NOT_FOUND);
      await this.assertNameFree(tx, reportId, name, null);
      const created = await tx.dynReportView.create({
        data: {
          reportId,
          name,
          title: view.title,
          showFilterLine: view.showFilterLine,
          itemKeys: storedItemKeys(view.itemKeys, known) ?? Prisma.DbNull,
          teamIds: teamIdsOf(view) ?? Prisma.DbNull,
          teamColumns: view.teamColumns,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      await this.log(tx, 'DYN_REPORT_VIEW_CREATE', actor, created);
      return created;
    });
    return (await this.toDtos([row]))[0];
  }

  async update(viewId: string, actor: ViewActor, input: ViewUpdateInput): Promise<ReportViewDto> {
    const found = await this.findManaged(viewId, actor);
    const known = input.itemKeys === undefined ? [] : await this.knownItemKeys(found.reportId);
    const askedTeamIds = teamIdsOf(input);
    // Only what was sent is checked and changed: a stored selection is never re-judged by a rename.
    const view = await this.checked(() =>
      this.normalised({ title: input.title, itemKeys: input.itemKeys === undefined ? null : input.itemKeys, teamIds: askedTeamIds }, known),
    );
    const name = input.name === undefined ? undefined : this.checkedSync(() => normaliseViewName(input.name));

    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedView(tx, found.reportId, viewId);
      if (current.revision !== input.expectedRevision) throw new ConflictException({ code: VIEW_ERROR.REVISION_CONFLICT });
      if (current.archivedAt !== null) throw new ConflictException({ code: VIEW_ERROR.VIEW_ARCHIVED });
      if (name !== undefined && name !== current.name) await this.assertNameFree(tx, found.reportId, name, viewId);
      const updated = await tx.dynReportView.update({
        where: { id: viewId },
        data: {
          ...(name === undefined ? {} : { name }),
          ...(input.title === undefined ? {} : { title: view.title }),
          ...(typeof input.showFilterLine === 'boolean' ? { showFilterLine: input.showFilterLine } : {}),
          ...(input.itemKeys === undefined ? {} : { itemKeys: storedItemKeys(view.itemKeys, known) ?? Prisma.DbNull }),
          ...(askedTeamIds === undefined ? {} : { teamIds: teamIdsOf(view) ?? Prisma.DbNull }),
          ...(typeof input.teamColumns === 'boolean' ? { teamColumns: input.teamColumns } : {}),
          revision: { increment: 1 },
          updatedById: actor.id,
        },
      });
      await this.log(tx, 'DYN_REPORT_VIEW_UPDATE', actor, updated);
      return updated;
    });
    return (await this.toDtos([row]))[0];
  }

  /** Out of the working list; its name becomes free. Nothing is lost: `restore` brings it back. */
  async archive(viewId: string, actor: ViewActor): Promise<ReportViewDto> {
    const found = await this.findManaged(viewId, actor);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedView(tx, found.reportId, viewId);
      if (current.archivedAt !== null) throw new ConflictException({ code: VIEW_ERROR.VIEW_ALREADY_ARCHIVED });
      const updated = await tx.dynReportView.update({
        where: { id: viewId },
        data: { archivedAt: new Date(), revision: { increment: 1 }, updatedById: actor.id },
      });
      await this.log(tx, 'DYN_REPORT_VIEW_ARCHIVE', actor, updated);
      return updated;
    });
    return (await this.toDtos([row]))[0];
  }

  async restore(viewId: string, actor: ViewActor): Promise<ReportViewDto> {
    const found = await this.findManaged(viewId, actor);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedView(tx, found.reportId, viewId);
      if (current.archivedAt === null) throw new ConflictException({ code: VIEW_ERROR.VIEW_NOT_ARCHIVED });
      // Its name may have been taken while it was away: the one in use has to be renamed (or removed) first.
      await this.assertNameFree(tx, found.reportId, current.name, viewId);
      const updated = await tx.dynReportView.update({
        where: { id: viewId },
        data: { archivedAt: null, revision: { increment: 1 }, updatedById: actor.id },
      });
      await this.log(tx, 'DYN_REPORT_VIEW_RESTORE', actor, updated);
      return updated;
    });
    return (await this.toDtos([row]))[0];
  }

  /** Gone for good. A view has nothing under it (a file already exported is its own row and expires by itself). */
  async remove(viewId: string, actor: ViewActor, expectedRevision?: number): Promise<{ deleted: true; id: string }> {
    const found = await this.findManaged(viewId, actor);
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedView(tx, found.reportId, viewId);
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw new ConflictException({ code: VIEW_ERROR.REVISION_CONFLICT });
      }
      await tx.dynReportView.delete({ where: { id: viewId } });
      await this.log(tx, 'DYN_REPORT_VIEW_DELETE', actor, current);
    });
    return { deleted: true, id: viewId };
  }

  // ---- shared

  /** A manager or an admin of the report, and the report exists; otherwise "not found", whichever it is. */
  private async assertManages(reportId: string, actor: ViewActor, code: string): Promise<void> {
    const report = await this.prisma.dynReport.findUnique({ where: { id: reportId }, select: { id: true } });
    const role = report ? await this.aggregate.accessRoleFor(reportId, actor.id, actor.roleId) : null;
    if (!report || !role || role.role === 'VIEWER') throw new NotFoundException({ code });
  }

  private async findManaged(viewId: string, actor: ViewActor): Promise<ViewRow> {
    const view = await this.prisma.dynReportView.findUnique({ where: { id: viewId } });
    if (!view) throw new NotFoundException({ code: VIEW_ERROR.VIEW_NOT_FOUND });
    await this.assertManages(view.reportId, actor, VIEW_ERROR.VIEW_NOT_FOUND);
    return view;
  }

  private async lockReport(tx: Prisma.TransactionClient, reportId: string, code: string): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM dyn_reports WHERE id = ${reportId} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundException({ code });
  }

  /** The view as it is NOW, read under the report lock every write of this service takes. */
  private async lockedView(tx: Prisma.TransactionClient, reportId: string, viewId: string): Promise<ViewRow> {
    await this.lockReport(tx, reportId, VIEW_ERROR.VIEW_NOT_FOUND);
    const view = await tx.dynReportView.findUnique({ where: { id: viewId } });
    if (!view) throw new NotFoundException({ code: VIEW_ERROR.VIEW_NOT_FOUND });
    return view;
  }

  private async assertNameFree(tx: Prisma.TransactionClient, reportId: string, name: string, exceptId: string | null): Promise<void> {
    const taken = await tx.dynReportView.findFirst({
      where: { reportId, name, archivedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (taken) throw new ConflictException({ code: VIEW_ERROR.VIEW_NAME_TAKEN });
  }

  /**
   * Every item key the report has had, the newest version's first (in the order of its rows), then the ones only
   * older versions have: a view may be built on an older period, and may keep a criterion a newer version dropped.
   */
  private async knownItemKeys(reportId: string): Promise<string[]> {
    const versions = await this.prisma.dynReportVersion.findMany({
      where: { reportId },
      orderBy: { version: 'desc' },
      select: { fields: { select: { fieldKey: true, itemKey: true, sheetKey: true, address: true } } },
    });
    const rowOf = (address: string) => Number(/\d+$/.exec(address)?.[0] ?? 0);
    const keys = new Set<string>();
    for (const version of versions) {
      const ordered = [...version.fields].sort(
        (a, b) => a.sheetKey.localeCompare(b.sheetKey) || rowOf(a.address) - rowOf(b.address) || a.address.localeCompare(b.address),
      );
      for (const field of ordered) keys.add(itemKeyOf(field));
    }
    return [...keys];
  }

  /** The definition part, checked against the report's criteria and against the teams that exist. */
  private async normalised(input: ViewDefinitionInput, knownItemKeys: readonly string[]) {
    const given = teamIdsOf(input);
    const asked = Array.isArray(given) ? [...new Set(given)] : [];
    const existing =
      asked.length > 0
        ? (await this.prisma.team.findMany({ where: { id: { in: asked } }, select: { id: true } })).map((t) => t.id)
        : [];
    return normaliseDefinition(input, knownItemKeys, existing);
  }

  private async checked<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw viewErrorToHttp(err);
    }
  }

  private checkedSync<T>(fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      throw viewErrorToHttp(err);
    }
  }

  private log(tx: Prisma.TransactionClient, action: string, actor: ViewActor, view: ViewRow): Promise<void> {
    const selected = readStoredItemKeys(view.itemKeys).selected;
    const teams = readStoredTeamIds(teamIdsOf(view));
    return this.audit.log(
      {
        userId: actor.id,
        action,
        subject: 'DynReportView',
        subjectId: view.id,
        // Metadata only: which view, how many criteria and teams it names. Never a figure.
        metadata: {
          reportId: view.reportId,
          name: view.name,
          criteria: selected === null ? 'ALL' : selected.length,
          teams: teams === null ? 'ALL' : teams.length,
          revision: view.revision,
        },
      },
      tx,
    );
  }

  private async toDtos(rows: ViewRow[]): Promise<ReportViewDto[]> {
    const userIds = [...new Set(rows.flatMap((r) => [r.createdById, r.updatedById]))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, username: true },
        })
      : [];
    const person = (id: string) => {
      const user = users.find((u) => u.id === id);
      return user ? { id, name: hoTenCanBo(user) } : null;
    };
    return rows.map((r) => ({
      id: r.id,
      reportId: r.reportId,
      name: r.name,
      title: r.title,
      showFilterLine: r.showFilterLine,
      itemKeys: readStoredItemKeys(r.itemKeys).selected,
      teamIds: readStoredTeamIds(teamIdsOf(r)),
      teamColumns: r.teamColumns,
      revision: r.revision,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      createdBy: person(r.createdById),
      updatedBy: person(r.updatedById),
    }));
  }
}

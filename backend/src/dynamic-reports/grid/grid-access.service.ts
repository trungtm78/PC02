import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { enforcement } from '../../authz/enforcement';
import { ownedKeys } from '../aggregate/contributors';

/**
 * Who may read a report version's grid model.
 *
 * The model is the template as the officers see it — headings, labels, the
 * layout of every figure — so it follows the same boundary as the rest of the
 * module (spec §10 R13, AC-012/AC-035): not the app-wide DataScope, but
 *   - `admin:DynamicReport` or `manage:DynamicReport` (any version, drafts too),
 *   - an active manager or viewer of the version's report,
 *   - an active editor of an assignment whose period uses this version.
 * Drafts are visible only to the first group. Anyone else gets the same
 * answer as for a version that does not exist (the caller maps `false` to 404).
 */
export type GridReadScope =
  | { kind: 'NONE' }
  | { kind: 'ALL' }
  | {
      kind: 'OWNED';
      ownedFieldKeys: string[];
      fields: { sheetKey: string; address: string; fieldKey: string }[];
      /** The workbook was generated from a list of criteria: one criterion per row. */
      criteriaRows: boolean;
    };
const NONE: GridReadScope = { kind: 'NONE' };
const ALL: GridReadScope = { kind: 'ALL' };

@Injectable()
export class GridAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canReadVersion(userId: string, roleId: string, versionId: string): Promise<boolean> {
    return (await this.readScope(userId, roleId, versionId)).kind !== 'NONE';
  }

  /**
   * What of a version's grid the caller may see. A manager, viewer or admin sees all of it. Someone who is only an
   * editor sees what the team reports IN THE ASSIGNMENT THE GRID IS OPENED FOR (`assignmentId`, sent by the entry
   * screen): a criterion taken away from the team in the running period is gone from that period's grid although the
   * team still has it in periods that have not opened. With no assignment named the editor gets only what every one
   * of their assignments on this version owns. The controller removes the rest from the grid.
   */
  async readScope(userId: string, roleId: string, versionId: string, assignmentId?: string): Promise<GridReadScope> {
    const version = await this.prisma.dynReportVersion.findUnique({
      where: { id: versionId },
      select: { id: true, reportId: true, status: true, sourceKind: true },
    });
    if (!version) return NONE;

    // One role query for "admin OR manage" when the role decides; what the person holds answers both when enforced.
    const held = enforcement()?.keysOf(userId);
    const privileged = held
      ? held.includes('admin:DynamicReport') || held.includes('manage:DynamicReport')
      : Boolean(
          await this.prisma.rolePermission.findFirst({
            where: {
              roleId,
              permission: { subject: 'DynamicReport', action: { in: ['admin', 'manage'] } },
            },
            select: { roleId: true },
          }),
        );
    if (privileged) return ALL;

    if (version.status === 'DRAFT') return NONE;

    const now = new Date();
    const reportRole = await this.prisma.dynReportRole.findFirst({
      where: {
        reportId: version.reportId,
        userId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { id: true },
    });
    if (reportRole) return ALL;

    const editing = await this.prisma.dynReportAssignmentEditor.findMany({
      where: {
        userId,
        isActive: true,
        // The assignment the grid is opened for, when the caller names one: it must be theirs and of this version.
        ...(assignmentId ? { assignmentId } : {}),
        assignment: { period: { versionId } },
      },
      select: { assignment: { select: { ownedFieldKeys: true } } },
    });
    if (editing.length === 0) return NONE;
    // null = that assignment owns every field: it narrows nothing.
    const subsets = editing.map((e) => ownedKeys(e.assignment)).filter((keys): keys is readonly string[] => keys !== null);
    if (subsets.length === 0) return ALL;

    // Named: the one subset. Not named: what EVERY assignment of the caller owns, so the answer can never hold a
    // criterion that one of their teams (or one of their periods) was not given.
    const ownedFieldKeys = subsets.reduce<string[]>(
      (common, keys) => common.filter((key) => keys.includes(key)),
      [...new Set(subsets[0])],
    );
    const fields = await this.prisma.dynReportField.findMany({
      where: { versionId },
      select: { sheetKey: true, address: true, fieldKey: true },
    });
    return { kind: 'OWNED', ownedFieldKeys, fields, criteriaRows: version.sourceKind === 'CRITERIA' };
  }
}

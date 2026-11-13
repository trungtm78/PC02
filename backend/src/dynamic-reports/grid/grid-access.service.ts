import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { enforcement } from '../../authz/enforcement';

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
   * editor sees what their team reports: every field when one of their assignments on this version has no subset,
   * otherwise the union of the subsets of their assignments (the controller then removes the rest from the grid).
   */
  async readScope(userId: string, roleId: string, versionId: string): Promise<GridReadScope> {
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
        assignment: { period: { versionId } },
      },
      select: { assignment: { select: { ownedFieldKeys: true } } },
    });
    if (editing.length === 0) return NONE;
    const subsets = editing.map((e) => e.assignment.ownedFieldKeys);
    if (subsets.some((keys) => !Array.isArray(keys))) return ALL;

    const ownedFieldKeys = [...new Set(subsets.flatMap((keys) => keys as string[]))];
    const fields = await this.prisma.dynReportField.findMany({
      where: { versionId },
      select: { sheetKey: true, address: true, fieldKey: true },
    });
    return { kind: 'OWNED', ownedFieldKeys, fields, criteriaRows: version.sourceKind === 'CRITERIA' };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
@Injectable()
export class GridAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canReadVersion(userId: string, roleId: string, versionId: string): Promise<boolean> {
    const version = await this.prisma.dynReportVersion.findUnique({
      where: { id: versionId },
      select: { id: true, reportId: true, status: true },
    });
    if (!version) return false;

    const privileged = await this.prisma.rolePermission.findFirst({
      where: {
        roleId,
        permission: { subject: 'DynamicReport', action: { in: ['admin', 'manage'] } },
      },
      select: { roleId: true },
    });
    if (privileged) return true;

    if (version.status === 'DRAFT') return false;

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
    if (reportRole) return true;

    const editor = await this.prisma.dynReportAssignmentEditor.findFirst({
      where: {
        userId,
        isActive: true,
        assignment: { period: { versionId } },
      },
      select: { id: true },
    });
    return !!editor;
  }
}

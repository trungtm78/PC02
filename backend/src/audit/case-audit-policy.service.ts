import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { CaseFieldSchemaService } from '../cases/governance/case-field-schema.service';
type Link = { auditId: string; caseId: string };
@Injectable()
export class CaseAuditPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
    private readonly fields: CaseFieldSchemaService,
  ) {}
  async links(): Promise<Link[]> {
    if (!this.prisma.$queryRaw) return [];
    return (
      (await this.prisma.$queryRaw<Link[]>`
    /* case_audit_links: every current or recorded Case parent is a visibility prerequisite. */
    SELECT DISTINCT audit.id AS "auditId", links."caseId"
    FROM audit_logs audit
    LEFT JOIN documents doc ON audit.subject='Document' AND doc.id=audit."subjectId"
    LEFT JOIN evidences ev ON audit.subject='Evidence' AND ev.id=audit."subjectId"
    LEFT JOIN subjects subj ON audit.subject='Subject' AND subj.id=audit."subjectId"
    LEFT JOIN lawyers lawyer ON audit.subject='Lawyer' AND lawyer.id=audit."subjectId"
    LEFT JOIN conclusions conclusion ON audit.subject='Conclusion' AND conclusion.id=audit."subjectId"
    LEFT JOIN delegations delegation ON audit.subject='Delegation' AND delegation.id=audit."subjectId"
    LEFT JOIN case_statistics statistic ON audit.subject='CaseStatistic' AND statistic.id=audit."subjectId"
    CROSS JOIN LATERAL (
      SELECT unnest(ARRAY[
        CASE WHEN audit.subject='Case' THEN audit."subjectId" END,
        doc."caseId", ev."caseId", subj."caseId", lawyer."caseId", conclusion."caseId", delegation."relatedCaseId", statistic."caseId"
      ]) AS "caseId"
      UNION ALL SELECT jsonb_array_elements_text(
        COALESCE(jsonb_path_query_array(audit.metadata,'$.**.caseId'),'[]'::jsonb) ||
        COALESCE(jsonb_path_query_array(audit.metadata,'$.**.sourceCaseId'),'[]'::jsonb) ||
        COALESCE(jsonb_path_query_array(audit.metadata,'$.**.targetCaseId'),'[]'::jsonb) ||
        COALESCE(jsonb_path_query_array(audit.metadata,'$.**.linkedCaseId'),'[]'::jsonb) ||
        COALESCE(jsonb_path_query_array(audit.metadata,'$.**.relatedCaseId'),'[]'::jsonb) ||
        COALESCE(jsonb_path_query_array(audit.metadata,'$.**.caseIds[*]'),'[]'::jsonb)
      )
    ) links
    WHERE links."caseId" IS NOT NULL
  `) ?? []
    );
  }
  async predicate(actorId?: string): Promise<Prisma.AuditLogWhereInput> {
    let allowed: string[] = [];
    if (actorId) {
      try {
        const where = await this.core.readableCaseWhere(
          this.prisma,
          { actorId },
          { includeDeleted: true, representationCapability: 'view' },
        );
        allowed = (
          await this.prisma.case.findMany({ where, select: { id: true } })
        ).map((c) => c.id);
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    const links = await this.links(),
      visible = new Set(allowed),
      denied = new Set(
        links.filter((x) => !visible.has(x.caseId)).map((x) => x.auditId),
      );
    const related = [
      ...new Set(
        links.filter((x) => !denied.has(x.auditId)).map((x) => x.auditId),
      ),
    ];
    return {
      AND: [
        { id: { notIn: [...denied] } },
        {
          OR: [
            { subject: 'Case', subjectId: { in: allowed } },
            {
              AND: [
                { OR: [{ subject: { not: 'Case' } }, { subject: null }] },
                {
                  OR: [
                    { action: { not: { startsWith: 'CASE_' } } },
                    { id: { in: related } },
                    {
                      subject: {
                        in: [
                          'User',
                          'Role',
                          'Permission',
                          'CaseRuleVersion',
                          'CaseFieldDefinitionVersion',
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }
  async sanitize<
    T extends {
      id: string;
      subject: string | null;
      subjectId: string | null;
      metadata: unknown;
    },
  >(row: T, actorId?: string, purpose: 'read' | 'export' = 'read'): Promise<T> {
    const links = (await this.links())
      .filter((x) => x.auditId === row.id)
      .map((x) => x.caseId);
    if (row.subject === 'Case' && row.subjectId) links.push(row.subjectId);
    if (!links.length) {
      if (row.subject === 'Case')
        throw new ForbiddenException(
          'Case audit must have an authorized parent',
        );
      return row;
    }
    if (!actorId)
      throw new ForbiddenException('Authenticated Case audit actor required');
    let result = row;
    for (const caseId of [...new Set(links)]) {
      const where = await this.core.readableCaseWhere(
        this.prisma,
        { actorId },
        { includeDeleted: true, representationCapability: 'view' },
      );
      const record = await this.prisma.case.findFirst({
        where: { AND: [where, { id: caseId }] },
      });
      if (!record)
        throw new ForbiddenException('Case audit parent is not accessible');
      const sanitized = await this.fields.filterCustomFields(
        { ...record, metadata: result.metadata },
        { actorId },
        this.prisma,
        purpose,
      );
      result = { ...result, metadata: sanitized.metadata };
    }
    return result;
  }
}

import {
  PrismaClient,
  CaseInvestigationPhase,
  CaseStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { CaseGovernanceService } from './case-governance.service';
import { CaseConfigurationService } from './case-configuration.service';
import { LegalWorkflowService } from './legal-workflow.service';
import { CaseOutboxWorker } from './case-outbox.worker';
import { CaseFieldSchemaService } from './case-field-schema.service';
import { CASE_ACTION_CATALOG } from './legal-action.catalog';
import { CaseEvidenceGovernanceService } from '../evidence-governance/evidence-governance.service';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ActionVersion } from './legal-workflow.service';

const connection = process.env.CASE_GOVERNANCE_UAT_DATABASE_URL;
if (connection) {
  const url = new URL(connection);
  if (
    url.hostname !== '127.0.0.1' ||
    url.port !== '55441' ||
    url.pathname !== '/pc02_case_governance_uat' ||
    url.username !== 'pc02_uat'
  )
    throw new Error('Private synthetic Case governance database required');
}
const suite = connection ? describe : describe.skip;
suite(
  'CG04–10/16 private PostgreSQL legal workflow (synthetic sources only)',
  () => {
    jest.setTimeout(120000);
    let db: PrismaClient,
      core: CaseGovernanceService,
      config: CaseConfigurationService,
      legal: LegalWorkflowService;
    let teamId: string,
      authorId: string,
      reviewerId: string,
      publisherId: string,
      ruleId: string;
    const run = 'legal-' + randomUUID();
    const sources = [
      {
        id:'synthetic-deadline-law',
        instrument: 'SYNTHETIC TEST ONLY — no statutory certification',
        provision: 'TEST-1',
        url: 'https://example.test/synthetic-provision',
        authority: 'Synthetic competent test authority',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2030-01-01',
      },
    ];
    function deadlineFor(code:string){const phase=({RESTORE_SUSPENDED:'RESTORED',SUPPLEMENT_AFTER_CONCLUSION:'SUPPLEMENTARY',REINVESTIGATE_AFTER_CONCLUSION:'REINVESTIGATION',REINVESTIGATE_AFTER_SUPPLEMENT:'REINVESTIGATION'} as Record<string,string>)[code];return !phase?{mode:'PRESERVE'}:{mode:'CALCULATE',algorithm:'CIVIL_PERIOD',version:1,phase,anchors:phase==='RESTORED'?{restoration:'payload.deadlineFacts.restoration'}:{dossierReceipt:'payload.deadlineFacts.dossierReceipt',requestReceipt:'payload.deadlineFacts.requestReceipt'},gravityPath:'payload.deadlineFacts.gravity',...(phase==='SUPPLEMENTARY'?{authorityPath:'payload.deadlineFacts.authority'}:{}),durations:[{gravity:'IT_NGHIEM_TRONG',...(phase==='SUPPLEMENTARY'?{authority:'VKS'}:{}),value:1,unit:'MONTHS'}],calendar:{id:'synthetic-calendar',version:'1',effectiveFrom:'2026-01-01',effectiveTo:'2030-01-01',weekendDays:[0,6],nonworkingDates:[],workingOverrides:[],sourceReferenceIds:['synthetic-deadline-law']},sourceReferenceIds:['synthetic-deadline-law']};}
    beforeAll(async () => {
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: connection! }),
      });
      await db.$connect();
      if (
        !(
          await db.featureFlag.findUnique({
            where: { key: 'CASE_GOVERNANCE_V1' },
          })
        )?.enabled
      )
        throw new Error(
          'Root must enable private test flag once; this suite never toggles flags',
        );
      core = new CaseGovernanceService(db as never);
      config = new CaseConfigurationService(db as never, core);
      legal = new LegalWorkflowService(
        db as never,
        core,
        undefined,
        new CaseEvidenceGovernanceService(db as never, core,new CaseFieldSchemaService(db as never,core)),
      );
      teamId = (await db.team.create({ data: { name: run, code: run } })).id;
      async function actor(suffix: string, caps: string[]) {
        const role = await db.role.create({
          data: { name: run + '-' + suffix },
        });
        for (const [subject, action] of [
          ['Case', 'read'],
          ['Case', 'edit'],
          ...caps.map((c) => ['CaseGovernance', c]),
        ]) {
          const permission = await db.permission.upsert({
            where: { action_subject: { action, subject } },
            create: { action, subject },
            update: {},
          });
          await db.rolePermission.create({
            data: { roleId: role.id, permissionId: permission.id },
          });
        }
        const user = await db.user.create({
          data: {
            username: run + '-' + suffix,
            passwordHash: 'synthetic-disabled-login',
            roleId: role.id,
            isActive: true,
            twoFaSetupRequired: true,
          },
        });
        await db.userTeam.create({ data: { userId: user.id, teamId } });
        return user.id;
      }
      authorId = await actor('author', ['operate']);
      reviewerId = await actor('reviewer', ['review', 'operate']);
      publisherId = await actor('publisher', ['publish']);
      let rule = (
        await config.create(
          'rules',
          {
            code: run,
            requestKey: 'draft',
            effectiveFrom: '2026-01-01',
            effectiveTo: '2030-01-01',
            definition: {
              actions: CASE_ACTION_CATALOG.map((a) => ({
                code: a.code,
                legalSources: sources,
                deadlineEffect:deadlineFor(a.code),
              })),
            },
          },
          { actorId: authorId },
        )
      ).data;
      rule = (
        await config.transition(
          'rules',
          rule.id,
          'validate',
          {
            expectedUpdatedAt: rule.updatedAt.toISOString(),
            expectedRevision: rule.revision,
          },
          { actorId: authorId },
        )
      ).data as typeof rule;
      rule = (
        await config.transition(
          'rules',
          rule.id,
          'review',
          {
            expectedUpdatedAt: (
              await db.caseRuleVersion.findUniqueOrThrow({
                where: { id: rule.id },
              })
            ).updatedAt.toISOString(),
            expectedRevision: rule.revision,
          },
          { actorId: reviewerId },
        )
      ).data as typeof rule;
      const current = await db.caseRuleVersion.findUniqueOrThrow({
        where: { id: rule.id },
      });
      await config.transition(
        'rules',
        rule.id,
        'publish',
        {
          expectedUpdatedAt: current.updatedAt.toISOString(),
          expectedRevision: current.revision,
        },
        { actorId: publisherId },
      );
      ruleId = rule.id;
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function fixture(code: string) {
      const action = CASE_ACTION_CATALOG.find((a) => a.code === code)!;
      const record = await db.case.create({
        data: {
          name: run + ' ' + code,
          assignedTeamId: teamId,
          createdById: authorId,
          caseProvenance: 'DIRECT_DISCOVERY',
          status: action.source.status as CaseStatus,
          investigationPhase: action.source
            .phase as CaseInvestigationPhase | null,
          ngayKhoiTo: new Date('2026-01-01'),
        },
      });
      const root = join(process.cwd(), 'uploads', 'documents'),
        fileName = run + '-' + randomUUID() + '.txt',
        bytes = Buffer.from(
          'SYNTHETIC TEST signed facts reference; no real dossier or statutory certification.',
        );
      await mkdir(root, { recursive: true });
      await writeFile(join(root, fileName), bytes, { flag: 'wx' });
      const doc = await db.document.create({
        data: {
          title: 'Synthetic signed-decision test reference',
          fileName,
          originalName: fileName,
          mimeType: 'text/plain',
          size: bytes.length,
          filePath: join(root, fileName),
          caseId: record.id,
          uploadedById: authorId,
        },
      });
      const target = await db.case.create({
        data: {
          name: run + ' target',
          assignedTeamId: teamId,
          createdById: authorId,
          caseProvenance: 'DIRECT_DISCOVERY',
        },
      });
      return { record, doc, target };
    }
    async function version(
      caseId: string,
      requestId: string,
    ): Promise<ActionVersion> {
      const record = await db.case.findUniqueOrThrow({ where: { id: caseId } }),
        request = await db.caseActionRequest.findUniqueOrThrow({
          where: { id: requestId },
        });
      return {
        requestKey: randomUUID(),
        expectedUpdatedAt: record.updatedAt.toISOString(),
        expectedAggregateUpdatedAt: request.updatedAt.toISOString(),
        expectedRevision: request.revision,
      };
    }
    async function approved(
      caseId: string,
      documentId: string,
      code: string,
      targetCaseId: string,
    ) {
      const record = await db.case.findUniqueOrThrow({ where: { id: caseId } });
      const payload = {
        decision: {
          type: code,
          number: 'SYNTHETIC-' + randomUUID(),
          date: '2026-10-01',
          effectiveDate: '2026-10-02',
          issuer: 'Synthetic authority',
          signatory: 'Synthetic signatory',
          legalBasis: 'Specific synthetic provision',
          sourceDocumentId: documentId,
        },
        destinationAgency: 'Synthetic external agency',
        targetCaseId,
        expirationEvaluation: 'EXPIRED_VERIFIED',
        deadlineFacts:{restoration:{date:'2026-10-01',quality:'VERIFIED'},dossierReceipt:{date:'2026-10-01',quality:'VERIFIED'},requestReceipt:{date:'2026-10-02',quality:'VERIFIED'},gravity:'IT_NGHIEM_TRONG',authority:'VKS'},
      };
      const request = (
        await legal.create(
          caseId,
          {
            requestKey: randomUUID(),
            expectedUpdatedAt: record.updatedAt.toISOString(),
            actionCode: code,
            ruleVersionId: ruleId,
            payload,
          },
          { actorId: authorId },
        )
      ).data;
      await legal.submit(
        caseId,
        request.id,
        { ...(await version(caseId, request.id)), reviewerId },
        { actorId: authorId },
      );
      await expect(
        legal.review(
          caseId,
          request.id,
          {
            ...(await version(caseId, request.id)),
            approve: true,
            note: 'Attempt self-review',
          },
          { actorId: authorId },
        ),
      ).rejects.toThrow();
      await legal.review(
        caseId,
        request.id,
        {
          ...(await version(caseId, request.id)),
          approve: true,
          note: 'Synthetic source/authority checked independently',
        },
        { actorId: reviewerId },
      );
      return request.id;
    }
    it.each(CASE_ACTION_CATALOG)(
      '$legacyId $code exact transaction, history, immutable source and same-key replay',
      async (action) => {
        const { record, doc, target } = await fixture(action.code);
        if (action.code === 'DISCONTINUE_EXPIRED') {
          const evaluation = await approved(
            record.id,
            doc.id,
            'REVIEW_EXPIRY',
            target.id,
          );
          await legal.execute(
            record.id,
            evaluation,
            await version(record.id, evaluation),
            { actorId: authorId },
          );
        }
        const id = await approved(record.id, doc.id, action.code, target.id),
          dto = await version(record.id, id);
        const result = await legal.execute(record.id, id, dto, {
          actorId: authorId,
        });
        const replay = await legal.execute(record.id, id, dto, {
          actorId: authorId,
        });
        expect(replay).toEqual(result);
        const current = await db.case.findUniqueOrThrow({
          where: { id: record.id },
        });
        expect(current.status).toBe(action.target.status);
        expect(current.investigationPhase).toBe(action.target.phase);
        expect(current.id).toBe(record.id);
        expect(await db.caseDecision.count({ where: { requestId: id } })).toBe(
          1,
        );
        expect(
          await db.caseGovernanceOperation.count({
            where: {
              caseId: record.id,
              operation: 'LEGAL_ACTION_EXECUTE',
              requestKey: dto.requestKey,
            },
          }),
        ).toBe(1);
        expect(
          await db.document.findUnique({ where: { id: doc.id } }),
        ).toMatchObject({ caseId: record.id });
        expect(
          await db.caseGovernanceOutbox.count({ where: { caseId: record.id } }),
        ).toBeGreaterThan(0);
        if (action.resultType === 'MERGE')
          expect(
            await db.caseRelation.findFirst({
              where: {
                sourceCaseId: record.id,
                targetCaseId: target.id,
                type: 'MERGE',
              },
            }),
          ).not.toBeNull();
      },
    );
    it('injected audit fault rolls back decision, Case, history, request and outbox', async () => {
      const { record, doc, target } = await fixture('CONCLUDE_INITIAL'),
        id = await approved(record.id, doc.id, 'CONCLUDE_INITIAL', target.id),
        dto = await version(record.id, id);
      const before = await db.case.findUniqueOrThrow({
          where: { id: record.id },
        }),
        outbox = await db.caseGovernanceOutbox.count({
          where: { caseId: record.id },
        });
      const original = core.recordEvent.bind(core);
      core.recordEvent = async () => {
        throw new Error('SYNTHETIC injected audit fault');
      };
      try {
        await expect(
          legal.execute(record.id, id, dto, { actorId: authorId }),
        ).rejects.toThrow('injected audit fault');
      } finally {
        core.recordEvent = original;
      }
      expect(await db.caseDecision.count({ where: { requestId: id } })).toBe(0);
      expect(
        await db.caseStatusHistory.count({ where: { caseId: record.id } }),
      ).toBe(0);
      expect(
        (await db.case.findUniqueOrThrow({ where: { id: record.id } }))
          .updatedAt,
      ).toEqual(before.updatedAt);
      expect(
        (await db.caseActionRequest.findUniqueOrThrow({ where: { id } }))
          .status,
      ).toBe('APPROVED');
      expect(
        await db.caseGovernanceOutbox.count({ where: { caseId: record.id } }),
      ).toBe(outbox);
    });
    it('outbox real lease processing is internal and deduplicated', async () => {
      const { record, doc, target } = await fixture('CONCLUDE_INITIAL'),
        id = await approved(record.id, doc.id, 'CONCLUDE_INITIAL', target.id);
      await legal.execute(record.id, id, await version(record.id, id), {
        actorId: authorId,
      });
      const row = await db.caseGovernanceOutbox.findFirstOrThrow({
          where: { caseId: record.id, recipientId: reviewerId },
        }),
        token = randomUUID();
      await db.caseGovernanceOutbox.update({
        where: { id: row.id },
        data: {
          status: 'PROCESSING',
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 60000),
        },
      });
      const worker = new CaseOutboxWorker(db as never, core);
      expect(await worker.deliver(row.id, token)).toBe(true);
      expect(await worker.deliver(row.id, token)).toBe(false);
      expect(
        await db.notification.count({
          where: { id: 'case-governance-' + row.id },
        }),
      ).toBe(1);
    });
    it('published native/custom field policies deny leaks, spoofed writes and token/count/export inference; scoped grant expiry enforced', async () => {
      let schema = (
        await config.create(
          'fields',
          {
            code: run + '-fields',
            requestKey: 'field-draft',
            definition: {
              fields: [
                {
                  key: 'custom_private',
                  label: 'Private',
                  type: 'text',
                  required: false,
                  sensitivity: 'RESTRICTED',
                },
                {
                  key: 'custom_count',
                  label: 'Count',
                  type: 'number',
                  required: false,
                },
              ],
              fieldPolicies: [
                { key: 'description', sensitivity: 'RESTRICTED' },
                { key: 'sdtCungCap', sensitivity: 'RESTRICTED' },
                { key: 'cccdCungCap', sensitivity: 'RESTRICTED' },
                {
                  key: 'statistic.soTienBiThietHai',
                  sensitivity: 'RESTRICTED',
                },
              ],
            },
          },
          { actorId: authorId },
        )
      ).data;
      await config.transition(
        'fields',
        schema.id,
        'validate',
        {
          expectedUpdatedAt: schema.updatedAt.toISOString(),
          expectedRevision: schema.revision,
        },
        { actorId: authorId },
      );
      schema = await db.caseFieldDefinitionVersion.findUniqueOrThrow({
        where: { id: schema.id },
      });
      await config.transition(
        'fields',
        schema.id,
        'review',
        {
          expectedUpdatedAt: schema.updatedAt.toISOString(),
          expectedRevision: schema.revision,
        },
        { actorId: reviewerId },
      );
      schema = await db.caseFieldDefinitionVersion.findUniqueOrThrow({
        where: { id: schema.id },
      });
      await config.transition(
        'fields',
        schema.id,
        'publish',
        {
          expectedUpdatedAt: schema.updatedAt.toISOString(),
          expectedRevision: schema.revision,
        },
        { actorId: publisherId },
      );
      const record = await db.case.create({
          data: {
            name: run + ' field policy',
            caseProvenance: 'DIRECT_DISCOVERY',
            createdById: authorId,
            assignedTeamId: teamId,
            fieldDefinitionVersionId: schema.id,
            sdtCungCap: 'SYNTHETIC-PRIVATE-PHONE',
            cccdCungCap: 'SYNTHETIC-PRIVATE-ID',
            metadata: {
              reporterIdNumber: 'SYNTHETIC-PRIVATE-ID',
              damageAmount: 999,
              legacyRaw: { old_phone: 'SYNTHETIC-PRIVATE-PHONE' },
              _customFields: {
                custom_private: 'SYNTHETIC-PRIVATE-CUSTOM',
                custom_count: 0,
              },
            },
            statistic: { create: { soTienBiThietHai: 999 } },
          },
        }),
        field = new CaseFieldSchemaService(db as never, core),
        hydrated = await db.case.findUniqueOrThrow({
          where: { id: record.id },
          include: { statistic: true },
        });
      expect(
        JSON.stringify(
          await field.filterCustomFields(hydrated, { actorId: authorId }),
        ),
      ).not.toContain('SYNTHETIC-PRIVATE');
      await expect(
        field.validateForWrite(
          db as never,
          { metadata: { reporterIdNumber: 'changed' } },
          hydrated,
          { actorId: authorId },
        ),
      ).rejects.toThrow('Protected native');
      await expect(
        field.assertQueryReadable(
          db as never,
          { actorId: authorId },
          { search: 'SYNTHETIC-PRIVATE' },
        ),
      ).resolves.toBeUndefined();
      await expect(
        field.assertQueryReadable(
          db as never,
          { actorId: authorId },
          { sortBy: 'cccdCungCap' },
          'export',
        ),
      ).rejects.toThrow();
      await db.case.update({
        where: { id: record.id },
        data: {
          name: 'All cần tìm tiếng Việt',
          moTaChiTiet: 'SYNTHETIC-PRIVATE-DESCRIPTION',
        },
      });
      const visibleWhere = await field.policyAwareSearchWhere(
          db as never,
          { actorId: authorId },
          { search: 'cần tìm tiếng Việt' },
        ),
        secretWhere = await field.policyAwareSearchWhere(
          db as never,
          { actorId: authorId },
          { search: 'SYNTHETIC-PRIVATE-DESCRIPTION' },
        ),
        literalWhere = await field.policyAwareSearchWhere(
          db as never,
          { actorId: authorId },
          { tk: ['tenVuAn~all'] },
        );
      expect(
        await db.case.count({
          where: { AND: [{ id: record.id }, visibleWhere!] },
        }),
      ).toBe(1);
      expect(
        await db.case.count({
          where: { AND: [{ id: record.id }, secretWhere!] },
        }),
      ).toBe(0);
      expect(
        await db.case.count({
          where: { AND: [{ id: record.id }, literalWhere!] },
        }),
      ).toBe(1);
      const grant = await db.caseGovernanceGrant.create({
        data: {
          caseId: record.id,
          granteeId: reviewerId,
          createdById: publisherId,
          capabilities: ['read_sensitive'],
          startsAt: new Date('2026-01-01'),
          expiresAt: null,
        },
      });
      expect(
        await field.filterCustomFields(hydrated, { actorId: reviewerId }),
      ).toMatchObject({ cccdCungCap: 'SYNTHETIC-PRIVATE-ID' });
      await db.caseGovernanceGrant.update({
        where: { id: grant.id },
        data: { expiresAt: new Date('2026-01-02') },
      });
      expect(
        JSON.stringify(
          await field.filterCustomFields(hydrated, { actorId: reviewerId }),
        ),
      ).not.toContain('SYNTHETIC-PRIVATE');
    });
  },
);

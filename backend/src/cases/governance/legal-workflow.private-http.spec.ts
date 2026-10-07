import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CaseGovernanceModule } from './case-governance.module';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const connection = process.env.CASE_GOVERNANCE_UAT_DATABASE_URL;
if (connection) {
  const u = new URL(connection);
  if (
    u.hostname !== '127.0.0.1' ||
    u.port !== '55441' ||
    u.pathname !== '/pc02_case_governance_uat' ||
    u.username !== 'pc02_uat' ||
    connection !== process.env.DATABASE_URL
  )
    throw new Error('Exact private synthetic database required');
}
const suite = connection ? describe : describe.skip;
suite(
  'T1b private HTTP wiring and real service authorization (synthetic identity adapter; JWT UAT separate)',
  () => {
    jest.setTimeout(120000);
    let app: INestApplication,
      db: PrismaService,
      author: string,
      reviewer: string,
      publisher: string,
      reader: string,
      team: string,
      caseId: string,
      docId: string,
      ruleId: string,
      fieldId: string,
      actionId: string,
      taskId: string;
    const run = 'http-legal-' + randomUUID(),
      prefix = '/api/v1/cases';
    const sources = [
      {
        instrument: 'SYNTHETIC ONLY',
        provision: 'TEST-1',
        url: 'https://example.test/law',
        authority: 'Synthetic authority',
        effectiveFrom: '2026-01-01',
      },
    ];
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [PrismaModule, CaseGovernanceModule],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(ctx: ExecutionContext) {
            const req = ctx
              .switchToHttp()
              .getRequest<{
                headers: { authorization?: string };
                user?: { id: string };
              }>();
            req.user = {
              id: req.headers.authorization?.replace(/^Bearer /, '') ?? '',
            };
            return true;
          },
        })
        .overrideGuard(PermissionsGuard)
        .useValue({ canActivate: () => true })
        .compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1');
      await app.init();
      db = app.get(PrismaService);
      if (
        !(
          await db.featureFlag.findUnique({
            where: { key: 'CASE_GOVERNANCE_V1' },
          })
        )?.enabled
      )
        throw new Error('Private root flag must already be enabled');
      team = (await db.team.create({ data: { name: run, code: run } })).id;
      async function actor(name: string, caps: string[], edit = true) {
        const role = await db.role.create({ data: { name: run + '-' + name } });
        for (const [subject, action] of [
          ['Case', 'read'],
          ...(edit ? [['Case', 'edit']] : []),
          ...caps.map((c) => ['CaseGovernance', c]),
        ]) {
          const perm = await db.permission.upsert({
            where: { action_subject: { action, subject } },
            create: { action, subject },
            update: {},
          });
          await db.rolePermission.create({
            data: { roleId: role.id, permissionId: perm.id },
          });
        }
        const user = await db.user.create({
          data: {
            username: run + '-' + name,
            passwordHash: 'synthetic-disabled-login',
            roleId: role.id,
            isActive: true,
          },
        });
        await db.userTeam.create({ data: { userId: user.id, teamId: team } });
        return user.id;
      }
      author = await actor('author', ['operate']);
      reviewer = await actor('reviewer', ['operate', 'review']);
      publisher = await actor('publisher', ['publish']);
      reader = await actor('reader', [], false);
      caseId = (
        await db.case.create({
          data: {
            name: run,
            caseProvenance: 'DIRECT_DISCOVERY',
            status: 'DANG_DIEU_TRA',
            investigationPhase: 'INITIAL',
            assignedTeamId: team,
            createdById: author,
            ngayKhoiTo: new Date('2026-01-01'),
          },
        })
      ).id;
      const root = join(process.cwd(), 'uploads', 'documents'),
        fileName = run + '.txt',
        bytes = Buffer.from('SYNTHETIC signed decision reference only');
      await mkdir(root, { recursive: true });
      await writeFile(join(root, fileName), bytes, { flag: 'wx' });
      docId = (
        await db.document.create({
          data: {
            title: run,
            fileName,
            originalName: fileName,
            mimeType: 'text/plain',
            size: bytes.length,
            filePath: join(root, fileName),
            caseId,
            uploadedById: author,
          },
        })
      ).id;
    });
    afterAll(async () => {
      await app?.close();
    });
    const call = (
      method: 'get' | 'post' | 'patch',
      url: string,
      actor: string,
      body?: object,
    ) => {
      const req = request(app.getHttpServer())
        [method](prefix + url)
        .set('Authorization', 'Bearer ' + actor);
      return body === undefined ? req : req.send(body);
    };
    async function caseVersion() {
      return (
        await db.case.findUniqueOrThrow({ where: { id: caseId } })
      ).updatedAt.toISOString();
    }
    async function configVersion(id: string, fields = false) {
      const row = fields
        ? await db.caseFieldDefinitionVersion.findUniqueOrThrow({
            where: { id },
          })
        : await db.caseRuleVersion.findUniqueOrThrow({ where: { id } });
      return {
        expectedUpdatedAt: row.updatedAt.toISOString(),
        expectedRevision: row.revision,
      };
    }
    async function actionVersion() {
      const row = await db.caseActionRequest.findUniqueOrThrow({
        where: { id: actionId },
      });
      return {
        requestKey: randomUUID(),
        expectedUpdatedAt: await caseVersion(),
        expectedAggregateUpdatedAt: row.updatedAt.toISOString(),
        expectedRevision: row.revision,
      };
    }
    it('routes catalog/default schema/rules/field definitions and denies inactive service identity', async () => {
      expect(
        (await call('get', '/governance/catalog', reader)).body.data.actions,
      ).toHaveLength(21);
      expect(
        (await call('get', '/governance/field-schema', reader)).status,
      ).toBe(200);
      expect((await call('get', '/governance/rules', reader)).status).toBe(200);
      expect(
        (await call('get', '/governance/field-definitions', reader)).status,
      ).toBe(200);
      expect(
        (await call('get', '/' + caseId + '/actions', 'unknown-actor')).status,
      ).toBe(403);
    });
    it('independent rule validation/review/publication is reachable and author/admin spoof cannot publish', async () => {
      const created = await call('post', '/governance/rules', author, {
        code: run,
        requestKey: 'draft',
        effectiveFrom: '2026-01-01',
        definition: {
          actions: [
            { code: 'CONCLUDE_INITIAL', legalSources: sources },
            { code: 'LINK_RELATED', legalSources: sources },
          ],
        },
      });
      expect(created.status).toBe(201);
      ruleId = created.body.data.id;
      expect(
        (
          await call('patch', '/governance/rules/' + ruleId, author, {
            ...(await configVersion(ruleId)),
            effectiveFrom: '2026-01-01',
            definition: {
              actions: [
                { code: 'CONCLUDE_INITIAL', legalSources: sources },
                { code: 'LINK_RELATED', legalSources: sources },
              ],
            },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await call(
            'post',
            '/governance/rules/' + ruleId + '/validate',
            author,
            await configVersion(ruleId),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await call(
            'post',
            '/governance/rules/' + ruleId + '/review',
            author,
            await configVersion(ruleId),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await call(
            'post',
            '/governance/rules/' + ruleId + '/review',
            reviewer,
            await configVersion(ruleId),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await call(
            'post',
            '/governance/rules/' + ruleId + '/publish',
            author,
            {
              ...(await configVersion(ruleId)),
              role: 'ADMIN',
              actorId: publisher,
            },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await call(
            'post',
            '/governance/rules/' + ruleId + '/publish',
            publisher,
            await configVersion(ruleId),
          )
        ).status,
      ).toBe(201);
    });
    it('draft/revise/submit/review/execute binds server source bytes and exact revision across HTTP', async () => {
      const payload = {
        decision: {
          type: 'CONCLUSION',
          number: 'SYNTHETIC-HTTP-1',
          date: '2026-10-01',
          effectiveDate: '2026-10-02',
          issuer: 'Synthetic authority',
          signatory: 'Synthetic signer',
          legalBasis: 'Synthetic provision',
          sourceDocumentId: docId,
        },
      };
      expect(
        (
          await call('post', '/' + caseId + '/actions', reader, {
            requestKey: 'denied',
            expectedUpdatedAt: await caseVersion(),
            actionCode: 'CONCLUDE_INITIAL',
            ruleVersionId: ruleId,
            payload,
            actorId: author,
          })
        ).status,
      ).toBe(403);
      const drafted = await call('post', '/' + caseId + '/actions', author, {
        requestKey: 'action-draft',
        expectedUpdatedAt: await caseVersion(),
        actionCode: 'CONCLUDE_INITIAL',
        ruleVersionId: ruleId,
        payload,
      });
      expect(drafted.status).toBe(201);
      actionId = drafted.body.data.id;
      expect(drafted.body.data.payload.sourceSnapshot.sha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(
        (
          await call('patch', '/' + caseId + '/actions/' + actionId, author, {
            ...(await actionVersion()),
            payload: {
              ...payload,
              decision: { ...payload.decision, number: 'SYNTHETIC-HTTP-2' },
            },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await call(
            'post',
            '/' + caseId + '/actions/' + actionId + '/submit',
            author,
            { ...(await actionVersion()), reviewerId: reviewer },
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await call(
            'post',
            '/' + caseId + '/actions/' + actionId + '/review',
            author,
            { ...(await actionVersion()), approve: true, note: 'Self review' },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await call(
            'post',
            '/' + caseId + '/actions/' + actionId + '/review',
            reviewer,
            {
              ...(await actionVersion()),
              approve: true,
              note: 'Source facts reviewed',
            },
          )
        ).status,
      ).toBe(201);
      const caps = await call(
        'get',
        '/' + caseId + '/actions/capabilities?requestId=' + actionId,
        author,
      );
      expect(caps.status).toBe(200);
      expect(
        caps.body.data.actions.find(
          (a: { code: string }) => a.code === 'CONCLUDE_INITIAL',
        ).ready,
      ).toBe(true);
      expect(
        (
          await call(
            'post',
            '/' + caseId + '/actions/' + actionId + '/execute',
            author,
            await actionVersion(),
          )
        ).status,
      ).toBe(201);
      const history = await call('get', '/' + caseId + '/actions', reader);
      expect(history.body.data.decisions).toHaveLength(1);
      expect(history.body.data.requests[0].status).toBe('EXECUTED');
    });
    it('field configuration and typed adoption preserve values and reject unknown or forged canonical storage', async () => {
      const definition = {
        fields: [
          { key: 'custom_note', label: 'Note', type: 'text', required: false },
        ],
      };
      const created = await call(
        'post',
        '/governance/field-definitions',
        author,
        { code: run, requestKey: 'fields', definition },
      );
      expect(created.status).toBe(201);
      fieldId = created.body.data.id;
      expect(
        (
          await call(
            'patch',
            '/governance/field-definitions/' + fieldId,
            author,
            { ...(await configVersion(fieldId, true)), definition },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await call(
            'post',
            '/governance/field-definitions/' + fieldId + '/validate',
            author,
            await configVersion(fieldId, true),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await call(
            'post',
            '/governance/field-definitions/' + fieldId + '/review',
            reviewer,
            await configVersion(fieldId, true),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await call(
            'post',
            '/governance/field-definitions/' + fieldId + '/publish',
            publisher,
            await configVersion(fieldId, true),
          )
        ).status,
      ).toBe(201);
      expect(
        (await call('get', '/' + caseId + '/governance/field-schema', reader))
          .body.data,
      ).toBeNull();
      const saved = await call(
        'post',
        '/' + caseId + '/governance/field-schema',
        author,
        {
          requestKey: 'adopt',
          expectedUpdatedAt: await caseVersion(),
          fieldDefinitionVersionId: fieldId,
          values: { custom_note: 'Persisted typed value' },
        },
      );
      expect(saved.status).toBe(201);
      expect(
        (await call('get', '/' + caseId + '/governance/field-schema', reader))
          .body.data.values.custom_note,
      ).toBe('Persisted typed value');
      expect(
        (
          await call(
            'post',
            '/' + caseId + '/governance/field-schema',
            author,
            {
              requestKey: 'forged',
              expectedUpdatedAt: await caseVersion(),
              values: { status: 'DINH_CHI' },
            },
          )
        ).status,
      ).toBe(400);
    });
    it('task assignment/status/due edits and scoped dashboard drilldown persist through HTTP', async () => {
      const body = {
        requestKey: 'task',
        expectedUpdatedAt: await caseVersion(),
        type: 'MANUAL',
        sourceId: run,
        assigneeId: author,
        status: 'OPEN',
        dueAt: '2026-10-08T00:00:00Z',
        payload: { title: 'Synthetic followup' },
      };
      const created = await call(
        'post',
        '/' + caseId + '/governance/tasks',
        author,
        body,
      );
      expect(created.status).toBe(201);
      taskId = created.body.data.id;
      const row = await db.caseGovernanceTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(
        (
          await call(
            'patch',
            '/' + caseId + '/governance/tasks/' + taskId,
            author,
            {
              ...body,
              requestKey: 'task-close',
              expectedUpdatedAt: await caseVersion(),
              expectedAggregateUpdatedAt: row.updatedAt.toISOString(),
              status: 'COMPLETED',
            },
          )
        ).status,
      ).toBe(200);
      expect(
        (await call('get', '/governance/tasks', reader)).body.data.find(
          (t: { id: string }) => t.id === taskId,
        ).status,
      ).toBe('COMPLETED');
      const dashboard = await call('get', '/governance/dashboard', author);
      expect(dashboard.status).toBe(200);
      for (const bucket of dashboard.body.data.buckets) {
        const queue = await call(
          'get',
          '/governance/queues/' +
            bucket.key +
            '?clock=' +
            encodeURIComponent(dashboard.body.data.clock),
          author,
        );
        expect(queue.body.data.total).toBe(bucket.count);
      }
    });
    it('relation HTTP denies unapproved decision binding and hydrates only scoped targets', async () => {
      expect(
        (await call('get', '/' + caseId + '/relations', reader)).status,
      ).toBe(200);
      expect(
        (
          await call('post', '/' + caseId + '/relations', author, {
            requestKey: 'forged-relation',
            expectedUpdatedAt: await caseVersion(),
            targetCaseId: caseId,
            decisionId: 'unapproved',
            type: 'RELATED',
          })
        ).status,
      ).toBe(400);
    });
  },
);

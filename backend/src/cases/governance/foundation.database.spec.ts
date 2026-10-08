import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { CaseGovernanceService } from './case-governance.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { CasesService } from '../cases.service';
import { AuditService } from '../../audit/audit.service';
import { CasePrincipalAccessService } from './case-principal-access.service';
import { configurationHash } from './case-configuration.service';
import { PassThrough } from 'node:stream';
import * as ExcelJS from 'exceljs';

const connection = process.env.CASE_GOVERNANCE_UAT_DATABASE_URL;
const run = connection ? describe : describe.skip;
run('CG14 private PostgreSQL foundation visibility', () => {
  let db: PrismaClient;
  let governance: CaseGovernanceService;
  let actorId: string;
  let teamId: string;
  let otherTeamId: string;
  const caseIds: string[] = [];
  beforeAll(async () => {
    const address = new URL(connection!);
    if (
      address.hostname !== '127.0.0.1' ||
      address.port !== '55441' ||
      address.pathname !== '/pc02_case_governance_uat'
    )
      throw new Error('Private Case UAT database guard rejected target');
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connection! }),
    });
    governance = new CaseGovernanceService(db as unknown as PrismaService);
    const prefix = 'cg-foundation-' + randomUUID();
    const role = await db.role.create({ data: { name: prefix } });
    for (const action of ['read', 'edit']) {
      const permission = await db.permission.upsert({
        where: { action_subject: { action, subject: 'Case' } },
        create: { action, subject: 'Case' },
        update: {},
      });
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    const user = await db.user.create({
      data: {
        username: prefix,
        passwordHash: 'synthetic-not-a-login',
        roleId: role.id,
      },
    });
    actorId = user.id;
    const team = await db.team.create({ data: { name: prefix, code: prefix } });
    teamId = team.id;
    otherTeamId = (
      await db.team.create({
        data: { name: prefix + '-other', code: prefix + '-other' },
      })
    ).id;
    await db.userTeam.create({ data: { userId: actorId, teamId } });
    const variants = [
      undefined,
      Prisma.DbNull,
      Prisma.JsonNull,
      { unknown: 'preserved' },
      { sensitivity: null },
      { sensitivity: 'NORMAL' },
      { sensitivity: 'RESTRICTED' },
      { sensitivity: 'UNKNOWN' },
    ];
    for (let i = 0; i < variants.length; i++) {
      const record = await db.case.create({
        data: {
          name: prefix + '-' + i,
          caseProvenance: 'DIRECT_DISCOVERY',
          sourceDocumentNote: 'Synthetic foundation verification',
          assignedTeamId: teamId,
          investigatorId: actorId,
          metadata: variants[i] as Prisma.InputJsonValue,
        },
      });
      caseIds.push(record.id);
    }
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  it('migration 132 exposes nullable receipt pins and a restrictive Document foreign key', async () => {
    const foreignKeys = await db.$queryRaw<{ deletion: string }[]>`
      SELECT confdeltype::text AS deletion FROM pg_constraint
      WHERE conrelid='case_disposition_requests'::regclass
      AND conname='case_disposition_requests_receiptDocumentId_fkey'`;
    expect(foreignKeys).toEqual([{ deletion: 'r' }]);
    const columns = await db.$queryRaw<
      { column_name: string; is_nullable: string }[]
    >`
      SELECT column_name,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='case_disposition_requests'
      AND column_name IN ('receiptDocumentId','receiptDocumentUpdatedAt','receiptSha256','receiptByteLength')`;
    expect(columns).toHaveLength(4);
    expect(columns.every((column) => column.is_nullable === 'YES')).toBe(true);
  });
  it('missing/SQL-null/JSON-null/unrelated/null/NORMAL metadata stay visible; legacy restrictive and unknown do not', async () => {
    const where = await governance.readableCaseWhere(
      db as unknown as Prisma.TransactionClient,
      { actorId },
    );
    const records = await db.case.findMany({
      where: { AND: [where, { id: { in: caseIds } }] },
      select: { id: true },
    });
    expect(records.map((x) => x.id).sort()).toEqual(caseIds.slice(0, 6).sort());
    for (const id of caseIds.slice(0, 6))
      await expect(
        governance.assertCaseReadable(
          db as unknown as Prisma.TransactionClient,
          id,
          { actorId },
        ),
      ).resolves.toHaveProperty('id', id);
    for (const id of caseIds.slice(6))
      await expect(
        governance.assertCaseReadable(
          db as unknown as Prisma.TransactionClient,
          id,
          { actorId },
        ),
      ).rejects.toMatchObject({ status: 403 });
  });
  it('legal-R2 dual aliases enforce real point/list/count/Excel and controlled inspection boundaries', async () => {
    const marker = 'dual-alias-' + randomUUID();
    const ids: string[] = [];
    const metadata = [
      { _sensitivity: 'NORMAL' },
      { sensitivity: 'NORMAL', _sensitivity: 'NORMAL' },
      { _sensitivity: 'RESTRICTED' },
      { sensitivity: 'NORMAL', _sensitivity: 'RESTRICTED' },
      { sensitivity: 'RESTRICTED', _sensitivity: 'NORMAL' },
      { _sensitivity: 'UNKNOWN' },
      { sensitivity: 'RESTRICTED', _sensitivity: 'UNKNOWN' },
    ];
    for (let i = 0; i < metadata.length; i++) {
      ids.push(
        (
          await db.case.create({
            data: {
              name: marker + '-' + i,
              tenCungCap: marker + '-' + i,
              caseProvenance: 'DIRECT_DISCOVERY',
              assignedTeamId: teamId,
              investigatorId: actorId,
              metadata: metadata[i],
            },
          })
        ).id,
      );
    }
    for (const id of ids.slice(2))
      await expect(
        governance.assertCaseReadable(db as never, id, {
          actorId,
          dataScope: null,
        }),
      ).rejects.toMatchObject({ status: 403 });
    const cases = new CasesService(
      db as never,
      new AuditService(db as never),
      {
        getKyThongKe: () =>
          Promise.resolve({ ky: 'TAT_CA', truong: 'NGAY_TIEP_NHAN' }),
      } as never,
      {} as never,
      { emit: () => false } as never,
    );
    const query = { search: marker } as never;
    const listed = await cases.getList(query, null, actorId);
    expect(listed.data.map((row) => row.id).sort()).toEqual(
      ids.slice(0, 2).sort(),
    );
    expect(listed.total).toBe(2);
    expect((await cases.getStats(query, null, actorId)).total).toBe(2);
    const stream = new PassThrough(),
      chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    await cases.xuatDanhSach(
      { search: marker, cot: 'name' } as never,
      null,
      Object.assign(stream, { setHeader: () => undefined }) as never,
      { userId: actorId },
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks) as never);
    const cells = JSON.stringify(workbook.worksheets[0].getSheetValues());
    expect(cells).toContain(marker + '-0');
    expect(cells).toContain(marker + '-1');
    for (let i = 2; i < ids.length; i++)
      expect(cells).not.toContain(marker + '-' + i);
    await db.caseGovernanceGrant.create({
      data: {
        caseId: ids[2],
        granteeId: actorId,
        createdById: actorId,
        startsAt: new Date('2000-01-01'),
        capabilities: ['read_sensitive'],
      },
    });
    await expect(
      governance.assertCaseReadable(db as never, ids[2], { actorId }),
    ).resolves.toMatchObject({ id: ids[2] });
    const role = await db.role.create({
      data: { name: marker + '-inspector' },
    });
    for (const [subject, action] of [
      ['Case', 'read'],
      ['Case', 'edit'],
      ['CaseGovernance', 'manage_access'],
      ['CaseGovernance', 'read_sensitive'],
    ]) {
      const permission = await db.permission.upsert({
        where: { action_subject: { subject, action } },
        create: { subject, action },
        update: {},
      });
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    const inspector = await db.user.create({
      data: {
        username: marker + '-inspector',
        passwordHash: 'synthetic-not-a-login',
        roleId: role.id,
      },
    });
    await db.userTeam.create({ data: { userId: inspector.id, teamId } });
    await expect(
      governance.assertCaseReadable(db as never, ids[6], {
        actorId: inspector.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const inspected = await governance.assertClassificationInspectable(
      db as never,
      ids[6],
      { actorId: inspector.id },
      'Recorded dual-alias classification inspection',
    );
    expect(inspected.metadata).toEqual(metadata[6]);
    await expect(
      governance.assertClassificationInspectable(
        db as never,
        ids[6],
        { actorId },
        'Recorded dual-alias classification inspection',
      ),
    ).rejects.toMatchObject({ status: 403 });
  }, 60000);
  it('legal-R4 rejects active duplicates but accepts new relation after revoke or deletion retaining old rows', async () => {
    // Persistence fixture only: this does not certify a human legal signature.
    const marker = 'relation-history-' + randomUUID(),
      hash = configurationHash({ proof: marker });
    const author = await db.user.findUniqueOrThrow({ where: { id: actorId } }),
      reviewer = await db.user.create({
        data: {
          username: marker,
          passwordHash: 'synthetic-not-a-login',
          roleId: author.roleId,
        },
      });
    const rule = await db.caseRuleVersion.create({
      data: {
        code: marker,
        definition: { mappings: [] },
        contentHash: hash,
        legalSources: [],
        authorId: actorId,
        status: 'PUBLISHED',
        reviewedById: reviewer.id,
        approvedHash: hash,
        approvedRevision: 1,
        publishedAt: new Date(),
      },
    });
    const source = await db.document.create({
      data: {
        caseId: caseIds[0],
        title: 'Synthetic relation decision source',
        fileName: 'constraint-reference.bin',
        filePath: 'synthetic-constraint-reference',
        originalName: 'constraint-reference.bin',
        mimeType: 'application/octet-stream',
        size: 1,
        uploadedById: actorId,
      },
    });
    const request = await db.caseActionRequest.create({
      data: {
        caseId: caseIds[0],
        actionCode: 'RELATED',
        ruleVersionId: rule.id,
        status: 'EXECUTED',
        payload: { proof: marker },
        contentHash: hash,
        authorId: actorId,
        reviewedById: reviewer.id,
        approvedHash: hash,
        approvedRevision: 1,
        executedAt: new Date(),
      },
    });
    const decision = await db.caseDecision.create({
      data: {
        caseId: caseIds[0],
        requestId: request.id,
        ruleVersionId: rule.id,
        type: 'RELATED',
        number: marker,
        date: new Date('2026-10-06'),
        issuer: 'Synthetic persistence test',
        signatory: 'Synthetic test signatory',
        legalBasis: 'Synthetic correction provenance',
        effectiveDate: new Date('2026-10-06'),
        sourceDocumentId: source.id,
        facts: { proof: marker },
        contentHash: hash,
        createdById: actorId,
      },
    });
    const first = await db.caseRelation.create({
      data: {
        sourceCaseId: caseIds[0],
        targetCaseId: caseIds[1],
        type: 'RELATED',
        createdById: actorId,
        payload: { proof: 'original authorized relation' },
        decisionId: decision.id,
      },
    });
    await expect(
      db.caseRelation.create({
        data: {
          sourceCaseId: caseIds[0],
          targetCaseId: caseIds[1],
          type: 'RELATED',
          createdById: actorId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await db.caseRelation.update({
      where: { id: first.id },
      data: {
        revokedAt: new Date(),
        revokedById: actorId,
        revision: { increment: 1 },
      },
    });
    const replacement = await db.caseRelation.create({
      data: {
        sourceCaseId: caseIds[0],
        targetCaseId: caseIds[1],
        type: 'RELATED',
        createdById: actorId,
      },
    });
    expect(replacement.id).not.toBe(first.id);
    await expect(
      db.caseRelation.create({
        data: {
          sourceCaseId: caseIds[0],
          targetCaseId: caseIds[1],
          type: 'RELATED',
          createdById: actorId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await db.caseRelation.update({
      where: { id: replacement.id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    const afterDeletion = await db.caseRelation.create({
      data: {
        sourceCaseId: caseIds[0],
        targetCaseId: caseIds[1],
        type: 'RELATED',
        createdById: actorId,
      },
    });
    expect(afterDeletion.id).not.toBe(replacement.id);
    const preserved = await db.caseRelation.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(preserved.payload).toEqual(first.payload);
    expect(preserved.decisionId).toBe(decision.id);
    expect(
      await db.caseDecision.findUniqueOrThrow({ where: { id: decision.id } }),
    ).toEqual(decision);
    expect(
      (
        await db.caseActionRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).approvedHash,
    ).toBe(hash);
    expect(preserved.revision).toBe(2);
    expect(preserved.revokedAt).not.toBeNull();
    expect(
      await db.caseRelation.count({
        where: {
          sourceCaseId: caseIds[0],
          targetCaseId: caseIds[1],
          type: 'RELATED',
        },
      }),
    ).toBe(3);
  });
  it('explicit no-expiry grant permits exact restricted Case without permitting unknown classification', async () => {
    await db.caseGovernanceGrant.create({
      data: {
        caseId: caseIds[6],
        granteeId: actorId,
        createdById: actorId,
        startsAt: new Date('2000-01-01'),
        expiresAt: null,
        capabilities: ['read_sensitive'],
      },
    });
    const where = await governance.readableCaseWhere(
      db as unknown as Prisma.TransactionClient,
      { actorId },
    );
    expect(
      await db.case.count({ where: { AND: [where, { id: caseIds[6] }] } }),
    ).toBe(1);
    await expect(
      governance.assertCaseReadable(
        db as unknown as Prisma.TransactionClient,
        caseIds[6],
        { actorId },
      ),
    ).resolves.toHaveProperty('id', caseIds[6]);
    await db.caseGovernanceGrant.create({
      data: {
        caseId: caseIds[7],
        granteeId: actorId,
        createdById: actorId,
        startsAt: new Date('2000-01-01'),
        expiresAt: null,
        capabilities: ['read_sensitive'],
      },
    });
    expect(
      await db.case.count({
        where: {
          AND: [
            await governance.readableCaseWhere(
              db as unknown as Prisma.TransactionClient,
              { actorId },
            ),
            { id: caseIds[7] },
          ],
        },
      }),
    ).toBe(0);
  });
  it('current actor deactivation denies reads despite supplied null scope', async () => {
    await db.user.update({ where: { id: actorId }, data: { isActive: false } });
    await expect(
      governance.assertCaseReadable(
        db as unknown as Prisma.TransactionClient,
        caseIds[0],
        { actorId, dataScope: null },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await db.user.update({ where: { id: actorId }, data: { isActive: true } });
  });
  it('durable one-PENDING ledger rejects a second handoff', async () => {
    await db.caseHandoff.create({
      data: {
        caseId: caseIds[0],
        toTeamId: otherTeamId,
        fromTeamId: teamId,
        sentById: actorId,
      },
    });
    await expect(
      db.caseHandoff.create({
        data: {
          caseId: caseIds[0],
          toTeamId: otherTeamId,
          fromTeamId: teamId,
          sentById: actorId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      governance.assertCaseWritable(
        db as unknown as Prisma.TransactionClient,
        caseIds[0],
        { actorId },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('native phone privacy applies to authorized broad search and counts, while public name remains searchable', async () => {
    const phone = 'SECRET-PHONE-' + randomUUID(),
      name = 'PUBLIC-NAME-' + randomUUID();
    const definition = {
      fields: [],
      fieldPolicies: [{ key: 'sdtCungCap', sensitivity: 'RESTRICTED' }],
    };
    const schema = await db.caseFieldDefinitionVersion.create({
      data: {
        code: 'synthetic-phone-' + randomUUID(),
        definition,
        contentHash: configurationHash(definition),
        status: 'PUBLISHED',
        authorId: actorId,
        publishedAt: new Date(),
      },
    });
    await db.case.update({
      where: { id: caseIds[1] },
      data: { name, sdtCungCap: phone, fieldDefinitionVersionId: schema.id },
    });
    const cases = new CasesService(
      db as unknown as PrismaService,
      new AuditService(db as unknown as PrismaService),
      {
        getKyThongKe: () =>
          Promise.resolve({ ky: 'TAT_CA', truong: 'NGAY_TIEP_NHAN' }),
      } as never,
      {} as never,
      { emit: () => false } as never,
    );
    const hidden = await cases.getList(
        { search: phone } as never,
        null,
        actorId,
      ),
      hiddenCount = await cases.getStats(
        { search: phone } as never,
        null,
        actorId,
      );
    expect(hidden.total).toBe(0);
    expect(hiddenCount.total).toBe(0);
    const visible = await cases.getList(
      { search: name } as never,
      null,
      actorId,
    );
    expect(visible.data.map((x) => x.id)).toContain(caseIds[1]);
    expect(JSON.stringify(visible.data)).not.toContain(phone);
  });
  it('configured period protects private date membership in real list/count/Excel and retains authorized date filtering', async () => {
    const marker = 'period-private-' + randomUUID();
    const definition = {
      fields: [],
      fieldPolicies: [{ key: 'ngayDeXuat', sensitivity: 'RESTRICTED' }],
    };
    const schema = await db.caseFieldDefinitionVersion.create({
      data: {
        code: marker,
        definition,
        contentHash: configurationHash(definition),
        status: 'PUBLISHED',
        authorId: actorId,
        publishedAt: new Date(),
      },
    });
    const outside = new Date('2026-11-15T00:00:00Z');
    const hidden = await db.case.create({
      data: {
        name: marker + '-hidden',
        tenCungCap: marker + '-hidden',
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        investigatorId: actorId,
        ngayDeXuat: outside,
        fieldDefinitionVersionId: schema.id,
      },
    });
    const publicCase = await db.case.create({
      data: {
        name: marker + '-public',
        tenCungCap: marker + '-public',
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        investigatorId: actorId,
        ngayDeXuat: outside,
      },
    });
    const cases = new CasesService(
      db as unknown as PrismaService,
      new AuditService(db as unknown as PrismaService),
      {
        getKyThongKe: () =>
          Promise.resolve({
            ky: 'THANG_NAY',
            truong: 'NGAY_TIEP_NHAN',
            tuNgay: '2026-10-01',
            denNgay: '2026-10-31',
          }),
      } as never,
      {} as never,
      { emit: () => false } as never,
    );
    const query = { search: marker } as never;
    const first = await cases.getList(query, null, actorId);
    expect(first.data.map((row) => row.id)).toEqual([hidden.id]);
    expect(first.total).toBe(1);
    expect((await cases.getStats(query, null, actorId)).total).toBe(1);
    expect(first.data[0]).not.toHaveProperty('ngayDeXuat');
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    await cases.xuatDanhSach(
      { search: marker, cot: 'name' } as never,
      null,
      Object.assign(stream, { setHeader: () => undefined }) as never,
      { userId: actorId },
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks) as never);
    const cells = JSON.stringify(workbook.worksheets[0].getSheetValues());
    expect(cells).toContain(marker + '-hidden');
    expect(cells).not.toContain(marker + '-public');
    await db.case.update({
      where: { id: hidden.id },
      data: { ngayDeXuat: new Date('2025-01-01') },
    });
    expect((await cases.getList(query, null, actorId)).total).toBe(1);
    expect((await cases.getStats(query, null, actorId)).total).toBe(1);
    await db.caseGovernanceGrant.create({
      data: {
        caseId: hidden.id,
        granteeId: actorId,
        createdById: actorId,
        startsAt: new Date('2000-01-01'),
        capabilities: ['read_sensitive'],
      },
    });
    expect((await cases.getList(query, null, actorId)).total).toBe(0);
    await db.case.update({
      where: { id: hidden.id },
      data: { ngayDeXuat: new Date('2026-10-15') },
    });
    expect(
      (await cases.getList(query, null, actorId)).data.map((row) => row.id),
    ).toEqual([hidden.id]);
    const user = await db.user.findUniqueOrThrow({ where: { id: actorId } });
    const representative = await db.user.create({
      data: {
        username: marker,
        passwordHash: 'synthetic-not-a-login',
        roleId: user.roleId,
        caseAccessMode: 'REPRESENTATION_ONLY',
      },
    });
    await db.userTeam.create({ data: { userId: representative.id, teamId } });
    const lawyer = await db.lawyer.create({
      data: {
        caseId: publicCase.id,
        fullName: 'Synthetic period representative',
        barNumber: marker,
      },
    });
    await db.caseRepresentationGrant.create({
      data: {
        caseId: publicCase.id,
        lawyerId: lawyer.id,
        granteeId: representative.id,
        createdById: actorId,
        startsAt: new Date('2000-01-01'),
        expiresAt: new Date('2099-01-01'),
        capabilities: ['list'],
      },
    });
    expect(
      (await cases.getList(query, null, representative.id)).data.map(
        (row) => row.id,
      ),
    ).toEqual([publicCase.id]);
    expect((await cases.getStats(query, null, representative.id)).total).toBe(
      1,
    );
    await expect(
      cases.xuatDanhSach(query, null, {} as never, {
        userId: representative.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
  }, 30000);
  it('Case audit SQL scopes direct and recorded parents, masking field values before diff', async () => {
    const audit = await db.auditLog.create({
      data: {
        userId: actorId,
        subject: 'Case',
        subjectId: caseIds[1],
        action: 'CASE_UPDATED',
        metadata: {
          before: { sdtCungCap: 'hidden-old', name: 'old' },
          after: { sdtCungCap: 'hidden-new', name: 'new' },
        },
      },
    });
    const service = new AuditService(db as unknown as PrismaService);
    const result = await service.findById(audit.id, actorId);
    expect(JSON.stringify(result)).not.toContain('hidden-old');
    expect(JSON.stringify(result)).not.toContain('hidden-new');
    expect(result?.changedFields.map((x) => x.field)).toEqual(['name']);
  });
  it('invalid receipt rolls back Case revision and operation ledger in actual PostgreSQL', async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: actorId } });
    const permission = await db.permission.upsert({
      where: {
        action_subject: { action: 'operate', subject: 'CaseGovernance' },
      },
      create: { action: 'operate', subject: 'CaseGovernance' },
      update: {},
    });
    await db.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: user.roleId,
          permissionId: permission.id,
        },
      },
      create: { roleId: user.roleId, permissionId: permission.id },
      update: {},
    });
    await db.user.update({
      where: { id: actorId },
      data: { canDispatch: true },
    });
    const record = await db.case.findUniqueOrThrow({
      where: { id: caseIds[1] },
    });
    const requestKey = 'invalid-receipt-' + randomUUID();
    await expect(
      governance.sendHandoff(
        record.id,
        {
          toTeamId: teamId,
          requestKey,
          expectedUpdatedAt: record.updatedAt.toISOString(),
          receiptChecklist: [
            {
              documentId: randomUUID(),
              expectedDocumentUpdatedAt: record.updatedAt.toISOString(),
              present: true,
            },
          ],
        },
        { actorId },
      ),
    ).rejects.toMatchObject({ status: 400 });
    const after = await db.case.findUniqueOrThrow({ where: { id: record.id } });
    expect(after.governanceRevision).toBe(record.governanceRevision);
    expect(after.updatedAt).toEqual(record.updatedAt);
    expect(after.intakeStage).toBe(record.intakeStage);
    expect(
      await db.caseGovernanceOperation.count({
        where: { actorId, caseId: record.id, requestKey },
      }),
    ).toBe(0);
    expect(await db.caseHandoff.count({ where: { caseId: record.id } })).toBe(
      0,
    );
  });
  it('principal mode change is CAS/audited and matching list grant never grants full view or general export', async () => {
    const marker = 'principal-manager-' + randomUUID(),
      role = await db.role.create({ data: { name: marker } });
    for (const [subject, action] of [
      ['User', 'write'],
      ['CaseGovernance', 'manage_access'],
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
    const manager = await db.user.create({
      data: {
        username: marker,
        passwordHash: 'synthetic-not-a-login',
        roleId: role.id,
      },
    });
    await db.userTeam.create({ data: { userId: manager.id, teamId } });
    const target = await db.user.findUniqueOrThrow({ where: { id: actorId } });
    const access = new CasePrincipalAccessService(
      db as unknown as PrismaService,
      governance,
    );
    const dto = {
      caseAccessMode: 'REPRESENTATION_ONLY' as const,
      expectedUserUpdatedAt: target.updatedAt.toISOString(),
      expectedCaseAccessRevision: target.caseAccessRevision,
      requestKey: marker,
      reason: 'Synthetic external recipient isolation',
    };
    const changed = await access.change(actorId, dto, { actorId: manager.id });
    expect(changed.data.caseAccessRevision).toBe(target.caseAccessRevision + 1);
    expect(await access.change(actorId, dto, { actorId: manager.id })).toEqual(
      changed,
    );
    await expect(
      governance.assertCaseReadable(
        db as unknown as Prisma.TransactionClient,
        caseIds[1],
        { actorId },
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await db.case.count({
        where: await governance.readableCaseWhere(
          db as unknown as Prisma.TransactionClient,
          { actorId },
        ),
      }),
    ).toBe(0);
    const lawyer = await db.lawyer.create({
      data: {
        caseId: caseIds[1],
        fullName: 'Synthetic list-only representative',
        barNumber: 'synthetic-' + randomUUID(),
      },
    });
    await db.caseRepresentationGrant.create({
      data: {
        caseId: caseIds[1],
        lawyerId: lawyer.id,
        granteeId: actorId,
        createdById: manager.id,
        startsAt: new Date('2000-01-01'),
        expiresAt: new Date('2099-01-01'),
        capabilities: ['list'],
      },
    });
    expect(
      await db.case.count({
        where: await governance.readableCaseWhere(
          db as unknown as Prisma.TransactionClient,
          { actorId },
        ),
      }),
    ).toBe(1);
    await expect(
      governance.assertCaseReadable(
        db as unknown as Prisma.TransactionClient,
        caseIds[1],
        { actorId },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      governance.assertGeneralExport(
        db as unknown as Prisma.TransactionClient,
        { actorId },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

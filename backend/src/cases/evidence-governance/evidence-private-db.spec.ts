import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CaseGovernanceService } from '../governance/case-governance.service';
import { CaseEvidenceGovernanceService } from './evidence-governance.service';
import { assertCasePreservation } from './case-preservation';
import { verifyDisclosureBundle } from './disclosure-manifest';
import { CaseFieldSchemaService } from '../governance/case-field-schema.service';
import { manifestHash } from './disclosure-manifest';
import { DocumentsService } from '../../documents/documents.service';
import { AuditService } from '../../audit/audit.service';
import { DocumentsController } from '../../documents/documents.controller';
import { CaseEvidenceGovernanceController } from './evidence-governance.controller';

const connection = process.env.CASE_GOVERNANCE_UAT_DATABASE_URL;
const privateSuite = connection ? describe : describe.skip;
privateSuite('CG11–14 private PostgreSQL evidence integration', () => {
  let db: PrismaClient,
    service: CaseEvidenceGovernanceService,
    root: string,
    caseId: string,
    assetId: string,
    packetId: string;
  let maker: string, reviewer: string, recipient: string;
  let teamId: string, roleId: string, grantId: string, lawyerId: string;
  const prefix = `cg-evidence-${randomUUID()}`;
  const bytes = Buffer.from(`private synthetic evidence ${prefix}`);
  const actor = () => ({ actorId: maker });
  let key = 0;
  async function command(extra: Record<string, unknown> = {}) {
    const record = await db.case.findUniqueOrThrow({ where: { id: caseId } });
    return {
      requestKey: `${prefix}-${++key}`,
      expectedUpdatedAt: record.updatedAt.toISOString(),
      expectedRevision: 1,
      ...extra,
    };
  }
  beforeAll(async () => {
    const address = new URL(connection!);
    if (
      address.hostname !== '127.0.0.1' ||
      address.port !== '55441' ||
      address.pathname !== '/pc02_case_governance_uat'
    )
      throw new Error('Refusing non-private evidence DB');
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connection! }),
    });
    if (
      !(
        await db.featureFlag.findUnique({
          where: { key: 'CASE_GOVERNANCE_V1' },
        })
      )?.enabled
    )
      throw new Error(
        'Coordinator must initialize private test flag; suite never toggles shared flag',
      );
    const role = await db.role.create({ data: { name: prefix } }),
      team = await db.team.create({ data: { name: prefix, code: prefix } });
    teamId = team.id;
    roleId = role.id;
    for (const [subject, actions] of [
      ['Case', ['read', 'edit']],
      ['Document', ['read']],
      [
        'CaseGovernance',
        [
          'read',
          'download',
          'operate',
          'review',
          'publish',
          'share',
          'custody',
          'dispose',
        ],
      ],
    ] as Array<[string, string[]]>) {
      for (const action of actions) {
        const permission = await db.permission.upsert({
          where: { action_subject: { action, subject } },
          create: { action, subject },
          update: {},
        });
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
    const users = [] as string[];
    for (const label of ['maker', 'reviewer', 'recipient']) {
      const user = await db.user.create({
        data: {
          username: `${prefix}-${label}`,
          passwordHash: 'synthetic-disabled-login',
          roleId: role.id,
          isActive: true,
          caseAccessMode:
            label === 'recipient' ? 'REPRESENTATION_ONLY' : 'INTERNAL',
        },
      });
      await db.userTeam.create({ data: { userId: user.id, teamId: team.id } });
      users.push(user.id);
    }
    [maker, reviewer, recipient] = users;
    const record = await db.case.create({
      data: {
        name: `Synthetic evidence ${prefix}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: team.id,
        investigatorId: maker,
        createdById: maker,
      },
    });
    caseId = record.id;
    root = await mkdtemp(join(tmpdir(), 'pc02-evidence-db-'));
    await writeFile(join(root, 'original.bin'), bytes, { flag: 'wx' });
    const document = await db.document.create({
      data: {
        title: 'Synthetic immutable original',
        caseId,
        fileName: 'original.bin',
        filePath: join(root, 'original.bin'),
        originalName: 'synthetic.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        uploadedById: maker,
      },
    });
    service = new CaseEvidenceGovernanceService(
      db as never,
      new CaseGovernanceService(db as never),
      new CaseFieldSchemaService(
        db as never,
        new CaseGovernanceService(db as never),
      ),
    );
    Object.defineProperty(service, 'uploadRoot', { value: root });
    const registered = await service.registerAsset(
      caseId,
      await command({ documentId: document.id }),
      actor(),
    );
    assetId = (registered.data as { id: string }).id;
    const lawyer = await db.lawyer.create({
      data: {
        fullName: 'Synthetic bounded representative',
        barNumber: prefix,
        caseId,
      },
    });
    lawyerId = lawyer.id;
    const grant = await service.addRepresentation(
      caseId,
      await command({
        lawyerId,
        granteeId: recipient,
        capabilities: ['list', 'view', 'download'],
        startsAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
      }),
      actor(),
    );
    grantId = grant.data.id;
  }, 120000);
  afterAll(async () => {
    await db?.$disconnect(); /* Preserve registered temp original and synthetic provenance for coordinator review; no ledger/file purge. */
  });
  it('approves exact revision in real transactions and exports verifiable bytes', async () => {
    const created = await service.createPacket(
      caseId,
      await command({
        recipientId: recipient,
        purpose: 'Synthetic review',
        basis: 'Synthetic permission only',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        items: [{ assetVersionId: assetId }],
      }),
      actor(),
    );
    packetId = (created.data as { id: string }).id;
    await service.submitPacket(caseId, packetId, await command(), actor());
    await expect(
      service.reviewPacket(
        caseId,
        packetId,
        await command({ approve: true }),
        actor(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await service.reviewPacket(
      caseId,
      packetId,
      await command({ approve: true }),
      { actorId: reviewer },
    );
    const approved = await db.caseDisclosurePacket.findUniqueOrThrow({
      where: { id: packetId },
    });
    const exported = await service.exportPacket(caseId, packetId, {
      actorId: recipient,
    });
    expect(
      verifyDisclosureBundle(exported.data, approved.approvedHash!).itemCount,
    ).toBe(1);
    expect(await db.caseGovernanceEvent.count({ where: { caseId } })).toBe(5);
  }, 60000);
  it('detects one-byte disk tamper and restores only its own private test bytes', async () => {
    const altered = Buffer.from(bytes);
    altered[0] ^= 1;
    await writeFile(join(root, 'original.bin'), altered);
    try {
      await expect(
        service.verifyAsset(caseId, assetId, actor()),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.exportPacket(caseId, packetId, { actorId: recipient }),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await writeFile(join(root, 'original.bin'), bytes);
    }
    expect(await readFile(join(root, 'original.bin'))).toEqual(bytes);
  }, 60000);
  it('preserves held Case identities, ledger and bytes against pre-delete force paths', async () => {
    await service.addHold(
      caseId,
      await command({
        reason: 'Synthetic hold',
        basis: 'Synthetic preservation',
      }),
      actor(),
    );
    const approved = await db.caseDisclosurePacket.findUniqueOrThrow({
      where: { id: packetId },
    });
    const disclosed = await service.exportPacket(caseId, packetId, {
      actorId: recipient,
    });
    expect(
      verifyDisclosureBundle(disclosed.data, approved.approvedHash!).valid,
    ).toBe(true);
    await expect(
      db.$transaction(async (tx) => {
        await assertCasePreservation(tx, caseId, 'FORCE_ROLLBACK');
        await tx.case.delete({ where: { id: caseId } });
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.case.findUnique({ where: { id: caseId } })).not.toBeNull();
    expect(
      await db.caseAssetVersion.findUnique({ where: { id: assetId } }),
    ).not.toBeNull();
    expect(await readFile(join(root, 'original.bin'))).toEqual(bytes);
  }, 60000);
  it('REP_ONLY same-unit reader cannot cross Case boundary or hydrate unapproved originals while INTERNAL staff retain scoped rights', async () => {
    const other = await db.case.create({
      data: {
        name: `Other synthetic Case ${prefix}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        investigatorId: maker,
        createdById: maker,
      },
    });
    await writeFile(join(root, 'other.bin'), bytes, { flag: 'wx' });
    const otherDoc = await db.document.create({
      data: {
        title: 'Other Case original',
        caseId: other.id,
        fileName: 'other.bin',
        filePath: join(root, 'other.bin'),
        originalName: 'other.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        uploadedById: maker,
      },
    });
    const otherAsset = await service.registerAsset(
      other.id,
      {
        requestKey: `${prefix}-${++key}`,
        expectedUpdatedAt: other.updatedAt.toISOString(),
        documentId: otherDoc.id,
      },
      actor(),
    );
    await expect(
      service.verifyAsset(other.id, otherAsset.data.id, { actorId: recipient }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.verifiedAsset(
        other.id,
        otherAsset.data.id,
        { actorId: recipient },
        'download',
      ),
    ).rejects.toMatchObject({ status: 403 });
    await writeFile(join(root, 'unapproved.bin'), bytes, { flag: 'wx' });
    const unapprovedDoc = await db.document.create({
      data: {
        title: 'Unapproved original',
        caseId,
        fileName: 'unapproved.bin',
        filePath: join(root, 'unapproved.bin'),
        originalName: 'unapproved.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        uploadedById: maker,
      },
    });
    const unapproved = await service.registerAsset(
      caseId,
      await command({ documentId: unapprovedDoc.id }),
      actor(),
    );
    await expect(
      service.verifiedAsset(
        caseId,
        unapproved.data.id,
        { actorId: recipient },
        'download',
      ),
    ).rejects.toMatchObject({ status: 403 });
    await service.addRepresentation(
      caseId,
      await command({
        lawyerId,
        granteeId: reviewer,
        capabilities: ['view'],
        startsAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
      }),
      actor(),
    );
    const staffFile = await service.verifiedAsset(
      other.id,
      otherAsset.data.id,
      { actorId: reviewer },
      'download',
    );
    await staffFile.handle.close();
    const staffOwn = await service.verifiedAsset(
      caseId,
      assetId,
      { actorId: reviewer },
      'download',
    );
    await staffOwn.handle.close();
  }, 60000);
  it('REP_ONLY revocation and expiry never fall back to unit-wide staff rights', async () => {
    await service.revokeRepresentation(
      caseId,
      grantId,
      await command(),
      actor(),
    );
    await expect(
      service.verifiedAsset(
        caseId,
        assetId,
        { actorId: recipient },
        'download',
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.exportPacket(caseId, packetId, { actorId: recipient }),
    ).rejects.toMatchObject({ status: 403 });
    const expiredUser = await db.user.create({
      data: {
        username: `${prefix}-expired`,
        passwordHash: 'synthetic-disabled-login',
        roleId,
        caseAccessMode: 'REPRESENTATION_ONLY',
      },
    });
    await db.userTeam.create({ data: { userId: expiredUser.id, teamId } });
    await db.caseRepresentationGrant.create({
      data: {
        caseId,
        lawyerId,
        granteeId: expiredUser.id,
        capabilities: ['list', 'view', 'download'],
        startsAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 1000),
        createdById: maker,
      },
    });
    await expect(
      service.getSummary(caseId, { actorId: expiredUser.id }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.verifiedAsset(
        caseId,
        assetId,
        { actorId: expiredUser.id },
        'download',
      ),
    ).rejects.toMatchObject({ status: 403 });
  }, 60000);
  it('normal Case native-field masking must also deny delivery of originals containing protected needles', async () => {
    const needle = `PROTECTED_PHONE_${prefix}`;
    const definition = {
      fields: [],
      fieldPolicies: [
        { key: 'sdtCungCap', sensitivity: 'RESTRICTED' },
        { key: 'description', sensitivity: 'RESTRICTED' },
      ],
    };
    const hash = manifestHash(definition);
    const schema = await db.caseFieldDefinitionVersion.create({
      data: {
        code: `${prefix}-byte-policy`,
        definition,
        status: 'PUBLISHED',
        contentHash: hash,
        approvedHash: hash,
        approvedRevision: 1,
        authorId: maker,
        reviewedById: reviewer,
        publishedAt: new Date(),
      },
    });
    const protectedCase = await db.case.create({
      data: {
        name: `Protected native fields ${prefix}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        investigatorId: maker,
        createdById: maker,
        sensitivity: 'NORMAL',
        fieldDefinitionVersionId: schema.id,
        sdtCungCap: needle,
        moTaChiTiet: needle,
        metadata: { phone: needle, description: needle },
      },
    });
    const fields = new CaseFieldSchemaService(
      db as never,
      new CaseGovernanceService(db as never),
    );
    const masked = await fields.filterCustomFields(protectedCase, {
      actorId: reviewer,
    });
    expect(JSON.stringify(masked)).not.toContain(needle);
    const secretBytes = Buffer.from(`Original includes ${needle}`);
    await writeFile(join(root, 'protected-original.bin'), secretBytes, {
      flag: 'wx',
    });
    const document = await db.document.create({
      data: {
        title: 'Protected original bytes',
        caseId: protectedCase.id,
        fileName: 'protected-original.bin',
        filePath: join(root, 'protected-original.bin'),
        originalName: 'protected.bin',
        mimeType: 'application/octet-stream',
        size: secretBytes.length,
        uploadedById: maker,
      },
    });
    const version = await service.registerAsset(
      protectedCase.id,
      {
        requestKey: `${prefix}-${++key}`,
        expectedUpdatedAt: protectedCase.updatedAt.toISOString(),
        documentId: document.id,
      },
      actor(),
    );
    const hydration = service.verifiedAsset(
      protectedCase.id,
      version.data.id,
      { actorId: reviewer },
      'download',
    );
    try {
      await expect(hydration).rejects.toMatchObject({ status: 403 });
    } finally {
      await hydration.then(
        (file) => file.handle.close(),
        () => undefined,
      );
    }
    const legacyDocuments = new DocumentsService(
      db as never,
      new AuditService(db as never),
      {} as never,
      new CaseGovernanceService(db as never),
      service,
    );
    Object.defineProperty(legacyDocuments, 'uploadDir', { value: root });
    await expect(
      legacyDocuments.openDownload(document.id, { userId: reviewer }),
    ).rejects.toMatchObject({ status: 403 });
    const sensitiveRole = await db.role.create({
      data: { name: `${prefix}-sensitive-reviewer` },
    });
    for (const [subject, action] of [
      ['Case', 'read'],
      ['Case', 'edit'],
      ['CaseGovernance', 'review'],
      ['CaseGovernance', 'download'],
      ['CaseGovernance', 'read_sensitive'],
    ]) {
      const permission = await db.permission.upsert({
        where: { action_subject: { action, subject } },
        create: { action, subject },
        update: {},
      });
      await db.rolePermission.create({
        data: { roleId: sensitiveRole.id, permissionId: permission.id },
      });
    }
    const sensitiveReviewer = await db.user.create({
      data: {
        username: `${prefix}-sensitive-reviewer`,
        passwordHash: 'synthetic-disabled-login',
        roleId: sensitiveRole.id,
      },
    });
    await db.userTeam.create({
      data: { userId: sensitiveReviewer.id, teamId },
    });
    const publicBytes = Buffer.from(
      'Public synthetic evidence contains no protected case fields',
    );
    await writeFile(join(root, 'public-reviewed.bin'), publicBytes, {
      flag: 'wx',
    });
    const publicDoc = await db.document.create({
      data: {
        title: 'Public reviewed source',
        caseId: protectedCase.id,
        fileName: 'public-reviewed.bin',
        filePath: join(root, 'public-reviewed.bin'),
        originalName: 'public.bin',
        mimeType: 'application/octet-stream',
        size: publicBytes.length,
        uploadedById: maker,
      },
    });
    const fresh = async (extra: Record<string, unknown> = {}) => ({
      requestKey: `${prefix}-${++key}`,
      expectedUpdatedAt: (
        await db.case.findUniqueOrThrow({ where: { id: protectedCase.id } })
      ).updatedAt.toISOString(),
      expectedRevision: 1,
      ...extra,
    });
    const publicAsset = await service.registerAsset(
      protectedCase.id,
      await fresh({ documentId: publicDoc.id }),
      actor(),
    );
    const publicPacket = await service.createPacket(
      protectedCase.id,
      await fresh({
        recipientId: reviewer,
        purpose: 'Reviewed public disclosure',
        basis: 'Synthetic approved declassification',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        items: [
          {
            assetVersionId: publicAsset.data.id,
            contentPolicy: 'PUBLIC_CONTENT_REVIEWED',
          },
        ],
      }),
      actor(),
    );
    await service.submitPacket(
      protectedCase.id,
      publicPacket.data.id,
      await fresh(),
      actor(),
    );
    await expect(
      service.reviewPacket(
        protectedCase.id,
        publicPacket.data.id,
        await fresh({ approve: true }),
        { actorId: reviewer },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await service.reviewPacket(
      protectedCase.id,
      publicPacket.data.id,
      await fresh({ approve: true }),
      { actorId: sensitiveReviewer.id },
    );
    const publicDisclosure = await service.exportPacket(
      protectedCase.id,
      publicPacket.data.id,
      { actorId: reviewer },
    );
    expect(
      Buffer.from(publicDisclosure.data.files[0].base64, 'base64'),
    ).toEqual(publicBytes);
    expect(JSON.stringify(publicDisclosure.data)).not.toContain(needle);
    const downloaded = await legacyDocuments.openDownload(publicDoc.id, {
      userId: reviewer,
    });
    const delivered: Buffer[] = [];
    for await (const chunk of downloaded.data.stream)
      delivered.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
      );
    expect(Buffer.concat(delivered)).toEqual(publicBytes);
    expect(Buffer.concat(delivered).toString()).not.toContain(needle);
    await expect(
      service.verifiedAsset(
        protectedCase.id,
        version.data.id,
        { actorId: reviewer },
        'download',
      ),
    ).rejects.toMatchObject({ status: 403 });
  }, 60000);
  it('records sourced physical receipt, transfer and append correction with actual holder/location chain CAS', async () => {
    const physical = await db.evidence.create({
      data: {
        code: `${prefix}-physical`,
        name: 'Synthetic physical exhibit',
        caseId,
        storageLocation: 'Unknown legacy shelf',
        createdById: maker,
      },
    });
    const receiptBytes = Buffer.from(
      'Synthetic actual custody receipt: warehouse A to custodian B',
    );
    await writeFile(join(root, 'custody-receipt.bin'), receiptBytes, {
      flag: 'wx',
    });
    const receiptDoc = await db.document.create({
      data: {
        title: 'Synthetic actual custody receipt',
        caseId,
        fileName: 'custody-receipt.bin',
        filePath: join(root, 'custody-receipt.bin'),
        originalName: 'custody-receipt.bin',
        mimeType: 'application/octet-stream',
        size: receiptBytes.length,
        uploadedById: maker,
      },
    });
    const warehouse = {
        kind: 'WAREHOUSE' as const,
        identifier: 'warehouse-A',
        name: 'Synthetic actual warehouse A',
      },
      custodian = {
        kind: 'PERSON' as const,
        identifier: 'custodian-B',
        name: 'Synthetic actual custodian B',
      };
    const baseFacts = {
      condition: 'SEALED' as const,
      conditionNote: 'Verified seal recorded in source receipt',
      receiptDocumentId: receiptDoc.id,
      receiptReference: 'SYNTHETIC-CUSTODY-001',
    };
    const receipt = await service.appendCustody(
      caseId,
      await command({
        evidenceId: physical.id,
        eventType: 'RECEIPT',
        occurredAt: '2026-10-06T00:00:00.000Z',
        expectedCustodyEventId: null,
        custodyFacts: {
          ...baseFacts,
          fromHolder: null,
          toHolder: warehouse,
          fromLocation: null,
          toLocation: 'Locker A',
        },
      }),
      actor(),
    );
    await expect(
      service.appendCustody(
        caseId,
        await command({
          evidenceId: physical.id,
          eventType: 'TRANSFER',
          occurredAt: '2026-10-06T01:00:00.000Z',
          expectedCustodyEventId: null,
          custodyFacts: {
            ...baseFacts,
            fromHolder: warehouse,
            toHolder: custodian,
            fromLocation: 'Locker A',
            toLocation: 'Secure cabinet B',
          },
        }),
        actor(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    const transfer = await service.appendCustody(
      caseId,
      await command({
        evidenceId: physical.id,
        eventType: 'TRANSFER',
        occurredAt: '2026-10-06T01:00:00.000Z',
        expectedCustodyEventId: receipt.data.id,
        custodyFacts: {
          ...baseFacts,
          fromHolder: warehouse,
          toHolder: custodian,
          fromLocation: 'Locker A',
          toLocation: 'Secure cabinet B',
        },
      }),
      actor(),
    );
    const original = await db.caseCustodyEvent.findUniqueOrThrow({
      where: { id: transfer.data.id },
    });
    const correction = await service.appendCustody(
      caseId,
      await command({
        evidenceId: physical.id,
        eventType: 'CORRECTION',
        correctsEventId: transfer.data.id,
        occurredAt: '2026-10-06T02:00:00.000Z',
        expectedCustodyEventId: transfer.data.id,
        custodyFacts: {
          ...baseFacts,
          fromHolder: custodian,
          toHolder: custodian,
          fromLocation: 'Secure cabinet B',
          toLocation: 'Secure cabinet B',
          condition: 'INTACT',
          conditionNote: 'Correct observed seal wording',
          correctionReason:
            'Receipt seal wording corrected without moving exhibit',
        },
      }),
      actor(),
    );
    expect(
      await db.caseCustodyEvent.count({ where: { evidenceId: physical.id } }),
    ).toBe(3);
    expect((correction.data.payload as { version: number }).version).toBe(3);
    expect(correction.data.correctsEventId).toBe(transfer.data.id);
    expect(correction.data.sourceDocumentId).toBe(receiptDoc.id);
    expect(
      (
        correction.data.payload as {
          currentCustody: { holder: { identifier: string } };
        }
      ).currentCustody.holder.identifier,
    ).toBe('custodian-B');
    expect(
      (
        await db.caseCustodyEvent.findUniqueOrThrow({
          where: { id: transfer.data.id },
        })
      ).payload,
    ).toEqual(original.payload);
  }, 60000);
  it('R4 actual controller rejects malformed collections without private DB operation writes', async () => {
    const controller = new CaseEvidenceGovernanceController(service),
      before = await db.caseGovernanceOperation.count({ where: { caseId } });
    for (const items of [[null], null, 'asset', [[assetId]]])
      await expect(
        controller.createPacket(
          caseId,
          (await command({ items })) as never,
          { id: maker } as never,
          { dataScope: null } as never,
        ),
      ).rejects.toMatchObject({ status: 400 });
    expect(await db.caseGovernanceOperation.count({ where: { caseId } })).toBe(
      before,
    );
  });
  it('R3 executed disposition preserves exact receipt and rejects stale/tampered/mutable provenance', async () => {
    const record = await db.case.create({
      data: {
        name: `${prefix}-disposition-receipt`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        createdById: maker,
        investigatorId: maker,
      },
    });
    const receiptBytes = Buffer.from(`authorized archive receipt ${prefix}`);
    await writeFile(join(root, 'disposition-target.bin'), bytes, {
      flag: 'wx',
    });
    await writeFile(join(root, 'disposition-receipt.bin'), receiptBytes, {
      flag: 'wx',
    });
    const targetDoc = await db.document.create({
      data: {
        title: 'Synthetic archive target',
        caseId: record.id,
        fileName: 'disposition-target.bin',
        filePath: join(root, 'disposition-target.bin'),
        originalName: 'target.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        uploadedById: maker,
      },
    });
    const receiptDoc = await db.document.create({
      data: {
        title: 'Synthetic archive receipt',
        caseId: record.id,
        fileName: 'disposition-receipt.bin',
        filePath: join(root, 'disposition-receipt.bin'),
        originalName: 'receipt.bin',
        mimeType: 'application/octet-stream',
        size: receiptBytes.length,
        uploadedById: maker,
      },
    });
    async function fresh(extra: Record<string, unknown> = {}) {
      return {
        requestKey: `${prefix}-${++key}`,
        expectedUpdatedAt: (
          await db.case.findUniqueOrThrow({ where: { id: record.id } })
        ).updatedAt.toISOString(),
        expectedRevision: 1,
        ...extra,
      };
    }
    const asset = await service.registerAsset(
      record.id,
      await fresh({ documentId: targetDoc.id }),
      actor(),
    );
    const policy = await service.createRetention(
      record.id,
      await fresh({
        preserveUntil: '2026-01-01T00:00:00.000Z',
        basis: 'Synthetic due archive policy',
      }),
      actor(),
    );
    await service.retentionTransition(
      record.id,
      policy.data.id,
      'review',
      await fresh({ approve: true }),
      { actorId: reviewer },
    );
    await service.retentionTransition(
      record.id,
      policy.data.id,
      'publish',
      await fresh(),
      { actorId: reviewer },
    );
    const request = await service.createDisposition(
      record.id,
      await fresh({
        policyId: policy.data.id,
        assetVersionIds: [asset.data.id],
        purpose: 'Synthetic approved archive',
      }),
      actor(),
    );
    await service.dispositionTransition(
      record.id,
      request.data.id,
      'submit',
      await fresh(),
      actor(),
    );
    await service.dispositionTransition(
      record.id,
      request.data.id,
      'review',
      await fresh({ approve: true }),
      { actorId: reviewer },
    );
    await expect(
      service.dispositionTransition(
        record.id,
        request.data.id,
        'execute',
        await fresh({
          outcome: 'ARCHIVED',
          receipt: {
            reference: 'archive-receipt',
            recordedAt: '2026-01-01T00:00:00.000Z',
            documentId: receiptDoc.id,
            expectedDocumentUpdatedAt: '1900-01-01T00:00:00.000Z',
          },
        }),
        { actorId: reviewer },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await db.caseAssetVersion.findUniqueOrThrow({
          where: { id: asset.data.id },
        })
      ).retiredAt,
    ).toBeNull();
    const executed = await service.dispositionTransition(
      record.id,
      request.data.id,
      'execute',
      await fresh({
        outcome: 'ARCHIVED',
        receipt: {
          reference: 'archive-receipt',
          recordedAt: '2026-01-01T00:00:00.000Z',
          documentId: receiptDoc.id,
          expectedDocumentUpdatedAt: receiptDoc.updatedAt.toISOString(),
        },
      }),
      { actorId: reviewer },
    );
    expect(executed.data.receiptDocumentId).toBe(receiptDoc.id);
    expect(executed.data.receiptSha256).toBe(
      createHash('sha256').update(receiptBytes).digest('hex'),
    );
    expect(executed.data.receiptDocumentUpdatedAt).toBe(
      receiptDoc.updatedAt.toISOString(),
    );
    expect(
      (
        await db.caseDispositionRequest.findUniqueOrThrow({
          where: { id: request.data.id },
        })
      ).receiptDocumentUpdatedAt,
    ).toEqual(receiptDoc.updatedAt);
    expect(executed.data.receiptByteLength).toBe(receiptBytes.length);
    expect(executed.data.receipt).toMatchObject({
      sourceKind: 'IMMUTABLE_DOCUMENT',
      sourceSnapshot: {
        documentId: receiptDoc.id,
        sha256: executed.data.receiptSha256,
      },
    });
    const ordinary = new DocumentsService(
      db as never,
      new AuditService(db as never),
      {} as never,
      new CaseGovernanceService(db as never),
      service,
    );
    Object.defineProperty(ordinary, 'uploadDir', { value: root });
    await expect(
      ordinary.update(receiptDoc.id, { title: 'rewritten' }, maker),
    ).rejects.toThrow('Disposition receipt');
    await expect(
      ordinary.update(receiptDoc.id, { caseId: null as never }, maker),
    ).rejects.toThrow('Disposition receipt');
    await expect(ordinary.delete(receiptDoc.id, maker)).rejects.toThrow(
      'Disposition receipt',
    );
    await expect(
      db.$transaction((tx) =>
        assertCasePreservation(tx, record.id, 'FORCE_ROLLBACK'),
      ),
    ).rejects.toMatchObject({ status: 409 });
    const altered = Buffer.from(receiptBytes);
    altered[0] ^= 1;
    await writeFile(join(root, 'disposition-receipt.bin'), altered);
    try {
      await expect(
        service.decisionSourceSnapshot(
          db as never,
          record.id,
          receiptDoc.id,
          actor(),
        ),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await writeFile(join(root, 'disposition-receipt.bin'), receiptBytes);
    }
    expect(await readFile(join(root, 'disposition-receipt.bin'))).toEqual(
      receiptBytes,
    );
    expect(await readFile(join(root, 'disposition-target.bin'))).toEqual(bytes);
  }, 60000);
  it('R1/R2 current legacy parent OR masks hidden Case identity and agrees on list/detail/verified bytes', async () => {
    const role = await db.role.create({
      data: { name: `${prefix}-legacy-reader` },
    });
    for (const subject of ['Document', 'Petition']) {
      const permission = await db.permission.upsert({
        where: { action_subject: { action: 'read', subject } },
        create: { action: 'read', subject },
        update: {},
      });
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    const reader = await db.user.create({
      data: {
        username: `${prefix}-legacy-reader`,
        passwordHash: 'synthetic-disabled-login',
        roleId: role.id,
        isActive: true,
      },
    });
    await db.userTeam.create({ data: { userId: reader.id, teamId } });
    const otherTeam = await db.team.create({
      data: { name: `${prefix}-hidden-unit`, code: `${prefix}-hidden-unit` },
    });
    const normal = await db.case.create({
      data: {
        name: `HIDDEN_CASE_${prefix}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: otherTeam.id,
        createdById: maker,
        sensitivity: 'NORMAL',
      },
    });
    const petition = await db.petition.create({
      data: {
        stt: `${prefix}-petition`,
        receivedDate: new Date(),
        senderName: 'Synthetic permitted petitioner',
        assignedTeamId: teamId,
        enteredById: reader.id,
      },
    });
    await writeFile(join(root, 'legacy-normal.bin'), bytes, { flag: 'wx' });
    const document = await db.document.create({
      data: {
        title: `legacy-normal-${prefix}`,
        caseId: normal.id,
        petitionId: petition.id,
        fileName: 'legacy-normal.bin',
        filePath: join(root, 'legacy-normal.bin'),
        originalName: 'legacy-normal.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        uploadedById: maker,
      },
    });
    const core = new CaseGovernanceService(db as never),
      legacy = new DocumentsService(
        db as never,
        new AuditService(db as never),
        {} as never,
        core,
        service,
      );
    Object.defineProperty(legacy, 'uploadDir', { value: root });
    expect(
      await core.hasEntityPermission(db as never, reader.id, 'Case', 'read'),
    ).toBe(false);
    expect(await core.hasCapability(db as never, reader.id, 'download')).toBe(
      false,
    );
    const controller = new DocumentsController(legacy),
      request = { dataScope: null } as never,
      user = { id: reader.id } as never;
    const listed = await controller.getList(
      { petitionId: petition.id, search: `legacy-normal-${prefix}` },
      request,
      user,
    );
    expect(listed.total).toBe(1);
    expect(listed.data).toEqual([
      expect.objectContaining({ id: document.id, caseId: null, case: null }),
    ]);
    expect(JSON.stringify(listed)).not.toContain(normal.id);
    expect(JSON.stringify(listed)).not.toContain(normal.name);
    const hiddenCaseSearch = await controller.getList(
      { petitionId: petition.id, tk: [`vuAn~${normal.name}`] },
      request,
      user,
    );
    expect(hiddenCaseSearch.total).toBe(0);
    expect(hiddenCaseSearch.data).toEqual([]);
    const detail = await controller.getById(document.id, request, user);
    expect(detail.data.caseId).toBeNull();
    expect(detail.data.case).toBeNull();
    const downloaded = await legacy.openDownload(document.id, {
      userId: reader.id,
    });
    const chunks: Buffer[] = [];
    for await (const chunk of downloaded.data.stream)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    expect(Buffer.concat(chunks)).toEqual(bytes);
    const safeDefinition = {
      fields: [],
      fieldPolicies: [
        { key: 'description', sensitivity: 'NORMAL', exportable: true },
      ],
    };
    const safeHash = manifestHash(safeDefinition),
      safeSchema = await db.caseFieldDefinitionVersion.create({
        data: {
          code: `${prefix}-legacy-safe`,
          definition: safeDefinition,
          status: 'PUBLISHED',
          contentHash: safeHash,
          approvedHash: safeHash,
          approvedRevision: 1,
          authorId: maker,
          reviewedById: reviewer,
          publishedAt: new Date(),
        },
      });
    await db.case.update({
      where: { id: normal.id },
      data: { fieldDefinitionVersionId: safeSchema.id },
    });
    expect(
      (await controller.getList({ petitionId: petition.id }, request, user))
        .total,
    ).toBe(1);
    await expect(
      legacy.openDownload(document.id, { userId: reader.id }),
    ).resolves.toMatchObject({ success: true });
    for (const [label, definition, status] of [
      [
        'protected',
        {
          fields: [],
          fieldPolicies: [{ key: 'sdtCungCap', sensitivity: 'RESTRICTED' }],
        },
        'PUBLISHED',
      ],
      [
        'export-denied',
        {
          fields: [],
          fieldPolicies: [
            { key: 'description', sensitivity: 'NORMAL', exportable: false },
          ],
        },
        'PUBLISHED',
      ],
      ['unpublished', { fields: [] }, 'DRAFT'],
    ] as const) {
      const hash = manifestHash(definition),
        schema = await db.caseFieldDefinitionVersion.create({
          data: {
            code: `${prefix}-legacy-${label}`,
            definition: JSON.parse(
              JSON.stringify(definition),
            ) as Prisma.InputJsonValue,
            status,
            contentHash: hash,
            approvedHash: hash,
            approvedRevision: 1,
            authorId: maker,
            reviewedById: reviewer,
            publishedAt: status === 'PUBLISHED' ? new Date() : null,
          },
        });
      await db.case.update({
        where: { id: normal.id },
        data: { fieldDefinitionVersionId: schema.id },
      });
      const blocked = await controller.getList(
        { petitionId: petition.id },
        request,
        user,
      );
      expect(blocked.total).toBe(0);
      expect(blocked.data).toEqual([]);
      await expect(
        controller.getById(document.id, request, user),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        legacy.openDownload(document.id, { userId: reader.id }),
      ).rejects.toMatchObject({ status: 403 });
    }
    await db.case.update({
      where: { id: normal.id },
      data: {
        fieldDefinitionVersionId: safeSchema.id,
        metadata: { sensitivity: 'UNKNOWN_LEGACY_LABEL' },
      },
    });
    expect(
      (await controller.getList({ petitionId: petition.id }, request, user))
        .total,
    ).toBe(0);
    await expect(
      legacy.openDownload(document.id, { userId: reader.id }),
    ).rejects.toMatchObject({ status: 403 });
    for (const metadata of [
      { _sensitivity: 'UNKNOWN_LEGACY_LABEL' },
      { sensitivity: 'NORMAL', _sensitivity: 'RESTRICTED' },
    ]) {
      await db.case.update({ where: { id: normal.id }, data: { metadata } });
      expect(
        (await controller.getList({ petitionId: petition.id }, request, user))
          .total,
      ).toBe(0);
      await expect(
        legacy.openDownload(document.id, { userId: reader.id }),
      ).rejects.toMatchObject({ status: 403 });
    }
    await db.case.update({ where: { id: normal.id }, data: { metadata: {} } });
    const caseRead = await db.permission.upsert({
      where: { action_subject: { action: 'read', subject: 'Case' } },
      create: { action: 'read', subject: 'Case' },
      update: {},
    });
    await db.rolePermission.create({
      data: { roleId: role.id, permissionId: caseRead.id },
    });
    const restricted = await db.case.create({
      data: {
        name: `R1 restricted ${prefix}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        createdById: maker,
        sensitivity: 'RESTRICTED',
      },
    });
    const hidden = await db.document.create({
      data: {
        title: `r1-secret-${prefix}`,
        description: `private restricted needle ${prefix}`,
        caseId: restricted.id,
        fileName: 'legacy-normal.bin',
        filePath: join(root, 'legacy-normal.bin'),
        originalName: 'private.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        uploadedById: maker,
      },
    });
    const denied = await controller.getList(
      { caseId: restricted.id, search: `r1-secret-${prefix}` },
      request,
      user,
    );
    expect(denied.total).toBe(0);
    expect(denied.data).toEqual([]);
    expect(JSON.stringify(denied)).not.toContain(hidden.id);
    await expect(
      controller.getById(hidden.id, request, user),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      legacy.openDownload(hidden.id, { userId: reader.id }),
    ).rejects.toMatchObject({ status: 403 });
    const beforeRemoval = await controller.getList(
      { caseId, search: prefix },
      request,
      user,
    );
    expect(beforeRemoval.total).toBeGreaterThan(0);
    await db.rolePermission.delete({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: caseRead.id },
      },
    });
    const stale = await controller.getList(
      { caseId, search: prefix },
      request,
      user,
    );
    expect(stale.total).toBe(0);
    expect(stale.data).toEqual([]);
  }, 60000);
  it('related packet pins real owning Case and link revision and denies stale/revoked/deleted authority', async () => {
    const owner = await db.case.create({
      data: {
        name: `Related owner ${prefix}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        investigatorId: maker,
        createdById: maker,
      },
    });
    const target = await db.case.create({
      data: {
        name: `Related packet ${prefix}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        assignedTeamId: teamId,
        investigatorId: maker,
        createdById: maker,
      },
    });
    await writeFile(join(root, 'related-original.bin'), bytes, { flag: 'wx' });
    const doc = await db.document.create({
      data: {
        title: 'Related synthetic original',
        caseId: owner.id,
        fileName: 'related-original.bin',
        filePath: join(root, 'related-original.bin'),
        originalName: 'related-original.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        uploadedById: maker,
      },
    });
    const registered = await service.registerAsset(
      owner.id,
      {
        requestKey: `${prefix}-${++key}`,
        expectedUpdatedAt: owner.updatedAt.toISOString(),
        documentId: doc.id,
      },
      actor(),
    );
    const link = await db.caseRelation.create({
      data: {
        sourceCaseId: target.id,
        targetCaseId: owner.id,
        type: 'RELATED',
        createdById: maker,
      },
    });
    async function relatedCommand(extra: Record<string, unknown> = {}) {
      return {
        requestKey: `${prefix}-${++key}`,
        expectedUpdatedAt: (
          await db.case.findUniqueOrThrow({ where: { id: target.id } })
        ).updatedAt.toISOString(),
        expectedRevision: 1,
        ...extra,
      };
    }
    const packet = await service.createPacket(
      target.id,
      await relatedCommand({
        recipientId: reviewer,
        purpose: 'Review direct related original',
        basis: 'Synthetic authorized typed relation',
        expiresAt: '2099-01-01T00:00:00.000Z',
        items: [{ assetVersionId: registered.data.id }],
      }),
      actor(),
    );
    await service.submitPacket(
      target.id,
      packet.data.id,
      await relatedCommand(),
      actor(),
    );
    await service.reviewPacket(
      target.id,
      packet.data.id,
      await relatedCommand({ approve: true }),
      { actorId: reviewer },
    );
    const exported = await service.exportPacket(target.id, packet.data.id, {
      actorId: reviewer,
    });
    expect(exported.data.manifest.items[0]).toMatchObject({
      ownerCaseId: owner.id,
      relationId: link.id,
      relationRevision: 1,
    });
    expect(
      (await db.document.findUniqueOrThrow({ where: { id: doc.id } })).caseId,
    ).toBe(owner.id);
    await db.caseRelation.update({
      where: { id: link.id },
      data: { revision: { increment: 1 } },
    });
    await expect(
      service.exportPacket(target.id, packet.data.id, { actorId: reviewer }),
    ).rejects.toMatchObject({ status: 409 });
    await db.caseRelation.update({
      where: { id: link.id },
      data: { revokedAt: new Date(), revokedById: maker },
    });
    await expect(
      service.verifyAsset(target.id, registered.data.id, actor()),
    ).rejects.toMatchObject({ status: 403 });
    await db.caseRelation.update({
      where: { id: link.id },
      data: { deletedAt: new Date() },
    });
    await expect(
      service.exportPacket(target.id, packet.data.id, { actorId: reviewer }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await readFile(join(root, 'related-original.bin'))).toEqual(bytes);
  }, 60000);
});

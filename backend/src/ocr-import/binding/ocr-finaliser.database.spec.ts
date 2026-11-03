import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { PrismaService } from '../../prisma/prisma.service';
import { OcrSessionsService } from '../sessions/ocr-sessions.service';
import { ImageStorageService } from '../storage/image-storage.service';
import { OcrBinder } from './ocr-binder';
import { OcrFinaliser } from './ocr-finaliser';

/**
 * After a session is bound, its originals become documents of the record. Runs on REAL PostgreSQL with a recording
 * stand-in for the documents service. Only with `PETITION_SUGGEST_DATABASE_URL`.
 */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

interface CreatedDocument {
  dto: Record<string, unknown>;
  actorId: string;
}

run('OcrFinaliser on PostgreSQL', () => {
  let db: PrismaClient;
  let sessions: OcrSessionsService;
  let storage: ImageStorageService;
  let finaliser: OcrFinaliser;
  let ocrRoot: string;
  let docsRoot: string;
  let created: CreatedDocument[];
  let failOnCall: number | null;
  /** How many times the documents service was asked to create something; only `failOnCall` fails. */
  let attempts: number;
  let existing: Set<string>;
  /** Parent record ids for which the documents service always refuses (a record deleted before its scans arrived). */
  let refusedParents: Set<string>;
  const tag = `fin-${randomUUID().slice(0, 8)}`;
  const alice = { id: `${tag}-alice` };

  const documents = {
    create: (dto: Record<string, unknown>, actorId: string) => {
      attempts += 1;
      const parent = (dto.petitionId ?? dto.incidentId ?? dto.caseId) as string;
      if (refusedParents.has(parent)) {
        return Promise.reject(new Error('the record no longer exists'));
      }
      if (failOnCall === attempts) {
        return Promise.reject(new Error('the record is not writable'));
      }
      created.push({ dto, actorId });
      return Promise.resolve({ data: { id: `doc-${created.length}` } });
    },
  };

  const scan = (shade: number) =>
    sharp({
      create: {
        width: 40,
        height: 30,
        channels: 3,
        background: { r: shade, g: 9, b: 9 },
      },
    })
      .jpeg()
      .toBuffer();

  /** A bound session with `count` pages, as the create flow leaves it. */
  const boundSession = async (
    count: number,
    entity: 'PETITION' | 'INCIDENT' | 'CASE' = 'PETITION',
  ) => {
    const s = await sessions.createSession(entity, alice);
    for (let i = 0; i < count; i += 1) {
      const stored = await storage.saveOriginal(s.id, await scan(50 + i * 40));
      await sessions.addPage(s.id, stored, alice);
    }
    const analysis = await sessions.publishAnalysis(
      s.id,
      {
        entity,
        pageSetRevision: count,
        inputFingerprint: await sessions.currentFingerprint(s.id),
        bundle: {},
        cleaned: {},
        issues: [],
        projection: {},
        promptVersions: {},
      },
      alice,
    );
    await db.$transaction((tx) =>
      new OcrBinder().bind(tx, {
        sessionId: s.id,
        analysisId: analysis.id,
        entity,
        recordId: `rec-${s.id}`,
        userId: alice.id,
      }),
    );
    return s;
  };

  const wipe = () =>
    db.ocrSession.deleteMany({ where: { createdById: { startsWith: tag } } });

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.pathname !== '/pc02_goiy_scope_test'
    ) {
      throw new Error(
        'Refused: PETITION_SUGGEST_DATABASE_URL must point to 127.0.0.1/pc02_goiy_scope_test',
      );
    }
    const client = new Client({ connectionString: url! });
    await client.connect();
    try {
      for (const migration of [
        '20261103203000_ocr_sessions',
        '20261103213000_ocr_jobs',
        '20261103223000_ocr_finalise',
        '20261103224500_ocr_page_document',
        '20261103230000_ocr_finalise_claim',
      ]) {
        const sql = fs.readFileSync(
          path.join(
            __dirname,
            `../../../prisma/migrations/${migration}/migration.sql`,
          ),
          'utf-8',
        );
        const marker = '-- Rules Prisma cannot express';
        await client.query(
          sql.includes(marker) ? sql.slice(sql.indexOf(marker)) : sql,
        );
      }
    } finally {
      await client.end();
    }
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
    await wipe();
  });

  beforeEach(() => {
    created = [];
    failOnCall = null;
    attempts = 0;
    existing = new Set();
    refusedParents = new Set();
    ocrRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-fin-'));
    docsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-fin-'));
    sessions = new OcrSessionsService(db as unknown as PrismaService);
    storage = new ImageStorageService({ rootDir: ocrRoot });
    finaliser = new OcrFinaliser(
      db as unknown as PrismaService,
      storage,
      documents as never,
      {
        documentsDir: docsRoot,
        findExistingDocument: (_parent, originalName) =>
          Promise.resolve(
            existing.has(originalName) ? { id: `old-${originalName}` } : null,
          ),
      },
    );
  });
  afterEach(async () => {
    await wipe();
    fs.rmSync(ocrRoot, { recursive: true, force: true });
    fs.rmSync(docsRoot, { recursive: true, force: true });
  });
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  it('turns each page into a scan document of the record, in page order, then marks the session finalised', async () => {
    const s = await boundSession(2);
    expect(await finaliser.finalise(s.id)).toEqual({
      state: 'DONE',
      documents: 2,
    });

    expect(created).toHaveLength(2);
    expect(created.map((c) => c.dto.title)).toEqual([
      'Bản scan trang 1',
      'Bản scan trang 2',
    ]);
    for (const c of created) {
      expect(c.dto).toMatchObject({
        documentType: 'BAN_SCAN',
        petitionId: `rec-${s.id}`,
        mimeType: 'image/jpeg',
      });
      expect(c.actorId).toBe(alice.id);
    }
    const row = await db.ocrSession.findUniqueOrThrow({ where: { id: s.id } });
    expect(row.finalisedAt).toBeInstanceOf(Date);
    const pages = await db.ocrPage.findMany({ where: { sessionId: s.id } });
    expect(pages.every((p) => p.documentId)).toBe(true);
  });

  it('copies the bytes unchanged into the documents folder under a server-chosen name', async () => {
    const s = await boundSession(1);
    await finaliser.finalise(s.id);
    const dto = created[0].dto as {
      fileName: string;
      filePath: string;
      size: number;
    };
    const original = await db.ocrPage.findFirstOrThrow({
      where: { sessionId: s.id },
    });
    const copied = fs.readFileSync(path.join(docsRoot, dto.fileName));
    expect(
      copied.equals(fs.readFileSync(path.join(ocrRoot, original.originalPath))),
    ).toBe(true);
    expect(dto.size).toBe(copied.length);
    expect(dto.fileName).not.toMatch(/[\\/]/);
  });

  it('attaches to the right kind of parent', async () => {
    const incident = await boundSession(1, 'INCIDENT');
    const kase = await boundSession(1, 'CASE');
    await finaliser.finalise(incident.id);
    await finaliser.finalise(kase.id);
    expect(created[0].dto).toMatchObject({ incidentId: `rec-${incident.id}` });
    expect(created[0].dto.petitionId).toBeUndefined();
    expect(created[1].dto).toMatchObject({ caseId: `rec-${kase.id}` });
  });

  it('running it again changes nothing', async () => {
    const s = await boundSession(2);
    await finaliser.finalise(s.id);
    expect(await finaliser.finalise(s.id)).toEqual({
      state: 'SKIPPED',
      documents: 0,
    });
    expect(created).toHaveLength(2);
    expect(fs.readdirSync(docsRoot)).toHaveLength(2);
  });

  it('after a failure on the second page, keeps the first and finishes only the rest on the next run', async () => {
    const s = await boundSession(3);
    failOnCall = 2;
    await expect(finaliser.finalise(s.id)).rejects.toThrow('not writable');
    expect(created).toHaveLength(1);
    expect(
      (await db.ocrSession.findUniqueOrThrow({ where: { id: s.id } }))
        .finalisedAt,
    ).toBeNull();
    // the file copied for the refused page was removed again
    expect(fs.readdirSync(docsRoot)).toHaveLength(1);

    failOnCall = null;
    expect(await finaliser.finalise(s.id)).toEqual({
      state: 'DONE',
      documents: 2,
    });
    expect(created).toHaveLength(3);
    expect(created.map((c) => c.dto.title)).toEqual([
      'Bản scan trang 1',
      'Bản scan trang 2',
      'Bản scan trang 3',
    ]);
  });

  it('links a document that an earlier crashed run already created instead of creating a second', async () => {
    const s = await boundSession(1);
    const page = await db.ocrPage.findFirstOrThrow({
      where: { sessionId: s.id },
    });
    existing.add(`ban-scan-1-${page.sha256.slice(0, 8)}.jpg`);
    expect(await finaliser.finalise(s.id)).toEqual({
      state: 'DONE',
      documents: 1,
    });
    expect(created).toHaveLength(0);
    expect(
      (await db.ocrPage.findUniqueOrThrow({ where: { id: page.id } }))
        .documentId,
    ).toBe(`old-ban-scan-1-${page.sha256.slice(0, 8)}.jpg`);
  });

  it('does nothing for a session that is not bound', async () => {
    const open = await sessions.createSession('PETITION', alice);
    expect(await finaliser.finalise(open.id)).toEqual({
      state: 'SKIPPED',
      documents: 0,
    });
  });

  it('the sweep finalises every bound session still waiting, and a failing one waits before its next try', async () => {
    const a = await boundSession(1);
    const b = await boundSession(1);
    const c = await boundSession(1);
    failOnCall = 2; // the second document created overall fails
    const result = await finaliser.sweep(10, tag);
    expect(result).toEqual({ finalised: 2, failed: 1 });

    const waiting = await db.ocrSession.findMany({
      where: { id: { in: [a.id, b.id, c.id] }, finalisedAt: null },
    });
    expect(waiting).toHaveLength(1);
    expect(waiting[0].finaliseAttempts).toBe(1);
    expect(waiting[0].finaliseClaimedAt).toBeNull();
    expect(waiting[0].finaliseNextAt!.getTime()).toBeGreaterThan(Date.now());

    // Not yet due: the next sweep leaves it alone.
    failOnCall = null;
    expect(await finaliser.sweep(10, tag)).toEqual({ finalised: 0, failed: 0 });
    // Once due, it is tried again and completes.
    await db.ocrSession.update({
      where: { id: waiting[0].id },
      data: { finaliseNextAt: new Date(Date.now() - 1000) },
    });
    expect(await finaliser.sweep(10, tag)).toEqual({ finalised: 1, failed: 0 });
  });

  it('sessions that keep failing do not keep newer ones from being served', async () => {
    const broken1 = await boundSession(1);
    const broken2 = await boundSession(1);
    const healthy = await boundSession(1);
    refusedParents = new Set([`rec-${broken1.id}`, `rec-${broken2.id}`]);

    expect(await finaliser.sweep(2, tag)).toEqual({ finalised: 0, failed: 2 });
    // The two failed ones are now waiting, so the next batch reaches the healthy one.
    expect(await finaliser.sweep(2, tag)).toEqual({ finalised: 1, failed: 0 });
    expect(
      (await db.ocrSession.findUniqueOrThrow({ where: { id: healthy.id } }))
        .finalisedAt,
    ).toBeInstanceOf(Date);
  });

  it('a session another instance is finalising right now is left to it; a dead instance claim is taken over', async () => {
    const s = await boundSession(1);
    await db.ocrSession.update({
      where: { id: s.id },
      data: { finaliseClaimedAt: new Date() },
    });
    expect(await finaliser.finalise(s.id)).toEqual({
      state: 'SKIPPED',
      documents: 0,
    });
    expect(created).toHaveLength(0);

    await db.ocrSession.update({
      where: { id: s.id },
      data: { finaliseClaimedAt: new Date(Date.now() - 30 * 60_000) },
    });
    expect(await finaliser.finalise(s.id)).toEqual({
      state: 'DONE',
      documents: 1,
    });
  });

  it('two instances finalising the same session at once create each document once', async () => {
    const s = await boundSession(2);
    const results = await Promise.all([
      finaliser.finalise(s.id),
      finaliser.finalise(s.id),
    ]);
    expect(results.map((r) => r.state).sort()).toEqual(['DONE', 'SKIPPED']);
    expect(created).toHaveLength(2);
  });
});

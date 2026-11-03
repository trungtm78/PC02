import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import { OcrSessionsService } from '../sessions/ocr-sessions.service';
import { OcrBinder } from './ocr-binder';

/**
 * Binding a session to the record the officer saves, inside the record's own transaction, on REAL PostgreSQL.
 * Runs only with `PETITION_SUGGEST_DATABASE_URL`.
 */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (
      (error as { getResponse?: () => { code?: string } }).getResponse?.()
        .code ?? 'unknown'
    );
  }
};

run('OcrBinder on PostgreSQL', () => {
  let db: PrismaClient;
  let sessions: OcrSessionsService;
  let binder: OcrBinder;
  const tag = `bnd-${randomUUID().slice(0, 8)}`;
  const alice = { id: `${tag}-alice` };
  const bob = { id: `${tag}-bob` };
  let counter = 0;

  /** An open session with one page and one published analysis; returns the analysis id the form was filled from. */
  const readySession = async (
    entity: 'PETITION' | 'INCIDENT' | 'CASE' = 'PETITION',
  ) => {
    const s = await sessions.createSession(entity, alice);
    counter += 1;
    await sessions.addPage(
      s.id,
      {
        sha256: `${tag}-${counter}`.padEnd(64, '0').slice(0, 64),
        mimeType: 'image/png',
        sizeBytes: 10,
        originalPath: `x/${counter}.png`,
      },
      alice,
    );
    const analysis = await sessions.publishAnalysis(
      s.id,
      {
        entity,
        pageSetRevision: 1,
        inputFingerprint: await sessions.currentFingerprint(s.id),
        bundle: {},
        cleaned: {},
        issues: [],
        projection: {},
        promptVersions: {},
      },
      alice,
    );
    return { session: s, analysisId: analysis.id };
  };

  const bindIn = (input: Parameters<OcrBinder['bind']>[1], fail = false) =>
    db.$transaction(async (tx) => {
      await binder.bind(tx, input);
      if (fail) throw new Error('the record could not be created');
    });

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
    sessions = new OcrSessionsService(db as unknown as PrismaService);
    binder = new OcrBinder();
  });
  afterEach(wipe);
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  it('binds the session to the record, once, and leaves finalisation pending', async () => {
    const { session, analysisId } = await readySession();
    await bindIn({
      sessionId: session.id,
      analysisId,
      entity: 'PETITION',
      recordId: 'rec-1',
      userId: alice.id,
    });
    const row = await db.ocrSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(row).toMatchObject({
      status: 'BOUND',
      boundRecordId: 'rec-1',
      finalisedAt: null,
    });
    expect(row.boundAt).toBeInstanceOf(Date);
  });

  it('is undone with the record: a failed save leaves the session open for another try', async () => {
    const { session, analysisId } = await readySession();
    await expect(
      bindIn(
        {
          sessionId: session.id,
          analysisId,
          entity: 'PETITION',
          recordId: 'rec-1',
          userId: alice.id,
        },
        true,
      ),
    ).rejects.toThrow('could not be created');
    expect(
      (await db.ocrSession.findUniqueOrThrow({ where: { id: session.id } }))
        .status,
    ).toBe('OPEN');
  });

  it("refuses someone else's session as if it did not exist", async () => {
    const { session, analysisId } = await readySession();
    expect(
      await codeOf(
        bindIn({
          sessionId: session.id,
          analysisId,
          entity: 'PETITION',
          recordId: 'r',
          userId: bob.id,
        }),
      ),
    ).toBe('OCR_SESSION_NOT_FOUND');
  });

  it('refuses a session opened for another kind of record', async () => {
    const { session, analysisId } = await readySession('INCIDENT');
    expect(
      await codeOf(
        bindIn({
          sessionId: session.id,
          analysisId,
          entity: 'PETITION',
          recordId: 'r',
          userId: alice.id,
        }),
      ),
    ).toBe('OCR_ENTITY_MISMATCH');
  });

  it('refuses an analysis that does not belong to the session', async () => {
    const { session } = await readySession();
    const other = await readySession();
    expect(
      await codeOf(
        bindIn({
          sessionId: session.id,
          analysisId: other.analysisId,
          entity: 'PETITION',
          recordId: 'r',
          userId: alice.id,
        }),
      ),
    ).toBe('OCR_ANALYSIS_NOT_FOUND');
  });

  it('accepts an analysis the form was filled from even if the text was corrected afterwards', async () => {
    const { session, analysisId } = await readySession();
    const [page] = await sessions.listPages(session.id, alice);
    await sessions.saveTranscript(
      session.id,
      page.id,
      { text: 'sửa sau', source: 'OFFICER' },
      alice,
    );
    await bindIn({
      sessionId: session.id,
      analysisId,
      entity: 'PETITION',
      recordId: 'rec-9',
      userId: alice.id,
    });
    expect(
      (await db.ocrSession.findUniqueOrThrow({ where: { id: session.id } }))
        .status,
    ).toBe('BOUND');
  });

  it('a session is bound to one record only, and a cancelled one to none', async () => {
    const { session, analysisId } = await readySession();
    const input = {
      sessionId: session.id,
      analysisId,
      entity: 'PETITION' as const,
      userId: alice.id,
    };
    await bindIn({ ...input, recordId: 'first' });
    expect(await codeOf(bindIn({ ...input, recordId: 'second' }))).toBe(
      'OCR_SESSION_CLOSED',
    );
    expect(
      (await db.ocrSession.findUniqueOrThrow({ where: { id: session.id } }))
        .boundRecordId,
    ).toBe('first');

    const other = await readySession();
    await sessions.cancel(other.session.id, alice);
    expect(
      await codeOf(
        bindIn({
          sessionId: other.session.id,
          analysisId: other.analysisId,
          entity: 'PETITION',
          recordId: 'x',
          userId: alice.id,
        }),
      ),
    ).toBe('OCR_SESSION_CLOSED');
  });

  it('two saves racing for one session: exactly one binds', async () => {
    const { session, analysisId } = await readySession();
    const attempt = (recordId: string) =>
      bindIn({
        sessionId: session.id,
        analysisId,
        entity: 'PETITION',
        recordId,
        userId: alice.id,
      }).then(
        () => 'bound',
        (e: unknown) =>
          (e as { getResponse?: () => { code?: string } }).getResponse?.().code,
      );
    const results = await Promise.all([attempt('a'), attempt('b')]);
    expect(results.filter((r) => r === 'bound')).toHaveLength(1);
    expect(results.filter((r) => r === 'OCR_SESSION_CLOSED')).toHaveLength(1);
  });
});

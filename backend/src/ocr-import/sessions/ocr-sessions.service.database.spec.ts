import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import { OcrSessionsService, type PageFileMeta } from './ocr-sessions.service';

/**
 * OcrSessionsService on REAL PostgreSQL: the revision rules that keep a late or stale result from overwriting a
 * newer one. Runs only with `PETITION_SUGGEST_DATABASE_URL` (127.0.0.1/pc02_goiy_scope_test); CI makes a missing
 * database a failure.
 */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

const code = async (promise: Promise<unknown>): Promise<string | null> => {
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

run('OcrSessionsService on PostgreSQL', () => {
  let db: PrismaClient;
  let service: OcrSessionsService;
  const tag = `ocr-${randomUUID().slice(0, 8)}`;
  const alice = { id: `${tag}-alice` };
  const bob = { id: `${tag}-bob` };

  const file = (name: string): PageFileMeta => ({
    sha256: `${tag}-${name}`.padEnd(64, '0').slice(0, 64),
    mimeType: 'image/png',
    sizeBytes: 1234,
    originalPath: `uploads/ocr/${tag}/${name}.png`,
  });

  const analysisFor = (fingerprint: string, revision: number, mark = 'x') => ({
    entity: 'PETITION' as const,
    pageSetRevision: revision,
    inputFingerprint: fingerprint,
    bundle: { mark },
    cleaned: { mark },
    issues: [],
    projection: { fills: [], skips: [] },
    promptVersions: { transcribe: 'transcribe.v1', analyse: 'analyse.v1' },
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
    // CI builds the tables with `prisma db push`, which cannot express the partial unique indexes and the CHECK
    // constraint. Apply that section of the REAL migration (idempotent) so the specs test the shipped SQL.
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '../../../prisma/migrations/20261103203000_ocr_sessions/migration.sql',
      ),
      'utf-8',
    );
    const marker = '-- Rules Prisma cannot express';
    expect(sql).toContain(marker);
    const client = new Client({ connectionString: url! });
    await client.connect();
    try {
      await client.query(sql.slice(sql.indexOf(marker)));
    } finally {
      await client.end();
    }
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
    await wipe();
  });

  beforeEach(() => {
    service = new OcrSessionsService(db as unknown as PrismaService, {
      maxPages: 3,
    });
  });
  afterEach(wipe);
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  describe('sessions and ownership', () => {
    it('opens a session that expires in seven days, at revision 0', async () => {
      const s = await service.createSession('PETITION', alice);
      expect(s).toMatchObject({
        status: 'OPEN',
        pageSetRevision: 0,
        entity: 'PETITION',
      });
      const days = (s.expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.9);
      expect(days).toBeLessThan(7.1);
    });

    it('is invisible to anyone but its creator: another user gets "not found", not "forbidden"', async () => {
      const s = await service.createSession('PETITION', alice);
      expect(await code(service.getSession(s.id, bob))).toBe(
        'OCR_SESSION_NOT_FOUND',
      );
      expect(await code(service.addPage(s.id, file('a'), bob))).toBe(
        'OCR_SESSION_NOT_FOUND',
      );
    });

    it('refuses to change a cancelled session', async () => {
      const s = await service.createSession('PETITION', alice);
      await service.cancel(s.id, alice);
      expect(await code(service.addPage(s.id, file('a'), alice))).toBe(
        'OCR_SESSION_CLOSED',
      );
    });
  });

  describe('pages and immutable page-set revisions', () => {
    it('every change makes a new revision, and an earlier revision never changes', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('a'), alice);
      const b = await service.addPage(s.id, file('b'), alice);
      expect([a.pageSetRevision, b.pageSetRevision]).toEqual([1, 2]);

      const first = await db.ocrPageSet.findUniqueOrThrow({
        where: { sessionId_revision: { sessionId: s.id, revision: 1 } },
      });
      await service.reorderPages(s.id, [b.page.id, a.page.id], alice);
      await service.removePage(s.id, a.page.id, alice);
      const again = await db.ocrPageSet.findUniqueOrThrow({
        where: { sessionId_revision: { sessionId: s.id, revision: 1 } },
      });
      expect(again.pages).toEqual(first.pages);
      expect((await service.getSession(s.id, alice)).pageSetRevision).toBe(4);
    });

    it('rejects the same scan twice in one session, but accepts it again once the first copy was removed', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('a'), alice);
      expect(await code(service.addPage(s.id, file('a'), alice))).toBe(
        'OCR_PAGE_DUPLICATE',
      );
      await service.removePage(s.id, a.page.id, alice);
      expect(await code(service.addPage(s.id, file('a'), alice))).toBeNull();
    });

    it('enforces the page limit', async () => {
      const s = await service.createSession('PETITION', alice);
      for (const n of ['a', 'b', 'c'])
        await service.addPage(s.id, file(n), alice);
      expect(await code(service.addPage(s.id, file('d'), alice))).toBe(
        'OCR_TOO_MANY_PAGES',
      );
    });

    it('reordering must name exactly the pages in the session', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('a'), alice);
      await service.addPage(s.id, file('b'), alice);
      expect(await code(service.reorderPages(s.id, [a.page.id], alice))).toBe(
        'OCR_PAGE_SET_MISMATCH',
      );
      expect(
        await code(service.reorderPages(s.id, [a.page.id, 'ghost'], alice)),
      ).toBe('OCR_PAGE_SET_MISMATCH');
    });

    it('lists the active pages in the order of the current revision', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('a'), alice);
      const b = await service.addPage(s.id, file('b'), alice);
      await service.reorderPages(s.id, [b.page.id, a.page.id], alice);
      expect((await service.listPages(s.id, alice)).map((p) => p.id)).toEqual([
        b.page.id,
        a.page.id,
      ]);
    });
  });

  describe('transcripts', () => {
    it('adds a revision each time and returns the latest, keeping the model reading as history', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('a'), alice);
      const one = await service.saveTranscript(
        s.id,
        a.page.id,
        { text: 'model reading', source: 'MODEL' },
        alice,
      );
      const two = await service.saveTranscript(
        s.id,
        a.page.id,
        { text: 'officer fix', source: 'OFFICER' },
        alice,
      );
      expect([one.revision, two.revision]).toEqual([1, 2]);
      const latest = await service.latestTranscripts(s.id, alice);
      expect(latest[a.page.id]).toMatchObject({
        text: 'officer fix',
        revision: 2,
        source: 'OFFICER',
      });
      expect(
        await db.ocrTranscript.count({ where: { pageId: a.page.id } }),
      ).toBe(2);
    });

    it('refuses a transcript for a page that is not in this session', async () => {
      const s = await service.createSession('PETITION', alice);
      const other = await service.createSession('PETITION', alice);
      const a = await service.addPage(other.id, file('a'), alice);
      expect(
        await code(
          service.saveTranscript(
            s.id,
            a.page.id,
            { text: 'x', source: 'MODEL' },
            alice,
          ),
        ),
      ).toBe('OCR_PAGE_NOT_FOUND');
    });
  });

  describe('fingerprint of the input state', () => {
    it('is stable while nothing changes, and changes when a page, the order or a transcript changes', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('a'), alice);
      const f1 = await service.currentFingerprint(s.id);
      expect(await service.currentFingerprint(s.id)).toBe(f1);

      const b = await service.addPage(s.id, file('b'), alice);
      const f2 = await service.currentFingerprint(s.id);
      expect(f2).not.toBe(f1);

      await service.reorderPages(s.id, [b.page.id, a.page.id], alice);
      const f3 = await service.currentFingerprint(s.id);
      expect(f3).not.toBe(f2);

      await service.saveTranscript(
        s.id,
        a.page.id,
        { text: 't', source: 'MODEL' },
        alice,
      );
      expect(await service.currentFingerprint(s.id)).not.toBe(f3);
    });
  });

  describe('publishing an analysis (compare-and-set)', () => {
    it('a result computed for the present state becomes the current analysis', async () => {
      const s = await service.createSession('PETITION', alice);
      await service.addPage(s.id, file('a'), alice);
      const fp = await service.currentFingerprint(s.id);
      const out = await service.publishAnalysis(
        s.id,
        analysisFor(fp, 1),
        alice,
      );
      expect(out.isCurrent).toBe(true);
      expect((await service.currentAnalysis(s.id, alice))?.id).toBe(out.id);
    });

    it('a newer result replaces the current one and the older stays as history', async () => {
      const s = await service.createSession('PETITION', alice);
      await service.addPage(s.id, file('a'), alice);
      const fp = await service.currentFingerprint(s.id);
      const first = await service.publishAnalysis(
        s.id,
        analysisFor(fp, 1, 'first'),
        alice,
      );
      const second = await service.publishAnalysis(
        s.id,
        analysisFor(fp, 1, 'second'),
        alice,
      );
      expect((await service.currentAnalysis(s.id, alice))?.id).toBe(second.id);
      expect(await db.ocrAnalysis.count({ where: { sessionId: s.id } })).toBe(
        2,
      );
      expect(first.id).not.toBe(second.id);
    });

    it('a late result for an input state that has since changed is kept as history and NEVER becomes current', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('a'), alice);
      const staleFingerprint = await service.currentFingerprint(s.id);
      const good = await service.publishAnalysis(
        s.id,
        analysisFor(staleFingerprint, 1, 'good'),
        alice,
      );

      // The officer corrects the transcript while an older run is still in flight.
      await service.saveTranscript(
        s.id,
        a.page.id,
        { text: 'fix', source: 'OFFICER' },
        alice,
      );
      const late = await service.publishAnalysis(
        s.id,
        analysisFor(staleFingerprint, 1, 'late'),
        alice,
      );

      expect(late.isCurrent).toBe(false);
      // The state moved on, so NO analysis is current any more: the earlier one no longer matches either.
      expect(await service.currentAnalysis(s.id, alice)).toBeNull();
      expect(await db.ocrAnalysis.count({ where: { sessionId: s.id } })).toBe(
        2,
      );
      expect(good.id).toBeDefined();
    });

    it('two runs finishing at the same moment still leave exactly one current analysis', async () => {
      const s = await service.createSession('PETITION', alice);
      await service.addPage(s.id, file('a'), alice);
      const fp = await service.currentFingerprint(s.id);
      await Promise.all([
        service.publishAnalysis(s.id, analysisFor(fp, 1, 'one'), alice),
        service.publishAnalysis(s.id, analysisFor(fp, 1, 'two'), alice),
        service.publishAnalysis(s.id, analysisFor(fp, 1, 'three'), alice),
      ]);
      expect(
        await db.ocrAnalysis.count({
          where: { sessionId: s.id, isCurrent: true },
        }),
      ).toBe(1);
      expect(await db.ocrAnalysis.count({ where: { sessionId: s.id } })).toBe(
        3,
      );
    });
  });

  describe('purging expired sessions', () => {
    it('removes expired OPEN sessions with their rows and reports the files to delete; keeps BOUND and live ones', async () => {
      const expired = await service.createSession('PETITION', alice);
      const live = await service.createSession('PETITION', alice);
      const bound = await service.createSession('PETITION', alice);
      await service.addPage(expired.id, file('e'), alice);
      await service.addPage(live.id, file('l'), alice);
      await service.addPage(bound.id, file('b'), alice);

      const past = new Date(Date.now() - 1000);
      await db.ocrSession.update({
        where: { id: expired.id },
        data: { expiresAt: past },
      });
      await db.ocrSession.update({
        where: { id: bound.id },
        data: {
          expiresAt: past,
          status: 'BOUND',
          boundRecordId: 'rec-1',
          boundAt: new Date(),
        },
      });

      const purged = await service.purgeExpired(new Date());
      expect(purged.files).toEqual([`uploads/ocr/${tag}/e.png`]);
      expect(
        await db.ocrSession.findUnique({ where: { id: expired.id } }),
      ).toBeNull();
      expect(await db.ocrPage.count({ where: { sessionId: expired.id } })).toBe(
        0,
      );
      expect(
        await db.ocrSession.findUnique({ where: { id: bound.id } }),
      ).not.toBeNull();
      expect(
        await db.ocrSession.findUnique({ where: { id: live.id } }),
      ).not.toBeNull();
    });
  });

  describe('consistent reads and model readings', () => {
    it('a snapshot gives the fingerprint and the text of the same moment', async () => {
      const s = await service.createSession('PETITION', alice);
      const { page } = await service.addPage(s.id, file('snap'), alice);
      await service.saveTranscript(
        s.id,
        page.id,
        { text: 'văn bản', source: 'OFFICER' },
        alice,
      );
      const snap = await service.snapshotForAnalysis(s.id, alice);
      expect(snap.fingerprint).toBe(await service.currentFingerprint(s.id));
      expect(snap.pages).toEqual([{ pageId: page.id, text: 'văn bản' }]);
    });

    it('stores a model reading of every page together, when the input is still the one it was read from', async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('ra'), alice);
      const b = await service.addPage(s.id, file('rb'), alice);
      const fp = await service.currentFingerprint(s.id);
      await service.saveModelReadings(
        s.id,
        fp,
        [
          {
            pageId: a.page.id,
            text: 'A',
            pageKind: 'COMPLAINT',
            promptVersion: 'v1',
          },
          {
            pageId: b.page.id,
            text: 'B',
            pageKind: 'OTHER',
            promptVersion: 'v1',
          },
        ],
        alice,
      );
      const latest = await service.latestTranscripts(s.id, alice);
      expect(latest[a.page.id]).toMatchObject({ text: 'A', source: 'MODEL' });
      expect(latest[b.page.id]).toMatchObject({ text: 'B', source: 'MODEL' });
    });

    it("refuses to bury an officer's correction under a reading that started before it", async () => {
      const s = await service.createSession('PETITION', alice);
      const a = await service.addPage(s.id, file('ca'), alice);
      const fp = await service.currentFingerprint(s.id);
      await service.saveTranscript(
        s.id,
        a.page.id,
        { text: 'cán bộ sửa', source: 'OFFICER' },
        alice,
      );

      await expect(
        service.saveModelReadings(
          s.id,
          fp,
          [
            {
              pageId: a.page.id,
              text: 'máy đọc',
              pageKind: 'OTHER',
              promptVersion: 'v1',
            },
          ],
          alice,
        ),
      ).rejects.toMatchObject({ response: { code: 'OCR_INPUT_CHANGED' } });
      expect(
        (await service.latestTranscripts(s.id, alice))[a.page.id].text,
      ).toBe('cán bộ sửa');
    });
  });

  describe('purging while a save binds the session', () => {
    it('never reports the files of a session that got bound after it was listed as expired', async () => {
      const s = await service.createSession('PETITION', alice);
      await service.addPage(s.id, file('race'), alice);
      await db.ocrSession.update({
        where: { id: s.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      // The officer's Save lands between the purge listing the session and deleting it.
      const original = db.ocrSession.findMany.bind(db.ocrSession);
      const spy = jest
        .spyOn(db.ocrSession, 'findMany')
        .mockImplementationOnce(((args: never) => {
          const listed = original(args) as Promise<unknown>;
          return listed.then(async (rows) => {
            await db.ocrSession.update({
              where: { id: s.id },
              data: {
                status: 'BOUND',
                boundRecordId: 'rec-9',
                boundAt: new Date(),
              },
            });
            return rows;
          });
        }) as never);

      const purged = await service.purgeExpired(new Date());
      spy.mockRestore();

      expect(purged).toEqual({ files: [], sessions: 0 });
      expect(
        await db.ocrSession.findUnique({ where: { id: s.id } }),
      ).not.toBeNull();
    });
  });

  describe('database rules', () => {
    it('a BOUND session without a record is rejected by the database', async () => {
      const s = await service.createSession('PETITION', alice);
      await expect(
        db.ocrSession.update({
          where: { id: s.id },
          data: { status: 'BOUND' },
        }),
      ).rejects.toThrow();
    });
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import { OcrJobQueue } from './jobs/ocr-job-queue';
import { OcrImportController } from './ocr-import.controller';
import { OcrIntakeService } from './ocr-intake.service';
import { OcrSessionsService } from './sessions/ocr-sessions.service';

const signedIn = {
  canActivate: (context: {
    switchToHttp(): { getRequest(): { user?: unknown } };
  }) => {
    context.switchToHttp().getRequest().user = {
      id: 'u1',
      email: 'u@x',
      role: 'OFFICER',
      roleId: 'role-1',
    };
    return true;
  },
};

describe('OcrImportController (HTTP)', () => {
  let app: INestApplication;
  const sessions = {
    getSession: jest.fn(),
    listPages: jest.fn(),
    reorderPages: jest.fn(),
    removePage: jest.fn(),
    cancel: jest.fn(),
    saveTranscript: jest.fn(),
    latestTranscripts: jest.fn(),
    currentAnalysis: jest.fn(),
  };
  const queue = { latestJob: jest.fn(), getJob: jest.fn() };
  const intake = {
    openSession: jest.fn(),
    uploadPage: jest.fn(),
    requestRead: jest.fn(),
    pageImage: jest.fn(),
  };
  const actor = { id: 'u1' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OcrImportController],
      providers: [
        { provide: OcrSessionsService, useValue: sessions },
        { provide: OcrJobQueue, useValue: queue },
        { provide: OcrIntakeService, useValue: intake },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(signedIn)
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    for (const group of [sessions, queue, intake]) {
      Object.values(group).forEach((fn) => fn.mockReset());
    }
  });
  afterAll(async () => {
    await app.close();
  });

  it('opens a session for the kind of record the open screen creates', async () => {
    intake.openSession.mockResolvedValue({ id: 's1', entity: 'PETITION' });
    const res = await request(app.getHttpServer())
      .post('/ocr/sessions')
      .send({ entity: 'PETITION' })
      .expect(201);
    expect(res.body).toMatchObject({ id: 's1' });
    expect(intake.openSession).toHaveBeenCalledWith(
      'PETITION',
      expect.objectContaining({ id: 'u1' }),
    );
  });

  it('refuses an unknown kind of record and any extra field', async () => {
    await request(app.getHttpServer())
      .post('/ocr/sessions')
      .send({ entity: 'USER' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/ocr/sessions')
      .send({ entity: 'CASE', createdById: 'someone-else' })
      .expect(400);
    expect(intake.openSession).not.toHaveBeenCalled();
  });

  it('uploads one scan per request and passes its raw bytes on', async () => {
    intake.uploadPage.mockResolvedValue({
      page: { id: 'p1' },
      pageSetRevision: 1,
    });
    const res = await request(app.getHttpServer())
      .post('/ocr/sessions/s1/pages')
      .attach('file', Buffer.from('raw-bytes'), 'scan.jpg')
      .expect(201);
    expect(res.body).toEqual({ page: { id: 'p1' }, pageSetRevision: 1 });
    const [sessionId, bytes, user] = intake.uploadPage.mock.calls[0] as [
      string,
      Buffer,
      { id: string },
    ];
    expect(sessionId).toBe('s1');
    expect(bytes.equals(Buffer.from('raw-bytes'))).toBe(true);
    expect(user.id).toBe('u1');
  });

  it('refuses an upload without a file', async () => {
    await request(app.getHttpServer())
      .post('/ocr/sessions/s1/pages')
      .field('note', 'x')
      .expect(400);
    expect(intake.uploadPage).not.toHaveBeenCalled();
  });

  it('refuses a file over 20 MB with a 413', async () => {
    await request(app.getHttpServer())
      .post('/ocr/sessions/s1/pages')
      .attach('file', Buffer.alloc(20 * 1024 * 1024 + 1), 'big.jpg')
      .expect(413);
    expect(intake.uploadPage).not.toHaveBeenCalled();
  });

  it('shows a session with its pages and its latest job', async () => {
    sessions.getSession.mockResolvedValue({ id: 's1', status: 'OPEN' });
    sessions.listPages.mockResolvedValue([{ id: 'p1' }]);
    queue.latestJob.mockResolvedValue({
      id: 'j1',
      kind: 'READ',
      state: 'RUNNING',
      attempts: 1,
      lastErrorCode: null,
      createdAt: new Date('2026-11-03T00:00:00Z'),
      finishedAt: null,
      createdById: 'u1',
      inputFingerprint: 'secret-ish',
    });
    const res = await request(app.getHttpServer())
      .get('/ocr/sessions/s1')
      .expect(200);
    const body = res.body as Record<string, unknown>;
    expect(body.session).toEqual({ id: 's1', status: 'OPEN' });
    expect(body.pages).toEqual([{ id: 'p1' }]);
    // Only what the screen needs: no fingerprint, no owner.
    expect(body.job).toEqual({
      id: 'j1',
      kind: 'READ',
      state: 'RUNNING',
      attempts: 1,
      lastErrorCode: null,
      createdAt: '2026-11-03T00:00:00.000Z',
      finishedAt: null,
    });
    expect(sessions.getSession).toHaveBeenCalledWith('s1', actor);
  });

  it('reorders and removes pages as the signed-in user', async () => {
    sessions.reorderPages.mockResolvedValue({ pageSetRevision: 2 });
    sessions.removePage.mockResolvedValue({ pageSetRevision: 3 });
    await request(app.getHttpServer())
      .put('/ocr/sessions/s1/pages/order')
      .send({ pageIds: ['b', 'a'] })
      .expect(200);
    expect(sessions.reorderPages).toHaveBeenCalledWith('s1', ['b', 'a'], actor);
    await request(app.getHttpServer())
      .delete('/ocr/sessions/s1/pages/p1')
      .expect(200);
    expect(sessions.removePage).toHaveBeenCalledWith('s1', 'p1', actor);
    await request(app.getHttpServer())
      .put('/ocr/sessions/s1/pages/order')
      .send({ pageIds: 'nope' })
      .expect(400);
  });

  it("saves the officer's correction of a page's text as the officer's, whatever the body says", async () => {
    sessions.saveTranscript.mockResolvedValue({ revision: 2 });
    await request(app.getHttpServer())
      .put('/ocr/sessions/s1/pages/p1/transcript')
      .send({ text: 'đã sửa' })
      .expect(200);
    expect(sessions.saveTranscript).toHaveBeenCalledWith(
      's1',
      'p1',
      { text: 'đã sửa', source: 'OFFICER' },
      actor,
    );
    await request(app.getHttpServer())
      .put('/ocr/sessions/s1/pages/p1/transcript')
      .send({ text: 'x', source: 'MODEL' })
      .expect(400);
  });

  it('queues a reading and answers 202 with the job to poll', async () => {
    intake.requestRead.mockResolvedValue({ id: 'j1', deduplicated: false });
    const res = await request(app.getHttpServer())
      .post('/ocr/sessions/s1/read')
      .send({ mode: 'ANALYSE' })
      .expect(202);
    expect(res.body).toEqual({ id: 'j1', deduplicated: false });
    expect(intake.requestRead).toHaveBeenCalledWith(
      's1',
      'ANALYSE',
      expect.objectContaining({ id: 'u1' }),
    );
    await request(app.getHttpServer())
      .post('/ocr/sessions/s1/read')
      .send({ mode: 'DELETE_EVERYTHING' })
      .expect(400);
  });

  it('returns the analysis the form is filled from, without the raw model output', async () => {
    sessions.currentAnalysis.mockResolvedValue({
      id: 'a1',
      entity: 'PETITION',
      pageSetRevision: 2,
      inputFingerprint: 'fp',
      bundle: { raw: true },
      cleaned: { ok: 1 },
      issues: [],
      projection: { fields: {} },
      promptVersions: { analyse: 'v1' },
      isCurrent: true,
    });
    const res = await request(app.getHttpServer())
      .get('/ocr/sessions/s1/analysis')
      .expect(200);
    expect((res.body as Record<string, unknown>).analysis).toMatchObject({
      id: 'a1',
      cleaned: { ok: 1 },
      issues: [],
      projection: { fields: {} },
    });
    expect(JSON.stringify(res.body)).not.toContain('"raw"');
  });

  it('answers null analysis while the input has moved on since the last one', async () => {
    sessions.currentAnalysis.mockResolvedValue(null);
    const res = await request(app.getHttpServer())
      .get('/ocr/sessions/s1/analysis')
      .expect(200);
    expect(res.body).toEqual({ analysis: null });
  });

  it('serves a page image with its type, never cached', async () => {
    intake.pageImage.mockResolvedValue({
      bytes: Buffer.from('jpegbytes'),
      mimeType: 'image/jpeg',
    });
    const res = await request(app.getHttpServer())
      .get('/ocr/sessions/s1/pages/p1/image')
      .expect(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('cancels a session', async () => {
    sessions.cancel.mockResolvedValue(undefined);
    await request(app.getHttpServer()).delete('/ocr/sessions/s1').expect(204);
    expect(sessions.cancel).toHaveBeenCalledWith('s1', actor);
  });
});

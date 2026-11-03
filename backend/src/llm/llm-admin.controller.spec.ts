import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import { LlmAdminController } from './llm-admin.controller';
import { LlmKeyService } from './llm-key.service';
import { LlmProvidersService } from './llm-providers.service';

const allow = {
  canActivate: (context: {
    switchToHttp(): { getRequest(): { user?: unknown } };
  }) => {
    context.switchToHttp().getRequest().user = {
      id: 'admin-1',
      email: 'a@x',
      role: 'ADMIN',
      roleId: 'r',
    };
    return true;
  },
};

const validBody = {
  kind: 'ANTHROPIC',
  label: 'Claude Haiku',
  model: 'claude-haiku-5-5',
  apiKey: 'sk-ant-1234567890',
};

describe('LlmAdminController (HTTP)', () => {
  let app: INestApplication;
  const providers = {
    list: jest.fn(),
    create: jest.fn(),
    testDraft: jest.fn(),
    update: jest.fn(),
    test: jest.fn(),
    setRole: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    remove: jest.fn(),
    activeAssessment: jest.fn(),
    createAssessment: jest.fn(),
    withdrawAssessment: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LlmAdminController],
      providers: [
        { provide: LlmProvidersService, useValue: providers },
        { provide: LlmKeyService, useValue: { isConfigured: () => true } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allow)
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    // Same pipe as main.ts: unknown keys are rejected, not silently dropped.
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
    Object.values(providers).forEach((fn) => fn.mockReset());
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a provider and hands the service the signed-in user, not a value from the body', async () => {
    providers.create.mockResolvedValue({ id: 'p1' });
    await request(app.getHttpServer())
      .post('/llm/providers')
      .send(validBody)
      .expect(201);
    const [, actor] = providers.create.mock.calls[0] as [
      unknown,
      { id: string },
    ];
    expect(actor.id).toBe('admin-1');
  });

  it('rejects an unknown field such as createdById instead of dropping it silently', async () => {
    const res = await request(app.getHttpServer())
      .post('/llm/providers')
      .send({ ...validBody, createdById: 'someone-else' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('createdById');
    expect(providers.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown kind and a missing key', async () => {
    await request(app.getHttpServer())
      .post('/llm/providers')
      .send({ ...validBody, kind: 'MYSTERY' })
      .expect(400);
    const withoutKey: Record<string, unknown> = { ...validBody };
    delete withoutKey.apiKey;
    await request(app.getHttpServer())
      .post('/llm/providers')
      .send(withoutKey)
      .expect(400);
  });

  it('does not let the kind be changed on update', async () => {
    await request(app.getHttpServer())
      .patch('/llm/providers/p1')
      .send({ kind: 'GEMINI' })
      .expect(400);
    expect(providers.update).not.toHaveBeenCalled();
  });

  it('routes test-draft to the draft test, not to the per-id test', async () => {
    providers.testDraft.mockResolvedValue({ ok: true, steps: [] });
    await request(app.getHttpServer())
      .post('/llm/providers/test-draft')
      .send(validBody)
      .expect(200);
    expect(providers.testDraft).toHaveBeenCalledTimes(1);
    expect(providers.test).not.toHaveBeenCalled();
  });

  it('tests a saved provider by id', async () => {
    providers.test.mockResolvedValue({ ok: true, steps: [] });
    await request(app.getHttpServer())
      .post('/llm/providers/p1/test')
      .expect(200);
    const [id] = providers.test.mock.calls[0] as [string];
    expect(id).toBe('p1');
  });

  it('validates the role change', async () => {
    providers.setRole.mockResolvedValue({ id: 'p1', role: 'PRIMARY' });
    await request(app.getHttpServer())
      .post('/llm/providers/p1/role')
      .send({ role: 'PRIMARY' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/llm/providers/p1/role')
      .send({ role: 'BOSS' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/llm/providers/p1/role')
      .send({ role: 'FALLBACK', fallbackOrder: 0 })
      .expect(400);
  });

  it('answers 204 with no body when deleting', async () => {
    providers.remove.mockResolvedValue(undefined);
    const res = await request(app.getHttpServer())
      .delete('/llm/providers/p1')
      .expect(204);
    expect(res.text).toBe('');
  });

  it('files and withdraws a transfer assessment', async () => {
    providers.createAssessment.mockResolvedValue({ id: 'a1' });
    await request(app.getHttpServer())
      .post('/llm/transfer-assessment')
      .send({ fileNumber: 'DGTD-01', filedAt: '2026-11-01' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/llm/transfer-assessment')
      .send({ fileNumber: 'DGTD-01', filedAt: 'not a date' })
      .expect(400);
    providers.withdrawAssessment.mockResolvedValue({ providersStopped: 1 });
    const res = await request(app.getHttpServer())
      .post('/llm/transfer-assessment/withdraw')
      .expect(200);
    expect(res.body).toEqual({ providersStopped: 1 });
  });

  it('reports whether keys can be stored and which assessment is in force', async () => {
    providers.activeAssessment.mockResolvedValue({ id: 'a1' });
    const res = await request(app.getHttpServer())
      .get('/llm/status')
      .expect(200);
    expect(res.body).toEqual({ keyConfigured: true, assessment: { id: 'a1' } });
  });
});

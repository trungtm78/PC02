// Regression: ISSUE-001 — PUT /notification-preferences/:type accepted any string without enum validation,
// causing Prisma to throw 500. ParseEnumPipe now returns 400 for invalid values.
// Found by /qa on 2026-05-27
// Report: .gstack/qa-reports/qa-report-feat-notification-center-2026-05-27.md

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationType } from '@prisma/client';

const mockService = {
  getPreferences: jest.fn(),
  upsertPreference: jest.fn(),
  resetPreferences: jest.fn(),
};

const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

describe('NotificationPreferencesController — enum validation (ISSUE-001 regression)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        { provide: NotificationPreferencesService, useValue: mockService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = mockUser; return true; } })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('returns 400 for an invalid NotificationType param (e.g. INVALID_TYPE)', async () => {
    const res = await supertest(app.getHttpServer())
      .put('/notification-preferences/INVALID_TYPE')
      .send({ inApp: true, push: false });
    expect(res.status).toBe(400);
  });

  it('returns 200 for a valid NotificationType param (CASE_ASSIGNED)', async () => {
    mockService.upsertPreference.mockResolvedValue({
      success: true,
      data: { userId: mockUser.id, eventType: NotificationType.CASE_ASSIGNED, inApp: true, push: false },
    });
    const res = await supertest(app.getHttpServer())
      .put(`/notification-preferences/${NotificationType.CASE_ASSIGNED}`)
      .send({ inApp: true, push: false });
    expect(res.status).toBe(200);
    expect(mockService.upsertPreference).toHaveBeenCalledWith(
      mockUser.id, NotificationType.CASE_ASSIGNED, { inApp: true, push: false },
    );
  });

  it('does NOT call service when enum param is invalid (prevents Prisma 500)', async () => {
    await supertest(app.getHttpServer())
      .put('/notification-preferences/NOT_A_REAL_TYPE')
      .send({ inApp: true, push: true });
    expect(mockService.upsertPreference).not.toHaveBeenCalled();
  });
});

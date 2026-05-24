/**
 * CasesController — Journey endpoint tests
 *
 * TDD Cycle 2 RED — tests verify the controller delegates to CasesJourneyService.
 *
 * TC-J08: GET /cases/:id/journey returns 200 with journey data
 * TC-J09: ForbiddenException propagated from service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CasesJourneyService } from './cases-journey.service';

const mockJourneyResult = {
  success: true,
  data: {
    events: [],
    total: 0,
    hasNextPage: false,
    page: 1,
    limit: 50,
  },
};

const mockCasesService = {
  getList: jest.fn(),
  getById: jest.fn(),
  getStatusHistory: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  tdcBackfill: jest.fn(),
  assignCase: jest.fn(),
};

const mockJourneyService = {
  getJourney: jest.fn(),
};

const makeReq = () => ({
  ip: '127.0.0.1',
  headers: { 'user-agent': 'jest-test' },
  user: { id: 'user-001', email: 'test@pc02.local', role: 'OFFICER' },
  dataScope: { teamIds: ['team-001'], userIds: ['user-001'], canDispatch: false },
});

const mockUser = { id: 'user-001', email: 'test@pc02.local', role: 'OFFICER', roleId: 'role-001' };

describe('CasesController — journey endpoint', () => {
  let controller: CasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesController],
      providers: [
        { provide: CasesService, useValue: mockCasesService },
        { provide: CasesJourneyService, useValue: mockJourneyService },
      ],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../auth/guards/permissions.guard').PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CasesController>(CasesController);
    jest.clearAllMocks();
  });

  // ── TC-J08 ──────────────────────────────────────────────────────────────────

  it('TC-J08: getJourney() delegates to journeyService with caseId, userId, dataScope, page, limit', async () => {
    mockJourneyService.getJourney.mockResolvedValue(mockJourneyResult);
    const req = makeReq();

    const result = await controller.getJourney('case-001', mockUser as any, req as any, 1, 50);

    expect(mockJourneyService.getJourney).toHaveBeenCalledWith(
      'case-001',
      mockUser.id,
      req.dataScope,
      1,
      50,
    );
    expect(result).toEqual(mockJourneyResult);
  });

  // ── TC-J09 ──────────────────────────────────────────────────────────────────

  it('TC-J09: getJourney() propagates ForbiddenException when service throws', async () => {
    mockJourneyService.getJourney.mockRejectedValue(
      new ForbiddenException('Bạn không có quyền truy cập bản ghi này'),
    );
    const req = makeReq();

    await expect(
      controller.getJourney('case-001', mockUser as any, req as any, 1, 50),
    ).rejects.toThrow(ForbiddenException);
  });
});

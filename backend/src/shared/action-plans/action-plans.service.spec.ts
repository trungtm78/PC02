/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * ActionPlansService Unit Tests
 *
 * createForCase:
 *   - throws NotFoundException when case does not exist
 *   - calls prisma.suspensionActionPlan.create with caseId set and incidentId=null
 *
 * createForIncident:
 *   - throws NotFoundException when incident does not exist
 *   - calls prisma.suspensionActionPlan.create with incidentId set and caseId=null
 *
 * findAllForCase:
 *   - calls prisma.suspensionActionPlan.findMany with caseId filter
 *   - returns empty array when no plans exist
 *
 * findAllForIncident:
 *   - calls prisma.suspensionActionPlan.findMany with incidentId filter
 *
 * delete:
 *   - throws NotFoundException when plan does not exist
 *   - calls prisma.suspensionActionPlan.delete when found
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { DataScope } from '../../auth/services/unit-scope.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  case: {
    findUnique: jest.fn(),
  },
  incident: {
    findUnique: jest.fn(),
  },
  suspensionActionPlan: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    delete: jest.fn(),
  },
};

const scopeTeamA: DataScope = {
  userIds: ['user-1'],
  teamIds: ['team-A'],
  writableTeamIds: ['team-A'],
  canDispatch: false,
};
const scopeTeamB: DataScope = {
  userIds: ['user-2'],
  teamIds: ['team-B'],
  writableTeamIds: ['team-B'],
  canDispatch: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    ngayLap: '2026-05-01',
    bienPhap: 'Biện pháp khắc phục A',
    thoiHan: '2026-06-01',
    ketQua: 'Đang xử lý',
    ...overrides,
  };
}

function makeActionPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    caseId: 'case-1',
    incidentId: null,
    ngayLap: new Date('2026-05-01'),
    bienPhap: 'Biện pháp khắc phục A',
    thoiHan: new Date('2026-06-01'),
    tienDo: 'DANG_THUC_HIEN',
    ketQua: null,
    createdById: 'user-1',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ActionPlansService', () => {
  let service: ActionPlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionPlansService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ActionPlansService>(ActionPlansService);
    jest.clearAllMocks();
    mockPrisma.case.findUnique.mockResolvedValue({ id: 'case-1' });
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'incident-1' });
    mockPrisma.suspensionActionPlan.findMany.mockResolvedValue([]);
    mockPrisma.suspensionActionPlan.findUnique.mockResolvedValue(null);
  });

  // ── createForCase ──────────────────────────────────────────────────────────

  describe('createForCase', () => {
    it('throws NotFoundException when case does not exist', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(
        service.createForCase('nonexistent-case', makeDto(), 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates plan with caseId set and incidentId=null', async () => {
      mockPrisma.suspensionActionPlan.create.mockResolvedValue(makeActionPlan());

      await service.createForCase('case-1', makeDto(), 'user-1');

      const callData = mockPrisma.suspensionActionPlan.create.mock.calls[0][0].data;
      expect(callData.caseId).toBe('case-1');
      expect(callData.incidentId).toBeNull();
      expect(callData.createdById).toBe('user-1');
    });
  });

  // ── createForIncident ──────────────────────────────────────────────────────

  describe('createForIncident', () => {
    it('throws NotFoundException when incident does not exist', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(null);

      await expect(
        service.createForIncident('nonexistent-incident', makeDto(), 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates plan with incidentId set and caseId=null', async () => {
      const plan = makeActionPlan({ caseId: null, incidentId: 'incident-1' });
      mockPrisma.suspensionActionPlan.create.mockResolvedValue(plan);

      await service.createForIncident('incident-1', makeDto(), 'user-1');

      const callData = mockPrisma.suspensionActionPlan.create.mock.calls[0][0].data;
      expect(callData.incidentId).toBe('incident-1');
      expect(callData.caseId).toBeNull();
    });
  });

  // ── findAllForCase ─────────────────────────────────────────────────────────

  describe('findAllForCase', () => {
    it('calls findMany with caseId filter and includes createdBy', async () => {
      await service.findAllForCase('case-1');

      expect(mockPrisma.suspensionActionPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { caseId: 'case-1' },
          include: expect.objectContaining({ createdBy: expect.any(Object) }),
        }),
      );
    });

    it('returns empty array when no action plans exist for the case', async () => {
      const result = await service.findAllForCase('case-1');
      expect(result).toEqual([]);
    });
  });

  // ── findAllForIncident ─────────────────────────────────────────────────────

  describe('findAllForIncident', () => {
    it('calls findMany with incidentId filter', async () => {
      await service.findAllForIncident('incident-1');

      expect(mockPrisma.suspensionActionPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { incidentId: 'incident-1' },
        }),
      );
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('throws NotFoundException when plan does not exist', async () => {
      mockPrisma.suspensionActionPlan.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent-plan')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.suspensionActionPlan.delete).not.toHaveBeenCalled();
    });

    it('calls prisma.suspensionActionPlan.delete when plan exists', async () => {
      const plan = makeActionPlan();
      mockPrisma.suspensionActionPlan.findUnique.mockResolvedValue({
        ...plan,
        case: { id: 'case-1', assignedTeamId: 'team-A', investigatorId: 'user-1' },
        incident: null,
      });
      mockPrisma.suspensionActionPlan.delete.mockResolvedValue(plan);

      await service.delete('plan-1', scopeTeamA);

      expect(mockPrisma.suspensionActionPlan.delete).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
    });
  });

  // ── DataScope enforcement (CSO finding F1/F2 — IDOR) ──────────────────────

  describe('DataScope enforcement', () => {
    const otherTeamCase = { id: 'case-1', assignedTeamId: 'team-B', investigatorId: 'user-2' };
    const otherTeamIncident = { id: 'incident-1', assignedTeamId: 'team-B', investigatorId: 'user-2' };

    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValue(otherTeamCase);
      mockPrisma.incident.findUnique.mockResolvedValue(otherTeamIncident);
    });

    it('createForCase: denies cross-team write', async () => {
      await expect(
        service.createForCase('case-1', makeDto(), 'user-1', scopeTeamA),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.suspensionActionPlan.create).not.toHaveBeenCalled();
    });

    it('createForIncident: denies cross-team write', async () => {
      await expect(
        service.createForIncident('incident-1', makeDto(), 'user-1', scopeTeamA),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.suspensionActionPlan.create).not.toHaveBeenCalled();
    });

    it('findAllForCase: denies cross-team read', async () => {
      await expect(service.findAllForCase('case-1', scopeTeamA)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.suspensionActionPlan.findMany).not.toHaveBeenCalled();
    });

    it('findAllForIncident: denies cross-team read', async () => {
      await expect(service.findAllForIncident('incident-1', scopeTeamA)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.suspensionActionPlan.findMany).not.toHaveBeenCalled();
    });

    it('delete: denies removing plan attached to cross-team case', async () => {
      mockPrisma.suspensionActionPlan.findUnique.mockResolvedValue({
        ...makeActionPlan(),
        case: otherTeamCase,
        incident: null,
      });
      await expect(service.delete('plan-1', scopeTeamA)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.suspensionActionPlan.delete).not.toHaveBeenCalled();
    });

    it('delete: denies removing plan attached to cross-team incident', async () => {
      mockPrisma.suspensionActionPlan.findUnique.mockResolvedValue({
        ...makeActionPlan({ caseId: null, incidentId: 'incident-1' }),
        case: null,
        incident: otherTeamIncident,
      });
      await expect(service.delete('plan-1', scopeTeamA)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.suspensionActionPlan.delete).not.toHaveBeenCalled();
    });

    it('null scope (admin) bypasses all checks', async () => {
      mockPrisma.suspensionActionPlan.create.mockResolvedValue(makeActionPlan());
      await expect(
        service.createForCase('case-1', makeDto(), 'admin-id', null),
      ).resolves.toBeDefined();
      expect(mockPrisma.suspensionActionPlan.create).toHaveBeenCalled();
    });

    it('matching team allows access', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-1', assignedTeamId: 'team-A', investigatorId: 'user-1',
      });
      mockPrisma.suspensionActionPlan.create.mockResolvedValue(makeActionPlan());
      await expect(
        service.createForCase('case-1', makeDto(), 'user-1', scopeTeamA),
      ).resolves.toBeDefined();
    });

    void scopeTeamB; // referenced for future cross-team test parameterization
  });
});

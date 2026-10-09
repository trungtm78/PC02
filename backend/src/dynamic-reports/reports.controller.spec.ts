import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { DynamicReportsRegistryService } from './reports.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * GET /bao-cao-dong/reports?mode=... (AC-012, AC-035). Unit test only wires
 * the controller to a mocked service — the guard chain (JwtAuthGuard,
 * FeatureFlagGuard, PermissionsGuard) is exercised by the route-permission
 * gate spec, not here; NestJS still needs their dependencies resolvable at
 * compile time (same workaround as clock.controller.spec.ts).
 */
describe('ReportsController', () => {
  let controller: ReportsController;
  const service = { listReports: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: DynamicReportsRegistryService, useValue: service },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get<ReportsController>(ReportsController);
  });

  it('delegates to the service with the current user and requested mode', () => {
    service.listReports.mockResolvedValue([]);
    const user = { id: 'u1', roleId: 'r1' };
    void controller.list({ mode: 'input' }, user);
    expect(service.listReports).toHaveBeenCalledWith(user, 'input');
  });

  it('returns whatever the service resolves', async () => {
    const reports = [{ id: 'rep1', code: 'HSLN' }];
    service.listReports.mockResolvedValue(reports);
    const result = await controller.list(
      { mode: 'manage' },
      { id: 'u1', roleId: 'r1' },
    );
    expect(result).toBe(reports);
  });
});

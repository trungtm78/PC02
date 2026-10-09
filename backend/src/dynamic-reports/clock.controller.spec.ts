import { Test, TestingModule } from '@nestjs/testing';
import { ClockController } from './clock.controller';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * GET /bao-cao-dong/clock — the single source of server time the client
 * trusts for deadline countdowns (spec §4.2). Intentionally NOT guarded by
 * PermissionsGuard (see clock.controller.ts): it reveals nothing sensitive,
 * so it only needs JwtAuthGuard + FeatureFlagGuard, declared at the
 * @Controller level alongside every other dynamic-reports route.
 */
describe('ClockController', () => {
  let controller: ClockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClockController],
      // NestJS resolves class-level @UseGuards dependencies at compile time
      // even though this unit test calls the handler directly and never
      // executes the guards — FeatureFlagGuard needs FeatureFlagsService.
      providers: [{ provide: FeatureFlagsService, useValue: {} }],
    }).compile();
    controller = module.get<ClockController>(ClockController);
  });

  it('returns the current server time as an ISO 8601 string', () => {
    const before = Date.now();
    const result = controller.getClock();
    const after = Date.now();
    const parsed = new Date(result.serverTime).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('serverTime matches ISO 8601 UTC format exactly (client parses it directly, no timezone ambiguity)', () => {
    const result = controller.getClock();
    expect(result.serverTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

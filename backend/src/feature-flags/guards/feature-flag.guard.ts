import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { FeatureFlagsService } from '../feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string | undefined>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Route not gated on a feature flag → allow.
    if (!flagKey) return true;

    // Guard này KHAI trong @UseGuards của controller, SAU JwtAuthGuard (cổng feature-flag.chan-that.spec.ts).
    // Không có user = bị đặt sai chỗ → 401 đồng nhất với JwtAuthGuard (khách không dò được cờ nào đang bật), KHÔNG cho
    // qua. Bản cũ là APP_GUARD: guard toàn cục chạy TRƯỚC JWT nên user luôn rỗng → luôn cho qua → tắt tính năng không
    // chặn được API (tồn đọng PR #217, sửa 19/09/2026).
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    if (!request.user) throw new UnauthorizedException();

    const enabled = await this.featureFlags.isEnabled(flagKey);
    if (!enabled) {
      // 404 (not 403) so disabled features look invisible to authenticated
      // clients too — but only authenticated clients can observe this.
      throw new NotFoundException();
    }
    return true;
  }
}

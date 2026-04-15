import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
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

    // Security: skip the flag check when the request is unauthenticated.
    // Otherwise an anonymous caller can probe which feature flags are
    // enabled by comparing 404 (disabled) vs 401 (enabled) responses,
    // and the response leaks out faster than the throttler's rate limit.
    // Returning true here hands control back to the next guard in the
    // chain (typically JwtAuthGuard) which will 401 uniformly regardless
    // of flag state. Decouples from APP_GUARD registration order.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!request.user) return true;

    const enabled = await this.featureFlags.isEnabled(flagKey);
    if (!enabled) {
      // 404 (not 403) so disabled features look invisible to authenticated
      // clients too — but only authenticated clients can observe this.
      throw new NotFoundException();
    }
    return true;
  }
}

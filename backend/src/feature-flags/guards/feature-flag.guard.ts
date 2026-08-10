import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { FeatureFlagsService } from '../feature-flags.service';
import { getManifest } from '../feature-registry';

/**
 * WIRE FORMAT — do not rename without shipping a mobile release first.
 *
 * Web (`lib/api.ts`) and mobile (`api_client.dart`) both branch on this string
 * to tell "feature switched off" apart from "record not found". An installed
 * APK carries its copy of it, so a rename here silently reverts those clients
 * to showing a raw 404.
 */
export const FEATURE_DISABLED_ERROR = 'FEATURE_DISABLED';

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
      // Status stays 404 — a disabled feature should not advertise itself with
      // a distinct status code, and only authenticated callers get this far.
      //
      // The body, however, has to be distinguishable. A bare 404 is
      // indistinguishable from "record not found", so every client showed the
      // wrong thing: the web app rendered a generic error, and the mobile app
      // surfaced `Lỗi: DioException ... 404` verbatim to an officer who had
      // done nothing wrong. `error: 'FEATURE_DISABLED'` is what lets both say
      // "this feature is switched off" instead of guessing.
      //
      // This is also the reason PR-M1 blocks the API-gating waves: turning a
      // flag off without it produces that Dio error string on installed apps,
      // and an installed app cannot be fixed by a redeploy.
      throw new NotFoundException({
        statusCode: 404,
        error: FEATURE_DISABLED_ERROR,
        feature: flagKey,
        message: `Tính năng "${getManifest(flagKey)?.label ?? flagKey}" hiện đang tắt`,
      });
    }
    return true;
  }
}

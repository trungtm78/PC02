import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'feature-flag';

/**
 * Gate a controller or route on a feature flag.
 * If the flag is disabled (or excluded from the current build pack),
 * the route returns 404 Not Found (as if it does not exist).
 *
 * Usage:
 *   @Controller('cases')
 *   @FeatureFlag('cases')
 *   export class CasesController { ... }
 */
export const FeatureFlag = (key: string) => SetMetadata(FEATURE_FLAG_KEY, key);

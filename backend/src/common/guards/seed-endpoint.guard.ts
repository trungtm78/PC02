import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_NAMES } from '../constants/role.constants';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

/**
 * Gate for the `seed` endpoints.
 *
 * These exist to populate reference data on a fresh install. They are not
 * day-to-day features: they write rows in bulk, some of them are slow, and
 * `POST /settings/seed` rewrites configuration that other code depends on.
 * Until now the only thing standing between them and any authenticated caller
 * was a permission that plenty of roles hold.
 *
 * Two conditions, both required:
 *
 *   1. `ALLOW_SEED_ENDPOINTS=true` in the environment. Absent on production,
 *      so the routes answer 403 there no matter who calls them.
 *   2. The caller is ADMIN. Even where seeding is enabled it is not an
 *      ordinary user's button.
 *
 * Deliberately NOT applied to `POST /address-mappings/seed/:id/cancel`:
 * cancelling a running job must stay available to whoever can see it stuck.
 */
@Injectable()
export class SeedEndpointGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.ALLOW_SEED_ENDPOINTS !== 'true') {
      throw new ForbiddenException(
        'Chức năng nạp dữ liệu mẫu đang tắt. Đặt ALLOW_SEED_ENDPOINTS=true trên môi trường cho phép.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: AuthUser }).user;
    if (user?.role !== ROLE_NAMES.ADMIN) {
      throw new ForbiddenException('Chỉ quản trị viên được nạp dữ liệu mẫu.');
    }

    return true;
  }
}

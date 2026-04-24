import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as AuthUser | undefined;
    return user?.id ?? (req['ip'] as string | undefined) ?? 'unknown';
  }
}

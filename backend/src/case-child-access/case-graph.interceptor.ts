import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { CaseChildAccessService } from './case-child-access.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
@Injectable()
export class CaseGraphPolicyInterceptor implements NestInterceptor {
  constructor(private readonly access: CaseChildAccessService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    return next
      .handle()
      .pipe(
        mergeMap((result: unknown) =>
          this.access.redactCaseLinks(result, request.user.id),
        ),
      );
  }
}

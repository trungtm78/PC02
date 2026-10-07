import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, mergeMap } from 'rxjs';
import { CaseGraphAccessService } from './case-graph-access.service';
@Injectable()
export class CaseGraphAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly access: CaseGraphAccessService,
    private readonly reflector: Reflector,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{
        user: { id: string };
        url: string;
        query: Record<string, unknown>;
        dataScope?: unknown;
      }>();
    const permissions =
      this.reflector.getAllAndOverride<{ subject: string; action: string }[]>(
        'permissions',
        [context.getHandler(), context.getClass()],
      ) ?? [];
    return new Observable((subscriber) =>
      this.access.run(
        request.user?.id,
        () => {
          void (async () => {
            await this.access.core.accessProfile(this.access['prisma'], {
              actorId: request.user?.id,
            });
            request.dataScope = await this.access.child.scope(request.user.id);
            for (const permission of permissions)
              await this.access.child.entity(
                permission.subject,
                permission.action,
                request.user.id,
              );
            const subscription = next
              .handle()
              .pipe(
                mergeMap((value) =>
                  this.access.child.redactCaseLinks(value, request.user.id),
                ),
              )
              .subscribe(subscriber);
            subscriber.add(() => subscription.unsubscribe());
          })().catch((error) => subscriber.error(error));
        },
        /export|workbook|download/i.test(request.url) ? 'export' : 'read',
        request.query,
      ),
    );
  }
}
